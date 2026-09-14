# SPARK — Symbiotic Personal AI Robotic Keeper

<p align="center">
  <img src="docs/spark_icon2.png" alt="SPARK — Symbiotic Personal AI Robotic Keeper" width="900">
</p>

> **Agent quick start:** 이 README의 `Installation` 절을 위에서 아래로 그대로 실행하면 새 Windows PC에서 SPARK 0.0.1 multi-user / deployment release candidate을 설치하고 ChatGPT custom MCP app까지 등록할 수 있습니다.

SPARK는 **Symbiotic Personal AI Robotic Keeper**의 약자입니다. 현재 0.0.1은 ChatGPT를 OpenAI Secure MCP Tunnel로 Windows PC의 SPARK Transport에 연결하여 local filesystem CRUD와 simple command execution을 표준 MCP로 제공합니다. ChatGPT Windows app에는 CDP 기반 ChatGPT UI theme runtime이 함께 포함됩니다.

현재 release는 **version 0.0.1 — Private Usage Baseline**입니다.

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

## 2. MCP Tools

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

`SPARK.cmd status`는 Transport/Tunnel/ChatGPT/ChatGPT UI 상태만 간결하게 표시합니다. 상세 operation history는 local JSONL ledger에 유지하며 정상 startup/status console에는 전체 JSON payload를 출력하지 않습니다.

`ledger/`와 `recovery/`는 배포 파일이 아니라 runtime state입니다. 둘 다 사전에 존재할 필요가 없으며 실제 operation 기록 또는 recoverable write/modify가 발생할 때 `stateDir` 아래에 자동 생성됩니다. 현재 private-use config는 `stateDir`을 `.runtime`으로 지정하며, `.runtime/` 전체는 Git에서 제외됩니다. `SPARK_STATE_DIR`로 test/development override가 가능합니다.

## 4. Installation

이 절은 **새 Windows PC에서 SPARK 0.0.1을 처음 설치하는 순서**입니다. 위에서 아래로 그대로 진행합니다.

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

마지막 출력은 `0.0.1`이어야 합니다.

### Step 3 — Private config + SPARK Access Key 초기화

신규 설치는 먼저 한 번 실행합니다.

```cmd
SPARK.cmd init
```

`init`은 기존 `.runtime/config/spark.local.json`을 덮어쓰지 않습니다. 새 config를 만들면서 Node.js `crypto.randomBytes(32)` / OS CSPRNG로 256-bit per-instance SPARK Access Key를 생성하고, config에는 raw key가 아니라 SHA-256 digest만 저장합니다. 화면에 한 번 표시되는 `spk_...` key는 ChatGPT app connection에 입력할 값이므로 복사해 둡니다.

```cmd
notepad .runtime\config\spark.local.json
```

최소 수정 항목:

- `transport.allowedRoot`: SPARK가 접근할 local root
- `tunnel.id`: Step 1에서 준비한 **이 사용자/PC 전용** tunnel ID
- `tunnel.controlPlaneApiKeyFile`: 기본값 `.runtime/secrets/control-plane-api-key.txt` 사용 권장
- `chatgptUi.enabled`: ChatGPT UI/CDP 통합 사용 여부
- `chatgptUi.theme`: 기본 `dark-red`
- `chatgptUi.progress.enabled`: experimental progress overlay 사용 여부, 기본 `true`

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

### Step 4 — Tunnel Runtime API key 저장

```cmd
mkdir .runtime\secrets 2>NUL
notepad .runtime\secrets\control-plane-api-key.txt
```

파일에는 Step 1에서 만든 **OpenAI Tunnel Runtime API key 한 줄만** 저장합니다. `.runtime/`은 Git에 포함되지 않습니다.

### Step 4A — 0.0.1 per-instance deployment notes

Access Key를 config 변경 없이 새로 생성/rotation하려면:

```cmd
SPARK.cmd auth generate
```

각 user/device/SPARK instance는 서로 다른 다음 값을 사용합니다.

- Secure MCP Tunnel ID
- Tunnel Runtime API key
- SPARK Access Key (`spk_...`)
- private local config/runtime state

ChatGPT custom app에서는 **Authentication = Access token / API key**, **Bearer** header scheme을 선택하고 Step 3에서 복사한 이 instance의 `spk_...` key를 입력합니다. 다른 instance key는 HTTP 401로 거부되어야 합니다. 0.0.1에는 중앙 SPARK OAuth service나 중앙 payload relay가 없습니다.

Tracked example config 자체도 bearer mode + zero placeholder digest라 provisioning 전에는 fail closed합니다. Bearer mode의 local Windows validation은 raw key를 저장하지 않고 해당 process/session의 `SPARK_MCP_BEARER_TOKEN` environment variable로 전달할 수 있습니다.

Experimental progress overlay는 measured SPARK watchdog progress와 heuristic Brain-working/elapsed state를 표시합니다. ChatGPT가 exact token/credit telemetry를 제공하지 않으면 `provider metrics unavailable`로 표시하며 추정 수치를 만들지 않습니다. `chatgptUi.progress.enabled=false`로 끌 수 있습니다.

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
4. 필요하면 app logo로 `docs/spark_icon1.png`를 사용합니다. 이 파일은 256×256 PNG이며 10 KB 미만입니다.
5. Connection은 **`Tunnel`**을 선택합니다.
6. Step 1에서 만든 tunnel을 선택하거나 `tunnel_id`를 붙여넣습니다.
   - private/local MCP URL을 ChatGPT에 직접 입력하지 않습니다.
7. `Scan Tools`를 실행하고 완료될 때까지 기다립니다.
8. Actions가 정확히 **10개**인지 확인합니다.
9. Create 후 app을 활성화합니다.

Business에서 이미 publish된 custom app은 현재 직접 이름/metadata를 수정할 수 없습니다. 기존 `SPARK_Transport`를 `SPARK`로 바꾸려면 새 `SPARK` app을 recreate/publish한 뒤 기존 app을 **disable**합니다. UI에서 remove/delete가 제공되는 경우에만 제거하고, 없으면 disabled 상태로 둡니다. 개발자 모드의 미게시 app은 Manage에서 이름과 logo를 수정할 수 있습니다.

OpenAI 공식 안내:

- Developer mode / custom MCP apps: https://help.openai.com/en/articles/12584461-developer-mode-and-mcp-apps-in-chatgpt
- Secure MCP Tunnel permission troubleshooting: https://github.com/openai/tunnel-client/blob/master/docs/permissions.md

#### Create / Scan Tools가 실패할 때

**local MCP server가 잘못됐다고 바로 판단하지 마십시오.** SPARK app 생성 과정은 Transport뿐 아니라 Secure MCP Tunnel의 Control Plane 인증/권한과 workspace 연결이 모두 정상이어야 합니다.

먼저 다음을 확인합니다.

```cmd
SPARK.cmd status
.\modules\transport\tools\tunnel-client\tunnel-client.exe health --port 8080 --pid-file .runtime\tunnel-client.pid --require-control-plane-poll --json
```

정상 기준:

```text
Tunnel: ready (identity=verified, ..., control-plane=ok)
health result: ok
control_plane_poll.ok: true
```

`/readyz`만 `ready`라고 해서 충분하지 않습니다. Runtime API key는 대상 tunnel에 대해 **Tunnels Read + Use** 권한이 있어야 하고, 해당 tunnel은 ChatGPT에서 사용하는 workspace에 연결되어 있어야 합니다. `403` polling 또는 `control_plane_poll.ok=false`이면 MCP protocol을 수정하기 전에 key 권한, tunnel ID, workspace 연결을 먼저 확인합니다. 새 tunnel은 생성 직후 약 25–30초 activation 시간이 필요할 수 있습니다.

이번 1.4 과정에서 실제로 혼동을 일으켰던 오류도 구분해서 봐야 합니다.

- `MCP SSE probe returned 404 from openai.org`: OpenAI `tunnel-client` issue #35에서 같은 증상이 보고됐습니다. 그중 Windows 재현 하나는 Runtime API key가 `401 Unauthorized`로 거부되어 **Control Plane poll이 한 번도 성공하지 않은 상태**가 원인이었고, key를 바로잡아 `control_plane_poll.ok=true`가 되자 이 증상은 사라졌습니다. 따라서 이 오류가 보이면 SPARK에 SSE endpoint를 임의로 추가하기 전에 Control Plane poll부터 확인합니다. https://github.com/openai/tunnel-client/issues/35
- `MCP server/discover response was inconsistent from openai.org` / HTTP 424: OpenAI `tunnel-client` issue #63은 v0.0.14의 **embedded MCP stub**이 modern stateless `2026-07-28` discovery를 올바르게 처리하지 못한 별도 문제였습니다. OpenAI는 source `master`에서 이를 수정했지만 해당 issue 종료 시점의 published v0.0.14에는 fix가 포함되지 않았다고 명시했습니다. SPARK는 embedded stub이 아니라 자체 HTTP MCP server가 `2026-07-28` `server/discover`/`tools/list`/`tools/call`을 직접 구현하므로 같은 오류 문자열만으로 SPARK server bug라고 단정하지 않습니다. https://github.com/openai/tunnel-client/issues/63

SPARK가 사용하는 현재 profile은 **Bearer-protected local MCP + Secure MCP Tunnel**입니다. 별도의 local MCP OAuth를 요구하지 않습니다. 다만 ChatGPT app 자체가 인증/권한 prompt를 표시하는 경우에는 해당 인증을 완료한 뒤 `Scan Tools`를 다시 실행해야 합니다.

#### `@SPARK`가 보이는데 tool을 사용할 수 없을 때

ChatGPT에서 app이 목록에 보이는 것과 **현재 message에 app tool schema가 실제 선택/주입된 것**은 같은 의미가 아닙니다.

1. 해당 message에서 Plugins/Apps 메뉴의 **`SPARK`**를 실제로 선택하거나 `@SPARK` mention을 붙입니다.
2. 인증/권한 prompt가 있으면 먼저 완료합니다.
3. 새 data/tool call이 필요한 후속 message에서는 필요하면 `@SPARK`를 다시 선택합니다.
4. 그 뒤 Actions가 정확히 10개인지 확인합니다.

1.4 acceptance에서도 처음에는 `SPARK` app이 UI에 보였지만 현재 turn에 namespace가 주입되지 않았고, **authorized `@SPARK` selection 후 정확히 10개 Actions가 노출되어 E2E가 성공**했습니다. 따라서 이 증상만 보고 SPARK Transport가 tool을 제공하지 못한다고 판단하지 않습니다.

### Step 8 — ChatGPT smoke test

새 `SPARK` app을 선택한 chat에서 다음을 확인합니다.

1. Actions가 정확히 10개인지 확인
2. `list_directory` 또는 `read_file` 성공
3. test-only file에 대한 `create_file` / `write_file` 성공
4. `run_command` simple command 성공
5. mutation test artifact는 `delete_path`로 Windows Recycle Bin에 정리

현재 repository의 branding assets:

- `docs/spark_icon1.png` — 256×256 app icon, 10 KB 미만
- `docs/spark_icon2.png` — README/GitHub banner
- `docs/spark_icon3.png` — large square artwork

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

0.0.1 release-candidate source는 GitHub Actions에서 Node 24 기준 Windows와 Ubuntu regression을 통과했습니다.

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

- Version: **0.0.1** (release candidate until final bearer-key E2E + CI gate)
- Name: **SPARK — Symbiotic Personal AI Robotic Keeper**
- Current Brain path: **ChatGPT → Secure MCP Tunnel → SPARK Transport**
- Current Windows UI integration: **ChatGPT UI CDP theme runtime**
- MCP actions: **10**
- private config, secrets, PID/profile, ledger/recovery는 tracked source에 포함되지 않습니다.