import { spawn } from 'node:child_process';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './config.mjs';
import { createSparkTransportServer, ensureStateDir } from './server.mjs';

const SELF = fileURLToPath(import.meta.url);

function print(value) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

async function readPid(pidFile) {
  try {
    const text = await fsp.readFile(pidFile, 'utf8');
    const pid = Number(text.trim());
    return Number.isInteger(pid) && pid > 0 ? pid : null;
  } catch {
    return null;
  }
}

function processExists(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function health(config, timeoutMs = 750) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`http://${config.host}:${config.port}${config.healthPath}`, { signal: controller.signal });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function serve() {
  const config = loadConfig();
  const state = await ensureStateDir(config);
  const existing = await readPid(state.pidFile);
  if (existing && existing !== process.pid && processExists(existing)) {
    throw new Error(`SPARK_Transport already appears to be running as PID ${existing}`);
  }

  await fsp.writeFile(state.pidFile, `${process.pid}\n`, { encoding: 'utf8' });
  const runtime = await createSparkTransportServer(config);
  const address = await runtime.listen();
  print({ status: 'started', pid: process.pid, host: config.host, port: address.port, mcp: config.mcpPath, rootConfigured: true });

  let shuttingDown = false;
  const shutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    await runtime.close().catch(() => {});
    const pid = await readPid(state.pidFile);
    if (pid === process.pid) await fsp.rm(state.pidFile, { force: true }).catch(() => {});
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

async function start() {
  const config = loadConfig();
  const state = await ensureStateDir(config);
  const existing = await readPid(state.pidFile);
  if (existing && processExists(existing)) {
    const info = await health(config);
    print({ status: 'already-running', pid: existing, healthy: Boolean(info) });
    return;
  }
  await fsp.rm(state.pidFile, { force: true }).catch(() => {});

  const logFd = fs.openSync(state.logFile, 'a');
  const child = spawn(process.execPath, [SELF, 'serve'], {
    detached: true,
    stdio: ['ignore', logFd, logFd],
    cwd: process.cwd(),
    env: process.env,
    windowsHide: true,
  });
  child.unref();
  fs.closeSync(logFd);

  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const info = await health(config, 500);
    const pid = await readPid(state.pidFile);
    if (info && pid) {
      print({ status: 'started', pid, healthy: true, host: config.host, port: config.port });
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`SPARK_Transport did not become healthy; inspect ${state.logFile}`);
}

async function status() {
  const config = loadConfig();
  const state = await ensureStateDir(config);
  const pid = await readPid(state.pidFile);
  const running = processExists(pid);
  const info = running ? await health(config) : null;
  print({ status: running && info ? 'running' : running ? 'running-unhealthy' : 'stopped', pid: running ? pid : null, healthy: Boolean(info) });
  process.exitCode = running && info ? 0 : 1;
}

async function stop() {
  const config = loadConfig();
  const state = await ensureStateDir(config);
  const pid = await readPid(state.pidFile);
  if (!pid || !processExists(pid)) {
    await fsp.rm(state.pidFile, { force: true }).catch(() => {});
    print({ status: 'stopped', pid: null });
    return;
  }

  process.kill(pid, 'SIGTERM');
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline && processExists(pid)) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (processExists(pid)) {
    throw new Error(`PID ${pid} did not stop within timeout`);
  }
  await fsp.rm(state.pidFile, { force: true }).catch(() => {});
  print({ status: 'stopped', pid });
}

const command = process.argv[2] ?? 'serve';
try {
  if (command === 'serve') await serve();
  else if (command === 'start') await start();
  else if (command === 'status') await status();
  else if (command === 'stop') await stop();
  else throw new Error(`unknown command: ${command}`);
} catch (error) {
  process.stderr.write(`${error?.message ?? error}\n`);
  process.exitCode = 1;
}
