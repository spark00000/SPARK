import {
  APP_NAME,
  APP_VERSION,
  MCP_PROTOCOL_VERSION,
  META_CLIENT_CAPABILITIES,
  META_CLIENT_INFO,
  META_PROTOCOL_VERSION,
  META_SERVER_INFO,
} from './constants.mjs';
import { TOOL_DEFINITIONS } from './tools.mjs';

const JSONRPC_VERSION = '2.0';

function serverMeta() {
  return {
    [META_SERVER_INFO]: {
      name: APP_NAME,
      version: APP_VERSION,
    },
  };
}

function completeResult(result) {
  return {
    resultType: 'complete',
    ...result,
    _meta: {
      ...(result?._meta ?? {}),
      ...serverMeta(),
    },
  };
}

function response(id, result) {
  return { jsonrpc: JSONRPC_VERSION, id, result };
}

function errorResponse(id, code, message, data) {
  const error = { code, message };
  if (data !== undefined) error.data = data;
  return { jsonrpc: JSONRPC_VERSION, id: id ?? null, error };
}

export function validateModernRequest({ headers, body }) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || body.jsonrpc !== JSONRPC_VERSION || typeof body.method !== 'string') {
    return { ok: false, status: 400, error: errorResponse(body?.id, -32600, 'Invalid Request') };
  }

  if (!Object.prototype.hasOwnProperty.call(body, 'id')) {
    return { ok: false, notification: true };
  }

  const headerVersion = headers['mcp-protocol-version'];
  if (headerVersion === undefined) {
    return {
      ok: false,
      status: 400,
      error: errorResponse(body.id, -32020, 'Missing required MCP-Protocol-Version header'),
    };
  }
  if (headerVersion !== MCP_PROTOCOL_VERSION) {
    return {
      ok: false,
      status: 400,
      error: errorResponse(body.id, -32022, 'Unsupported protocol version', { supported: [MCP_PROTOCOL_VERSION] }),
    };
  }

  const params = body.params && typeof body.params === 'object' && !Array.isArray(body.params) ? body.params : {};
  const meta = params._meta;
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) {
    return { ok: false, status: 400, error: errorResponse(body.id, -32602, 'Missing required request _meta envelope') };
  }
  if (meta[META_PROTOCOL_VERSION] !== MCP_PROTOCOL_VERSION) {
    return { ok: false, status: 400, error: errorResponse(body.id, -32020, 'Header/body protocol version mismatch') };
  }
  if (!meta[META_CLIENT_CAPABILITIES] || typeof meta[META_CLIENT_CAPABILITIES] !== 'object' || Array.isArray(meta[META_CLIENT_CAPABILITIES])) {
    return { ok: false, status: 400, error: errorResponse(body.id, -32602, 'Missing required client capabilities') };
  }
  if (meta[META_CLIENT_INFO] !== undefined) {
    const ci = meta[META_CLIENT_INFO];
    if (!ci || typeof ci !== 'object' || typeof ci.name !== 'string' || typeof ci.version !== 'string') {
      return { ok: false, status: 400, error: errorResponse(body.id, -32602, 'Malformed clientInfo metadata') };
    }
  }

  if (headers['mcp-method'] !== body.method) {
    return { ok: false, status: 400, error: errorResponse(body.id, -32020, 'Mcp-Method header does not match JSON-RPC method') };
  }

  const requiresName = body.method === 'tools/call';
  if (requiresName) {
    const bodyName = params.name;
    if (typeof bodyName !== 'string' || headers['mcp-name'] !== bodyName) {
      return { ok: false, status: 400, error: errorResponse(body.id, -32020, 'Mcp-Name header does not match tool name') };
    }
  }

  return { ok: true, params };
}

export function createMcpDispatcher({ toolRuntime }) {
  async function dispatch(body) {
    const params = body.params && typeof body.params === 'object' && !Array.isArray(body.params) ? body.params : {};

    if (body.method === 'server/discover') {
      return response(
        body.id,
        completeResult({
          supportedVersions: [MCP_PROTOCOL_VERSION],
          capabilities: { tools: {} },
          instructions: 'SPARK_Transport Sprint-1 exposes read-only local filesystem tools scoped to one configured allowed root.',
          ttlMs: 0,
          cacheScope: 'private',
        }),
      );
    }

    if (body.method === 'tools/list') {
      return response(
        body.id,
        completeResult({
          tools: TOOL_DEFINITIONS,
          ttlMs: 0,
          cacheScope: 'private',
        }),
      );
    }

    if (body.method === 'tools/call') {
      if (typeof params.name !== 'string') {
        return errorResponse(body.id, -32602, 'Invalid params: tool name is required');
      }
      const tool = TOOL_DEFINITIONS.find((item) => item.name === params.name);
      if (!tool) {
        return errorResponse(body.id, -32602, `Unknown tool: ${params.name}`);
      }
      const structured = await toolRuntime.call(params.name, params.arguments ?? {});
      return response(
        body.id,
        completeResult({
          content: [{ type: 'text', text: JSON.stringify(structured) }],
          structuredContent: structured,
          isError: structured.ok !== true,
        }),
      );
    }

    return errorResponse(body.id, -32601, 'Method not found');
  }

  return { dispatch };
}
