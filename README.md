# SPARK_Transport

SPARK_Transport는 AI Brain과 사용자의 local/physical capability 사이를 연결하는 **provider-neutral Agent Core**입니다. 현재 0.0.1은 ChatGPT + Secure MCP Tunnel을 Brain path로 사용하고, Windows local filesystem CRUD와 simple command execution을 표준 MCP로 제공합니다.

현재 baseline은 **version 0.0.1 — CRUD + Simple Execution Small PoC**입니다. Ubuntu/Windows Node 24 GitHub Actions가 모두 PASS했습니다.

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

Future extension points에는 Claude/other Brain Host, custom SPARK UI, Computer Use, Drone/Robot/Sensor/Actuator Body adapters가 포함됩니다. Claude와 GUI/robot integration은 0.0.1에 구현하지 않았습니다.

자세한 구조:

- `docs/ARCH.md`
- `docs/ARCH_QGate.md`

프로젝트 process 문서 `SWE1.md`, `SWE2.md`, `SWE3.md`, `PIM3.md`는 local-only `_pArc/`에 유지하며 GitHub에는 올리지 않습니다.

## 2. 0.0.1 Tools

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

`SPARK_Transport status`는 daemon health와 최근 operation을 함께 표시합니다.

Default runtime/recovery/ledger state는 repository가 아닌 user-private local state directory에 저장됩니다. `SPARK_TRANSPORT_STATE_DIR`로 test/development override가 가능합니다.

## 4. Windows config

최초 한 번:

```cmd
copy config\spark-transport.example.json config\spark-transport.local.json
notepad config\spark-transport.local.json
```

최소한 다음을 실제 환경에 맞게 수정합니다.

- `daemon.allowedRoot`
- `tunnel.id`
- `tunnel.controlPlaneApiKeyFile`

Windows path는 JSON escaping 문제를 피하기 위해 `/` 표기를 권장합니다. Windows Explorer에서 복사한 `E:\\SRC\\...` 형태를 JSON에 넣으려면 각 `\\`를 `\\\\`로 escape해야 하므로, 사람이 직접 편집할 때는 `E:/SRC/...`가 가장 안전합니다.

단일 Root는 기존 문자열 형식도 계속 지원합니다.

```json
"allowedRoot": "E:/test"
```

Multi-root에서는 문자열 배열 또는 Root별 권한 객체를 사용할 수 있습니다.

```json
"allowedRoot": [
  { "path": "E:/SRC/SPARK_Transport", "permissions": "RWX" },
  { "path": "E:/SRC/00_pArc", "permissions": "R" },
  { "path": "E:/SRC/SPARK_Theme", "permissions": "RX" }
]
```

권한 의미:

- `R`: `list_directory`, `read_file`, copy source
- `W`: create/write/modify/copy destination/move/delete
- `X`: `run_command`의 cwd로 사용 가능

문자열 Root는 backward compatibility를 위해 `RWX`로 해석합니다. 상대경로가 둘 이상의 Root에 실제로 존재하면 `AMBIGUOUS_ROOT_PATH`로 실패하며, 이 경우 사용자는 `E:/...` 절대경로로 대상 Root를 명시해야 합니다. `.`은 primary Root(첫 번째 Root)를 의미합니다.

`tunnel.clientDir` 기본값:

```text
tools/tunnel-client
```

실제 Windows binary:

```text
tools\tunnel-client\tunnel-client.exe
```

## 5. Tunnel key file

0.0.1에서는 tunnel Runtime API key를 **파일 하나로 고정**해서 읽습니다. Environment variable이나 `env:` / `file:` prefix를 config에 쓰지 않습니다.

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

Repository root에서 `SPARK_Transport.cmd`를 인자 없이 실행/더블클릭하면 daemon + Secure MCP Tunnel + ChatGPT Windows app을 한 번에 시작합니다.

```cmd
SPARK_Transport.cmd
SPARK_Transport.cmd start
SPARK_Transport.cmd restart
SPARK_Transport.cmd status
SPARK_Transport.cmd stop
SPARK_Transport.cmd validate
```

`start`는 daemon health와 tunnel readiness를 확인한 뒤 통합 Theme runtime을 통해 ChatGPT Windows app을 CDP 모드로 시작하고 theme을 적용합니다. 이미 정상 실행 중인 daemon/tunnel/theme 구성요소는 재사용합니다. `status`는 daemon, tunnel, ChatGPT process와 Theme watcher/CDP 상태를 각각 표시합니다. `stop`은 tunnel-client, daemon, Theme watcher, ChatGPT를 순서대로 종료합니다. `restart`는 stop 후 start를 실행합니다.

기본 Theme 설정:

```json
"theme": {
  "enabled": true,
  "selection": "dark-red"
}
```

Theme 기능을 사용하지 않으려면 `theme.enabled`를 `false`로 설정합니다. 통합 Theme 구현은 `theme/` 아래에 있으며 `E:/SRC/SPARK_Theme` 원본 프로젝트와 독립적으로 실행됩니다. 원본 Theme 프로젝트는 그대로 유지됩니다.

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

0.0.1 behavior:

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
SPARK_Transport validate
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

CatDesk가 제시하는 `3,000 messages/week`는 historical GPT-5.5 Chat allowance이며 current GPT-5.6 guaranteed quota로 사용하지 않습니다. Claude Pro/Max의 official remote MCP path는 future Brain Gateway 후보로 기록했지만 0.0.1에는 구현하지 않았습니다.

자세한 Brain Host 비교와 source-reference study는 `docs/ARCH.md`의 해당 chapter에 통합되어 있습니다.

## 11. Remaining Deployment Acceptance

GitHub source/automated 0.0.1 gate는 PASS입니다. Local PC에서 최신 main을 pull/restart한 뒤 ChatGPT에서 mutation + `run_command` live E2E를 수행합니다.
