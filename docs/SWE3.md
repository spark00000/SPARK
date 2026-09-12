# SWE3 — SPARK_Transport 구현 Backlog

**Version:** 0.0.0

이 문서는 미완료, 실패, 재시도, 보류, 후속 구현 작업을 관리합니다. 안정된 Architecture는 `ARCH.md`, requirement는 `SWE1.md`, 설계 과정은 `SWE2.md`가 소유합니다.

## Sprint-1 — Read-only MCP Daemon

### 1.1. Local read/list implementation
- [x] `read_file`
- [x] `list_directory`
- 상태: DONE
- 완료 조건: automated test 통과

### 1.2. Filesystem containment
- [x] allowed root
- [x] parent traversal 차단
- [x] absolute path 차단
- [x] symlink escape 차단
- 상태: DONE

### 1.3. Daemon lifecycle
- [x] start
- [x] status
- [x] stop/restart
- 상태: DONE

### 1.4. Secure MCP Tunnel + ChatGPT E2E
- [ ] 사용자 환경에서 Secure MCP Tunnel 연결
- [ ] ChatGPT에서 `list_directory` 실제 호출
- [ ] ChatGPT에서 `read_file` 실제 호출
- 관련 REQ: ACC-S1-012
- 상태: BLOCKED / external integration pending
- 완료 조건: 실제 ChatGPT tool-call evidence 2건

### 1.5. Windows target verification
- [ ] Windows에서 전체 test 재실행
- [ ] junction escape behavior 확인
- 상태: TODO
- 완료 조건: target Windows에서 test 결과 기록

### 1.6. Independent Architecture QGate
- [ ] 작성자와 독립된 context에서 `ARCH_QGate.md` 검토
- 상태: TODO
- 완료 조건: blocking finding 0 및 final gate decision 기록

## Sprint-2 — Mutation / Command 기능

- [ ] file create/update/modify 설계 및 구현
- [ ] delete 정책/confirmation/recovery 설계
- [ ] command execution의 cwd/timeout/no-elevation 정책
- [ ] authorization/admin/approval flow
- [ ] backup/hash/audit
- 상태: DEFERRED
- Revisit trigger: Sprint-1 E2E 및 QGate 완료 후

## Sprint-3 — Transport Interface 확장

- [ ] external producer가 prompt/event를 daemon에 전달할 표준 interface 정의
- [ ] durable queue/log contract 정의
- 상태: DEFERRED

## Sprint-4 — Multi-user Gateway

- [ ] single gateway endpoint
- [ ] OAuth identity
- [ ] user/device routing
- [ ] local agent outbound connection
- 상태: DEFERRED

## Sprint-5 — 배포

- [ ] Windows/macOS packaging
- [ ] install/update/rollback
- [ ] signing/notarization 필요사항 조사
- 상태: DEFERRED
