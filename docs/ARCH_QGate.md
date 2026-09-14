# ARCH QGate — SPARK 0.0.1 Release Candidate

**Target:** 0.0.1 multi-user / deployment release candidate
**Inherited baseline:** `v0.0.0` private-use baseline
**Review date:** 2026-09-15
**Review type:** Author self-check + automated evidence — **independent peer review 아님**

| 항목 | 결과 |
|---|---|
| 0.0.0 Brain Gateway / Agent Core / Body Port separation | PASS — inherited |
| MCP standard / no proprietary protocol extension | PASS |
| 10-tool CRUD/process surface unchanged | PASS |
| traversal / absolute / symlink / Windows junction containment | PASS |
| write/modify recovery + Windows Recycle Bin / no permanent fallback | PASS |
| command output bound + process-tree timeout cleanup | PASS |
| synchronous command/tool/request/lifecycle waits bounded | PASS |
| timed-out mutation `stateUncertain` + overlapping mutation fail-closed | PASS |
| per-instance Bearer authorization positive/negative regression | PASS |
| raw SPARK access key excluded from config; only SHA-256 digest stored | PASS |
| access-key generator = 32 CSPRNG bytes / 256 bits | PASS |
| `SPARK init` refuses existing config overwrite | PASS |
| new-install example config uses fail-closed bearer placeholder | PASS |
| distinct per-user/device tunnel + per-instance credential architecture | PASS — architecture/implementation boundary documented |
| central SPARK payload relay absent | PASS |
| ChatGPT UI progress overlay source regression | PASS |
| ChatGPT Windows DOM progress experiment | PASS — `BRAIN IDLE`, `SPARK run_command 12s/30s`, 40% observed then removed |
| exact usage telemetry transparency | PASS — UI reports unavailable rather than fabricating token/credit values |
| ChatGPT UI PowerShell-BOM runtime JSON compatibility | PASS |
| private config/runtime excluded from Git | PASS |
| tracked `.gitignore` excludes `_pArc/`, `.runtime/`, `.SPARK.wiki`, private config without local-exclude dependency | PASS |
| local Node regression | PASS — candidate source |
| ChatGPT UI validate | PASS — candidate source |
| PowerShell parser gate | PASS — start/stop/init/bootstrap/validator/ChatGPT UI scripts |
| Windows live `SPARK.cmd validate` after restart onto 0.0.1 source | PENDING final live gate |
| ChatGPT `Access token / API key` own-key success / foreign-key denial | **PENDING final multi-user gate** |
| Ubuntu Node 24 CI on candidate commit | PASS — run `34907410144` |
| Windows Node 24 CI on candidate commit | PASS — run `34907410144` |
| ProcessService filesystem/network confinement outside FileService roots | **TBD / KNOWN GAP** — current `X` gates cwd only; child authority remains ambient OS-user authority |
| hostile process on the same local PC calling loopback SPARK | **TBD** — explicitly outside 0.0.1 remote/workspace-user isolation scope |
| Independent Architecture Peer | PENDING — process gate |

## 1. 0.0.1 Acceptance Evidence

Candidate acceptance requires all of the following before the final `v0.0.1` tag is created or moved:

- package/runtime/launcher version all report `0.0.1`.
- `npm test` full regression PASS.
- `npm run chatgpt-ui:validate` PASS.
- PowerShell lifecycle/parser PASS.
- tracked repository hygiene/privacy/secret check PASS.
- `SPARK auth generate` produces a 256-bit prefixed token and a matching SHA-256 digest.
- `SPARK init` creates a new private config but refuses to overwrite an existing one.
- bearer-auth MCP requests reject missing/wrong keys and accept the configured instance key.
- watchdog regressions prove tool/request/lifecycle control returns within declared bounds.
- experimental progress UI renders on the real ChatGPT Windows DOM and remains removable/recoverable.
- after runtime restart, Windows `SPARK.cmd validate` PASS on the 0.0.1 source.
- ChatGPT custom app configured as `Access token / API key` + Bearer succeeds with its own SPARK instance key and fails with another instance key.
- GitHub Actions Ubuntu Node 24 PASS.
- GitHub Actions Windows Node 24 PASS.

Exact candidate SHA, CI run IDs and final live runtime acceptance belong in local-only `_pArc/SWE3.md`.

## 2. Findings / Debt

- **DEBT-001:** Native Windows Job Object remains the preferred stronger long-term process-ownership backend.
- **DEBT-002 / TBD:** `run_command` cwd containment is not an OS filesystem/network sandbox. If a root grants `X`, the launched process may access other locations allowed by the ambient OS account. FileService R/W and Recycle Bin semantics do not constrain arbitrary child-process I/O. Provider-native ProcessService confinement remains deferred.
- **DEBT-003 / RESEARCH:** Cygwin remains only a possible Windows POSIX/ACL File/Permission PAL helper; it is not a ProcessService sandbox.
- **DEBT-004 / TBD:** same-PC hostile local-process isolation remains deferred; 0.0.1 prioritizes remote/workspace-user cross-access prevention.
- **DEPLOY-001:** 0.0.1 uses one distinct Secure MCP Tunnel and one high-entropy bearer credential per SPARK instance. It intentionally has no SPARK-operated central payload relay or OAuth service.
- **DEPLOY-002:** the raw per-instance access key is an initial connection secret. Normal SPARK config stores only its SHA-256 digest. Manual generation/rotation remains possible with `SPARK auth generate`.
- **UX-001 / EXPERIMENTAL:** Brain working indication is a ChatGPT DOM heuristic and may require adaptation when the provider UI changes. SPARK watchdog progress is measured locally; provider token/credit values are not invented when unavailable.
- **PROCESS-001:** Independent Architecture Peer review has not been executed in this authoring context.

## 3. Gate Conclusion

**0.0.1 source-level release-candidate gate: PASS locally, subject to the pending final live and CI gates listed above.**

This is **not yet the final 0.0.1 baseline** and does not authorize creating/moving `v0.0.1` until the candidate commit passes cross-platform CI and the user-scoped ChatGPT bearer-key E2E. ProcessService filesystem/network confinement and same-PC hostile-process isolation remain explicit deferred gaps rather than implied guarantees.
