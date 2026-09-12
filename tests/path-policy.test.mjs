import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { createPathPolicy } from '../src/path-policy.mjs';
import { makeFixture } from './helpers.mjs';

test('path policy allows files inside the allowed root', async (t) => {
  const fixture = await makeFixture();
  t.after(fixture.cleanup);
  const policy = await createPathPolicy(fixture.root);
  const result = await policy.resolveFile('nested/inner.txt');
  assert.equal(result.displayPath, 'nested/inner.txt');
});

test('path policy rejects parent traversal', async (t) => {
  const fixture = await makeFixture();
  t.after(fixture.cleanup);
  const policy = await createPathPolicy(fixture.root);
  await assert.rejects(() => policy.resolveFile('../outside/secret.txt'), (error) => error.code === 'PATH_TRAVERSAL');
});

test('path policy rejects absolute paths', async (t) => {
  const fixture = await makeFixture();
  t.after(fixture.cleanup);
  const policy = await createPathPolicy(fixture.root);
  await assert.rejects(() => policy.resolveFile(path.join(fixture.outside, 'secret.txt')), (error) => error.code === 'ABSOLUTE_PATH_NOT_ALLOWED');
});

test('path policy rejects symlink escape when symlinks are available', async (t) => {
  const fixture = await makeFixture();
  t.after(fixture.cleanup);
  const policy = await createPathPolicy(fixture.root);
  const link = path.join(fixture.root, 'escape-link');
  try {
    await fs.symlink(fixture.outside, link, process.platform === 'win32' ? 'junction' : 'dir');
  } catch (error) {
    if (error?.code === 'EPERM' || error?.code === 'EACCES' || error?.code === 'UNKNOWN') {
      t.skip(`symlink/junction creation unavailable: ${error.code}`);
      return;
    }
    throw error;
  }
  await assert.rejects(() => policy.resolveFile('escape-link/secret.txt'), (error) => error.code === 'SYMLINK_ESCAPE');
});
