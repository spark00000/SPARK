# SPARK_Transport Sprint-1 Test Report

**Date:** 2026-09-12  
**Baseline:** 0.0.0  
**Runtime:** Node.js v22.16.0, npm 10.9.2  
**Execution OS:** Linux x86_64

## 결과 요약

- 전체 test: **17 PASS / 0 FAIL / 0 SKIP**
- source/test syntax check: **PASS**
- local daemon lifecycle: **PASS**
- MCP modern protocol smoke: **PASS**
- 실제 symlink escape 차단: **PASS**
- Secure MCP Tunnel → 실제 ChatGPT 호출: **NOT RUN / 사용자 환경 integration 필요**
- Windows target 실행: **현재 build 환경에서는 NOT RUN**

## Acceptance Evidence

| Acceptance | Evidence | Result |
|---|---|---|
| ACC-S1-001 root 내부 file read | UTF-8 text read + hash metadata | PASS |
| ACC-S1-002 directory list | list test + HTTP call | PASS |
| ACC-S1-003 parent traversal | path-policy test | PASS |
| ACC-S1-004 absolute path | absolute-path test | PASS |
| ACC-S1-005 symlink escape | 실제 symlink fixture | PASS |
| ACC-S1-006 missing/wrong type | structured tool error | PASS |
| ACC-S1-007 read-only tool scope | discovery/definition test | PASS |
| ACC-S1-008 MCP discover/list/call | HTTP protocol test | PASS |
| ACC-S1-009 header/body mismatch | HTTP 400 / `-32020` | PASS |
| ACC-S1-010 no modern session/GET SSE | no `Mcp-Session-Id`; GET 405 | PASS |
| ACC-S1-011 daemon lifecycle | start/status/stop/restart | PASS |
| ACC-S1-012 Secure MCP Tunnel + ChatGPT | 실제 workspace 필요 | BLOCKED |

## 추가 Protocol 검증

- `MCP-Protocol-Version` 누락 → HTTP 400 / `-32020`
- unknown MCP method → HTTP 404 / JSON-RPC `-32601`
- `server/discover` → `2026-07-28`과 tools capability 광고
- `tools/list` → deterministic result, `ttlMs: 0`, `cacheScope: private`
- 성공 response → `resultType: complete`
- server identity → `_meta.io.modelcontextprotocol/serverInfo`

## Dependency Note

공식 MCP TypeScript SDK v2를 향후 내부 구현으로 사용하는 것이 목표입니다. 현재 build 환경에서 npm registry 접근이 불가능했던 경우 Sprint-1은 외부 dependency 없이 필요한 표준 wire surface만 구현합니다. 이 선택은 MCP 외부 contract를 변경하지 않습니다.

Raw test output은 `evidence/npm-test-output.txt`를 참조합니다.
