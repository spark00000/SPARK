# SPARK_Transport

SPARK_Transport는 ChatGPT에서 사용자의 로컬 파일과 명령을 **표준 MCP(Model Context Protocol)** 로 다루기 위한 Windows 중심 Local MCP daemon입니다.

현재 개발 상태는 **Sprint-2 candidate / version 0.0.0**입니다. Windows 실제 검증이 끝난 뒤에만 `0.0.1`로 승격합니다.

## 1. Sprint-2 기능

MCP baseline은 `2026-07-28`이며 SPARK_Transport 전용 protocol extension은 만들지 않습니다.

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
| `run_command` | non-elevated command 실행 |

`run_command`는 자동으로 관리자 권한을 얻지 않습니다. 관리자 권한이 필요한 command는 실패를 반환합니다.

## 2. 가장 쉬운 Windows 실행 방법

### S2-CFG-01 — Config 준비

최초 한 번:

```cmd
copy config\spark-transport.example.json config\spark-transport.local.json
notepad config\spark-transport.local.json
```

최소한 `daemon.allowedRoot`와 `tunnel.id`를 실제 환경에 맞게 수정합니다. local config는 Git에 포함되지 않습니다.

### S2-SEC-01 — Tunnel runtime key 설정

```cmd
set "CONTROL_PLANE_API_KEY=sk-..."
```

이 secret은 config/Git에 넣지 않습니다. tunnel control plane 인증용이며 SPARK_Transport는 OpenAI model API를 호출하지 않습니다.

### S2-START-01 — 한 번에 시작

```cmd
start.cmd
```

순서: config → Node → daemon → `/health` → tunnel-client 확인/다운로드 → SHA256 검증 → doctor/init → tunnel run → `/readyz`.

### 상태/중지

```cmd
status.cmd
stop.cmd
```

## 3. tunnel-client 자동 설치

`start.cmd`는 없을 때 OpenAI 공식 GitHub release의 **full client** `tunnel-client-v0.0.14-windows-amd64.zip`을 받고 `SHA256SUMS.txt`로 검증합니다. `runtime-cloudflared` artifact는 사용하지 않습니다.

공식 release: https://github.com/openai/tunnel-client/releases/tag/v0.0.14

## 4. Config

`config/spark-transport.local.json`에서 allowed root, host/port, MCP/health path, read limit, command timeout, state dir, recycle policy, tunnel id/profile/client version을 설정합니다. 환경변수는 config보다 우선합니다.

## 5. UAC / 관리자 권한 정책

Sprint-2에서는 별도 admin UI를 두지 않습니다. `run_command`는 현재 사용자 권한으로만 실행합니다.

- 자동 UAC prompt 없음
- 자동 `RunAs` 금지
- permission/elevation 문제는 error로 반환
- 향후 필요 시 사용자 명시 승인을 전제로 별도 elevated helper를 설계

## 6. Delete 정책

Windows `delete_path`는 파일/폴더를 **Recycle Bin으로 이동**합니다. 실패 시 permanent delete로 fallback하지 않습니다. allowed root 자체, root 밖, traversal, symlink/junction escape 대상은 삭제하지 않습니다.

## 7. Command execution

예:

```json
{"command":"cmd.exe","args":["/c","dir"],"cwd":".","timeoutMs":10000}
```

`cwd`는 allowed root 내부 relative path만 허용합니다. shell 기능은 `cmd.exe /c` 또는 `powershell.exe -Command`를 명시적으로 호출합니다. 결과에는 stdout/stderr/exitCode/durationMs가 포함됩니다.

## 8. 테스트

```cmd
npm test
```

현재 build container: **11 PASS / 0 FAIL / 0 SKIP**. Windows 실제 Recycle Bin, NTFS junction, `start.cmd`+Tunnel, ChatGPT mutation/command E2E가 완료되기 전에는 version을 `0.0.1`로 올리지 않습니다.

## 9. Windows Sprint-2 local validation

`start.cmd`가 성공한 뒤 실제 mutation/command/Recycle Bin path를 자동 검증하려면:

```cmd
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\validate-windows-sprint2.ps1
```

이 검증은 allowed root 안에 고유한 임시 test directory를 만들고 create/write/modify/copy/move/command/traversal/delete를 순서대로 실행합니다. 삭제는 Recycle Bin으로 보내며 마지막에 Recycle Bin enumeration 결과도 확인합니다. 자동 enumeration이 확인하지 못하면 script가 manual 확인을 요구합니다.
