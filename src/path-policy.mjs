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

function rejectUnsafeSyntax(input) {
  if (typeof input !== 'string') throw new PolicyError('INVALID_PATH', 'path must be a string');
  if (input.includes('\0')) throw new PolicyError('INVALID_PATH', 'path contains a NUL byte');
  if (path.isAbsolute(input) || path.win32.isAbsolute(input) || /^[A-Za-z]:/.test(input) || input.startsWith('\\\\')) {
    throw new PolicyError('ABSOLUTE_PATH_NOT_ALLOWED', 'absolute paths are not allowed');
  }
  const parts = input.replaceAll('\\', '/').split('/');
  if (parts.includes('..')) throw new PolicyError('PATH_TRAVERSAL', 'parent traversal is not allowed');
}

async function realpathParentInside(rootReal, lexical) {
  let cursor = lexical;
  const missing = [];
  while (true) {
    try {
      const real = await fs.realpath(cursor);
      if (!isInside(rootReal, real)) throw new PolicyError('SYMLINK_ESCAPE', 'resolved path escapes the allowed root');
      return { existingReal: real, missing };
    } catch (error) {
      if (error instanceof PolicyError) throw error;
      if (error?.code !== 'ENOENT') throw error;
      const parent = path.dirname(cursor);
      if (parent === cursor) throw new PolicyError('OUTSIDE_ALLOWED_ROOT', 'path is outside the allowed root');
      missing.unshift(path.basename(cursor));
      cursor = parent;
    }
  }
}

export async function createPathPolicy(root) {
  const rootAbs = path.resolve(root);
  let rootReal;
  try { rootReal = await fs.realpath(rootAbs); }
  catch { throw new PolicyError('ROOT_NOT_FOUND', 'configured allowed root does not exist'); }
  const stat = await fs.stat(rootReal);
  if (!stat.isDirectory()) throw new PolicyError('ROOT_NOT_DIRECTORY', 'configured allowed root is not a directory');

  function lexicalPath(input = '.') {
    rejectUnsafeSyntax(input);
    const relative = input === '' ? '.' : input;
    const lexical = path.resolve(rootReal, relative);
    if (!isInside(rootReal, lexical)) throw new PolicyError('OUTSIDE_ALLOWED_ROOT', 'path is outside the allowed root');
    return lexical;
  }

  async function resolveExisting(input = '.', expected = 'any') {
    const lexical = lexicalPath(input);
    let real;
    try { real = await fs.realpath(lexical); }
    catch (error) {
      if (error?.code === 'ENOENT') throw new PolicyError('NOT_FOUND', 'path does not exist');
      throw error;
    }
    if (!isInside(rootReal, real)) throw new PolicyError('SYMLINK_ESCAPE', 'resolved path escapes the allowed root');
    const info = await fs.stat(real);
    if (expected === 'file' && !info.isFile()) throw new PolicyError('NOT_A_FILE', 'path is not a regular file');
    if (expected === 'directory' && !info.isDirectory()) throw new PolicyError('NOT_A_DIRECTORY', 'path is not a directory');
    const displayPath = path.relative(rootReal, real) || '.';
    return { absolutePath: real, displayPath: displayPath.split(path.sep).join('/'), stat: info };
  }

  async function resolveForCreate(input, { parentMustExist = true } = {}) {
    if (!input || input === '.') throw new PolicyError('INVALID_PATH', 'target path must not be root');
    const lexical = lexicalPath(input);
    const parent = path.dirname(lexical);
    let parentReal;
    try { parentReal = await fs.realpath(parent); }
    catch (error) {
      if (error?.code === 'ENOENT' && !parentMustExist) {
        const probe = await realpathParentInside(rootReal, parent);
        parentReal = path.join(probe.existingReal, ...probe.missing);
      } else if (error?.code === 'ENOENT') {
        throw new PolicyError('PARENT_NOT_FOUND', 'parent directory does not exist');
      } else throw error;
    }
    if (!isInside(rootReal, parentReal)) throw new PolicyError('SYMLINK_ESCAPE', 'parent resolves outside the allowed root');
    const target = path.join(parentReal, path.basename(lexical));
    if (!isInside(rootReal, target)) throw new PolicyError('OUTSIDE_ALLOWED_ROOT', 'path is outside the allowed root');
    const displayPath = path.relative(rootReal, target) || '.';
    return { absolutePath: target, displayPath: displayPath.split(path.sep).join('/') };
  }

  async function resolveMutationEntry(input) {
    const lexical = lexicalPath(input);
    let lst;
    try { lst = await fs.lstat(lexical); }
    catch (error) {
      if (error?.code === 'ENOENT') throw new PolicyError('NOT_FOUND', 'path does not exist');
      throw error;
    }
    let real;
    try { real = await fs.realpath(lexical); }
    catch (error) {
      if (error?.code === 'ENOENT') throw new PolicyError('NOT_FOUND', 'path does not exist');
      throw error;
    }
    if (!isInside(rootReal, real)) throw new PolicyError('SYMLINK_ESCAPE', 'resolved path escapes the allowed root');
    if (lst.isSymbolicLink()) throw new PolicyError('SYMLINK_MUTATION_NOT_ALLOWED', 'mutating symbolic links/junctions is not allowed');
    const displayPath = path.relative(rootReal, lexical) || '.';
    return { absolutePath: lexical, displayPath: displayPath.split(path.sep).join('/'), stat: lst };
  }

  async function resolveCwd(input = '.') { return resolveExisting(input, 'directory'); }

  return {
    rootReal,
    resolveFile: (input) => resolveExisting(input, 'file'),
    resolveDirectory: (input = '.') => resolveExisting(input, 'directory'),
    resolveExisting,
    resolveForCreate,
    resolveMutationEntry,
    resolveCwd,
  };
}
