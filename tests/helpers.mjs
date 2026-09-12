import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { MCP_PROTOCOL_VERSION, META_CLIENT_CAPABILITIES, META_CLIENT_INFO, META_PROTOCOL_VERSION } from '../src/constants.mjs';

export async function makeFixture() {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'spark-transport-'));
  const root = path.join(base, 'root');
  const outside = path.join(base, 'outside');
  await fs.mkdir(path.join(root, 'nested'), { recursive: true });
  await fs.mkdir(outside, { recursive: true });
  await fs.writeFile(path.join(root, 'hello.txt'), 'hello SPARK\n', 'utf8');
  await fs.writeFile(path.join(root, 'nested', 'inner.txt'), 'inside\n', 'utf8');
  await fs.writeFile(path.join(outside, 'secret.txt'), 'outside\n', 'utf8');
  return {
    base,
    root,
    outside,
    cleanup: () => fs.rm(base, { recursive: true, force: true }),
  };
}

export async function freePort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = address.port;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

export function modernParams(extra = {}) {
  return {
    ...extra,
    _meta: {
      [META_PROTOCOL_VERSION]: MCP_PROTOCOL_VERSION,
      [META_CLIENT_CAPABILITIES]: {},
      [META_CLIENT_INFO]: { name: 'spark-transport-test', version: '0.0.0' },
      ...(extra._meta ?? {}),
    },
  };
}

export async function mcpPost(baseUrl, method, params = {}, options = {}) {
  const headers = {
    'content-type': 'application/json',
    accept: 'application/json, text/event-stream',
    'mcp-protocol-version': MCP_PROTOCOL_VERSION,
    'mcp-method': method,
    ...(options.headers ?? {}),
  };
  if (method === 'tools/call' && params.name) headers['mcp-name'] = params.name;
  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined) delete headers[key];
  }
  const body = {
    jsonrpc: '2.0',
    id: options.id ?? 1,
    method,
    params: modernParams(params),
  };
  const response = await fetch(`${baseUrl}/mcp`, { method: 'POST', headers, body: JSON.stringify(body) });
  const json = await response.json();
  return { response, json };
}
