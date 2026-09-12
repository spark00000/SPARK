# SWE1 — SPARK_Transport 요구사항

**Version:** 0.0.0  
**상태:** Sprint-1 Baseline

## 0. 문서 제어

| 항목 | 값 |
|---|---|
| 프로젝트 | SPARK_Transport |
| 기준선 | 0.0.0 |
| Architecture Contract | `docs/ARCH.md` |
| Architecture Quality Gate | `docs/ARCH_QGate.md` |
| 설계 기록 | `docs/SWE2.md` |
| 구현 Backlog | `docs/SWE3.md` |
| MCP 기준 | `2026-07-28` |

## 1. 목적

SPARK_Transport는 ChatGPT가 사용자의 로컬 MCP 서버를 통해 로컬 자원에 접근할 수 있도록 하는 **MCP transport/daemon 프로젝트**입니다.

Sprint-1의 목적은 기능을 최소화하여 다음 경로를 실제로 검증하는 것입니다.

```text
ChatGPT -> Secure MCP Tunnel -> SPARK_Transport -> 허용된 로컬 파일
```

Sprint-1에서는 읽기 기능만 제공합니다.

## 2. Sprint-1 범위

### 2.1. 포함

- 독립 실행 가능한 Local MCP daemon
- `read_file(path)`
- `list_directory(path=".")`
- 명시적으로 지정된 allowed root
- 경로 정규화와 root 이탈 방지
- `..` traversal 차단
- absolute path 차단
- symlink/junction을 이용한 root escape 차단
- daemon `start/status/stop/restart`
- loopback 전용 listener
- Secure MCP Tunnel을 통한 ChatGPT 연결
- 구조화된 성공/오류 결과
- 테스트 및 검증 evidence

### 2.2. 제외

Sprint-1에서는 다음 MCP tool을 제공하지 않습니다.

- 파일 생성/쓰기/수정
- 파일 삭제
- command/shell 실행
- 권한 상승
- 임의 public listener

## 3. 기능 요구사항

- **REQ-F-001 — Tool Discovery:** MCP client가 사용 가능한 tool을 조회할 수 있어야 합니다.
- **REQ-F-002 — File Read:** allowed root 내부의 UTF-8 text file을 읽을 수 있어야 합니다.
- **REQ-F-003 — Directory List:** allowed root 내부 directory의 entry를 조회할 수 있어야 합니다.
- **REQ-F-004 — Read-only Scope:** Sprint-1 tool discovery에는 `read_file`, `list_directory`만 나타나야 합니다.
- **REQ-F-005 — Daemon Lifecycle:** daemon은 application과 독립적으로 시작/상태확인/중지/재시작할 수 있어야 합니다.
- **REQ-F-006 — Health:** 로컬 운영자가 daemon 상태를 확인할 수 있어야 합니다.
- **REQ-F-007 — Structured Error:** 잘못된 경로, 파일 부재, 타입 오류 등은 구조화된 오류로 반환해야 합니다.

## 4. 인터페이스 요구사항

- **REQ-I-001 — MCP Baseline:** MCP protocol 기준은 `2026-07-28`입니다.
- **REQ-I-002 — No Protocol Extension:** 프로젝트 전용 MCP method/header/framing/session semantics를 추가하지 않습니다.
- **REQ-I-003 — Standard Tool Model:** 프로젝트 기능은 표준 MCP `tools`/schema로 표현합니다.
- **REQ-I-004 — MCP Endpoint:** 기본 local endpoint는 `POST /mcp`입니다.
- **REQ-I-005 — Local Health Endpoint:** `/health`는 daemon 운영용이며 MCP protocol의 일부가 아닙니다.
- **REQ-I-006 — Secure Tunnel:** ChatGPT와 private/local MCP의 연결은 OpenAI Secure MCP Tunnel을 Sprint-1 기본 연결 방식으로 사용합니다.
- **REQ-I-007 — Loopback:** Sprint-1 daemon은 기본적으로 `127.0.0.1`에만 bind합니다.

## 5. 품질 요구사항

- **REQ-Q-001 — Containment:** allowed root 밖의 파일 내용이 반환되어서는 안 됩니다.
- **REQ-Q-002 — Fail Closed:** 경로/프로토콜 검증이 실패하면 작업을 거부해야 합니다.
- **REQ-Q-003 — Least Privilege:** daemon은 권한 상승을 요구하지 않아야 합니다.
- **REQ-Q-004 — Determinism:** tool 목록과 directory 목록은 테스트 가능한 결정적 순서를 사용해야 합니다.
- **REQ-Q-005 — Privacy:** health/error 출력에 불필요한 local absolute root를 노출하지 않습니다.
- **REQ-Q-006 — Independence:** daemon 동작은 특정 IDE나 UI 자동화에 의존하지 않습니다.
- **REQ-Q-007 — Replaceability:** 내부 구현은 향후 공식 MCP SDK로 교체 가능해야 하며 외부 MCP contract는 변경하지 않습니다.

## 6. 보안 제약

- tool path는 allowed root 기준 relative path를 사용합니다.
- absolute path와 drive-qualified path는 거부합니다.
- `..` 기반 parent traversal을 거부합니다.
- realpath 검증을 통해 symlink/junction escape를 거부합니다.
- Sprint-1에는 write/delete/exec 권한이 없습니다.
- daemon 자체에는 OpenAI model/Responses API 호출이 없습니다.
- Secure MCP Tunnel의 runtime API key는 **터널 control plane 인증용**이며 model inference API 호출과 별개입니다.
- tunnel/API credential은 repository에 저장하지 않습니다.

## 7. 외부 환경 제약

- Runtime: Node.js 20 이상
- 개발 기준 테스트 runtime: Node.js 22.16.0
- ChatGPT custom/full MCP와 Developer Mode 사용 가능 여부는 OpenAI plan/workspace 정책에 따릅니다.
- Secure MCP Tunnel에는 Platform의 tunnel 권한과 runtime API key가 필요합니다.
- local MCP server는 public port를 열 필요가 없습니다.

## 8. Sprint-1 Acceptance

| ID | 검증 항목 | 완료 조건 |
|---|---|---|
| ACC-S1-001 | root 내부 파일 읽기 | 정확한 UTF-8 내용 반환 |
| ACC-S1-002 | directory list | entry 목록 정상 반환 |
| ACC-S1-003 | `..` traversal | 거부 |
| ACC-S1-004 | absolute path | 거부 |
| ACC-S1-005 | symlink/junction escape | 거부 |
| ACC-S1-006 | missing/wrong type | 구조화된 오류 반환 |
| ACC-S1-007 | tool scope | `read_file`, `list_directory`만 발견 |
| ACC-S1-008 | MCP smoke | `server/discover`, `tools/list`, `tools/call` 성공 |
| ACC-S1-009 | protocol mismatch | 잘못된 header/body 조합 거부 |
| ACC-S1-010 | session-free baseline | `Mcp-Session-Id` 미사용, legacy GET SSE 미제공 |
| ACC-S1-011 | daemon lifecycle | start/status/stop/restart 성공 |
| ACC-S1-012 | ChatGPT E2E | Secure MCP Tunnel을 통한 실제 두 tool 호출 성공 |

## 9. 향후 범위

Sprint-2 이후에는 별도 설계 승인 후 write/modify/delete/command execution, authorization, confirmation, backup/recovery, audit를 단계적으로 추가합니다. Sprint-1의 read-only 보안 경계를 암묵적으로 확장하지 않습니다.
