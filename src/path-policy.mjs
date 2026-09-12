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
  if (candidateNorm === rootNorm) return true;
  return candidateNorm.startsWith(rootNorm + path.sep);
}

function rejectUnsafeSyntax(input) {
  if (typeof input !== 'string') {
    throw new PolicyError('INVALID_PATH', 'path must be a string');
  }
  if (input.includes('\0')) {
    throw new PolicyError('INVALID_PATH', 'path contains a NUL byte');
  }
  if (path.isAbsolute(input) || path.win32.isAbsolute(input) || /^[A-Za-z]:/.test(input)) {
    throw new PolicyError('ABSOLUTE_PATH_NOT_ALLOWED', 'absolute paths are not allowed');
  }
  const parts = input.replaceAll('\\', '/').split('/');
  if (parts.includes('..')) {
    throw new PolicyError('PATH_TRAVERSAL', 'parent traversal is not allowed');
  }
}

export async function createPathPolicy(root) {
  const rootAbs = path.resolve(root);
  let rootReal;
  try {
    rootReal = await fs.realpath(rootAbs);
  } catch {
    throw new PolicyError('ROOT_NOT_FOUND', 'configured allowed root does not exist');
  }
  const stat = await fs.stat(rootReal);
  if (!stat.isDirectory()) {
    throw new PolicyError('ROOT_NOT_DIRECTORY', 'configured allowed root is not a directory');
  }

  async function resolveExisting(input = '.', expected = 'any') {
    rejectUnsafeSyntax(input);
    const relative = input === '' ? '.' : input;
    const lexical = path.resolve(rootReal, relative);
    if (!isInside(rootReal, lexical)) {
      throw new PolicyError('OUTSIDE_ALLOWED_ROOT', 'path is outside the allowed root');
    }

    let real;
    try {
      real = await fs.realpath(lexical);
    } catch (error) {
      if (error?.code === 'ENOENT') {
        throw new PolicyError('NOT_FOUND', 'path does not exist');
      }
      throw error;
    }
    if (!isInside(rootReal, real)) {
      throw new PolicyError('SYMLINK_ESCAPE', 'resolved path escapes the allowed root');
    }

    const info = await fs.stat(real);
    if (expected === 'file' && !info.isFile()) {
      throw new PolicyError('NOT_A_FILE', 'path is not a regular file');
    }
    if (expected === 'directory' && !info.isDirectory()) {
      throw new PolicyError('NOT_A_DIRECTORY', 'path is not a directory');
    }

    const displayPath = path.relative(rootReal, real) || '.';
    return { absolutePath: real, displayPath: displayPath.split(path.sep).join('/'), stat: info };
  }

  return {
    rootReal,
    resolveFile: (input) => resolveExisting(input, 'file'),
    resolveDirectory: (input = '.') => resolveExisting(input, 'directory'),
  };
}
