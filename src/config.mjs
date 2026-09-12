import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_COMMAND_TIMEOUT_MS,
  DEFAULT_HEALTH_PATH,
  DEFAULT_HOST,
  DEFAULT_MAX_READ_BYTES,
  DEFAULT_MCP_PATH,
  DEFAULT_PORT,
} from './constants.mjs';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = path.resolve(MODULE_DIR, '..');

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

export function loadConfig(overrides = {}) {
  const env = process.env;
  const configPath = path.resolve(overrides.configPath ?? env.SPARK_TRANSPORT_CONFIG ?? path.join(PROJECT_ROOT, 'config', 'spark-transport.local.json'));
  const file = readJsonIfExists(configPath);
  const daemon = file.daemon ?? {};
  const tunnel = file.tunnel ?? {};

  const root = overrides.root ?? env.SPARK_TRANSPORT_ROOT ?? daemon.allowedRoot;
  if (!root) throw new Error('allowed root is required: set daemon.allowedRoot in config or SPARK_TRANSPORT_ROOT');

  return {
    configPath,
    root: path.resolve(root),
    host: overrides.host ?? env.SPARK_TRANSPORT_HOST ?? daemon.host ?? DEFAULT_HOST,
    port: positiveInteger(overrides.port ?? env.SPARK_TRANSPORT_PORT ?? daemon.port, DEFAULT_PORT, 'port'),
    mcpPath: overrides.mcpPath ?? env.SPARK_TRANSPORT_MCP_PATH ?? daemon.mcpPath ?? DEFAULT_MCP_PATH,
    healthPath: overrides.healthPath ?? env.SPARK_TRANSPORT_HEALTH_PATH ?? daemon.healthPath ?? DEFAULT_HEALTH_PATH,
    maxReadBytes: positiveInteger(overrides.maxReadBytes ?? env.SPARK_TRANSPORT_MAX_READ_BYTES ?? daemon.maxReadBytes, DEFAULT_MAX_READ_BYTES, 'maxReadBytes'),
    commandTimeoutMs: positiveInteger(overrides.commandTimeoutMs ?? env.SPARK_TRANSPORT_COMMAND_TIMEOUT_MS ?? daemon.commandTimeoutMs, DEFAULT_COMMAND_TIMEOUT_MS, 'commandTimeoutMs'),
    stateDir: path.resolve(overrides.stateDir ?? env.SPARK_TRANSPORT_STATE_DIR ?? daemon.stateDir ?? path.join(PROJECT_ROOT, '.runtime')),
    recycleBin: daemon.recycleBin !== false,
    tunnel: {
      enabled: tunnel.enabled !== false,
      id: env.SPARK_TRANSPORT_TUNNEL_ID ?? tunnel.id ?? '',
      profile: tunnel.profile ?? 'spark-transport',
      localMcpUrl: tunnel.localMcpUrl ?? `http://127.0.0.1:${positiveInteger(daemon.port, DEFAULT_PORT, 'port')}${daemon.mcpPath ?? DEFAULT_MCP_PATH}`,
      clientVersion: tunnel.clientVersion ?? 'v0.0.14',
      clientDir: path.resolve(tunnel.clientDir ?? path.join(PROJECT_ROOT, 'tools', 'tunnel-client')),
    },
  };
}
