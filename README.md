# SPARK — Symbiotic Personal AI Robotic Keeper

> **Agent quick start:** 이 README의 `Installation` 절을 위에서 아래로 그대로 실행하면 새 Windows PC에서 SPARK 0.0.0 private-use baseline을 설치하고 ChatGPT custom MCP app까지 등록할 수 있습니다.

SPARK는 **Symbiotic Personal AI Robotic Keeper**의 약자입니다. 현재 0.0.0은 ChatGPT를 OpenAI Secure MCP Tunnel로 Windows PC의 SPARK Transport에 연결하여 local filesystem CRUD와 simple command execution을 표준 MCP로 제공합니다. ChatGPT Windows app에는 CDP 기반 ChatGPT UI theme runtime이 함께 포함됩니다.

현재 release는 **version 0.0.0 — Private Usage Baseline**입니다.

## 1. Architecture

현재 동작 경로는 다음과 같습니다.

```text
ChatGPT Web/App
  -> OpenAI Secure MCP Tunnel
  -> MCP 2026-07-28
  -> SPARK Transport
  -> Windows Filesystem / Process / Recycle Bin
```

ChatGPT Windows app UI는 별도의 local module이 담당합니다.

```text
SPARK/
├─ modules/
│  ├─ transport/     # MCP, policy, filesystem/process execution, tunnel support
│  └─ chatgpt-ui/    # ChatGPT Windows UI theme/CDP integration
├─ .runtime/         # local-only config, secret, PID, profile, ledger/recovery
├─ docs/             # architecture / quality gate
├─ scripts/          # start-all / status-all / stop-all
└─ SPARK.cmd
```

자세한 내부 구조는 `docs/ARCH.md`와 `docs/ARCH_QGate.md`에 있습니다.

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

이 절은 **새 Windows PC에서 SPARK 0.0.0을 처음 설치하는 순서**입니다. 위에서 아래로 그대로 진행합니다.

### Step 0 — Prerequisite

필수 조건:

- Windows 11
- Git
- Node.js 20 이상 (`Node 24` CI 검증)
- ChatGPT Business / Enterprise / Edu에서 custom MCP app을 만들 수 있는 권한
- OpenAI Platform에서 Secure MCP Tunnel을 만들거나 사용할 수 있는 권한

### Step 1 — OpenAI Secure MCP Tunnel 준비

SPARK를 clone하기 전에 Tunnel ID와 Runtime API key를 먼저 준비합니다.

1. OpenAI Platform의 Tunnels 관리 화면을 엽니다.
   - https://platform.openai.com/settings/organization/tunnels
2. 새 tunnel을 만들거나 기존 tunnel을 선택하고 **tunnel ID**를 기록합니다.
   - 형식: `tunnel_...`
   - ChatGPT에서 사용할 workspace에 tunnel access가 있어야 합니다.
3. Runtime API keys 화면을 엽니다.
   - https://platform.openai.com/settings/organization/api-keys
4. Runtime key를 **Restricted**로 만들고 **Tunnels Read + Use** 권한을 부여합니다.
   - 장시간 실행되는 SPARK runtime에는 Admin key를 사용하지 않습니다.
5. 새 tunnel을 방금 생성했다면 약 **25–30초** 뒤 active/ready 상태를 확인합니다.

SPARK는 이후 `SPARK.cmd start`에서 필요한 `tunnel-client.exe` 다운로드, SHA-256 검증, profile 생성, `doctor`, `run`을 자동으로 수행합니다. 사용자가 tunnel-client profile을 수동으로 만들 필요는 없습니다.

### Step 2 — SPARK clone 및 version 확인

```cmd
git clone https://github.com/spark00000/SPARK.git
cd SPARK
node --version
npm --version
node -p "require('./package.json').version"
```

마지막 출력은 `0.0.0`이어야 합니다.

### Step 3 — Private config 생성

```cmd
mkdir .runtime\config 2>NUL
copy modules\transport\config\spark.example.json .runtime\config\spark.local.json
notepad .runtime\config\spark.local.json
```

최소 수정 항목:

- `transport.allowedRoot`: SPARK가 접근할 local root
- `tunnel.id`: Step 1에서 준비한 tunnel ID
- `tunnel.controlPlaneApiKeyFile`: 기본값 `.runtime/secrets/control-plane-api-key.txt` 사용 권장
- `chatgptUi.enabled`: ChatGPT UI/CDP 통합 사용 여부
- `chatgptUi.theme`: 기본 `dark-red`

Windows JSON path는 `C:/SPARK/...`처럼 `/` 표기를 권장합니다.

Root별 권한 예:

```json
"allowedRoot": [
  { "path": "C:/SPARK/workspace", "permissions": "RWX" },
  { "path": "C:/SPARK/reference", "permissions": "R" }
]
```

- `R`: list/read/copy source
- `W`: create/write/modify/copy destination/move/delete
- `X`: `run_command` cwd

Private config 선택 순서:

1. 명시적인 `-ConfigPath`
2. 실제 파일이 존재하는 `SPARK_CONFIG`
3. `modules/transport/config/spark.local.json`
4. `.runtime/config/spark.local.json`

### Step 4 — Runtime API key 저장

```cmd
mkdir .runtime\secrets 2>NUL
notepad .runtime\secrets\control-plane-api-key.txt
```

파일에는 Step 1에서 만든 **Runtime API key 한 줄만** 저장합니다. `.runtime/`은 Git에 포함되지 않습니다.

### Step 5 — SPARK 시작

```cmd
SPARK.cmd start
SPARK.cmd status
```

정상 상태:

```text
Transport service : running / healthy
Tunnel            : ready
ChatGPT            : running
ChatGPT UI         : active
```

Tunnel이 ready가 아니면 먼저 `SPARK.cmd status`와 `.runtime/tunnel-doctor.log`를 확인합니다. 새 tunnel은 생성 직후 약 25–30초의 activation 시간이 필요할 수 있습니다.

`start`는 ready 응답만으로 기존 tunnel-client를 재사용하지 않습니다. 현재 config의 `tunnel.id`, generated profile의 `tunnel_id`, PID/runtime identity state와 profile SHA-256이 모두 일치하고 Control Plane poll까지 성공한 경우에만 기존 process를 재사용합니다. ID/profile mismatch가 발견되면 기존 profile을 `.runtime/tunnel-profile-backups/`에 hash 검증된 recovery copy로 보존한 뒤 현재 config 기준으로 profile을 재생성하고 tunnel-client를 다시 시작합니다.

### Step 6 — Local validation

```cmd
npm test
npm run chatgpt-ui:validate
SPARK.cmd validate
```

모든 명령이 PASS해야 합니다.

### Step 7 — ChatGPT custom MCP app 등록

SPARK runtime과 tunnel이 healthy/ready인 상태에서 ChatGPT에 등록합니다.

1. ChatGPT에서 developer mode를 활성화합니다.
2. Apps → Create에서 새 custom MCP app을 만듭니다.
3. 이름은 **`SPARK`**로 지정합니다.
4. Connection은 **`Tunnel`**을 선택합니다.
5. Step 1에서 만든 tunnel을 선택하거나 `tunnel_id`를 붙여넣습니다.
   - private/local MCP URL을 ChatGPT에 직접 입력하지 않습니다.
6. `Scan Tools`를 실행하고 완료될 때까지 기다립니다.
7. Actions가 정확히 **10개**인지 확인합니다.
8. Create 후 app을 활성화합니다.

Business에서 이미 publish된 `SPARK_Transport` custom app은 이름/metadata를 직접 바꿀 수 없습니다. 새 `SPARK` app을 먼저 만들고 검증한 뒤 기존 app을 제거합니다.

### Step 8 — ChatGPT smoke test

새 `SPARK` app을 선택한 chat에서 다음을 확인합니다.

1. `list_directory` 또는 `read_file` 성공
2. test file에 대한 `create_file` / `write_file` 성공
3. `run_command` simple command 성공
4. Actions가 10개인지 다시 확인

## 5. Lifecycle

Repository root에서 사용합니다.

```cmd
SPARK.cmd          rem help
SPARK.cmd start
SPARK.cmd status
SPARK.cmd restart
SPARK.cmd stop
SPARK.cmd validate
```

- `start`: Transport → Secure MCP Tunnel → ChatGPT UI 순서로 시작
- `status`: Transport, Tunnel, ChatGPT, ChatGPT UI 상태 표시
- `restart`: 전체 runtime 재시작
- `stop`: tunnel-client, Transport, ChatGPT UI watcher, ChatGPT 종료
- `validate`: Windows Transport CRUD/command/Recycle Bin 검증

## 6. Current Security Behavior

### Filesystem

- allowed root 밖 경로 차단
- `..` traversal 차단
- symlink / NTFS junction escape 차단
- Root 자체 삭제 금지
- multi-root에서 같은 상대경로가 둘 이상의 Root에 있으면 `AMBIGUOUS_ROOT_PATH`
- `delete_path`는 Windows Recycle Bin 사용
- Recycle Bin 실패 시 permanent-delete fallback 없음

### Command execution

`run_command`는:

- current-user / non-elevated 실행
- explicit executable + argv
- allowed root 내부 cwd 요구
- timeout + child process-tree cleanup
- bounded stdout/stderr
- exit code/signal/duration 반환

**cwd confinement은 OS filesystem sandbox가 아닙니다.** 실행한 process는 현재 Windows 사용자 권한을 가집니다.

## 7. Runtime State

`.runtime/`은 machine-local이며 Git에 포함되지 않습니다.

현재 사용되는 항목:

```text
.runtime/
├─ config/             # spark.local.json
├─ secrets/            # tunnel Runtime API key
├─ tunnel-profiles/    # generated tunnel-client profile
├─ ledger/             # operation 발생 시 자동 생성
├─ recovery/           # recoverable mutation 시 자동 생성
├─ spark.log           # Transport log
├─ spark.pid
├─ tunnel-client.pid
├─ tunnel-runtime.json # active tunnel ID/profile hash/PID identity state
└─ tunnel-doctor.log   # tunnel doctor 실행 시 생성
```

`ledger/`와 `recovery/`는 clone/package에 없어도 정상이며 필요할 때 자동 생성됩니다.

## 8. Validation

```cmd
npm test
npm run chatgpt-ui:validate
SPARK.cmd validate
```

0.0.0 source는 GitHub Actions에서 Node 24 기준 Windows와 Ubuntu regression을 통과했습니다.

## 9. Current Repository Layout

```text
SPARK/
├─ modules/
│  ├─ transport/
│  │  ├─ config/
│  │  ├─ scripts/
│  │  ├─ src/
│  │  ├─ test/
│  │  └─ tools/
│  └─ chatgpt-ui/
│     ├─ config/
│     ├─ scripts/
│     ├─ src/
│     └─ test/
├─ .runtime/           # local-only, clone에는 없음
├─ docs/
├─ scripts/            # start-all/status-all/stop-all
├─ SPARK.cmd
└─ package.json
```

## 10. Baseline

- Version: **0.0.0**
- Name: **SPARK — Symbiotic Personal AI Robotic Keeper**
- Current Brain path: **ChatGPT → Secure MCP Tunnel → SPARK Transport**
- Current Windows UI integration: **ChatGPT UI CDP theme runtime**
- MCP actions: **10**
- private config, secrets, PID/profile, ledger/recovery는 tracked source에 포함되지 않습니다.