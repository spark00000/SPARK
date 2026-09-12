import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { APP_NAME, APP_VERSION, MAX_REQUEST_BYTES, MCP_PROTOCOL_VERSION } from './constants.mjs';
import { createMcpDispatcher, validateModernRequest } from './mcp.mjs';
import { createPathPolicy } from './path-policy.mjs';
import { createToolRuntime } from './tools.mjs';

function isLoopbackHost(value) {
  if (!value) return true;
  let host = String(value).toLowerCase();
  try {
    if (host.includes(':') && !host.startsWith('[') && host !== '::1') {
      host = new URL(`http://${host}`).hostname;
    } else if (host.startsWith('[')) {
      host = new URL(`http://${host}`).hostname;
    }
  } catch {
    return false;
  }
  host = host.replace(/^\[/, '').replace(/\]$/, '');
  return host === '127.0.0.1' || host === 'localhost' || host === '::1';
}

function validateOrigin(req) {
  const host = req.headers.host;
  if (host && !isLoopbackHost(host)) return false;
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    return isLoopbackHost(new URL(origin).hostname);
  } catch {
    return false;
  }
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
  });
  res.end(body);
}

async function readJsonBody(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_REQUEST_BYTES) {
      const error = new Error('request too large');
      error.code = 'REQUEST_TOO_LARGE';
      throw error;
    }
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  return JSON.parse(raw);
}

export async function createSparkTransportServer(config) {
  if (config.host !== '127.0.0.1' && config.host !== 'localhost' && config.host !== '::1') {
    throw new Error('Sprint-1 server must bind to a loopback host');
  }
  const policy = await createPathPolicy(config.root);
  const toolRuntime = createToolRuntime({ policy, maxReadBytes: config.maxReadBytes });
  const dispatcher = createMcpDispatcher({ toolRuntime });

  const server = http.createServer(async (req, res) => {
    if (!validateOrigin(req)) {
      sendJson(res, 403, { error: 'invalid host/origin' });
      return;
    }

    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? '127.0.0.1'}`);

    if (url.pathname === config.healthPath) {
      if (req.method !== 'GET') {
        res.writeHead(405, { allow: 'GET' });
        res.end();
        return;
      }
      sendJson(res, 200, {
        status: 'ok',
        name: APP_NAME,
        version: APP_VERSION,
        protocol: MCP_PROTOCOL_VERSION,
        mode: 'read-only',
      });
      return;
    }

    if (url.pathname !== config.mcpPath) {
      res.writeHead(404);
      res.end();
      return;
    }

    if (req.method !== 'POST') {
      res.writeHead(405, { allow: 'POST' });
      res.end();
      return;
    }

    const contentType = String(req.headers['content-type'] ?? '').toLowerCase();
    if (!contentType.startsWith('application/json')) {
      sendJson(res, 415, { jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Content-Type must be application/json' } });
      return;
    }

    let body;
    try {
      body = await readJsonBody(req);
    } catch (error) {
      if (error?.code === 'REQUEST_TOO_LARGE') {
        sendJson(res, 413, { jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Request body too large' } });
      } else {
        sendJson(res, 400, { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
      }
      return;
    }

    const headers = Object.fromEntries(Object.entries(req.headers).map(([k, v]) => [k.toLowerCase(), Array.isArray(v) ? v[0] : v]));
    const validation = validateModernRequest({ headers, body });
    if (validation.notification) {
      res.writeHead(202);
      res.end();
      return;
    }
    if (!validation.ok) {
      sendJson(res, validation.status ?? 400, validation.error);
      return;
    }

    try {
      const result = await dispatcher.dispatch(body);
      const status = result?.error?.code === -32601 ? 404 : 200;
      sendJson(res, status, result);
    } catch {
      sendJson(res, 200, { jsonrpc: '2.0', id: body.id ?? null, error: { code: -32603, message: 'Internal error' } });
    }
  });

  return {
    policy,
    toolRuntime,
    server,
    async listen() {
      await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(config.port, config.host, () => {
          server.off('error', reject);
          resolve();
        });
      });
      return server.address();
    },
    async close() {
      if (!server.listening) return;
      await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    },
  };
}

export async function ensureStateDir(config) {
  await fs.mkdir(config.stateDir, { recursive: true });
  return {
    pidFile: path.join(config.stateDir, 'spark-transport.pid'),
    logFile: path.join(config.stateDir, 'spark-transport.log'),
  };
}
