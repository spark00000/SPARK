import assert from 'node:assert/strict';
import test from 'node:test';
import { loadConfig } from '../src/config.mjs';
import { MCP_PROTOCOL_VERSION, META_SERVER_INFO } from '../src/constants.mjs';
import { createSparkTransportServer } from '../src/server.mjs';
import { freePort, makeFixture, mcpPost } from './helpers.mjs';

async function startFixtureServer(t) {
  const fixture = await makeFixture();
  const port = await freePort();
  const config = loadConfig({ root: fixture.root, port, stateDir: `${fixture.base}/state` });
  const runtime = await createSparkTransportServer(config);
  await runtime.listen();
  t.after(async () => {
    await runtime.close();
    await fixture.cleanup();
  });
  return { fixture, baseUrl: `http://127.0.0.1:${port}` };
}

test('server/discover advertises modern read-only MCP capability', async (t) => {
  const { baseUrl } = await startFixtureServer(t);
  const { response, json } = await mcpPost(baseUrl, 'server/discover');
  assert.equal(response.status, 200);
  assert.equal(json.result.resultType, 'complete');
  assert.deepEqual(json.result.supportedVersions, [MCP_PROTOCOL_VERSION]);
  assert.deepEqual(json.result.capabilities, { tools: {} });
  assert.equal(json.result.ttlMs, 0);
  assert.equal(json.result.cacheScope, 'private');
  assert.equal(json.result._meta[META_SERVER_INFO].name, 'SPARK_Transport');
  assert.equal('serverInfo' in json.result, false);
});

test('tools/list exposes only list_directory and read_file with cache metadata', async (t) => {
  const { baseUrl } = await startFixtureServer(t);
  const { response, json } = await mcpPost(baseUrl, 'tools/list');
  assert.equal(response.status, 200);
  assert.equal(json.result.resultType, 'complete');
  assert.deepEqual(json.result.tools.map((tool) => tool.name), ['list_directory', 'read_file']);
  assert.equal(json.result.ttlMs, 0);
  assert.equal(json.result.cacheScope, 'private');
});

test('tools/call invokes read_file and list_directory over Streamable HTTP POST', async (t) => {
  const { baseUrl } = await startFixtureServer(t);
  const read = await mcpPost(baseUrl, 'tools/call', { name: 'read_file', arguments: { path: 'hello.txt' } });
  assert.equal(read.response.status, 200);
  assert.equal(read.json.result.resultType, 'complete');
  assert.equal(read.json.result.isError, false);
  assert.equal(read.json.result.structuredContent.text, 'hello SPARK\n');

  const list = await mcpPost(baseUrl, 'tools/call', { name: 'list_directory', arguments: { path: 'nested' } }, { id: 2 });
  assert.equal(list.response.status, 200);
  assert.equal(list.json.result.isError, false);
  assert.deepEqual(list.json.result.structuredContent.entries.map((e) => e.name), ['inner.txt']);
});

test('tool policy errors remain successful JSON-RPC tool results with isError=true', async (t) => {
  const { baseUrl } = await startFixtureServer(t);
  const result = await mcpPost(baseUrl, 'tools/call', { name: 'read_file', arguments: { path: '../outside/secret.txt' } });
  assert.equal(result.response.status, 200);
  assert.equal(result.json.result.isError, true);
  assert.equal(result.json.result.structuredContent.error.code, 'PATH_TRAVERSAL');
});

test('modern header/body mismatch is rejected with -32020', async (t) => {
  const { baseUrl } = await startFixtureServer(t);
  const result = await mcpPost(baseUrl, 'tools/list', {}, { headers: { 'mcp-method': 'tools/call' } });
  assert.equal(result.response.status, 400);
  assert.equal(result.json.error.code, -32020);
});

test('MCP endpoint rejects GET and no session header is emitted', async (t) => {
  const { baseUrl } = await startFixtureServer(t);
  const getResponse = await fetch(`${baseUrl}/mcp`);
  assert.equal(getResponse.status, 405);
  const discover = await mcpPost(baseUrl, 'server/discover');
  assert.equal(discover.response.headers.has('mcp-session-id'), false);
});


test('missing modern protocol header is rejected with -32020', async (t) => {
  const { baseUrl } = await startFixtureServer(t);
  const result = await mcpPost(baseUrl, 'tools/list', {}, { headers: { 'mcp-protocol-version': undefined } });
  assert.equal(result.response.status, 400);
  assert.equal(result.json.error.code, -32020);
});

test('unknown MCP method returns HTTP 404 with JSON-RPC -32601', async (t) => {
  const { baseUrl } = await startFixtureServer(t);
  const result = await mcpPost(baseUrl, 'not/a/method');
  assert.equal(result.response.status, 404);
  assert.equal(result.json.error.code, -32601);
});
