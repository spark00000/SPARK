import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_COMMAND_TIMEOUT_MS,
  DEFAULT_HEALTH_PATH,
  DEFAULT_HOST,
  DEFAULT_MAX_COMMAND_OUTPUT_BYTES,
  DEFAULT_MAX_READ_BYTES,
  DEFAULT_MCP_PATH,
  DEFAULT_PORT,
} from './constants.mjs';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
export const MODULE_ROOT = path.resolve(MODULE_DIR, '..');
export const PROJECT_ROOT = path.resolve(MODULE_DIR, '..', '..', '..');
export const MODULE_CONFIG_PATH = path.join(MODULE_ROOT, 'config', 'spark.local.json');
export const RUNTIME_CONFIG_PATH = path.join(PROJECT_ROOT, '.runtime', 'config', 'spark.local.json');
const ROOT_PERMISSION_ORDER = Object.freeze(['R', 'W', 'X']);

export function resolveConfigPath({ override, envPath, modulePath = MODULE_CONFIG_PATH, runtimePath = RUNTIME_CONFIG_PATH } = {}) {
  if (override) return path.resolve(override);
  if (envPath && fs.existsSync(envPath)) return path.resolve(envPath);
  if (fs.existsSync(modulePath)) return path.resolve(modulePath);
  return path.resolve(runtimePath);
}

function positiveInteger(value, fallback, name) {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error(`${name} must be a positive integer`);
  return parsed;
}

function readJsonIfExists(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') return {};
    throw new Error(`failed to read config ${filePath}: ${error.message}`);
  }
}

function defaultPrivateStateDir() {
  if (process.platform === 'win32') {
    const base = process.env.LOCALAPPDATA || process.env.APPDATA || os.homedir();
    return path.join(base, 'SPARK');
  }
  const base = process.env.XDG_STATE_HOME || path.join(os.homedir(), '.local', 'state');
  return path.join(base, 'SPARK');
}

function normalizeRootPermissions(value, index) {
  if (value === undefined || value === null || value === '') return 'RWX';
  if (typeof value !== 'string') throw new Error(`daemon.allowedRoot[${index}].permissions must be a string containing R, W and/or X`);
  const compact = value.toUpperCase().replace(/[\s,]+/g, '');
  if (!compact || /[^RWX]/.test(compact)) {
    throw new Error(`daemon.allowedRoot[${index}].permissions must contain only R, W and/or X`);
  }
  return ROOT_PERMISSION_ORDER.filter((permission) => compact.includes(permission)).join('');
}

function normalizeAllowedRoots(value) {
  const raw = Array.isArray(value) ? value : [value];
  if (raw.length === 0) throw new Error('daemon.allowedRoot must contain at least one path');

  const rootPolicies = raw.map((entry, index) => {
    if (typeof entry === 'string') {
      if (entry.trim() === '') throw new Error(`daemon.allowedRoot[${index}] must be a non-empty string path`);
      return { path: path.resolve(entry), permissions: 'RWX' };
    }
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error(`daemon.allowedRoot[${index}] must be a path string or { path, permissions } object`);
    }
    if (typeof entry.path !== 'string' || entry.path.trim() === '') {
      throw new Error(`daemon.allowedRoot[${index}].path must be a non-empty string path`);
    }
    return {
      path: path.resolve(entry.path),
      permissions: normalizeRootPermissions(entry.permissions, index),
    };
  });

  const seen = new Set();
  for (const rootPolicy of rootPolicies) {
    const key = process.platform === 'win32' ? rootPolicy.path.toLowerCase() : rootPolicy.path;
    if (seen.has(key)) throw new Error(`daemon.allowedRoot contains a duplicate path: ${rootPolicy.path}`);
    seen.add(key);
  }
  return rootPolicies;
}

export function loadConfig(overrides = {}) {
  const env = process.env;
  const configPath = resolveConfigPath({ override: overrides.configPath, envPath: env.SPARK_CONFIG });
  const file = readJsonIfExists(configPath);
  const daemon = file.daemon ?? {};
  const tunnel = file.tunnel ?? {};

  const configuredRoots = overrides.root ?? env.SPARK_ROOT ?? daemon.allowedRoot;
  if (!configuredRoots || (Array.isArray(configuredRoots) && configuredRoots.length === 0)) {
    throw new Error('allowed root is required: set daemon.allowedRoot in config or SPARK_ROOT');
  }
  const rootPolicies = normalizeAllowedRoots(configuredRoots);
  const roots = rootPolicies.map((entry) => entry.path);

  return {
    configPath,
    root: roots[0],
    roots,
    rootPolicies,
    host: overrides.host ?? env.SPARK_HOST ?? daemon.host ?? DEFAULT_HOST,
    port: positiveInteger(overrides.port ?? env.SPARK_PORT ?? daemon.port, DEFAULT_PORT, 'port'),
    mcpPath: overrides.mcpPath ?? env.SPARK_MCP_PATH ?? daemon.mcpPath ?? DEFAULT_MCP_PATH,
    healthPath: overrides.healthPath ?? env.SPARK_HEALTH_PATH ?? daemon.healthPath ?? DEFAULT_HEALTH_PATH,
    maxReadBytes: positiveInteger(overrides.maxReadBytes ?? env.SPARK_MAX_READ_BYTES ?? daemon.maxReadBytes, DEFAULT_MAX_READ_BYTES, 'maxReadBytes'),
    commandTimeoutMs: positiveInteger(overrides.commandTimeoutMs ?? env.SPARK_COMMAND_TIMEOUT_MS ?? daemon.commandTimeoutMs, DEFAULT_COMMAND_TIMEOUT_MS, 'commandTimeoutMs'),
    maxCommandOutputBytes: positiveInteger(overrides.maxCommandOutputBytes ?? env.SPARK_MAX_COMMAND_OUTPUT_BYTES ?? daemon.maxCommandOutputBytes, DEFAULT_MAX_COMMAND_OUTPUT_BYTES, 'maxCommandOutputBytes'),
    stateDir: path.resolve(overrides.stateDir ?? env.SPARK_STATE_DIR ?? daemon.stateDir ?? defaultPrivateStateDir()),
    recycleBin: daemon.recycleBin !== false,
    tunnel: {
      enabled: tunnel.enabled !== false,
      id: env.SPARK_TUNNEL_ID ?? tunnel.id ?? '',
      profile: tunnel.profile ?? 'spark',
      localMcpUrl: tunnel.localMcpUrl ?? `http://127.0.0.1:${positiveInteger(daemon.port, DEFAULT_PORT, 'port')}${daemon.mcpPath ?? DEFAULT_MCP_PATH}`,
      clientVersion: tunnel.clientVersion ?? 'v0.0.14',
      clientDir: path.resolve(tunnel.clientDir ?? path.join(PROJECT_ROOT, 'modules', 'transport', 'tools', 'tunnel-client')),
    },
  };
}
