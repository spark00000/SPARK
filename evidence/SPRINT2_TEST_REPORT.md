# Sprint-2 / 0.0.1 Test Report

**Date:** 2026-09-12  
**Target:** SPARK_Transport 0.0.1 Small PoC  
**Scope:** CRUD + recoverable delete + simple execution + result/ledger + MCP/lifecycle regression

## 1. Release-version verification

GitHub Actions workflow: `SPARK Transport CI`  
Run ID: `34684217502`  
Head SHA: `5014a3e816c4ee6af57dd6fe6c300199789a3f93`  
Runtime/package version under test: `0.0.1`

| Target | Runtime | Result |
|---|---|---|
| Ubuntu `ubuntu-latest` | Node 24 | **PASS** |
| Windows `windows-latest` | Node 24 | **PASS** |

Both jobs completed successfully and the `npm test` step passed.

## 2. Verified behavior represented in the test suite

### Filesystem / CRUD

- list/read
- create/write/modify
- create directory
- copy/move
- write/modify recovery metadata
- traversal rejection
- absolute-path rejection
- symlink escape rejection where fixture is supported
- Windows NTFS junction escape rejection
- missing child creation through escaping junction rejection

### Recoverable delete

- actual Windows Recycle Bin source-removal test
- product implementation has no permanent-delete fallback from `delete_path`

### Simple execution

- stdout/stderr capture
- exit code / non-zero failure
- timeout
- bounded stdout and stderr independently
- timeout descendant process-tree cleanup / orphan-marker negative test
- no automatic elevation

### Result / observability

- normalized operation result envelope
- unique operation ID
- mutation `changed` indication
- explicit failure/elevation metadata
- append-only JSONL operation ledger
- MCP `structuredContent`

### Runtime / protocol

- daemon start/status/stop/restart
- MCP `2026-07-28` discover/list/call regression
- modern header mismatch rejection
- no legacy GET/SSE session path

## 3. Earlier full-suite verification

Initial workflow run after adding the matrix and all source/test changes:

- Run ID: `34684121732`
- Head SHA: `26081ef9030127aa9a21f076e4ae7682c5626fbd`
- Ubuntu Node 24: **PASS**
- Windows Node 24: **PASS**

The final `0.0.1` version commit was then independently rerun as §1 and also passed on both targets.

## 4. Release conclusion

**Automated 0.0.1 source acceptance: PASS.**

The following are deliberately not claimed by this report:

- native Windows Job Object ownership backend — future hardening debt; 0.0.1 uses verified Windows tree termination on timeout.
- distribution-grade OS filesystem/network sandbox for `run_command`.
- Claude/other Brain Host runtime E2E.
- GUI Computer Use.
- live ChatGPT mutation/exec E2E against the user's local machine after deployment of the new 0.0.1 daemon.

The already-connected ChatGPT MCP daemon must be updated/restarted to the 0.0.1 source before that final live deployment acceptance can be performed.
