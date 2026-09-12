# SWE3 — SPARK_Transport Implementation / Verification Backlog

**Baseline:** 0.0.1  
**Status:** CRUD + Simple Execution Small PoC source baseline complete

## Sprint-1 — Read-only MCP PoC

### 1.1. Read/list MCP path
- [x] COMPLETE — read/list local implementation and protocol tests.
- [x] COMPLETE — ChatGPT Web/App read/list E2E previously demonstrated.

## Sprint-2 — 0.0.1 CRUD + Simple Execution

### 2.1. Architecture stabilization
- [x] COMPLETE — CatDesk / Local Coding Agent / ChatGPT Local Coder source comparison.
- [x] COMPLETE — Jan future client analysis.
- [x] COMPLETE — Brain Gateway introduced between Brain Host and Agent Core.
- [x] COMPLETE — Body Port generalized for future Computer/drone/robot/device capability.
- [x] COMPLETE — Human UX Plane separated from Core.
- [x] COMPLETE — GUI/Computer Use moved out of Sprint-2.
- Evidence: `ARCH.md`, `ARCH_REFERENCE_STUDY.md`, `BRAIN_HOST_COMPARISON.md`, `SWE2.md`.

### 2.2. Brain Host cost/quota research
- [x] COMPLETE — CatDesk `3,000 messages/week` source identified as historical GPT-5.5 ChatGPT allowance cited through an archived OpenAI Help page.
- [x] COMPLETE — current GPT-5.6 fixed `3,000/week` claim rejected as unsupported.
- [x] COMPLETE — cost model expanded to Consumer Chat+MCP / coding allowance / API-PAYG / local model.
- [x] COMPLETE — Claude Pro/Max remote MCP + included subscription-usage path researched.
- [x] COMPLETE — Claude implementation deferred until a real target environment is available.
- [x] COMPLETE — Gemini Apps quota noted; equivalent web-chat custom MCP path not verified in this Sprint.

### 2.3. CRUD
- [x] COMPLETE — list/read/create/write/modify/mkdir/copy/move.
- [x] COMPLETE — write/modify recovery backup + SHA-256.
- [x] COMPLETE — traversal/absolute/realpath containment.
- [x] COMPLETE — Windows junction/symlink escape defense.
- [x] COMPLETE — Windows Recycle Bin delete, no permanent fallback.

### 2.4. Normalized Result + Ledger
- [x] COMPLETE — operation ID/result envelope.
- [x] COMPLETE — explicit `changed`, error, duration/elevation/retry metadata.
- [x] COMPLETE — JSONL operation ledger.
- [x] COMPLETE — `status` recent-operation output.
- [x] COMPLETE — default private state outside repository/workspace.

### 2.5. Simple execution
- [x] COMPLETE — non-elevated explicit executable + argv, `shell:false`.
- [x] COMPLETE — timeout.
- [x] COMPLETE — independently bounded stdout/stderr.
- [x] COMPLETE — Windows timeout descendant termination via `taskkill /T /F`.
- [x] COMPLETE — POSIX process-group termination.
- [x] COMPLETE — orphan child marker test.
- [ ] DEBT — native Windows Job Object backend remains preferred for stronger long-term ownership.
- [ ] DEBT — distribution-grade filesystem/network sandbox is not part of 0.0.1.

### 2.6. Automated verification
- [x] PASS — CRUD/tool tests.
- [x] PASS — traversal/absolute/symlink tests.
- [x] PASS — Windows junction escape including not-yet-created child target.
- [x] PASS — actual Windows Recycle Bin source-removal test.
- [x] PASS — command stdout/stderr/non-zero exit.
- [x] PASS — command timeout.
- [x] PASS — bounded stdout/stderr.
- [x] PASS — timeout child-tree cleanup.
- [x] PASS — normalized result/ledger tests.
- [x] PASS — daemon lifecycle.
- [x] PASS — MCP 2026-07-28 regression.
- [x] PASS — GitHub Actions Ubuntu Node 24.
- [x] PASS — GitHub Actions Windows Node 24.
- Evidence run: `34684217502`, head SHA `5014a3e816c4ee6af57dd6fe6c300199789a3f93`.

### 2.7. 0.0.1 promotion
- [x] COMPLETE — `package.json` version = `0.0.1`.
- [x] COMPLETE — runtime `APP_VERSION` = `0.0.1`.
- [x] COMPLETE — version-promotion commit was retested on Ubuntu + Windows and both passed.
- [x] COMPLETE — `evidence/SPRINT2_TEST_REPORT.md` updated.

### 2.8. Live ChatGPT mutation/exec E2E
- [ ] DEPLOYMENT ACCEPTANCE — current user's local daemon/tunnel must be updated to GitHub 0.0.1 before create/write/modify/delete/run_command can be invoked from ChatGPT.
- Current chat's already-connected daemon is an older read-only deployment and cannot prove the new 0.0.1 tools.
- This item does **not** invalidate the automated 0.0.1 source baseline; it remains the final live-deployment acceptance.

### 2.9. Independent Architecture Peer QGate
- [ ] PROCESS GATE — independent reviewer not executed in this authoring context.
- Do not treat author self-check as independent review.

## Next Sprint — GUI / Computer / Physical / Alternate Brain

- [ ] ComputerService / PlatformComputerPort.
- [ ] Screen/mouse/keyboard/video/keyframe design.
- [ ] Claude Brain Gateway adapter when a test target exists.
- [ ] Other Brain adapters only after official connector path verification.
- [ ] DronePort / RobotPort / SensorPort / ActuatorPort requirements when a physical target is selected.
