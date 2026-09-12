# SWE3 — SPARK_Transport Implementation / Verification Backlog

**Baseline:** 0.0.0  
**Target:** 0.0.1

## Sprint-1 — Read-only MCP PoC

### 1.1. Read/list MCP path
- [x] COMPLETE — read/list local implementation and protocol tests.
- [x] COMPLETE — ChatGPT Web/App read/list E2E previously demonstrated.

## Sprint-2 — 0.0.1 CRUD + Simple Execution

### 2.1. Architecture stabilization
- [x] COMPLETE — CatDesk / Local Coding Agent / ChatGPT Local Coder source comparison.
- [x] COMPLETE — Jan future client analysis.
- [x] COMPLETE — Brain Gateway introduced.
- [x] COMPLETE — Body Port generalized for future drone/robot/device capability.
- [x] COMPLETE — GUI/Computer Use moved out of Sprint-2.
- Evidence: `ARCH.md`, `ARCH_REFERENCE_STUDY.md`, `BRAIN_HOST_COMPARISON.md`, `SWE2.md`.

### 2.2. Brain Host cost/quota research
- [x] COMPLETE — CatDesk historical `3,000 messages/week` source identified as archived GPT-5.5 ChatGPT documentation.
- [x] COMPLETE — current GPT-5.6 fixed 3,000/week claim rejected as unsupported.
- [x] COMPLETE — Claude Pro/Max remote MCP + subscription-usage path researched.
- [x] COMPLETE — Claude implementation deferred until real target is available.
- [x] COMPLETE — Gemini Apps quota noted; comparable web-chat custom MCP route not verified.

### 2.3. CRUD
- [x] IMPLEMENTED — list/read/create/write/modify/mkdir/copy/move.
- [x] IMPLEMENTED — write/modify recovery backup + SHA-256.
- [x] IMPLEMENTED — allowed-root/path policy.
- [x] IMPLEMENTED — Windows Recycle Bin delete, no permanent fallback.

### 2.4. Normalized Result + Ledger
- [x] IMPLEMENTED — operation ID/result envelope decorator.
- [x] IMPLEMENTED — JSONL operation ledger.
- [x] IMPLEMENTED — `status` recent-operation output.
- [x] IMPLEMENTED — default private state outside repository/workspace.

### 2.5. Simple execution
- [x] IMPLEMENTED — non-elevated explicit executable + args, `shell:false`.
- [x] IMPLEMENTED — timeout.
- [x] IMPLEMENTED — bounded stdout/stderr.
- [x] IMPLEMENTED — Windows descendant termination via `taskkill /T /F` on timeout.
- [x] IMPLEMENTED — POSIX process-group termination on timeout.
- [ ] DEBT — native Windows Job Object backend remains preferred for stronger process ownership beyond the Small PoC.
- [ ] DEBT — distribution-grade OS filesystem/network sandbox is not part of 0.0.1.

### 2.6. Automated verification
- [x] IMPLEMENTED — command success/non-zero/timeout tests.
- [x] IMPLEMENTED — bounded-output test.
- [x] IMPLEMENTED — timeout child-tree orphan test.
- [x] IMPLEMENTED — normalized result/ledger tests.
- [x] IMPLEMENTED — Windows junction escape test.
- [x] IMPLEMENTED — actual Windows Recycle Bin test.
- [x] IMPLEMENTED — Windows/Linux GitHub Actions matrix.
- [ ] VERIFY — first Windows/Linux matrix run completion/result.

### 2.7. 0.0.1 promotion
- [ ] WAITING — mandatory CI gates must pass before version promotion.
- [ ] After PASS: update `package.json` + `src/constants.mjs` to `0.0.1`.
- [ ] After PASS: update `evidence/SPRINT2_TEST_REPORT.md`.
- [ ] After PASS: rerun Windows/Linux CI on promotion commit.

### 2.8. Live ChatGPT mutation/exec E2E
- [ ] TARGET ENVIRONMENT — use current Secure MCP Tunnel and enabled SPARK_Transport app to exercise create/write/modify/delete/run_command against a disposable allowed root.
- This is distinct from source/CI acceptance and requires the user's live tunnel/client environment.

## Next Sprint — GUI / Computer / Physical Extension

- [ ] ComputerService / PlatformComputerPort.
- [ ] Screen/mouse/keyboard/video/keyframe design.
- [ ] Claude Brain adapter when a test target exists.
- [ ] DronePort / RobotPort requirements when physical target is selected.
