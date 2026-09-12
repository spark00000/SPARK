import assert from 'node:assert/strict';
import test from 'node:test';
import { createPathPolicy } from '../src/path-policy.mjs';
import { createToolRuntime, TOOL_DEFINITIONS } from '../src/tools.mjs';
import { makeFixture } from './helpers.mjs';

test('read_file reads UTF-8 text and returns hash metadata', async (t) => {
  const fixture = await makeFixture();
  t.after(fixture.cleanup);
  const policy = await createPathPolicy(fixture.root);
  const runtime = createToolRuntime({ policy, maxReadBytes: 1024 * 1024 });
  const result = await runtime.readFile({ path: 'hello.txt' });
  assert.equal(result.ok, true);
  assert.equal(result.text, 'hello SPARK\n');
  assert.equal(result.path, 'hello.txt');
  assert.match(result.sha256, /^[a-f0-9]{64}$/);
});

test('list_directory returns deterministic structured entries', async (t) => {
  const fixture = await makeFixture();
  t.after(fixture.cleanup);
  const policy = await createPathPolicy(fixture.root);
  const runtime = createToolRuntime({ policy, maxReadBytes: 1024 * 1024 });
  const result = await runtime.listDirectory({ path: '.' });
  assert.equal(result.ok, true);
  assert.deepEqual(result.entries.map((entry) => entry.name), ['hello.txt', 'nested']);
  assert.equal(result.entries.find((entry) => entry.name === 'nested').type, 'directory');
});

test('read_file returns structured errors for missing file and wrong type', async (t) => {
  const fixture = await makeFixture();
  t.after(fixture.cleanup);
  const policy = await createPathPolicy(fixture.root);
  const runtime = createToolRuntime({ policy, maxReadBytes: 1024 * 1024 });
  const missing = await runtime.readFile({ path: 'missing.txt' });
  assert.deepEqual(missing, { ok: false, error: { code: 'NOT_FOUND', message: 'path does not exist' } });
  const directory = await runtime.readFile({ path: 'nested' });
  assert.equal(directory.ok, false);
  assert.equal(directory.error.code, 'NOT_A_FILE');
});

test('Sprint-1 exposes only read-only tools', () => {
  assert.deepEqual(TOOL_DEFINITIONS.map((tool) => tool.name), ['list_directory', 'read_file']);
  for (const tool of TOOL_DEFINITIONS) {
    assert.equal(tool.annotations.readOnlyHint, true);
    assert.equal(tool.annotations.idempotentHint, true);
    assert.equal(tool.annotations.openWorldHint, false);
  }
});
