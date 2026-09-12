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

## 2. Windows 실행

### 2.1 Config 준비

최초 한 번:

```cmd
copy config\spark-transport.example.json config\spark-transport.local.json
notepad config\spark-transport.local.json
```

최소한 `daemon.allowedRoot`와 `tunnel.id`를 실제 환경에 맞게 수정합니다. `config\spark-transport.local.json`은 Git에 포함되지 않습니다.

`tunnel.clientDir` 기본값은 다음입니다.

```text
tools/tunnel-client
```

따라서 실제 확인 대상은 repo 기준:

```text
tools\tunnel-client\tunnel-client.exe
```

입니다. 없으면 시작 과정에서 공식 OpenAI release에서 다운로드합니다.

### 2.2 Tunnel runtime secret

실제 key 값은 tracked JSON config에 저장하지 않습니다. config에는 **secret reference**만 둡니다.

기본값:

```json
"controlPlaneApiKeyRef": "env:CONTROL_PLANE_API_KEY"
```

이 경우 현재 shell에서 한 번 설정합니다.

```cmd
set "CONTROL_PLANE_API_KEY=실제_RUNTIME_KEY"
```

shell `set`을 사용하고 싶지 않으면 gitignored local file을 사용할 수 있습니다.

예:

```json
"controlPlaneApiKeyRef": "file:.runtime/secrets/control-plane-api-key.txt"
```

그리고 실제 key를 `.runtime\secrets\control-plane-api-key.txt`에 저장합니다. `.runtime/`은 Git에서 제외됩니다. 이 방식은 평문 local file이므로 Windows ACL/디스크 보안의 보호를 받으며, 더 강한 secret storage는 별도 hardening 항목입니다.

OpenAI tunnel-client profile에는 literal key가 아니라 `env:` 또는 `file:` reference가 들어갑니다.

### 2.3 단일 command surface

root에서는 다음 하나만 사용합니다.

```cmd
SPARK_Transport start
SPARK_Transport status
SPARK_Transport stop
SPARK_Transport validate
```

`start` 순서:

```text
config -> Node -> daemon -> /health -> tunnel-client 확인/다운로드
-> SHA256 검증 -> doctor/init -> tunnel run -> /readyz
```

## 3. tunnel-client 자동 설치

`tunnel.clientDir`에 `tunnel-client.exe`가 없으면 OpenAI 공식 GitHub release의 **full client** `tunnel-client-v0.0.14-windows-amd64.zip`을 받고 `SHA256SUMS.txt`로 검증합니다. `runtime-cloudflared` artifact는 사용하지 않습니다.

공식 release: https://github.com/openai/tunnel-client/releases/tag/v0.0.14

## 4. UAC / 관리자 권한 정책

Sprint-2에서는 별도 admin UI를 두지 않습니다. `run_command`는 현재 사용자 token으로만 실행합니다.

- 자동 UAC prompt 없음
- 자동 `RunAs` 금지
- permission/elevation 문제는 error로 반환
- 향후 실제 requirement가 생기면 사용자 명시 승인을 전제로 **별도 elevated helper**를 설계

## 5. Delete / Windows Recycle Bin 정책

`delete_path`는 먼저 대상이 allowed root 내부인지 검사한 뒤 Windows Recycle Bin API를 호출합니다.

Recycle Bin은 allowed root의 하위 directory가 아닙니다. 삭제 요청은 Windows가 **현재 로그인 사용자의 보안 token**으로 해당 volume의 사용자별 Recycle Bin 영역에 이동시키는 OS operation입니다. SPARK_Transport에 Recycle Bin 전체를 browse/write할 수 있는 별도 MCP filesystem 권한을 주는 것은 아닙니다.

중요한 동작 규칙:

- source path가 allowed root 밖이면 요청 자체를 거부합니다.
- 현재 사용자에게 source delete 권한이 없거나 Recycle Bin operation이 실패하면 `RECYCLE_BIN_FAILED` 계열 오류를 반환합니다.
- 실패 시 **permanent delete로 fallback하지 않습니다.**
- allowed root 자체 삭제 금지.
- traversal/symlink/junction escape 대상 삭제 금지.
- Recycle Bin에 들어간 파일은 이동되었다는 이유만으로 자동 실행되지 않습니다.

즉 `delete_path`가 실패했다고 해서 파일이 영구 삭제되는 구조가 아닙니다.

## 6. Command execution 주의

예:

```json
{"command":"cmd.exe","args":["/c","dir"],"cwd":".","timeoutMs":10000}
```

현재 구현은 `cwd`를 allowed root 내부로 제한하지만, child process 자체의 filesystem 접근 권한까지 OS sandbox로 제한하는 것은 아닙니다. 따라서 `cmd.exe`/`powershell.exe` 등에 root 밖 absolute path를 인자로 넘길 수 있는 위험은 별도 hardening blocker로 관리합니다. `0.0.1` 승격 전에 command execution policy를 추가 검증합니다.

## 7. 테스트

```cmd
npm test
SPARK_Transport validate
```

현재 build container automated test는 **11 PASS / 0 FAIL / 0 SKIP**입니다. Windows 실제 Recycle Bin, NTFS junction, 통합 launcher+tunnel, ChatGPT mutation/command E2E 및 command containment hardening이 완료되기 전에는 version을 `0.0.1`로 올리지 않습니다.
