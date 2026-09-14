import fs from 'node:fs/promises';
import path from 'node:path';

export class PolicyError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'PolicyError';
    this.code = code;
  }
}

function normalizeCase(value) {
  return process.platform === 'win32' ? value.toLowerCase() : value;
}

function isInside(root, candidate) {
  const rootNorm = normalizeCase(path.resolve(root));
  const candidateNorm = normalizeCase(path.resolve(candidate));
  return candidateNorm === rootNorm || candidateNorm.startsWith(rootNorm + path.sep);
}

function isAbsoluteInput(input) {
  return path.isAbsolute(input) || path.win32.isAbsolute(input) || /^[A-Za-z]:/.test(input) || input.startsWith('\\\\');
}

function rejectUnsafeSyntax(input, { allowAbsolute = false } = {}) {
  if (typeof input !== 'string') throw new PolicyError('INVALID_PATH', 'path must be a string');
  if (input.includes('\0')) throw new PolicyError('INVALID_PATH', 'path contains a NUL byte');
  const parts = input.replaceAll('\\', '/').split('/');
  if (parts.includes('..')) throw new PolicyError('PATH_TRAVERSAL', 'parent traversal is not allowed');
  if (isAbsoluteInput(input) && !allowAbsolute) {
    throw new PolicyError('ABSOLUTE_PATH_NOT_ALLOWED', 'absolute paths are not allowed when only one allowed root is configured');
  }
}

function displayPath(rootReal, target, absoluteInput) {
  if (normalizeCase(path.resolve(target)) === normalizeCase(path.resolve(rootReal))) return '.';
  if (absoluteInput) return path.resolve(target).split(path.sep).join('/');
  const relative = path.relative(rootReal, target) || '.';
  return relative.split(path.sep).join('/');
}

function chooseRootForAbsolute(rootContexts, candidate) {
  const matches = rootContexts.filter(({ rootAbs, rootReal }) => isInside(rootAbs, candidate) || isInside(rootReal, candidate));
  if (matches.length === 0) throw new PolicyError('OUTSIDE_ALLOWED_ROOT', 'absolute path is outside configured allowed roots');
  return matches.sort((a, b) => Math.max(b.rootAbs.length, b.rootReal.length) - Math.max(a.rootAbs.length, a.rootReal.length))[0];
}

async function realpathParentInside(rootReal, lexical) {
  let cursor = lexical;
  const missing = [];
  while (true) {
    try {
      const real = await fs.realpath(cursor);
      if (!isInside(rootReal, real)) throw new PolicyError('SYMLINK_ESCAPE', 'resolved path escapes the selected allowed root');
      return { existingReal: real, missing };
    } catch (error) {
      if (error instanceof PolicyError) throw error;
      if (error?.code !== 'ENOENT') throw error;
      const parent = path.dirname(cursor);
      if (parent === cursor) throw new PolicyError('OUTSIDE_ALLOWED_ROOT', 'path is outside the selected allowed root');
      missing.unshift(path.basename(cursor));
      cursor = parent;
    }
  }
}

export async function createPathPolicy(rootOrRoots) {
  const configured = Array.isArray(rootOrRoots) ? rootOrRoots : [rootOrRoots];
  if (configured.length === 0) throw new PolicyError('ROOT_NOT_FOUND', 'at least one configured allowed root is required');

  const rootContexts = [];
  const seen = new Set();
  for (const configuredRoot of configured) {
    const rootAbs = path.resolve(configuredRoot);
    let rootReal;
    try { rootReal = await fs.realpath(rootAbs); }
    catch { throw new PolicyError('ROOT_NOT_FOUND', `configured allowed root does not exist: ${rootAbs}`); }
    const stat = await fs.stat(rootReal);
    if (!stat.isDirectory()) throw new PolicyError('ROOT_NOT_DIRECTORY', `configured allowed root is not a directory: ${rootAbs}`);
    const key = normalizeCase(rootReal);
    if (seen.has(key)) throw new PolicyError('DUPLICATE_ROOT', `configured allowed root is duplicated: ${rootAbs}`);
    seen.add(key);
    rootContexts.push({ rootAbs, rootReal });
  }
  const rootReals = rootContexts.map(({ rootReal }) => rootReal);

  function lexicalPath(input = '.') {
    const allowAbsolute = rootContexts.length > 1;
    rejectUnsafeSyntax(input, { allowAbsolute });
    const absoluteInput = isAbsoluteInput(input);
    if (absoluteInput) {
      const lexical = path.resolve(input);
      const context = chooseRootForAbsolute(rootContexts, lexical);
      return { lexical, rootReal: context.rootReal, absoluteInput };
    }

    const relative = input === '' ? '.' : input;
    const rootReal = rootContexts[0].rootReal;
    const lexical = path.resolve(rootReal, relative);
    if (!isInside(rootReal, lexical)) throw new PolicyError('OUTSIDE_ALLOWED_ROOT', 'path is outside the primary allowed root');
    return { lexical, rootReal, absoluteInput: false };
  }

  async function resolveExisting(input = '.', expected = 'any') {
    const context = lexicalPath(input);
    let real;
    try { real = await fs.realpath(context.lexical); }
    catch (error) {
      if (error?.code === 'ENOENT') throw new PolicyError('NOT_FOUND', 'path does not exist');
      throw error;
    }
    if (!isInside(context.rootReal, real)) throw new PolicyError('SYMLINK_ESCAPE', 'resolved path escapes the selected allowed root');
    const info = await fs.stat(real);
    if (expected === 'file' && !info.isFile()) throw new PolicyError('NOT_A_FILE', 'path is not a regular file');
    if (expected === 'directory' && !info.isDirectory()) throw new PolicyError('NOT_A_DIRECTORY', 'path is not a directory');
    return { absolutePath: real, displayPath: displayPath(context.rootReal, real, context.absoluteInput), stat: info };
  }

  async function resolveForCreate(input, { parentMustExist = true } = {}) {
    if (!input || input === '.') throw new PolicyError('INVALID_PATH', 'target path must not be root');
    const context = lexicalPath(input);
    const parent = path.dirname(context.lexical);
    let parentReal;
    try { parentReal = await fs.realpath(parent); }
    catch (error) {
      if (error?.code === 'ENOENT' && !parentMustExist) {
        const probe = await realpathParentInside(context.rootReal, parent);
        parentReal = path.join(probe.existingReal, ...probe.missing);
      } else if (error?.code === 'ENOENT') {
        throw new PolicyError('PARENT_NOT_FOUND', 'parent directory does not exist');
      } else throw error;
    }
    if (!isInside(context.rootReal, parentReal)) throw new PolicyError('SYMLINK_ESCAPE', 'parent resolves outside the selected allowed root');
    const target = path.join(parentReal, path.basename(context.lexical));
    if (!isInside(context.rootReal, target)) throw new PolicyError('OUTSIDE_ALLOWED_ROOT', 'path is outside the selected allowed root');
    return { absolutePath: target, displayPath: displayPath(context.rootReal, target, context.absoluteInput) };
  }

  async function resolveMutationEntry(input) {
    const context = lexicalPath(input);
    let lst;
    try { lst = await fs.lstat(context.lexical); }
    catch (error) {
      if (error?.code === 'ENOENT') throw new PolicyError('NOT_FOUND', 'path does not exist');
      throw error;
    }
    let real;
    try { real = await fs.realpath(context.lexical); }
    catch (error) {
      if (error?.code === 'ENOENT') throw new PolicyError('NOT_FOUND', 'path does not exist');
      throw error;
    }
    if (!isInside(context.rootReal, real)) throw new PolicyError('SYMLINK_ESCAPE', 'resolved path escapes the selected allowed root');
    if (lst.isSymbolicLink()) throw new PolicyError('SYMLINK_MUTATION_NOT_ALLOWED', 'mutating symbolic links/junctions is not allowed');
    return { absolutePath: context.lexical, displayPath: displayPath(context.rootReal, real, context.absoluteInput), stat: lst };
  }

  async function resolveCwd(input = '.') { return resolveExisting(input, 'directory'); }

  return {
    rootReal: rootReals[0],
    rootReals,
    resolveFile: (input) => resolveExisting(input, 'file'),
    resolveDirectory: (input = '.') => resolveExisting(input, 'directory'),
    resolveExisting,
    resolveForCreate,
    resolveMutationEntry,
    resolveCwd,
  };
}
