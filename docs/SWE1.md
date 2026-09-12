# SWE1 — SPARK_Transport Requirements

**Baseline:** 0.0.0  
**Target:** 0.0.1 Small PoC  
**Status:** Sprint-2 implementation / verification

## 1. Product Goal

SPARK_Transport는 **AI Brain Host와 local/physical capability 사이의 provider-neutral Agent Core**다.

0.0.1은 ChatGPT를 현재 Brain Host로 사용하여 Windows local filesystem CRUD와 simple command execution을 MCP로 수행하는 Small PoC를 완료한다.

Long-term physical scope는 filesystem/process에 한정되지 않으며 Body Port를 통해 drone/robot/device operation으로 확장 가능해야 한다.

## 2. In Scope — 0.0.1

- MCP `2026-07-28` standard-only transport.
- ChatGPT + Secure MCP Tunnel current Brain path.
- allowed-root filesystem operations:
  - `list_directory`
  - `read_file`
  - `create_file`
  - `write_file`
  - `modify_file`
  - `create_directory`
  - `copy_path`
  - `move_path`
  - `delete_path`
- `run_command` simple native process execution.
- overwrite/modify recovery backup + hash.
- Windows Recycle Bin delete; permanent fallback forbidden.
- timeout + child process-tree cleanup.
- bounded stdout/stderr.
- normalized tool result envelope.
- local operation ledger and CLI status visibility.
- Windows + Linux automated regression; Windows is the physical target.

## 3. Architecture-only / Out of Scope — 0.0.1

- Claude Brain adapter implementation/test.
- Google/Gemini Brain adapter implementation/test.
- local-model Brain adapter implementation.
- GUI Computer Use: screen/mouse/keyboard/video.
- drone/robot/device adapters.
- macOS/Linux/Android physical PAL feature parity.
- automatic UAC/elevation.
- distribution-grade OS command sandbox.
- custom SPARK Desktop/Robot UI.
- provider login/session scraping or quota bypass.
- OpenAI/Anthropic/Google model API dependency in the SPARK daemon.

## 4. Functional Requirements

- **REQ-S2-F-001:** Agent Core SHALL expose the 10 tools listed in §2 through standard MCP tool discovery.
- **REQ-S2-F-002:** Create/write/modify/copy/move/delete operations SHALL return explicit success/failure and whether state changed.
- **REQ-S2-F-003:** `write_file` and `modify_file` SHALL preserve recovery metadata before replacement.
- **REQ-S2-F-004:** `delete_path` SHALL use the Windows Recycle Bin on the Windows target and SHALL NOT permanently delete on Recycle Bin failure.
- **REQ-S2-F-005:** `run_command` SHALL use an explicit executable + argument vector with shell parsing disabled by default.
- **REQ-S2-F-006:** `run_command` SHALL return stdout, stderr, exit code/signal, timeout state through the normalized result.
- **REQ-S2-F-007:** Every actual tool call SHALL receive an operation ID and SHALL be appended to a local operation ledger.
- **REQ-S2-F-008:** `SPARK_Transport status` SHALL expose recent operation records in addition to daemon health.
- **REQ-S2-F-009:** Brain-specific quota/message values SHALL NOT be hard-coded into Agent Core.

## 5. Brain / Agent / Body Requirements

- **REQ-S2-A-001:** Brain Host SHALL be separated from Agent Core by a Brain Gateway/connector boundary.
- **REQ-S2-A-002:** MCP SHALL be treated as a transport adapter, not the Agent Core domain model.
- **REQ-S2-A-003:** Human UX SHALL remain separable from Agent Core.
- **REQ-S2-A-004:** Physical execution SHALL be reached through Body Port/PAL abstractions so future drone/robot/device adapters can coexist with Windows filesystem/process adapters.
- **REQ-S2-A-005:** Claude integration SHALL exist only as an architecture extension point until a real Claude target can be verified.

## 6. Security / Safety Requirements

- **REQ-S2-S-001:** Reject `..` traversal.
- **REQ-S2-S-002:** Reject absolute, drive-qualified and UNC tool paths.
- **REQ-S2-S-003:** Resolve real paths and reject symlink/junction escape.
- **REQ-S2-S-004:** Non-existing create targets SHALL validate the nearest existing ancestor before authorization.
- **REQ-S2-S-005:** Local MCP listener SHALL default to loopback only.
- **REQ-S2-S-006:** No automatic UAC/RunAs/elevation.
- **REQ-S2-S-007:** Command `cwd` SHALL remain inside allowed root, while documentation SHALL explicitly state that cwd confinement is not an OS filesystem sandbox.
- **REQ-S2-S-008:** Timeout SHALL terminate the command's child process tree sufficiently to prevent the verified orphan-process test case.
- **REQ-S2-S-009:** stdout and stderr capture SHALL be bounded independently.
- **REQ-S2-S-010:** User-facing/model-facing failures SHALL not silently claim a mutation succeeded.
- **REQ-S2-S-011:** Secret/provider credentials SHALL not be stored in tracked source/config/logs.

## 7. Result Contract

Every MCP tool call SHALL return a common envelope containing at least:

```text
ok
operationId
operation
summary
changed
data
durationMs
requiresElevation
retryable
error? { code, message, platformCode? }
```

MCP response SHALL provide both textual `content` and `structuredContent`.

## 8. Quality Requirements

- **REQ-S2-Q-001:** File mutation negative tests SHALL cover traversal, absolute paths and symlink/junction escape.
- **REQ-S2-Q-002:** Command tests SHALL cover success, non-zero exit, timeout, bounded output and child-tree cleanup.
- **REQ-S2-Q-003:** Windows target verification SHALL cover actual Recycle Bin behavior.
- **REQ-S2-Q-004:** Automated CI SHALL run on Windows and Linux with Node 24.
- **REQ-S2-Q-005:** Local state SHALL default to a user-private state directory outside the repository/workspace unless explicitly overridden for test/development.
- **REQ-S2-Q-006:** The daemon SHALL remain independently startable/stoppable without GUI or sibling projects.

## 9. Acceptance — 0.0.1

- **ACC-001:** Tool discovery returns exactly the 10 0.0.1 tools.
- **ACC-002:** read/list positive tests pass.
- **ACC-003:** create/write/modify/mkdir/copy/move positive tests pass.
- **ACC-004:** write/modify recovery evidence exists.
- **ACC-005:** traversal and absolute-path negative tests pass.
- **ACC-006:** symlink escape test passes where supported.
- **ACC-007:** Windows junction escape, including a not-yet-created child target, is rejected.
- **ACC-008:** actual Windows Recycle Bin source removal passes; no permanent fallback exists.
- **ACC-009:** command stdout/stderr/non-zero exit tests pass.
- **ACC-010:** command timeout test passes.
- **ACC-011:** timeout child-process-tree cleanup test passes.
- **ACC-012:** bounded stdout/stderr test passes.
- **ACC-013:** normalized result + operation ledger tests pass.
- **ACC-014:** daemon lifecycle test passes.
- **ACC-015:** MCP modern protocol regression passes.
- **ACC-016:** Windows CI and Linux CI both pass.
- **ACC-017:** ChatGPT Secure MCP Tunnel E2E is revalidated with mutation + simple execution before final deployment acceptance.

`ACC-017` requires the user's live ChatGPT/tunnel environment and is recorded separately from source/CI acceptance.

## 10. Cost / Brain Host Requirement

Brain deployment cost is categorized as:

```text
A. Consumer subscription Chat + connector/MCP
B. Coding-product allowance (Work/Codex/Claude Code)
C. Pay-as-you-go API/usage credit
D. Local model
```

Current research is maintained in `BRAIN_HOST_COMPARISON.md`. Historical quota numbers SHALL be labeled with their model/date rather than treated as current guarantees.

## 11. References

- `ARCH.md`
- `ARCH_REFERENCE_STUDY.md`
- `BRAIN_HOST_COMPARISON.md`
- MCP `2026-07-28`
