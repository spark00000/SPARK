import { spawn } from 'node:child_process';

function createBoundedCapture(maxBytes) {
  const chunks = [];
  let bytes = 0;
  let truncated = false;
  return {
    push(chunk) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      const remaining = Math.max(0, maxBytes - bytes);
      if (buffer.length <= remaining) {
        chunks.push(buffer);
        bytes += buffer.length;
      } else {
        if (remaining > 0) chunks.push(buffer.subarray(0, remaining));
        bytes += remaining;
        truncated = true;
      }
    },
    result() {
      return { text: Buffer.concat(chunks).toString('utf8'), truncated, bytes };
    },
  };
}

async function terminateProcessTree(pid, child) {
  if (!pid) {
    try { child?.kill('SIGKILL'); } catch {}
    return;
  }
  if (process.platform === 'win32') {
    await new Promise((resolve) => {
      let killer;
      try {
        killer = spawn('taskkill.exe', ['/PID', String(pid), '/T', '/F'], {
          stdio: 'ignore',
          windowsHide: true,
        });
      } catch {
        resolve();
        return;
      }
      killer.once('error', () => resolve());
      killer.once('close', () => resolve());
    });
    try { child?.kill('SIGKILL'); } catch {}
    return;
  }

  try { process.kill(-pid, 'SIGTERM'); }
  catch { try { child?.kill('SIGTERM'); } catch {} }
  await new Promise((resolve) => setTimeout(resolve, 150));
  try { process.kill(-pid, 'SIGKILL'); }
  catch { try { child?.kill('SIGKILL'); } catch {} }
}

export async function runProcess({ command, args = [], cwd, timeoutMs, maxOutputBytes = 64 * 1024, env = {} }) {
  if (typeof command !== 'string' || !command.trim()) {
    return { ok: false, error: { code: 'INVALID_ARGUMENTS', message: 'command must be a non-empty string' } };
  }
  if (!Array.isArray(args) || !args.every((v) => typeof v === 'string')) {
    return { ok: false, error: { code: 'INVALID_ARGUMENTS', message: 'args must be an array of strings' } };
  }
  if (!Number.isSafeInteger(maxOutputBytes) || maxOutputBytes <= 0) {
    return { ok: false, error: { code: 'INVALID_ARGUMENTS', message: 'maxOutputBytes must be a positive integer' } };
  }

  const startedAt = Date.now();
  return await new Promise((resolve) => {
    let settled = false;
    let timedOut = false;
    let child;
    const stdoutCapture = createBoundedCapture(maxOutputBytes);
    const stderrCapture = createBoundedCapture(maxOutputBytes);

    const finish = (payload) => {
      if (settled) return;
      settled = true;
      const stdout = stdoutCapture.result();
      const stderr = stderrCapture.result();
      resolve({
        ...payload,
        stdout: stdout.text,
        stderr: stderr.text,
        stdoutTruncated: stdout.truncated,
        stderrTruncated: stderr.truncated,
        durationMs: Date.now() - startedAt,
      });
    };

    try {
      child = spawn(command, args, {
        cwd,
        env: { ...process.env, ...env },
        shell: false,
        windowsHide: true,
        detached: process.platform !== 'win32',
      });
    } catch (error) {
      const permission = error?.code === 'EACCES' || error?.code === 'EPERM';
      finish({
        ok: false,
        error: {
          code: permission ? 'ELEVATION_REQUIRED_OR_PERMISSION_DENIED' : 'COMMAND_START_FAILED',
          message: permission ? 'command could not start with current non-elevated permissions' : 'command could not be started',
        },
      });
      return;
    }

    child.stdout?.on('data', (d) => stdoutCapture.push(d));
    child.stderr?.on('data', (d) => stderrCapture.push(d));

    child.once('error', (error) => {
      clearTimeout(timer);
      const permission = error?.code === 'EACCES' || error?.code === 'EPERM';
      finish({
        ok: false,
        error: {
          code: permission ? 'ELEVATION_REQUIRED_OR_PERMISSION_DENIED' : 'COMMAND_START_FAILED',
          message: permission ? 'command could not start with current non-elevated permissions' : 'command could not be started',
        },
      });
    });

    child.once('close', (code, signal) => {
      clearTimeout(timer);
      if (timedOut) {
        finish({
          ok: false,
          error: { code: 'COMMAND_TIMEOUT', message: `command exceeded ${timeoutMs} ms timeout` },
          exitCode: code,
          signal,
        });
        return;
      }
      finish({
        ok: code === 0,
        exitCode: code,
        signal,
        ...(code === 0 ? {} : {
          error: {
            code: 'COMMAND_FAILED',
            message: 'command exited with non-zero status; elevated execution is not attempted automatically',
          },
        }),
      });
    });

    const timer = setTimeout(() => {
      timedOut = true;
      void terminateProcessTree(child.pid, child);
    }, timeoutMs);
    timer.unref?.();
  });
}
