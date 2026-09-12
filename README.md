# SPARK_Transport

SPARK_Transport는 ChatGPT가 사용자의 로컬 파일을 **표준 MCP(Model Context Protocol)** 로 읽을 수 있게 하는 로컬 MCP daemon 프로젝트입니다.

현재 **Sprint-1은 읽기 전용 PoC**입니다.

- `read_file(path)` : 허용된 root 아래의 UTF-8 text file 읽기
- `list_directory(path=".")` : 허용된 root 아래의 directory 목록 보기
- 쓰기/수정/삭제/command 실행 기능은 **없습니다**.

## 1. 가장 먼저 알아둘 것

SPARK_Transport는 PC에서 다음 주소로 실행됩니다.

```text
http://127.0.0.1:8765/mcp
```

ChatGPT는 이 localhost 주소에 직접 접속하지 않습니다. 따라서 실제 ChatGPT와 연결할 때는 OpenAI의 **Secure MCP Tunnel**을 사용합니다.

```text
ChatGPT
   ↓
Secure MCP Tunnel
   ↓
tunnel-client
   ↓
SPARK_Transport (127.0.0.1:8765/mcp)
   ↓
사용자가 허용한 local folder
```

공인 IP, router port-forwarding, inbound firewall port 개방은 필요하지 않습니다.

---

# 2. 설치

## 2.1. 필요한 프로그램

- Git
- Node.js 20 이상
- Windows Command Prompt(CMD) 또는 PowerShell

Node.js 설치 여부 확인:

```cmd
node --version
npm --version
```

## 2.2. Repository 받기

원하는 작업 폴더에서 다음을 실행합니다.

```cmd
git clone https://github.com/spark00000/SPARK_Transport.git
cd SPARK_Transport
```

Sprint-1에는 외부 runtime package가 없으므로 별도의 `npm install`이 필요하지 않습니다.

---

# 3. SPARK_Transport 실행

## 3.1. ChatGPT가 읽을 수 있는 folder 지정

`SPARK_TRANSPORT_ROOT`는 ChatGPT에 읽기를 허용할 최상위 folder입니다.

### Windows CMD

```cmd
set "SPARK_TRANSPORT_ROOT=C:\path\to\allowed-folder"
```

확인:

```cmd
echo %SPARK_TRANSPORT_ROOT%
```

### PowerShell

```powershell
$env:SPARK_TRANSPORT_ROOT = 'C:\path\to\allowed-folder'
```

확인:

```powershell
$env:SPARK_TRANSPORT_ROOT
```

**주의:** 이 folder 아래의 파일만 읽을 수 있습니다. 상위 folder로 빠져나가는 경로와 absolute path는 거부됩니다.

## 3.2. Daemon 시작

CMD와 PowerShell 모두 동일합니다.

```cmd
npm run daemon:start
```

상태 확인:

```cmd
npm run daemon:status
```

정상이라면 health endpoint도 확인할 수 있습니다.

### CMD

```cmd
curl http://127.0.0.1:8765/health
```

### PowerShell

```powershell
Invoke-RestMethod http://127.0.0.1:8765/health
```

foreground로 직접 실행하려면:

```cmd
npm start
```

## 3.3. Daemon 중지

```cmd
npm run daemon:stop
```

다시 시작하려면:

```cmd
npm run daemon:start
```

---

# 4. Secure MCP Tunnel 설정

> 이 절차는 **SPARK_Transport daemon이 먼저 정상 실행된 상태**에서 진행합니다.

OpenAI 공식 문서:

- Secure MCP Tunnel: <https://developers.openai.com/api/docs/guides/secure-mcp-tunnels>
- Tunnel 설정: <https://platform.openai.com/settings/organization/tunnels>
- Runtime API key: <https://platform.openai.com/settings/organization/api-keys>
- tunnel-client release: <https://github.com/openai/tunnel-client/releases/latest>
- ChatGPT MCP/Developer Mode: <https://help.openai.com/en/articles/12584461>

## 4.1. OpenAI Platform에서 Tunnel 생성

1. 다음 페이지를 엽니다.
   - <https://platform.openai.com/settings/organization/tunnels>
2. 새 Tunnel을 생성합니다.
3. 사용할 ChatGPT workspace와 연결합니다.
4. 생성된 `tunnel_id`를 기록합니다.

예:

```text
tunnel_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

## 4.2. Tunnel용 Runtime API key 생성

다음 페이지에서 runtime API key를 만듭니다.

<https://platform.openai.com/settings/organization/api-keys>

Tunnel 실행에는 적절한 Tunnel 권한이 필요합니다.

- 사용: `Tunnels Read + Use`
- Tunnel 생성/수정: 필요 시 `Tunnels Read + Manage`

**중요:** 이 key는 OpenAI model/Responses API로 prompt를 보내기 위한 key가 아닙니다. SPARK_Transport는 OpenAI model API를 호출하지 않습니다. 이 key는 `tunnel-client`가 OpenAI의 tunnel control plane에 인증할 때 사용됩니다.

## 4.3. tunnel-client 설치

최신 release를 받습니다.

<https://github.com/openai/tunnel-client/releases/latest>

`tunnel-client` 실행 파일을 PATH가 잡힌 위치에 두거나 현재 shell에서 실행 가능한 위치에 둡니다.

확인:

```cmd
tunnel-client help quickstart
```

## 4.4. Runtime key와 tunnel ID 설정

### Windows CMD

```cmd
set "CONTROL_PLANE_API_KEY=sk-..."
set "TUNNEL_ID=tunnel_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

### PowerShell

```powershell
$env:CONTROL_PLANE_API_KEY = 'sk-...'
$tunnelId = 'tunnel_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
```

key를 source code, README, Git repository에 저장하지 마십시오.

## 4.5. Tunnel profile 생성

### Windows CMD

```cmd
tunnel-client init --sample sample_mcp_remote_no_auth --profile spark-transport --tunnel-id %TUNNEL_ID% --mcp-server-url http://127.0.0.1:8765/mcp
```

### PowerShell

```powershell
tunnel-client init `
  --sample sample_mcp_remote_no_auth `
  --profile spark-transport `
  --tunnel-id $tunnelId `
  --mcp-server-url http://127.0.0.1:8765/mcp
```

설정 검사:

```cmd
tunnel-client doctor --profile spark-transport --explain
```

## 4.6. Tunnel 실행

```cmd
tunnel-client run --profile spark-transport
```

이 창은 닫지 마십시오. ChatGPT가 tool을 호출하는 동안 `SPARK_Transport daemon`과 `tunnel-client`가 둘 다 실행 중이어야 합니다.

Tunnel 상태 확인:

```cmd
curl http://127.0.0.1:8080/healthz
curl http://127.0.0.1:8080/readyz
```

브라우저에서 다음 local 관리 화면도 확인할 수 있습니다.

```text
http://127.0.0.1:8080/ui
```

---

# 5. ChatGPT에 연결

ChatGPT Web에서 진행합니다.

1. 사용하는 workspace에서 Developer Mode를 활성화합니다.
2. Custom MCP app을 생성합니다.
3. Connection 방식에서 **Tunnel**을 선택합니다.
4. 앞에서 만든 tunnel을 선택하거나 `tunnel_id`를 입력합니다.
5. **Scan tools**를 실행합니다.
6. 다음 두 tool만 나타나는지 확인합니다.

```text
read_file
list_directory
```

Sprint-1에서는 write/delete/exec tool이 나타나면 안 됩니다.

---

# 6. 실제 동작 확인

예를 들어 ChatGPT에서 다음과 같이 요청합니다.

```text
SPARK_Transport를 사용해서 허용된 root의 "." directory 목록을 보여줘.
```

파일 읽기 테스트:

```text
SPARK_Transport를 사용해서 허용된 root 안의 README.md를 읽어줘.
```

실제 파일명은 `SPARK_TRANSPORT_ROOT` 아래에 존재하는 파일을 사용하십시오.

---

# 7. 프로그램 종료

SPARK_Transport daemon:

```cmd
npm run daemon:stop
```

`tunnel-client`는 실행 중인 terminal에서 `Ctrl+C`로 종료합니다.

다시 사용할 때는 다음 두 개를 다시 실행합니다.

```cmd
npm run daemon:start
tunnel-client run --profile spark-transport
```

---

# 8. 문제 해결

| 증상 | 확인 방법 |
|---|---|
| `SPARK_TRANSPORT_ROOT is required` | CMD에서는 `set "SPARK_TRANSPORT_ROOT=..."`, PowerShell에서는 `$env:SPARK_TRANSPORT_ROOT = '...'` 실행 |
| daemon이 시작되지 않음 | `npm run daemon:status` 확인 |
| local server 확인 | `curl http://127.0.0.1:8765/health` |
| tunnel이 연결되지 않음 | `tunnel-client doctor --profile spark-transport --explain` |
| tunnel 상태 확인 | `curl http://127.0.0.1:8080/readyz` |
| ChatGPT에서 tunnel이 안 보임 | tunnel과 ChatGPT workspace 연결 및 Tunnel 권한 확인 |
| `OUTSIDE_ALLOWED_ROOT` | 요청한 파일이 `SPARK_TRANSPORT_ROOT` 밖에 있거나 absolute path 사용 여부 확인 |
| write/delete/exec tool이 보임 | Sprint-1이 아닌 잘못된 server/profile 연결 여부 확인 |

---

# 9. 설정값

| 환경 변수 | 필수 | 기본값 | 설명 |
|---|---:|---|---|
| `SPARK_TRANSPORT_ROOT` | 예 | 없음 | 읽기를 허용할 최상위 folder |
| `SPARK_TRANSPORT_HOST` | 아니오 | `127.0.0.1` | Sprint-1 local bind |
| `SPARK_TRANSPORT_PORT` | 아니오 | `8765` | MCP server port |
| `SPARK_TRANSPORT_MCP_PATH` | 아니오 | `/mcp` | MCP endpoint |
| `SPARK_TRANSPORT_HEALTH_PATH` | 아니오 | `/health` | daemon health endpoint |
| `SPARK_TRANSPORT_MAX_READ_BYTES` | 아니오 | `1048576` | 한 파일의 최대 읽기 크기 |
| `SPARK_TRANSPORT_STATE_DIR` | 아니오 | `.runtime` | PID/log 저장 위치 |

---

# 10. 테스트

```cmd
npm test
```

Sprint-1 baseline에서는 다음을 검증합니다.

- root 내부 file read
- directory list
- `..` traversal 차단
- absolute path 차단
- symlink escape 차단
- structured error
- MCP discovery/list/call
- write/delete/exec tool 미노출
- daemon start/status/stop/restart

상세 결과는 `evidence/SPRINT1_TEST_REPORT.md`를 참조하십시오.

---

# 11. 프로토콜 기준

- MCP baseline: `2026-07-28`
- SPARK_Transport 전용 MCP method/header/session/framing을 추가하지 않습니다.
- `/health`는 local daemon 관리 endpoint이며 MCP protocol extension이 아닙니다.
- 상세 protocol reference는 `refs/MCP_2026-07-28.md`에 정리되어 있습니다.
