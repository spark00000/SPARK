# SPARK — Symbiotic Personal AI Robotic Keeper

> **Agent quick start:** 이 README의 `Installation` 절을 위에서 아래로 그대로 실행하면 새 Windows PC에서 SPARK 0.0.0 private-use baseline을 설치하고 ChatGPT custom MCP app까지 등록할 수 있습니다.

SPARK는 **Symbiotic Personal AI Robotic Keeper**의 약자이며, AI Brain과 사용자의 local/physical capability 사이를 연결하는 provider-neutral Agent Core입니다. 현재 0.0.0 private-use baseline은 ChatGPT + Secure MCP Tunnel을 Brain path로 사용하고, Windows local filesystem CRUD와 simple command execution을 표준 MCP로 제공합니다.

현재 baseline은 **version 0.0.0 — Private Usage Baseline**입니다. 다음 0.0.1부터 multi-user usage와 deployment hardening을 진행합니다.

## 1. Architecture

```text
AI Brain Host
  -> Brain Gateway
  -> SPARK Agent Core + Human UX Plane
  -> Body Port
  -> Physical / Execution Adapter
```

현재:

```text
ChatGPT Web/App
  -> OpenAI Secure MCP Tunnel
  -> MCP 2026-07-28
  -> SPARK Agent Core
  -> Windows Filesystem / Process / Recycle Bin
```

Future extension points에는 Claude/other Brain Host, custom SPARK UI, Computer Use, Drone/Robot/Sensor/Actuator Body adapters가 포함됩니다. Claude와 GUI/robot integration은 0.0.0에 구현하지 않았습니다.

Repository는 기능별 sub-project를 `modules/` 아래에 둡니다.

```text
SPARK/
├─ modules/
│  ├─ transport/
│  │  ├─ config/   # Transport config template / optional local override
│  │  ├─ src/
│  │  ├─ test/
│  │  ├─ scripts/  # Transport-only bootstrap/validation
│  │  └─ tools/
│  ├─ chatgpt-ui/  # ChatGPT Windows UI integration (theme/CDP and future UI controls)
│  └─ oui/         # future Obsidian UI / clipboard integration
├─ .runtime/       # local-only config / secrets / runtime state
├─ docs/           # architecture / quality gate
├─ scripts/        # SPARK-wide lifecycle orchestration
├─ _pArc/          # local-only process artifacts
└─ SPARK.cmd       # one-click entry point
```

새 기능은 독립 lifecycle/config/test 경계가 있으면 `modules/<name>/` sub-project로 추가합니다. Root는 전체 SPARK orchestration과 공통 산출물만 유지합니다. 따라서 root `scripts/`에는 `start-all/status-all/stop-all` 같은 공통 orchestration만 두고, tunnel bootstrap·Transport validation처럼 특정 module 전용 script는 `modules/transport/scripts/`가 소유합니다.

자세한 구조:

- `docs/ARCH.md`
- `docs/ARCH_QGate.md`

프로젝트 process 문서 `SWE1.md`, `SWE2.md`, `SWE3.md`, `PIM3.md`는 local-only `_pArc/`에 유지하며 GitHub에는 올리지 않습니다.

## 2. 0.0.0 Tools

MCP baseline은 `2026-07-28`이며 SPARK 전용 protocol extension은 만들지 않습니다.

| Tool | 기능 |
|---|---|
| `list_directory` | directory 목록 |
| `read_file` | UTF-8 파일 읽기 |
| `create_file` | 새 파일 생성 |
| `write_file` | recovery backup 후 파일 전체 교체 |
| `modify_file` | 정확히 한 번 나타나는 text 부분 치환 |
| `create_directory` | directory 생성 |
| `copy_path` | 파일/폴더 복사 |
| `move_path` | 파일/폴더 이동/rename |
| `delete_path` | **Windows Recycle Bin**으로 이동 |
| `run_command` | non-elevated simple command 실행 |

모든 tool invocation은 normalized result와 unique operation ID를 반환하고 local JSONL operation ledger에 기록됩니다.

## 3. Result / Operation Ledger

Result envelope의 핵심 fields:

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
error?
```

`SPARK status`는 Transport health와 최근 operation을 함께 표시합니다.

`ledger/`와 `recovery/`는 배포 파일이 아니라 runtime state입니다. 둘 다 사전에 존재할 필요가 없으며 실제 operation 기록 또는 recoverable write/modify가 발생할 때 `stateDir` 아래에 자동 생성됩니다. 현재 private-use config는 `stateDir`을 `.runtime`으로 지정하며, `.runtime/` 전체는 Git에서 제외됩니다. `SPARK_STATE_DIR`로 test/development override가 가능합니다.

## 4. Installation

이 절은 **새 Windows PC / clean clone에서 agent가 위에서 아래로 그대로 수행하는 기준 절차**입니다. 중간 단계를 추측해서 생략하지 않습니다.

### Step 0 — Prerequisite

필수 조건:

- Windows 11
- Git
- Node.js 20 이상 (`Node 24` CI 검증)
- ChatGPT Business / Enterprise / Edu에서 custom MCP app을 만들 수 있는 관리자/소유자 또는 허용된 사용자
- OpenAI Secure MCP Tunnel ID
- Tunnel Runtime API key (`Tunnels Read + Use` 권한)

Tunnel ID는 OpenAI Platform의 Tunnels 관리 화면에서 확인하거나 생성합니다. Runtime API key는 Platform Runtime API keys에서 **Restricted + Tunnels Read + Use**로 발급합니다. 새 tunnel을 방금 만든 경우 OpenAI tunnel-client 문서 기준으로 active/ready까지 약 25–30초가 걸릴 수 있습니다. 기존 tunnel을 재사용하는 경우 이 생성 대기 시간은 해당하지 않습니다.

### Step 1 — Clone 및 version 확인

```cmd
git clone https://github.com/spark00000/SPARK.git
cd SPARK
node --version
npm --version
node -p "require('./package.json').version"
```

마지막 출력은 private-use baseline에서 `0.0.0`이어야 합니다.

### Step 2 — Private config 생성

```cmd
mkdir .runtime\config 2>NUL
copy modules\transport\config\spark.example.json .runtime\config\spark.local.json
notepad .runtime\config\spark.local.json
```

최소 수정 항목:

- `transport.allowedRoot`: SPARK가 접근할 실제 local root
- `tunnel.id`: 자신의 Secure MCP Tunnel ID
- `tunnel.controlPlaneApiKeyFile`: 기본값 `.runtime/secrets/control-plane-api-key.txt` 유지 권장
- `chatgptUi.enabled`: ChatGPT UI/CDP 통합 사용 여부
- `chatgptUi.theme`: 기본 `dark-red`

개인 설정 파일과 `.runtime/`은 Git에 올리지 않습니다.

Config 선택 순서:

1. 명시적인 `-ConfigPath`
2. 실제 파일이 존재하는 `SPARK_CONFIG`
3. `modules/transport/config/spark.local.json`
4. `.runtime/config/spark.local.json`

Windows JSON path는 `C:/SPARK/...`처럼 `/` 사용을 권장합니다.

Root 권한:

```json
"allowedRoot": [
  { "path": "C:/SPARK/workspace", "permissions": "RWX" },
  { "path": "C:/SPARK/reference", "permissions": "R" }
]
```

- `R`: list/read/copy source
- `W`: create/write/modify/copy destination/move/delete
- `X`: `run_command` cwd

### Step 3 — Runtime key 저장

```cmd
mkdir .runtime\secrets 2>NUL
notepad .runtime\secrets\control-plane-api-key.txt
```

파일에는 **Runtime API key 한 줄만** 저장합니다. Admin key를 long-running Transport runtime key로 사용하지 않습니다.

### Step 4 — SPARK 시작

```cmd
SPARK.cmd start
SPARK.cmd status
```

`SPARK.cmd start`는 필요한 `tunnel-client.exe`가 없으면 OpenAI 공식 release를 내려받고 SHA-256 checksum을 검증한 뒤 설치합니다.

정상 상태:

```text
Transport service : running / healthy
Tunnel            : ready
ChatGPT            : running
ChatGPT UI         : active
```

Tunnel이 새로 생성된 직후라면 OpenAI 문서의 25–30초 activation window를 고려하고 다시 `SPARK.cmd status`로 확인합니다.

### Step 5 — Local validation

```cmd
npm test
npm run chatgpt-ui:validate
SPARK.cmd validate
```

모든 명령이 PASS해야 다음 단계로 진행합니다.

### Step 6 — ChatGPT custom MCP app 등록

ChatGPT에서 §11의 절차대로 새 custom MCP app을 생성합니다.

- App name: `SPARK`
- 기존 Secure MCP Tunnel과 같은 endpoint/connection을 사용
- `Scan Tools` 완료까지 기다림
- Actions가 정확히 **10개**인지 확인
- `read_file`, `write_file`, `run_command` smoke test

기존 `SPARK_Transport`가 이미 게시된 Business custom app이면 새 `SPARK` 앱의 동작을 먼저 확인한 뒤 기존 앱을 제거합니다.

### Step 7 — 일상 lifecycle

```cmd
SPARK.cmd          rem help
SPARK.cmd start
SPARK.cmd status
SPARK.cmd restart
SPARK.cmd stop
SPARK.cmd validate
```

`ledger/`, `recovery/`, PID, log, ChatGPT UI runtime state 등은 필요할 때 자동 생성되는 local runtime state이며 clone/package에 포함되지 않습니다.

## 5. Tunnel key file

0.0.0에서는 tunnel Runtime API key를 **파일 하나로 고정**해서 읽습니다. Environment variable이나 `env:` / `file:` prefix를 config에 쓰지 않습니다.

기본 config:

```json
"controlPlaneApiKeyFile": ".runtime/secrets/control-plane-api-key.txt"
```

파일 생성:

```cmd
mkdir .runtime\secrets 2>NUL
notepad .runtime\secrets\control-plane-api-key.txt
```

파일에는 실제 Runtime API key 한 줄만 저장합니다.

`.runtime/` 전체는 `.gitignore` 대상이므로 key file은 Git에 올라가지 않습니다.

## 6. Lifecycle

Repository root에서 `SPARK.cmd`를 인자 없이 실행하면 도움말을 표시합니다. 실제 runtime은 `SPARK.cmd start` 한 번으로 Transport + Secure MCP Tunnel + ChatGPT UI를 시작합니다.

```cmd
SPARK.cmd
SPARK.cmd start
SPARK.cmd restart
SPARK.cmd status
SPARK.cmd stop
SPARK.cmd validate
```

`start`는 Transport health와 tunnel readiness를 확인한 뒤 통합 ChatGPT UI runtime을 통해 ChatGPT Windows app을 CDP 모드로 시작하고 현재 theme을 적용합니다. 이미 정상 실행 중인 Transport/tunnel/ChatGPT UI 구성요소는 재사용합니다. `status`는 Transport, tunnel, ChatGPT process와 ChatGPT UI watcher/CDP 상태를 각각 표시합니다. `stop`은 tunnel-client, Transport, ChatGPT UI watcher, ChatGPT를 순서대로 종료합니다. `restart`는 stop 후 start를 실행합니다.

기본 ChatGPT UI 설정:

```json
"chatgptUi": {
  "enabled": true,
  "theme": "dark-red"
}
```

ChatGPT UI 통합을 사용하지 않으려면 `chatgptUi.enabled`를 `false`로 설정합니다. 현재 0.0.0에서 구현된 UI 기능은 CDP 기반 theme 적용이며, 이후 font size·wrapping·usage 표시도 같은 `modules/chatgpt-ui/` sub-project에 추가합니다.

## 7. Delete / Recycle Bin Policy

`delete_path`는 source path를 allowed-root policy로 검증한 뒤 Windows Recycle Bin으로 이동합니다.

- outside-root source 거부
- root 자체 삭제 금지
- traversal/symlink/junction escape 거부
- source delete 권한 또는 Recycle Bin operation 실패 시 explicit error
- **permanent delete fallback 없음**

Windows CI에서 actual Recycle Bin source-removal test를 통과했습니다.

## 8. Command Execution Policy

예:

```json
{"command":"cmd.exe","args":["/c","dir"],"cwd":".","timeoutMs":10000}
```

0.0.0 behavior:

- explicit executable + argv
- `shell:false` by default
- current-user / non-elevated
- cwd must be inside allowed root
- timeout
- child process-tree cleanup
- bounded stdout/stderr
- exit code/signal/duration
- automatic UAC/RunAs 없음

**주의:** cwd confinement은 OS filesystem sandbox가 아닙니다. Child process는 current user 권한으로 root 밖 resource를 접근할 가능성이 있습니다. Distribution-grade command sandbox는 후속 hardening입니다.

Windows timeout cleanup은 현재 verified tree termination을 사용하며, native Windows Job Object backend는 후속 hardening debt입니다.

## 9. 테스트

```cmd
npm test
npm run chatgpt-ui:validate
SPARK.cmd validate
```

GitHub Actions release-version verification:

| Target | Result |
|---|---|
| Ubuntu / Node 24 | **PASS** |
| Windows / Node 24 | **PASS** |

Detailed automated and live verification history is maintained in local-only `_pArc/SWE3.md`.

## 10. Brain Host Cost Strategy

SPARK는 cost/allowance를 네 경로로 구분합니다.

```text
A. Consumer subscription Chat + connector/MCP
B. Coding-product allowance (Work/Codex/Claude Code)
C. Pay-as-you-go API/usage credit
D. Local model
```

CatDesk가 제시하는 `3,000 messages/week`는 historical GPT-5.5 Chat allowance이며 current GPT-5.6 guaranteed quota로 사용하지 않습니다. Claude Pro/Max의 official remote MCP path는 future Brain Gateway 후보로 기록했지만 0.0.0에는 구현하지 않았습니다.

자세한 Brain Host 비교와 source-reference study는 `docs/ARCH.md`의 해당 chapter에 통합되어 있습니다.

## 11. ChatGPT custom MCP app 등록 / SPARK 이름 적용

ChatGPT에 등록된 custom MCP app의 표시명은 MCP `serverInfo.name`만 변경한다고 자동으로 바뀌지 않습니다. SPARK Transport service는 `serverInfo.name=SPARK`를 광고하지만 ChatGPT 쪽 앱 이름은 별도의 등록 metadata입니다.

현재 OpenAI 공식 절차 기준(2026-09-14 확인):

1. ChatGPT에서 developer mode를 활성화합니다. 이 단계는 custom MCP app을 생성하기 위해 필요합니다.
   - Business: 관리자/소유자가 Workspace settings → Apps → Create에서 developer mode를 사용할 수 있습니다.
   - Enterprise/Edu: Settings → Apps → Advanced Settings에서 developer mode를 활성화할 수 있습니다.
2. 기존 앱이 아직 Dev/draft 상태이고 `Manage`에서 이름 수정이 가능하면 앱 이름을 `SPARK`로 변경합니다.
3. Business에서 이미 publish된 앱은 이름/메타데이터를 수정할 수 없으므로 새 custom app을 만듭니다. 개발자 모드의 미게시 앱이라면 Manage에서 이름/로고 수정이 가능합니다.
   - 이름: `SPARK`
   - Endpoint: 현재 Secure MCP Tunnel이 제공하는 MCP endpoint
   - Authentication: 현재 tunnel/profile 설정과 동일한 방식
   - `Scan Tools` 실행
   - 정확히 10개 SPARK tool이 보이는지 확인
   - Create 후 read/write/run_command smoke test
4. 새 `SPARK` 앱이 정상 동작하는 것을 확인한 뒤 기존 `SPARK_Transport` 앱을 제거합니다. 기존 앱부터 먼저 삭제하지 않는 것이 안전합니다. OpenAI 공식 문서에는 custom app 표시 이름이 전역적으로 유일해야 한다는 요구나 별도의 전파 대기 시간이 명시되어 있지 않습니다. 생성 시 Tool Scan 완료까지는 기다려야 합니다.
5. MCP tool/schema가 변경되면 ChatGPT 앱 설정에서 Refresh/Scan Tools를 다시 수행합니다.

공식 참고: `https://help.openai.com/en/articles/12584461`

로컬 MCP server는 ChatGPT가 직접 접속할 수 없으므로 현재 구조처럼 Secure MCP Tunnel을 사용합니다.

> 현재 `SPARK_Transport`가 이미 게시된 Business custom app이라면 이름을 직접 `SPARK`로 고치는 UI가 없는 것이 정상입니다. 새 `SPARK` 앱을 생성 → Scan Tools 완료 → 10개 action 확인 → smoke test → 기존 `SPARK_Transport` 제거 순서로 전환합니다.

## 12. Baseline

- `0.0.0`: 현재까지 검증된 **private-use baseline**
- `0.0.1`: 다음 단계인 **multi-user usage / deployment**
- `0.0.0` tracked source에는 사용자 개인 absolute path, 실제 tunnel ID/API key, local runtime state를 포함하지 않습니다.

## 13. Final private-use acceptance

Source/automated `0.0.0` gate와 이전 live mutation/exec E2E는 PASS입니다. 이 baseline source를 실제 Transport service가 다시 읽도록 `SPARK.cmd restart`한 뒤, Transport version `0.0.0`, tunnel ready, ChatGPT UI active, ChatGPT custom app 이름 `SPARK`를 최종 확인합니다.
