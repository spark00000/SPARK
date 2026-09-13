import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { loadConfig } from '../src/config.mjs';
import { createPathPolicy } from '../src/path-policy.mjs';
import { createToolRuntime } from '../src/tools.mjs';
import { makeFixture } from './helpers.mjs';

test('allowedRoot accepts an array while preserving first-root relative paths', async (t) => {
  const f = await makeFixture();
  t.after(f.cleanup);
  const second = path.join(f.base, 'second-root');
  await fs.mkdir(second, { recursive: true });
  await fs.writeFile(path.join(second, 'second.txt'), 'second\n', 'utf8');

  const configPath = path.join(f.base, 'config.json');
  await fs.writeFile(configPath, JSON.stringify({ daemon: { allowedRoot: [f.root, second] } }), 'utf8');
  const config = loadConfig({ configPath });

  assert.deepEqual(config.roots, [path.resolve(f.root), path.resolve(second)]);
  assert.equal(config.root, path.resolve(f.root));

  const policy = await createPathPolicy(config.roots);
  assert.equal((await policy.resolveFile('hello.txt')).displayPath, 'hello.txt');
  assert.equal((await policy.resolveFile(path.join(second, 'second.txt'))).absolutePath, await fs.realpath(path.join(second, 'second.txt')));
  await assert.rejects(() => policy.resolveFile(path.join(f.outside, 'secret.txt')), (error) => error.code === 'OUTSIDE_ALLOWED_ROOT');
});

test('multi-root permits CRUD by absolute path only inside configured roots', async (t) => {
  const f = await makeFixture();
  t.after(f.cleanup);
  const second = path.join(f.base, 'second-root');
  const stateDir = path.join(f.base, 'state');
  await fs.mkdir(second, { recursive: true });
  await fs.writeFile(path.join(second, 'existing.txt'), 'beta\n', 'utf8');

  const policy = await createPathPolicy([f.root, second]);
  const recycled = [];
  const runtime = createToolRuntime({
    policy,
    maxReadBytes: 1024 * 1024,
    stateDir,
    commandTimeoutMs: 1000,
    recycleBin: true,
    recycle: async (target) => { recycled.push(target); },
    runner: async () => ({ ok: true, stdout: '', stderr: '', exitCode: 0, signal: null, durationMs: 1 }),
  });

  let result = await runtime.readFile({ path: path.join(second, 'existing.txt') });
  assert.equal(result.ok, true);
  assert.equal(result.text, 'beta\n');

  const created = path.join(second, 'created.txt');
  result = await runtime.createFile({ path: created, text: 'created' });
  assert.equal(result.ok, true);
  assert.equal(await fs.readFile(created, 'utf8'), 'created');

  result = await runtime.deletePath({ path: second });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'ROOT_DELETE_FORBIDDEN');
  assert.equal(recycled.length, 0);

  result = await runtime.createFile({ path: path.join(f.outside, 'blocked.txt'), text: 'blocked' });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'OUTSIDE_ALLOWED_ROOT');
});

test('single-root compatibility still rejects absolute tool paths', async (t) => {
  const f = await makeFixture();
  t.after(f.cleanup);
  const policy = await createPathPolicy(f.root);
  await assert.rejects(() => policy.resolveFile(path.join(f.root, 'hello.txt')), (error) => error.code === 'ABSOLUTE_PATH_NOT_ALLOWED');
});
