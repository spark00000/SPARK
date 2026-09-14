const MUTATING_OPERATIONS = new Set([
  'create_file',
  'write_file',
  'modify_file',
  'create_directory',
  'copy_path',
  'move_path',
  'delete_path',
  'run_command',
]);

function operationTarget(name, args = {}) {
  if (typeof args.path === 'string') return args.path;
  if (typeof args.source === 'string' && typeof args.destination === 'string') return `${args.source} -> ${args.destination}`;
  if (name === 'run_command') return [args.command, ...(Array.isArray(args.args) ? args.args : [])].filter(Boolean).join(' ');
  return null;
}

function summaryFor(name, legacy) {
  if (legacy.ok === true) {
    if (name === 'list_directory') return `Listed ${legacy.entries?.length ?? 0} entries.`;
    if (name === 'read_file') return `Read ${legacy.path ?? 'file'}.`;
    if (name === 'run_command') return `Command completed with exit code ${legacy.exitCode ?? 0}.`;
    return `${name} completed.`;
  }
  return legacy.error?.message ?? `${name} failed.`;
}

function dataOnly(legacy) {
  const data = { ...legacy };
  delete data.ok;
  delete data.error;
  delete data.durationMs;
  return data;
}

export function createOperationRuntime({ toolRuntime, ledger }) {
  async function call(name, args = {}) {
    const operationId = ledger.nextOperationId();
    const startedAt = Date.now();
    let legacy;
    try {
      legacy = await toolRuntime.call(name, args);
    } catch {
      legacy = { ok: false, error: { code: 'INTERNAL_ERROR', message: 'the operation failed' } };
    }

    const durationMs = Number.isFinite(legacy.durationMs) ? legacy.durationMs : Date.now() - startedAt;
    const changed = legacy.ok === true && MUTATING_OPERATIONS.has(name);
    const error = legacy.ok === true ? undefined : {
      code: legacy.error?.code ?? 'INTERNAL_ERROR',
      message: legacy.error?.message ?? 'the operation failed',
      ...(legacy.error?.platformCode ? { platformCode: legacy.error.platformCode } : {}),
    };
    const requiresElevation = Boolean(error && ['EACCES', 'EPERM', 'PERMISSION_DENIED', 'ELEVATION_REQUIRED', 'ELEVATION_REQUIRED_OR_PERMISSION_DENIED'].includes(error.code));
    const summary = summaryFor(name, legacy);
    const result = {
      ok: legacy.ok === true,
      operationId,
      operation: name,
      summary,
      changed,
      data: dataOnly(legacy),
      durationMs,
      requiresElevation,
      retryable: error?.code === 'COMMAND_TIMEOUT',
      ...(error ? { error } : {}),
    };

    await ledger.record({
      operationId,
      operation: name,
      target: operationTarget(name, args),
      status: result.ok ? 'success' : 'failed',
      changed,
      durationMs,
      errorCode: error?.code ?? null,
      summary,
    });
    return result;
  }

  return { call };
}
