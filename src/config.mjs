import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_HEALTH_PATH,
  DEFAULT_HOST,
  DEFAULT_MAX_READ_BYTES,
  DEFAULT_MCP_PATH,
  DEFAULT_PORT,
} from './constants.mjs';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = path.resolve(MODULE_DIR, '..');

function positiveInteger(value, fallback, name) {
  if (value === undefined || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

export function loadConfig(overrides = {}) {
  const env = process.env;
  const root = overrides.root ?? env.SPARK_TRANSPORT_ROOT;
  if (!root) {
    throw new Error('SPARK_TRANSPORT_ROOT is required');
  }

  return {
    root: path.resolve(root),
    host: overrides.host ?? env.SPARK_TRANSPORT_HOST ?? DEFAULT_HOST,
    port: positiveInteger(overrides.port ?? env.SPARK_TRANSPORT_PORT, DEFAULT_PORT, 'port'),
    mcpPath: overrides.mcpPath ?? env.SPARK_TRANSPORT_MCP_PATH ?? DEFAULT_MCP_PATH,
    healthPath: overrides.healthPath ?? env.SPARK_TRANSPORT_HEALTH_PATH ?? DEFAULT_HEALTH_PATH,
    maxReadBytes: positiveInteger(
      overrides.maxReadBytes ?? env.SPARK_TRANSPORT_MAX_READ_BYTES,
      DEFAULT_MAX_READ_BYTES,
      'maxReadBytes',
    ),
    stateDir: path.resolve(overrides.stateDir ?? env.SPARK_TRANSPORT_STATE_DIR ?? path.join(PROJECT_ROOT, '.runtime')),
  };
}
