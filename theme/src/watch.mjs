#!/usr/bin/env node

import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { evaluate, listTargets } from "./cdp.mjs";
import { PROJECT_ROOT, buildApplyExpression, loadTheme } from "./theme.mjs";

function parseArgs(argv) {
  const options = {
    host: "127.0.0.1",
    port: null,
    themePath: undefined,
    intervalMs: 1_500,
    unavailableExitMs: 30_000,
  };
  const args = [...argv];
  while (args.length > 0) {
    const flag = args.shift();
    const value = args.shift();
    if (value === undefined) throw new Error(`Missing value for ${flag}`);
    if (flag === "--host") options.host = value;
    else if (flag === "--port") options.port = Number(value);
    else if (flag === "--theme") options.themePath = path.resolve(value);
    else if (flag === "--interval") options.intervalMs = Number(value);
    else if (flag === "--unavailable-exit") options.unavailableExitMs = Number(value);
    else throw new Error(`Unknown option: ${flag}`);
  }
  if (!Number.isInteger(options.port) || options.port < 1 || options.port > 65535) {
    throw new Error("--port must be an integer from 1 to 65535.");
  }
  if (!Number.isInteger(options.intervalMs) || options.intervalMs < 250) {
    throw new Error("--interval must be an integer of at least 250ms.");
  }
  return options;
}

const delay = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

async function writeHeartbeat(value) {
  const filePath = path.join(PROJECT_ROOT, ".runtime", "watcher.json");
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporary, filePath);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const theme = await loadTheme(options.themePath);
  const expression = buildApplyExpression(theme);
  let unavailableSince = null;
  let cycle = 0;

  for (;;) {
    cycle += 1;
    try {
      const targets = await listTargets({
        host: options.host,
        port: options.port,
        timeoutMs: Math.min(options.intervalMs, 1_200),
      });
      const results = [];
      for (const target of targets) {
        results.push({
          targetId: target.id,
          url: target.url,
          result: await evaluate(target, expression, { timeoutMs: 5_000 }),
        });
      }
      unavailableSince = null;
      await writeHeartbeat({
        schemaVersion: 2,
        pid: process.pid,
        cycle,
        healthy: true,
        checkedAt: new Date().toISOString(),
        endpoint: `${options.host}:${options.port}`,
        configPath: options.themePath ?? null,
        theme: { id: theme.id, name: theme.name },
        results,
      });
    } catch (error) {
      unavailableSince ??= Date.now();
      await writeHeartbeat({
        schemaVersion: 2,
        pid: process.pid,
        cycle,
        healthy: false,
        checkedAt: new Date().toISOString(),
        endpoint: `${options.host}:${options.port}`,
        configPath: options.themePath ?? null,
        theme: { id: theme.id, name: theme.name },
        error: error.message,
      });
      if (Date.now() - unavailableSince >= options.unavailableExitMs) {
        throw new Error(
          `CDP endpoint unavailable for ${options.unavailableExitMs}ms: ${error.message}`,
        );
      }
    }
    await delay(options.intervalMs);
  }
}

main().catch((error) => {
  process.stderr.write(
    `chatgpt-theme-changer watcher: ${error.stack ?? error.message}\n`,
  );
  process.exitCode = 1;
});
