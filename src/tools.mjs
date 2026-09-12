import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { PolicyError } from './path-policy.mjs';

export const TOOL_DEFINITIONS = Object.freeze([
  {
    name: 'list_directory',
    title: 'List directory',
    description: 'List entries inside the configured SPARK_Transport allowed root. Paths are relative to the allowed root.',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Relative directory path inside the allowed root.',
          default: '.',
        },
      },
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  {
    name: 'read_file',
    title: 'Read file',
    description: 'Read a UTF-8 text file inside the configured SPARK_Transport allowed root. Paths are relative to the allowed root.',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          minLength: 1,
          description: 'Relative file path inside the allowed root.',
        },
      },
      required: ['path'],
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
]);

function errorShape(error) {
  if (error instanceof PolicyError) {
    return { code: error.code, message: error.message };
  }
  if (error?.code === 'EACCES' || error?.code === 'EPERM') {
    return { code: 'PERMISSION_DENIED', message: 'access was denied by the operating system' };
  }
  return { code: 'INTERNAL_ERROR', message: 'the operation failed' };
}

function validateOnlyKeys(obj, allowed) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
  return Object.keys(obj).every((key) => allowed.has(key));
}

export function createToolRuntime({ policy, maxReadBytes }) {
  async function readFile(argumentsValue) {
    if (!validateOnlyKeys(argumentsValue, new Set(['path'])) || typeof argumentsValue.path !== 'string' || argumentsValue.path.length === 0) {
      return { ok: false, error: { code: 'INVALID_ARGUMENTS', message: 'read_file requires a non-empty string path' } };
    }
    try {
      const resolved = await policy.resolveFile(argumentsValue.path);
      if (resolved.stat.size > maxReadBytes) {
        return {
          ok: false,
          error: {
            code: 'FILE_TOO_LARGE',
            message: `file exceeds the configured ${maxReadBytes} byte read limit`,
          },
        };
      }
      const bytes = await fs.readFile(resolved.absolutePath);
      let text;
      try {
        text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      } catch {
        return { ok: false, error: { code: 'UNSUPPORTED_ENCODING', message: 'Sprint-1 read_file supports UTF-8 text only' } };
      }
      return {
        ok: true,
        path: resolved.displayPath,
        type: 'file',
        encoding: 'utf-8',
        bytes: bytes.length,
        sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
        text,
      };
    } catch (error) {
      return { ok: false, error: errorShape(error) };
    }
  }

  async function listDirectory(argumentsValue = {}) {
    if (argumentsValue === undefined || argumentsValue === null) argumentsValue = {};
    if (!validateOnlyKeys(argumentsValue, new Set(['path']))) {
      return { ok: false, error: { code: 'INVALID_ARGUMENTS', message: 'list_directory accepts only the optional path argument' } };
    }
    const requestedPath = argumentsValue.path ?? '.';
    if (typeof requestedPath !== 'string') {
      return { ok: false, error: { code: 'INVALID_ARGUMENTS', message: 'path must be a string' } };
    }
    try {
      const resolved = await policy.resolveDirectory(requestedPath);
      const dirents = await fs.readdir(resolved.absolutePath, { withFileTypes: true });
      const entries = [];
      for (const dirent of dirents) {
        const absolute = path.join(resolved.absolutePath, dirent.name);
        let type = 'other';
        let size;
        try {
          const lst = await fs.lstat(absolute);
          if (lst.isSymbolicLink()) {
            type = 'symlink';
          } else if (lst.isDirectory()) {
            type = 'directory';
          } else if (lst.isFile()) {
            type = 'file';
            size = lst.size;
          }
        } catch {
          type = 'unavailable';
        }
        const base = resolved.displayPath === '.' ? '' : resolved.displayPath;
        const relativePath = [base, dirent.name].filter(Boolean).join('/');
        const item = { name: dirent.name, type, relativePath };
        if (size !== undefined) item.size = size;
        entries.push(item);
      }
      entries.sort((a, b) => a.name.localeCompare(b.name, 'en'));
      return { ok: true, path: resolved.displayPath, type: 'directory', entries };
    } catch (error) {
      return { ok: false, error: errorShape(error) };
    }
  }

  async function call(name, args) {
    if (name === 'read_file') return readFile(args);
    if (name === 'list_directory') return listDirectory(args);
    return { ok: false, error: { code: 'UNKNOWN_TOOL', message: `unknown tool: ${String(name)}` } };
  }

  return { call, readFile, listDirectory };
}
