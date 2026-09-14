# ARCH QGate — SPARK 0.0.0

**Target:** 0.0.0 private-use baseline
**Review date:** 2026-09-14
**Review type:** Author self-check + automated cross-platform evidence — **independent peer review 아님**

| 항목 | 결과 |
|---|---|
| Brain Gateway / Agent Core / Body Port separation | PASS |
| GUI/Claude runtime excluded from 0.0.0 | PASS |
| MCP standard / no proprietary extension | PASS |
| CRUD implementation | PASS |
| traversal / absolute / symlink containment | PASS |
| Windows junction containment | PASS |
| write/modify recovery | PASS |
| Windows Recycle Bin actual automated test | PASS |
| no permanent-delete fallback | PASS |
| command stdout/stderr/exit | PASS |
| timeout | PASS |
| bounded output | PASS |
| timeout child-tree cleanup | PASS |
| automatic elevation forbidden | PASS |
| normalized result / operation ledger | PASS |
| ledger/recovery lazy runtime creation from clean state | PASS |
| private config/runtime excluded from Git | PASS |
| tracked `.gitignore` excludes `_pArc/`, `.runtime/`, private config without local-exclude dependency | PASS |
| tunnel runtime identity/profile/hash + Control Plane reuse gate | PASS |
| Transport lifecycle + no-argument help contract | PASS |
| Ubuntu Node 24 CI | PASS |
| Windows Node 24 CI | PASS |
| Integrated ChatGPT UI source/config regression | PASS — local 7/7 before merge, Transport suite 포함 |
| Integrated ChatGPT UI launcher validate | PASS |
| ChatGPT mutation/exec live E2E after local 0.0.0 deployment | PASS — 2026-09-14 live MCP acceptance |
| Transport + Tunnel + ChatGPT UI `SPARK start` live E2E | PASS — 2026-09-14 integrated runtime acceptance |
| ProcessService filesystem/network confinement outside FileService roots | **TBD / KNOWN GAP** — current `X` gates cwd only; child process authority is ambient OS-user authority |
| Independent Architecture Peer | PENDING — process gate |

## Evidence

0.0.0 baseline acceptance requires all of the following on the tagged source:

- local `npm test` full regression PASS
- ChatGPT UI theme validate PASS
- PowerShell lifecycle parser PASS
- release-file privacy/secret scan PASS
- tracked repository hygiene check PASS (`_pArc/`, `.runtime/`, private config excluded without local/global ignore dependency)
- live tunnel identity/control-plane + 10-tool ChatGPT MCP smoke PASS
- GitHub Actions Ubuntu Node 24 PASS
- GitHub Actions Windows Node 24 PASS

Exact run IDs, merge SHA, tag and live runtime acceptance are maintained in local-only `_pArc/SWE3.md`.

## Findings / Debt

- **DEBT-001:** Windows process ownership is verified through timeout tree termination for the private-use baseline; native Windows Job Object remains the preferred stronger production backend.
- **DEBT-002 / TBD:** `run_command` cwd containment is not an OS filesystem/network sandbox. If any root grants `X`, the launched process may read/write/delete `R`-only or unconfigured paths wherever the ambient OS user is permitted; FileService R/W and Recycle Bin-only semantics do not constrain arbitrary child I/O. SPARK will not add a parallel command parser or default heavyweight container/VM to mask this gap. ProcessService filesystem/network confinement remains TBD until a simple provider-native PAL mechanism is selected and verified.
- **DEPLOY-001:** ChatGPT mutation/exec live MCP E2E는 2026-09-14에 최신 Transport service/tunnel 기준으로 완료했습니다.
- **DEPLOY-002:** 통합된 Transport + Tunnel + ChatGPT UI `SPARK start` 경로의 최종 사용자 runtime acceptance를 2026-09-14에 완료했습니다.
- **PROCESS-001:** Independent Architecture Peer review has not been executed in this authoring context.

## Gate Conclusion

**0.0.0 source/implementation/live private-use baseline gate: PASS for the declared private-use scope.**

This PASS does **not** certify ProcessService filesystem/network confinement: that capability is explicitly **TBD / KNOWN GAP** and is not part of the 0.0.0 security guarantee. Independent Architecture Peer review remains a separate process gate and is not silently treated as completed.
