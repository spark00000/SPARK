# SWE2 — SPARK_Transport Architecture Definition Ledger

**Version:** 0.0.0  
**Status:** Sprint-1 baseline

이 문서는 SPARK_Transport의 Architecture 설계 과정과 주요 decision evidence를 기록합니다. 안정된 결과는 `ARCH.md`가 소유합니다.

## 0.0.0

### 1.1. MCP protocol baseline

- 결정: MCP `2026-07-28`을 normative baseline으로 사용합니다.
- 이유: 현재 프로젝트는 MCP를 확장하지 않고 표준 protocol과 interoperable해야 합니다.
- 대안: custom method/header/session dialect.
- 결과: Reject. 구현 편의보다 interoperability를 우선합니다.
- 관련 ADR: `ADR-002`.

### 1.2. Sprint-1 capability boundary

- 결정: `read_file`, `list_directory`만 제공합니다.
- 이유: Secure MCP Tunnel과 local filesystem boundary를 가장 작은 위험 범위로 먼저 검증합니다.
- 대안: write/delete/exec를 동시에 구현.
- 결과: Reject. mutation은 별도 Sprint에서 authorization/recovery와 함께 추가합니다.
- 관련 ADR: `ADR-003`.

### 1.3. Filesystem containment

- 결정: user-configured allowed root + relative path + lexical/realpath 검증을 사용합니다.
- 이유: traversal과 symlink/junction escape를 모두 차단해야 합니다.
- 관련 ADR: `ADR-004`.

### 1.4. Local daemon lifecycle

- 결정: MCP endpoint와 별도로 local `/health` 및 start/status/stop lifecycle을 제공합니다.
- 이유: daemon 운영 기능을 MCP protocol extension으로 만들지 않기 위해서입니다.
- 관련 ADR: `ADR-005`.

### 1.5. ChatGPT connectivity

- 결정: Sprint-1 remote 연결은 Secure MCP Tunnel을 사용합니다.
- 이유: ChatGPT가 localhost MCP에 직접 연결하는 구조를 가정하지 않습니다.
- 관련 ADR: `ADR-006`.
- 상태: Architecture decision은 완료. 실제 end-to-end evidence는 아직 사용자 환경에서 필요합니다.

### 1.6. SDK dependency

- 결정: 외부 contract는 MCP `2026-07-28`에 고정하고, 내부 구현은 향후 official SDK v2로 교체 가능하게 유지합니다.
- 현재 상태: build 환경의 package access가 제한된 경우 zero-external-dependency 구현을 허용합니다.
- 관련 ADR: `ADR-007`.

## 설계 승격 규칙

- requirement 변경 → `SWE1.md`
- architecture decision → 본 문서 기록 후 `ARCH.md` 반영
- 구현 TODO/실패/보류 → `SWE3.md`
- 검증 결과 → `evidence/`
