# SPARK_Transport

**SPARK_Transport** is the MCP transport/daemon project for local ChatGPT-to-PC MCP transport.

Sibling projects are independent repositories:

- `SPARK_Transport` — local MCP daemon and future gateway transport
- `ACT_Tool` — Obsidian-facing interface/plugin
- `ACT_Theme` — ChatGPT UI/theme/usage customization through CDP

## Sprint-1

Sprint-1 is intentionally read-only.

### MCP tools

- `read_file(path)` — reads one UTF-8 text file under the configured allowed root.
- `list_directory(path=".")` — lists entries under the configured allowed root.

No write, modify, delete, or command-execution MCP tools are exposed in Sprint-1.

### Protocol

- MCP baseline: **`2026-07-28`**.
- Endpoint: `POST /mcp`.
- Modern/stateless protocol only for this PoC: no `initialize`, no `Mcp-Session-Id`.
- SPARK_Transport does **not** define custom MCP methods, headers, framing, or session semantics.
- `/health` is a local daemon-administration endpoint outside MCP. It is not an MCP extension.

The official MCP TypeScript SDK v2 is the preferred production dependency because it is the stable SDK line implementing `2026-07-28`. The current execution environment could not reach the npm registry, so Sprint-1 implements the small required MCP wire subset directly from the official specification with **zero external runtime dependencies**. The external MCP contract is kept standard and is covered by protocol tests. See `refs/MCP_2026-07-28.md` and `ARCH.md`.

## Runtime

Requirement: Node.js 20+; Sprint-1 was tested with Node.js 22.16.0.

Set an explicit local filesystem root. Absolute paths supplied to MCP tools are rejected; tool paths are relative to this root.

### PowerShell

```powershell
$env:SPARK_TRANSPORT_ROOT = 'E:\SRC'
npm run daemon:start
npm run daemon:status
npm run daemon:stop
```

Foreground mode:

```powershell
$env:SPARK_TRANSPORT_ROOT = 'E:\SRC'
npm start
```

Default local endpoint:

```text
http://127.0.0.1:8765/mcp
```

Health endpoint:

```text
http://127.0.0.1:8765/health
```

The MCP daemon binds to loopback by default. ChatGPT does not connect directly to a local MCP server; the intended Sprint-1 ChatGPT deployment path is Secure MCP Tunnel. Tunnel credentials/configuration are deliberately not stored in this repository.

## Secure MCP Tunnel setup

ChatGPT does **not** connect directly to `127.0.0.1`. OpenAI's supported path for a private/local MCP server is **Secure MCP Tunnel**: `tunnel-client` runs on the same PC/network as SPARK_Transport, makes an outbound HTTPS connection to OpenAI, and forwards MCP requests to `http://127.0.0.1:8765/mcp`. No inbound firewall rule, public IP, port-forwarding, or public MCP URL is required.

Official references:

- Secure MCP Tunnel guide: <https://developers.openai.com/api/docs/guides/secure-mcp-tunnels>
- Platform tunnel settings: <https://platform.openai.com/settings/organization/tunnels>
- Runtime API keys: <https://platform.openai.com/settings/organization/api-keys>
- Latest `tunnel-client` release: <https://github.com/openai/tunnel-client/releases/latest>
- ChatGPT developer-mode MCP apps: <https://help.openai.com/en/articles/12584461-developer-mode-and-mcp-apps-in-chatgpt>
- ChatGPT app/plugin setup: <https://chatgpt.com/plugins>

### 1. Prerequisites

For the current ChatGPT full-MCP beta, use **ChatGPT Web** with a Business or Enterprise/Edu workspace that has Developer Mode enabled. Business Admin/Owner users can enable Developer Mode and create/test a custom MCP app. OpenAI Platform tunnel permissions and ChatGPT workspace Developer Mode are separate permissions.

For the tunnel you need:

- a `tunnel_id` created in Platform **Tunnels**;
- a runtime API key used by `tunnel-client`;
- **Tunnels Read + Use** to run/select the tunnel; creating or editing the tunnel additionally requires **Tunnels Read + Manage**;
- the tunnel associated with the target ChatGPT workspace, otherwise it will not appear when creating the ChatGPT app.

> SPARK_Transport does not use the OpenAI model/Responses API for prompts or inference. Secure MCP Tunnel nevertheless requires a Platform **runtime API key** to authenticate `tunnel-client` to the tunnel control plane. Do not commit that key to this repository.

### 2. Start SPARK_Transport locally

From the repository root in PowerShell:

```powershell
$env:SPARK_TRANSPORT_ROOT = 'E:\SRC'
npm run daemon:start
npm run daemon:status
Invoke-RestMethod http://127.0.0.1:8765/health
```

The local MCP endpoint must be reachable from the same PC:

```text
http://127.0.0.1:8765/mcp
```

### 3. Create the OpenAI tunnel

1. Open <https://platform.openai.com/settings/organization/tunnels>.
2. Create a tunnel and associate it with the ChatGPT workspace that will use SPARK_Transport.
3. Copy the resulting `tunnel_id` (`tunnel_` followed by the generated identifier).
4. Create a **runtime** API key at <https://platform.openai.com/settings/organization/api-keys> with the required tunnel permissions.
5. Download the supported `tunnel-client` from the Platform Tunnels page or the latest public release at <https://github.com/openai/tunnel-client/releases/latest> and put the executable on `PATH`.

OpenAI recommends checking the built-in quickstart before first use:

```powershell
tunnel-client help quickstart
```

### 4. Configure the tunnel-client profile

Use a shell-only environment variable for the runtime key:

```powershell
$env:CONTROL_PLANE_API_KEY = 'sk-...'
$tunnelId = 'tunnel_0123456789abcdef0123456789abcdef'
```

SPARK_Transport is a local HTTP MCP server, so initialize the standard no-auth HTTP sample and point it at the loopback MCP endpoint:

```powershell
tunnel-client init `
  --sample sample_mcp_remote_no_auth `
  --profile spark-transport `
  --tunnel-id $tunnelId `
  --mcp-server-url http://127.0.0.1:8765/mcp
```

Validate the profile before running it:

```powershell
tunnel-client doctor --profile spark-transport --explain
```

Then start the tunnel in the foreground:

```powershell
tunnel-client run --profile spark-transport
```

Keep **both** SPARK_Transport and `tunnel-client run` running while ChatGPT scans or calls tools. OpenAI documents that connector discovery and MCP calls depend on a healthy running `tunnel-client`.

By default, `tunnel-client` exposes a loopback-only operator surface on port `8080`. From another PowerShell window:

```powershell
Invoke-RestMethod http://127.0.0.1:8080/healthz
Invoke-RestMethod http://127.0.0.1:8080/readyz
```

The local tunnel admin UI is normally:

```text
http://127.0.0.1:8080/ui
```

### 5. Attach the tunnel to ChatGPT

On **ChatGPT Web**:

1. Ensure Developer Mode is enabled for the account/workspace.
2. Open <https://chatgpt.com/plugins> or use the current **Settings/Workspace Settings → Apps → Create** flow.
3. Create a developer-mode custom app.
4. Under **Connection**, choose **Tunnel**.
5. Select the tunnel from the list, or paste the `tunnel_id`.
6. Choose **Scan tools** and wait for discovery to finish.
7. Sprint-1 must expose exactly these application tools:
   - `read_file`
   - `list_directory`
8. Create/save the draft app and enable it in a new chat.

A minimal verification prompt is:

```text
Use SPARK_Transport to list the configured root directory ".". Do not modify anything.
```

If `SPARK_TRANSPORT_ROOT` points at this repository, a second check is:

```text
Use SPARK_Transport to read README.md. Do not use any write or command-execution tool.
```

### 6. Stop / restart behavior

The tunnel and MCP daemon do not have to run permanently, but they **must be running when ChatGPT discovers or calls the MCP tools**.

```powershell
npm run daemon:stop
```

If SPARK_Transport or `tunnel-client` is stopped, ChatGPT tool calls through that tunnel fail until the process is restarted/reconnected. The OpenAI tunnel registration itself is not the local daemon process.

### 7. Troubleshooting

| Symptom | Check |
|---|---|
| `SPARK_Transport` unavailable locally | `npm run daemon:status` and `Invoke-RestMethod http://127.0.0.1:8765/health` |
| `tunnel-client` not ready | `tunnel-client doctor --profile spark-transport --explain`; then check `/readyz` and `/ui` |
| Tunnel not visible in ChatGPT | Associate the tunnel with the target ChatGPT workspace and verify **Tunnels Read + Use** |
| Tool scan/calls fail | Keep `tunnel-client run --profile spark-transport` running and confirm the local `/mcp` endpoint is reachable |
| Tool list contains write/delete/exec | Wrong server/build/profile; Sprint-1 must expose only `read_file` and `list_directory` |
| `OUTSIDE_ALLOWED_ROOT` / path error | Check `SPARK_TRANSPORT_ROOT`; tool paths are relative and may not escape the configured root |
| ChatGPT UI labels differ | MCP/full-app support is beta; follow the current Developer Mode/App creation flow, keeping **Connection = Tunnel** |

### 8. Security boundary

- No inbound firewall port or public MCP listener is required.
- Keep `SPARK_TRANSPORT_HOST=127.0.0.1` for Sprint-1.
- Never commit `CONTROL_PLANE_API_KEY` or tunnel credentials.
- The allowed root is the filesystem security boundary exposed by Sprint-1.
- Sprint-1 intentionally has **no** write, modify, delete, or command-execution MCP tool.

## Configuration

| Variable | Required | Default | Purpose |
|---|---:|---|---|
| `SPARK_TRANSPORT_ROOT` | Yes | — | Allowed filesystem root |
| `SPARK_TRANSPORT_HOST` | No | `127.0.0.1` | Sprint-1 requires loopback |
| `SPARK_TRANSPORT_PORT` | No | `8765` | Local MCP port |
| `SPARK_TRANSPORT_MCP_PATH` | No | `/mcp` | MCP endpoint |
| `SPARK_TRANSPORT_HEALTH_PATH` | No | `/health` | Local daemon health endpoint |
| `SPARK_TRANSPORT_MAX_READ_BYTES` | No | `1048576` | Maximum UTF-8 file size |
| `SPARK_TRANSPORT_STATE_DIR` | No | `.runtime` | PID/log state |

## Safety boundary

Sprint-1 rejects:

- parent traversal (`..`),
- absolute/drive-qualified paths,
- paths resolving outside the allowed root,
- symlink/junction escapes,
- non-file reads and non-directory listings,
- non-UTF-8 content for `read_file`,
- files over the configured size limit.

The server does not elevate privileges and exposes no state-changing MCP tool.

## Tests

```bash
npm test
```

Sprint-1 test coverage includes filesystem containment, traversal rejection, absolute-path rejection, symlink escape rejection, structured tool errors, MCP discovery, tool listing/calling, modern header validation, absence of session headers, and daemon start/status/stop/restart.

See `evidence/SPRINT1_TEST_REPORT.md` for the tested baseline.

## Development artifacts

- `AGENTS.md` — reusable pArc/PIM3 engineering charter supplied by the project
- `SWE1.md` — SPARK_Transport requirements/constraints
- `SWE2.md` — architecture/process ledger
- `ARCH.md` — stable Architecture Contract
- `ARCH_QGate.md` — architecture review worksheet/result
- `SWE3.md` — implementation backlog and unresolved work
- `MIGRATION_REPORT.md` — what was reused from the prior mcpwriter snapshot

## Sprint roadmap

- **Sprint-1:** read-only local MCP daemon (`read_file`, `list_directory`) + tunnel PoC.
- **Sprint-2:** file create/update/delete and command execution with authorization, confirmation, backup/recovery, and audit controls.
- **Sprint-3:** stable producer/transport contract for sibling `ACT_Tool`; ACT_Tool owns Obsidian UI/plugin behavior.
- **Sprint-4:** public SPARK gateway, OAuth, user/device routing, outbound local-agent channel.
- **Sprint-5:** packaging/distribution/operations for SPARK_Transport.
