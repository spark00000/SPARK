import { spawn } from 'node:child_process';

export async function runProcess({ command, args = [], cwd, timeoutMs, env = {} }) {
  if (typeof command !== 'string' || !command.trim()) {
    return { ok: false, error: { code: 'INVALID_ARGUMENTS', message: 'command must be a non-empty string' } };
  }
  if (!Array.isArray(args) || !args.every((v) => typeof v === 'string')) {
    return { ok: false, error: { code: 'INVALID_ARGUMENTS', message: 'args must be an array of strings' } };
  }
  const startedAt = Date.now();
  return await new Promise((resolve) => {
    let settled = false;
    let timedOut = false;
    let stdout = '';
    let stderr = '';
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, ...env },
      shell: false,
      windowsHide: true,
    });
    const timer = setTimeout(() => {
      timedOut = true;
      try { child.kill('SIGTERM'); } catch {}
      setTimeout(() => { try { child.kill('SIGKILL'); } catch {} }, 1000).unref();
    }, timeoutMs);
    child.stdout?.on('data', (d) => { stdout += d.toString(); });
    child.stderr?.on('data', (d) => { stderr += d.toString(); });
    child.on('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const permission = error?.code === 'EACCES' || error?.code === 'EPERM';
      resolve({
        ok: false,
        error: {
          code: permission ? 'ELEVATION_REQUIRED_OR_PERMISSION_DENIED' : 'COMMAND_START_FAILED',
          message: permission ? 'command could not start with current non-elevated permissions' : 'command could not be started',
        },
        stdout,
        stderr,
        durationMs: Date.now() - startedAt,
      });
    });
    child.on('exit', (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (timedOut) {
        resolve({ ok: false, error: { code: 'COMMAND_TIMEOUT', message: `command exceeded ${timeoutMs} ms timeout` }, stdout, stderr, exitCode: code, signal, durationMs: Date.now() - startedAt });
        return;
      }
      resolve({ ok: code === 0, stdout, stderr, exitCode: code, signal, durationMs: Date.now() - startedAt, ...(code === 0 ? {} : { error: { code: 'COMMAND_FAILED', message: 'command exited with non-zero status; elevated execution is not attempted automatically' } }) });
    });
  });
}
