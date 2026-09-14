import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { freePort, makeFixture } from './helpers.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLI = path.join(ROOT, 'src', 'cli.mjs');

function run(command, env) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [CLI, command], { cwd: ROOT, env: { ...process.env, ...env } });
    let out = '';
    let err = '';
    child.stdout.on('data', (data) => out += data);
    child.stderr.on('data', (data) => err += data);
    child.on('exit', (code) => resolve({ code, out: out.trim(), err: err.trim() }));
  });
}

test('daemon start/status/stop/restart', async (t) => {
  const f = await makeFixture();
  const port = await freePort();
  const env = {
    SPARK_TRANSPORT_ROOT: f.root,
    SPARK_TRANSPORT_PORT: String(port),
    SPARK_TRANSPORT_STATE_DIR: path.join(f.base, 'state'),
  };
  t.after(async () => {
    await run('stop', env).catch(() => {});
    await f.cleanup();
  });

  let result = await run('start', env);
  assert.equal(result.code, 0, result.err);
  assert.equal(JSON.parse(result.out).status, 'started');
  result = await run('status', env);
  assert.equal(result.code, 0, result.err);
  assert.equal(JSON.parse(result.out).status, 'running');
  result = await run('stop', env);
  assert.equal(result.code, 0, result.err);
  result = await run('start', env);
  assert.equal(result.code, 0, result.err);
  result = await run('stop', env);
  assert.equal(result.code, 0, result.err);
});

test('Windows one-click lifecycle scripts preserve start/restart/status/stop contract', async () => {
  const [cmd, start, stop, status] = await Promise.all([
    fs.readFile(path.join(ROOT, 'SPARK_Transport.cmd'), 'utf8'),
    fs.readFile(path.join(ROOT, 'scripts', 'start-all.ps1'), 'utf8'),
    fs.readFile(path.join(ROOT, 'scripts', 'stop-all.ps1'), 'utf8'),
    fs.readFile(path.join(ROOT, 'scripts', 'status-all.ps1'), 'utf8'),
  ]);

  assert.match(cmd, /if "%~1"=="" goto :start/i);
  assert.match(cmd, /if \/I "%~1"=="restart" goto :restart/i);
  assert.match(start, /Get-StartApps/);
  assert.match(start, /Get-Process -Name 'ChatGPT'/);
  assert.match(start, /\.StartsWith\('\[S2-07\]'\)/);
  assert.doesNotMatch(start, /-like\s+'\[S2-07\]\*'/i);
  assert.match(status, /Get-Process -Name 'ChatGPT'/);
  assert.match(stop, /\$tunnelPid\s*=/);
  assert.doesNotMatch(stop, /\$pid\s*=/i);
  assert.match(stop, /Stop-Process -Name|Stop-Process/);
});
