# ARCH — SPARK_Transport

**Version:** 0.0.1  
**Status:** Accepted Small PoC Architecture Baseline  
**Architecture review:** 2026-09-12 / 1.23

## 1. Purpose and Product Boundary

SPARK_Transport는 특정 AI UI나 특정 model에 종속된 coding agent가 아니라 **AI Brain과 local/physical capability 사이의 provider-neutral Agent Core**를 제공한다.

현재 first Brain Host는 ChatGPT Web/App이고 OpenAI Secure MCP Tunnel을 통해 연결한다. ChatGPT subscription message를 사용해 별도 model API 비용을 피하는 방식은 중요한 current deployment strategy이지만 Agent Core의 dependency가 아니다.

장기적으로 Brain Host는 ChatGPT, Claude, Google 계열 agent, local model 또는 다른 reasoning host로 교체될 수 있고, Body는 filesystem/process에서 drone/robot/device로 확장될 수 있다.

## 2. Stable Layer Model

```mermaid
flowchart LR
    subgraph B[Brain Host Plane]
      O[ChatGPT Web/App\ncurrent]
      C[Claude\narchitecture only]
      G[Google/other AI\narchitecture only]
      L[Local Model\nfuture]
    end

    BG[Brain Gateway\nconnector / ingress / session / capability normalization]

    subgraph H[Human UX Plane]
      U1[Current Chat UI]
      U2[Obsidian workflow]
      U3[Future SPARK Desktop / Ledger UI]
      U4[Future SPARK Robot UI]
    end

    CORE[SPARK Agent Core\nLogical Operations + Policy + Result + Ledger + Recovery]
    BP[Body Port Layer\nCapability abstraction]

    subgraph BODY[Physical / Execution Body]
      W[Windows PAL\nfilesystem / process / recycle bin]
      D[Drone Adapter\nfuture]
      R[Robot Adapter\nfuture]
      DEV[Other Device Adapter\nfuture]
    end

    O --> BG
    C -.TBD.-> BG
    G -.TBD.-> BG
    L -.TBD.-> BG
    BG --> CORE
    U1 -.human interaction.-> BG
    U2 -.human interaction.-> BG
    U3 -.status / ledger / prompt.-> CORE
    U4 -.future.-> CORE
    CORE --> BP
    BP --> W
    BP -.future.-> D
    BP -.future.-> R
    BP -.future.-> DEV
```

Durable relationship:

```text
AI Brain
  -> Brain Gateway
  -> SPARK Agent Core + Human UX Plane
  -> Body Port
  -> Physical / Execution Adapter
```

## 3. Architecture Principles

1. **Brain independent** — ChatGPT/Claude/local model은 교체 가능한 Brain Host다.
2. **Brain Gateway boundary** — Brain별 connector, quota/session, ingress 차이는 Core 앞에서 흡수한다.
3. **Protocol independent Core** — MCP는 current transport adapter이며 Core domain model이 아니다.
4. **UX independent Core** — Chat UI, Obsidian, future SPARK Desktop/Robot UI는 execution Core 밖에 둔다.
5. **Body independent** — Windows filesystem/process는 first Body implementation일 뿐이다.
6. **Logical before physical** — Core logical operation은 PAL/device adapter가 실제 OS/device 동작으로 매핑한다.
7. **Windows-first 0.0.1** — physical target은 Windows. 다른 OS/device PAL은 TBD다.
8. **Fail closed** — hidden elevation/destructive fallback 금지.
9. **Recoverability** — overwrite/modify recovery와 Windows Recycle Bin delete.
10. **Bounded execution** — timeout, descendant cleanup, bounded stdout/stderr.
11. **User-visible ledger** — chat transcript만 operation history로 간주하지 않는다.
12. **No model API dependency** — daemon 자체는 OpenAI/Anthropic/Google model API를 호출하지 않는다.

## 4. Brain Gateway

Brain Gateway는 AI Brain과 SPARK Agent Core 사이의 Anti-Corruption Layer다. Model reasoning 자체를 구현하지 않는다.

책임:

- Brain Host별 connector/ingress 차이 격리
- standard protocol adaptation
- capability/tool discovery 및 invocation boundary
- client/session identity normalization
- approval/confirmation metadata 전달 가능성
- optional quota/cost/status observation
- Brain Host 교체 시 Core contract 보호

Current implementation/deployment:

```text
ChatGPT Web/App
  -> OpenAI Secure MCP Tunnel
  -> MCP 2026-07-28 Adapter
  -> SPARK Agent Core
```

Architecture-only future Claude path:

```text
Claude / Claude Desktop
  -> Claude Custom Remote MCP
  -> MCP Adapter
  -> same SPARK Agent Core
```

Claude runtime code/test는 0.0.1에 포함하지 않는다. SPARK는 provider subscription credential을 탈취하거나 unsupported login/OAuth reuse 또는 quota bypass를 시도하지 않는다.

## 5. Human UX Plane

UX는 execution security boundary가 아니다. Future SPARK UI는 flat chat transcript 대신 다음을 독립적으로 표시할 수 있다.

```text
Conversation      | Task / Plan
Operation Ledger  | Artifacts
Workspace         | Status / Approval
```

현재 Obsidian은 optional workflow다. 향후 SPARK Desktop이나 SPARK Robot UI가 대체해도 Core contract는 유지한다.

## 6. Agent Core Logical Services

### 6.1. FileService

- `list_directory`
- `read_file`
- `create_file`
- `write_file`
- `modify_file`
- `create_directory`
- `copy_path`
- `move_path`
- `delete_path`

### 6.2. ProcessService

0.0.1에서는 `run_command`만 구현한다. 이는 simple native CLI/process execution이다.

Future process lifecycle:

```text
start_process
process_status
process_output
stop_process
```

GUI screen/mouse/keyboard/video 제어는 다음 Sprint 이후 별도 ComputerService 대상이다.

### 6.3. StatusService

- health
- lifecycle status
- recent operation ledger
- future long-output/report handles

## 7. Policy / Result / Ledger / Recovery

Transport와 Body implementation에 독립적인 공통 semantics:

- allowed-root authorization
- path canonicalization
- traversal/symlink/junction escape defense
- mutation recovery
- normalized result
- operation ledger
- secret/private-state separation
- future approval policy

## 8. Body Port Layer

Current logical ports:

```text
PlatformFilePort
PlatformTrashPort
PlatformProcessPort
PlatformPermissionPort
PlatformInfoPort
```

Future physical ports:

```text
PlatformComputerPort
DronePort
RobotPort
SensorPort
ActuatorPort
```

따라서 동일한 Agent Core가 filesystem/process뿐 아니라 향후 physical actuation까지 확장될 수 있다.

## 9. Authorization and Path Safety

`cwd`는 process의 시작 위치일 뿐 security boundary가 아니다.

```text
workingDirectory != authorizationRoot
```

0.0.1 filesystem policy는 다음을 reject한다.

- `..`
- absolute/drive-qualified path
- UNC path
- symlink escape
- NTFS junction escape
- non-existing target parent-chain escape

현재 single allowed root로 시작하되 future multi-root/capability policy로 확장 가능하게 유지한다.

## 10. Command Execution Trust Statement

0.0.1 `run_command`는 **trusted local, non-elevated Small PoC capability**다.

- explicit executable + argv
- `shell:false` by default
- cwd must resolve inside allowed root
- timeout
- descendant process-tree cleanup
- independently bounded stdout/stderr
- exit code/signal/duration
- automatic UAC/RunAs 금지
- **cwd confinement은 OS filesystem sandbox가 아니다**

0.0.1 Windows timeout cleanup은 verified `taskkill /T /F` tree termination을 사용한다. CatDesk에서 확인한 Windows Job Object는 stronger production ownership backend로 후속 DEBT에 유지한다. Distribution-grade filesystem/network sandbox 역시 0.0.1 범위가 아니다.

## 11. Recoverable Delete

Core semantics:

```text
delete_path = recoverable delete request
```

Windows mapping:

```text
delete_path
  -> PlatformTrashPort.delete()
  -> Windows Recycle Bin
```

Recycle Bin operation 실패 시 permanent delete fallback은 금지한다.

## 12. Normalized Result Contract

모든 external tool call은 다음 공통 envelope를 사용한다.

```json
{
  "ok": false,
  "operationId": "op-...",
  "operation": "delete_path",
  "summary": "Deletion was not performed.",
  "changed": false,
  "data": {},
  "durationMs": 12,
  "requiresElevation": true,
  "retryable": false,
  "error": {
    "code": "PERMISSION_DENIED",
    "message": "The operating system denied the operation."
  }
}
```

MCP response는 textual `content`와 `structuredContent`를 함께 제공한다.

## 13. Operation Ledger and Private State

각 operation은 append-only JSONL ledger에 기록한다.

```text
operationId
Timestamp
operation
target
status
changed
durationMs
errorCode
summary
```

`SPARK_Transport status`는 recent operations를 health와 함께 표시한다.

Default runtime/recovery/ledger state는 repository/workspace가 아니라 user-private local state directory를 사용한다. Test/development는 explicit `stateDir` override를 허용한다.

## 14. Brain Host Cost / Quota Rule

`BRAIN_HOST_COMPARISON.md`가 research source다.

- Consumer/subscription Chat + official connector/MCP는 valid Brain deployment mode다.
- Coding-product allowance, API/PAYG, local model은 별도 cost modes다.
- quota 숫자는 provider policy이므로 Agent Core에 hard-code하지 않는다.
- historical allowance를 current guarantee로 취급하지 않는다.

## 15. Source Architecture References

`ARCH_REFERENCE_STUDY.md` 참조.

- **CatDesk** — process ownership, timeout/cancel cleanup, bounded output, Windows Job Object concept, logical tools 우선.
- **Local Coding Agent** — working directory vs authorization separation, capability concept, missing-target canonicalization, private authority state. AGPL source 직접 복사 금지 unless license strategy accepts it.
- **ChatGPT Local Coder** — structured result/activity stream/process lifecycle decomposition. Open full-machine security model은 채택하지 않음.
- **Jan** — future provider-neutral/local-model client and UI reference.

## 16. 0.0.1 Implemented Scope

Implemented:

- 10 MCP tools: read/list/CRUD/delete/run_command
- recovery backup + SHA-256
- Windows Recycle Bin delete
- timeout + verified descendant cleanup
- bounded output
- normalized result
- JSONL operation ledger
- private default state directory
- lifecycle/status
- Windows + Linux CI

Architecture-only / deferred:

- Claude/Google/local-model Brain adapter
- GUI Computer Use
- Drone/Robot/device adapters
- elevated helper
- native Windows Job Object backend
- distribution-grade command sandbox
- alternate SPARK Desktop/Robot UI

## 17. ADR Summary

| ADR | Decision |
|---|---|
| ADR-001 | MCP `2026-07-28` standard-only |
| ADR-002 | Brain Host와 Agent Core 분리 |
| ADR-003 | Brain Gateway가 provider/connector 차이를 흡수 |
| ADR-004 | UX는 Core와 분리된 Human UX Plane |
| ADR-005 | Agent Core와 Physical Body를 Body Port/PAL로 분리 |
| ADR-006 | 0.0.1 physical target = Windows |
| ADR-007 | FileService와 ProcessService 분리 |
| ADR-008 | GUI/Computer Use는 후속 Sprint |
| ADR-009 | working directory와 authorization root 분리 |
| ADR-010 | normalized result + operation ledger |
| ADR-011 | Windows delete = Recycle Bin; no permanent fallback |
| ADR-012 | automatic UAC/elevation 금지 |
| ADR-013 | command = timeout + verified tree cleanup + bounded output |
| ADR-014 | private state default는 workspace 밖 |
| ADR-015 | quota/cost는 Brain deployment policy이며 Core constant가 아님 |
| ADR-016 | Claude/other Brain implementation은 target E2E 가능 시점까지 deferred |
| ADR-017 | future physical capability = Computer/Drone/Robot/Sensor/Actuator ports |

## 18. 0.0.1 Verification Status

GitHub Actions Node 24 matrix에서 final version commit `5014a3e816c4ee6af57dd6fe6c300199789a3f93`에 대해:

- Ubuntu: PASS
- Windows: PASS

Source/automated Small PoC acceptance는 PASS다. Live ChatGPT Secure MCP Tunnel mutation/exec E2E는 배포된 local daemon을 0.0.1로 갱신한 뒤 별도 deployment acceptance로 수행한다. Independent Architecture Peer review 역시 별도 process gate이며 이 문서의 author self-check와 동일시하지 않는다.

## 19. External References

- `docs/SWE1.md`
- `docs/SWE2.md`
- `docs/SWE3.md`
- `docs/ARCH_REFERENCE_STUDY.md`
- `docs/BRAIN_HOST_COMPARISON.md`
- `evidence/SPRINT2_TEST_REPORT.md`
- MCP 2026-07-28: https://blog.modelcontextprotocol.io/posts/2026-07-28/
- CatDesk: https://github.com/Xeift/CatDesk
- Local Coding Agent: https://github.com/LongNgn204/local-coding-agent
- ChatGPT Local Coder: https://github.com/posavr/chatgpt-local-coder
- Jan: https://github.com/janhq/jan

## Baseline Handoff

`0.0.1`은 CRUD + simple execution의 verified Small PoC source baseline이다. 다음 implementation Sprint는 GUI/Computer Use 또는 alternate Brain/physical adapter 중 실제 target requirement가 선택된 뒤 시작한다.
