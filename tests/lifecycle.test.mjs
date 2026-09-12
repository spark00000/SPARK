import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { freePort, makeFixture } from './helpers.mjs';

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLI = path.join(PROJECT_ROOT, 'src', 'cli.mjs');

function runCli(command, env) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [CLI, command], { cwd: PROJECT_ROOT, env: { ...process.env, ...env } });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (data) => (stdout += data));
    child.stderr.on('data', (data) => (stderr += data));
    child.on('exit', (code) => resolve({ code, stdout: stdout.trim(), stderr: stderr.trim() }));
  });
}

test('daemon start/status/stop/restart lifecycle works cleanly', async (t) => {
  const fixture = await makeFixture();
  const port = await freePort();
  const stateDir = path.join(fixture.base, 'state');
  const env = {
    SPARK_TRANSPORT_ROOT: fixture.root,
    SPARK_TRANSPORT_PORT: String(port),
    SPARK_TRANSPORT_STATE_DIR: stateDir,
  };

  t.after(async () => {
    await runCli('stop', env).catch(() => {});
    await fixture.cleanup();
  });

  const firstStart = await runCli('start', env);
  assert.equal(firstStart.code, 0, firstStart.stderr);
  assert.equal(JSON.parse(firstStart.stdout).status, 'started');

  const status = await runCli('status', env);
  assert.equal(status.code, 0, status.stderr);
  assert.equal(JSON.parse(status.stdout).status, 'running');

  const stop = await runCli('stop', env);
  assert.equal(stop.code, 0, stop.stderr);
  assert.equal(JSON.parse(stop.stdout).status, 'stopped');

  const pidPath = path.join(stateDir, 'spark-transport.pid');
  await assert.rejects(() => fs.access(pidPath));

  const secondStart = await runCli('start', env);
  assert.equal(secondStart.code, 0, secondStart.stderr);
  assert.equal(JSON.parse(secondStart.stdout).status, 'started');

  const secondStop = await runCli('stop', env);
  assert.equal(secondStop.code, 0, secondStop.stderr);
});
