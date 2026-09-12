# SPARK_Transport — Architecture Reference Study 1.22

**Date:** 2026-09-12  
**Purpose:** SPARK_Transport Sprint-2 architecture 재정립을 위한 source-level comparison  
**Scope:** CatDesk, Local Coding Agent, ChatGPT Local Coder, Jan

## 1. Executive Conclusion

세 coding-agent 프로젝트는 SPARK_Transport가 다시 구현할 필요가 없는 문제를 이미 상당 부분 다루고 있다. 그러나 어느 하나도 SPARK의 target architecture를 그대로 제공하지는 않는다.

가장 유용한 조합은 다음과 같다.

```text
CatDesk
  -> process lifecycle / timeout / Windows Job Object / bounded output

Local Coding Agent
  -> permission resolver / root capability / private authority state / local dashboard

ChatGPT Local Coder
  -> structured tool result / activity stream / MCP session + admin UX

Jan
  -> future client/UI / MCP host / provider-neutral and local-model architecture
```

SPARK_Transport는 이 요소를 **Client/Transport/Core/Policy/PAL**로 분리하여 조합한다.

## 2. Reproducible Source Snapshots

| Project | Reviewed main commit | License |
|---|---|---|
| CatDesk | `41900ba851334713061053f345740c1ddcaf5283` | MIT |
| Local Coding Agent | `95144e610ddcc3bb5a879117803907c008b1a88e` | AGPL-3.0-or-later |
| ChatGPT Local Coder | `81a53c9c553fde3b1c3fa5b484d23c6d1d3f38b4` | MIT |
| Jan | `6ccd6f4ad227cf5f0f6bfbb118729dfb4f3a8d32` | Apache-2.0 |

## 3. Comparison Matrix

| Concern | CatDesk | Local Coding Agent | ChatGPT Local Coder | SPARK decision |
|---|---|---|---|---|
| Model API required by local daemon | No | No | No | No |
| ChatGPT Web/remote MCP orientation | Yes | Yes | Yes | Current client path |
| Filesystem root policy | Canonical workspace root | Strong multi-root resolver | Current code is open/full disk | LCA concept + SPARK implementation |
| Missing-target canonicalization | Partial/general canonical path logic | Longest-existing-ancestor canonicalization | No security boundary | Adopt LCA concept |
| Command process tree | Strong | Managed processes | Managed processes | Adopt CatDesk pattern |
| Windows process cleanup | Job Object | App-specific process management | native child process | Job Object target |
| OS command sandbox | Linux bwrap; Windows native | Explicitly not OS sandbox | Open/native | Do not claim sandbox in PoC |
| Result schema | CommandResult | rich tool results | common `{ok,tool,summary,data}` | SPARK normalized envelope |
| User-visible local activity | TUI/widget | dashboard/audit | admin UI/activity stream | Operation Ledger |
| Long output strategy | bounded buffers | local reports + compact handles | activity/audit + caps | bounded + future handle |
| Approval/policy | modes/approval UX | strict/balanced/full + grants | open | future SPARK policy port |
| Cross-platform abstraction | conditional backends | cross-platform policy | platform branches | formal PAL |
| UI scope | TUI/widget/mascot | dashboard + desktop app | admin web UI | UI kept outside core |
| License reuse risk | low/MIT | high for direct reuse/AGPL | low/MIT | study concepts; check reuse case-by-case |

## 4. CatDesk

### 4.1. Source structure observed

Important files:

```text
src/command.rs
src/process_runner.rs
src/linux_sandbox.rs
src/workspace_tools.rs
src/mcp.rs
src/server.rs
src/state.rs
src/change_tracking/*
src/widget/*
```

CatDesk는 MCP transport, workspace operation, command execution, change tracking, UI/widget 영역을 별도 module로 나누고 있다. 다만 `mcp.rs`, `main.rs`, `server.rs`는 이미 상당히 커져 있어 SPARK는 같은 monolithic growth를 피해야 한다.

### 4.2. Command / process lifecycle

`CommandResult`는 다음을 별도로 보존한다.

- stdout
- stderr
- success
- exit code
- elapsed time
- timeout
- stdout/stderr truncation

Windows process runner는 child를 suspended state로 시작한 뒤 **Windows Job Object**에 할당하고 resume한다. Job handle이 닫히거나 timeout/cancel/drop이 발생하면 전체 process tree를 정리한다.

이 pattern은 SPARK에 직접적으로 유용하다.

### 4.3. Linux backend

Linux에서는 `bubblewrap`을 사용하여 별도 sandbox helper를 구성한다. usable bwrap이 없으면 unconfined fallback 대신 error를 낸다.

이것은 “모든 OS에 하나의 sandbox 구현”보다 **backend-specific execution policy**가 현실적이라는 근거다.

### 4.4. Path / command intent

Workspace path를 canonicalize하고 root escape를 거부한다.

또 `ls/find/tree/rg/mv` 같은 일부 shell intent를 parse/intercept하여 logical operation으로 바꾸려는 코드가 있다.

SPARK는 당장 shell parser까지 확대하지 않되, 장기적으로 “가능하면 logical CRUD tool을 우선하고 shell은 verification/build에 사용”하는 policy reference로 삼는다.

### 4.5. Adopt

- process-tree ownership
- Windows Job Object
- timeout/cancellation cleanup
- bounded stdout/stderr
- command result fields
- OS/backend-specific process implementation
- logical operation 우선

### 4.6. Do not adopt blindly

- UI/widget/mascot/browser feature scope
- 큰 monolithic MCP/server module
- Windows native command가 filesystem sandbox라는 오해

## 5. Local Coding Agent

### 5.1. Source structure observed

핵심 source:

```text
server/permission-resolver.mjs
server/server.mjs
server/README.md
desktop-app/*
```

### 5.2. Permission Resolver

가장 가치 있는 reference다.

Permission root preset:

```text
observe      -> filesystem read / commands deny
edit         -> filesystem write / commands deny
develop      -> filesystem write / commands safe
full_control -> filesystem write / commands full
deny
```

중요한 architectural choice:

```text
working directory != authorization roots
```

또한 non-existing target도 longest existing ancestor를 realpath한 뒤 missing tail을 붙이는 방식으로 canonicalize하여 junction/symlink escape를 막으려 한다.

Temporary grant scope도:

- once
- task
- session
- profile

로 분리한다.

SPARK의 future authorization model에 좋은 reference다.

### 5.3. Private authority state

Approval state를 writable workspace 밖의 private state directory에 둔다. Agent가 자기 approval file을 수정해서 권한을 위조하지 못하도록 하는 설계다.

SPARK의 secret/recovery/ledger state도 동일한 trust-boundary 원칙을 따라야 한다.

### 5.4. Dashboard / output management

MCP endpoint와 local dashboard를 별도 loopback server로 둔다.

또 큰 log/report/output을 local file에 저장하고 ChatGPT에는 compact summary + handle을 보내는 구조가 있다. 이는 ChatGPT Web의 긴 tool output lag를 줄이는 실용적인 pattern이다.

### 5.5. Security limit

프로젝트 자체 문서가 `run_command`가 **OS sandbox가 아님**을 명시한다. Safe mode의 regex blocklist와 root-aware policy는 유용한 guardrail이지만 OS confinement와 동일하지 않다.

### 5.6. Adopt conceptually

- root capability model
- working directory와 authorization 분리
- non-existing target canonicalization
- private approval/authority state
- local-only status/dashboard
- large-output indirection
- risk policy categories

### 5.7. Do not copy directly

- AGPL source code 직접 복사
- regex blocklist를 security boundary로 간주
- all-in-one `server.mjs` 구조

## 6. ChatGPT Local Coder

### 6.1. Source structure observed

```text
src/tools/filesystem.ts
src/tools/shell.ts
src/lib/tool-result.ts
src/lib/activity-log.ts
src/lib/audit.ts
src/lib/mcp-session-manager.ts
src/lib/path-security.ts
src/lib/permissions.ts
public/ui/*
```

### 6.2. Result envelope

모든 tool이 공통 payload를 반환한다.

```text
ok
tool
summary
data
```

그리고 MCP text content와 `structuredContent`를 함께 만든다.

SPARK는 이 아이디어를 확장해 `operationId`, `changed`, normalized error, duration 등을 추가한다.

### 6.3. Activity stream

Activity entry에 다음을 기록한다.

- time
- kind/tool/action
- target
- status
- duration
- session/client
- summary/details

이 구조는 사용자가 요구한 **AI뿐 아니라 사용자에게도 failure를 명확히 보여주는 operation ledger**의 좋은 reference다.

### 6.4. Process tools

단기 command와 장기 process를 분리한다.

```text
run_command
start_process
process_status
process_output
stop_process
```

Sprint-2에서는 `run_command`만 유지하되, 장기 process가 필요해지면 이 decomposition을 reference로 사용한다.

### 6.5. Security baseline은 채택하지 않음

현재 source는 `path-security.ts`에서 workspace를 access boundary가 아닌 default CWD로 취급하고 absolute path를 허용한다.

`permissions.ts`도 현재 full machine access / any command를 명시한다.

따라서 이 프로젝트는 **security reference가 아니라 result/session/admin UX reference**로만 사용한다.

## 7. Jan

### 7.1. SPARK와 같은 것은 아님

Jan은 ChatGPT subscription message를 재사용하는 MCP bridge가 아니다.

Cloud OpenAI/Anthropic provider를 쓰면 해당 provider API/key 경로를 사용한다.

그러나 Jan은 local model을 자체 실행할 수 있어 **paid model API 없이도** 완전한 client/model/tool stack을 구성할 수 있다.

### 7.2. Architecture relevance

Jan은:

- Windows/macOS/Linux desktop app
- Tauri-based native shell
- local models
- MCP host
- local OpenAI-compatible API server
- provider/model separation

을 제공한다.

따라서 SPARK의 미래 custom UI 또는 provider-neutral client architecture reference로 가치가 높다.

### 7.3. Local API

Jan의 local server는 기본적으로 localhost에서 OpenAI-compatible REST API를 제공한다. 이는 “API”이지만 cloud billing API가 아니라 local inference interface다.

### 7.4. Future SPARK implication

향후 SPARK UI는 다음 두 종류의 reasoning host를 선택할 수 있다.

```text
A. ChatGPT Web/App
   -> consumer message/subscription
   -> Secure MCP Tunnel
   -> SPARK_Transport

B. SPARK/Jan-like local UI
   -> local model or configured provider
   -> local transport/MCP
   -> SPARK_Transport
```

B에서 frontier cloud model을 직접 쓰려면 일반적으로 provider API/auth가 필요하다. 현재 architecture는 이 provider 선택을 SPARK_Transport core 밖에 둔다.

## 8. SPARK Architecture Decision after Study

최종 layer:

```text
Client / UX
    |
Transport Adapter
    |
Logical Operations
    |
Policy + Result + Ledger + Recovery
    |
PAL
    |
OS Adapter
```

### Why this is stable

- ChatGPT UI가 바뀌어도 core 변경 최소화
- Obsidian을 버려도 core 변경 없음
- Jan/local model을 붙여도 core operation contract 유지
- Windows 외 OS는 PAL 추가로 확장
- GUI Computer Use는 별도 service/port로 추가 가능
- MCP version 변경은 transport adapter 안에서 흡수 가능

## 9. Small PoC Recommendation

0.0.1 목표는 범위를 줄인다.

### Must finish

- Windows PAL
- CRUD
- recoverable delete
- simple native execution
- timeout
- process-tree cleanup
- bounded output
- normalized result
- user-visible operation ledger
- Secure MCP Tunnel E2E

### Defer

- GUI Computer Use
- alternative UI
- Robot
- macOS/Linux/Android
- elevated helper
- strong OS command sandbox
- background process manager
- local model/provider integration

## 10. License Notes

- CatDesk: MIT — source reuse 가능성이 비교적 높으나 attribution/license 조건 준수 필요.
- Local Coding Agent: AGPL-3.0-or-later — source 직접 복사/결합은 SPARK의 라이선스 전략에 큰 영향을 줄 수 있으므로 architecture concept만 참고한다.
- ChatGPT Local Coder: MIT.
- Jan: Apache-2.0.

실제 code reuse 전에는 dependency/derivative-work 범위를 별도 검토한다.

## 11. References

### CatDesk

- https://github.com/Xeift/CatDesk
- https://github.com/Xeift/CatDesk/blob/main/src/command.rs
- https://github.com/Xeift/CatDesk/blob/main/src/process_runner.rs
- https://github.com/Xeift/CatDesk/blob/main/src/linux_sandbox.rs

### Local Coding Agent

- https://github.com/LongNgn204/local-coding-agent
- https://github.com/LongNgn204/local-coding-agent/blob/main/server/permission-resolver.mjs
- https://github.com/LongNgn204/local-coding-agent/blob/main/server/server.mjs
- https://github.com/LongNgn204/local-coding-agent/blob/main/SECURITY.md

### ChatGPT Local Coder

- https://github.com/posavr/chatgpt-local-coder
- https://github.com/posavr/chatgpt-local-coder/blob/main/src/lib/tool-result.ts
- https://github.com/posavr/chatgpt-local-coder/blob/main/src/lib/activity-log.ts
- https://github.com/posavr/chatgpt-local-coder/blob/main/src/tools/shell.ts
- https://github.com/posavr/chatgpt-local-coder/blob/main/src/lib/path-security.ts
- https://github.com/posavr/chatgpt-local-coder/blob/main/src/lib/permissions.ts

### Jan

- https://github.com/janhq/jan
- https://www.jan.ai/docs/desktop
- https://www.jan.ai/docs/desktop/mcp
- https://www.jan.ai/docs/desktop/api-server
- https://www.jan.ai/docs/agent/providers
