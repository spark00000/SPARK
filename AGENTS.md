# AGENTS.md — SPARK 개발 방법론

**Version:** 0.0.0

이 문서는 SPARK에서 Agent와 사람이 동일한 방식으로 작업하기 위한 개발 규칙입니다. 프로젝트별 요구사항은 `docs/SWE1.md`, 설계 과정은 `docs/SWE2.md`, 안정된 Architecture Contract는 `docs/ARCH.md`, 미완료 구현은 `docs/SWE3.md`가 소유합니다.

## 1. 기본 원칙

### P1. Artifact 우선

대화 기록이 아니라 repository의 versioned Markdown/source/test/evidence를 authoritative source로 사용합니다.

### P2. Requirement → Architecture → Implementation → Verification

요구사항과 acceptance를 먼저 정의하고, Architecture를 거쳐 구현한 뒤 동일 ID로 검증 evidence를 남깁니다.

### P3. Architecture를 구현 Agent가 임의로 보완하지 않음

구현 중 Architecture가 부족하거나 모순되면 `SWE2.md`로 되돌아가 결정한 뒤 `ARCH.md`를 갱신합니다.

### P4. 독립 검증

Architecture 작성자가 최종 QGate의 유일한 reviewer가 되어서는 안 됩니다. 최종 baseline은 별도 review context에서 확인합니다.

### P5. 최소 권한과 단계적 확장

Sprint-1은 read-only입니다. write/delete/exec 같은 위험 기능은 해당 Sprint의 requirement, architecture, recovery/approval 정책이 준비된 뒤에만 추가합니다.

### P6. 표준 우선

SPARK는 MCP 표준을 확장하지 않습니다. 기능은 표준 MCP tool/resource/schema 안에서 표현합니다.

### P7. 검증되지 않은 완료 선언 금지

source가 존재한다는 이유만으로 완료라고 하지 않습니다. 실제 test와 integration evidence가 있어야 합니다.

## 2. Artifact 역할

| Artifact | 역할 |
|---|---|
| `AGENTS.md` | 공통 개발 규칙 |
| `docs/SWE1.md` | 프로젝트 요구사항/제약/acceptance |
| `docs/SWE2.md` | Architecture 설계 및 결정 과정 |
| `docs/ARCH.md` | 구현 Agent가 따라야 할 안정된 Architecture Contract |
| `docs/ARCH_QGate.md` | Architecture review evidence |
| `docs/SWE3.md` | TODO/FAILED/RETRY/DEFERRED/BLOCKED backlog |
| `modules/transport/` | MCP daemon / policy / PAL / tunnel 지원 sub-project |
| `modules/theme/` | ChatGPT Windows CDP Theme sub-project |
| `modules/oui/` | 향후 Obsidian UI / clipboard integration sub-project |
| `scripts/` | 전체 SPARK lifecycle orchestration |
| `config/` | 전체 SPARK runtime configuration |
| `evidence/` | test/build/integration evidence |

Project-specific requirement를 `AGENTS.md`에 넣지 않습니다.

## 3. 작업 절차

1. 작업 전 현재 branch, 변경 상태, 관련 requirement/ADR을 확인합니다.
2. state-changing 작업 전에 복구 가능한 상태를 확보합니다.
3. 구현 범위를 Sprint와 requirement ID에 맞춥니다.
4. source 변경 후 syntax/unit/integration test를 실행합니다.
5. 실패/보류/외부 blocker는 `SWE3.md`에 기록합니다.
6. Architecture에 영향을 주는 변경은 `SWE2.md`에서 결정 후 `ARCH.md`에 반영합니다.
7. 완료 시 evidence를 남기고 baseline을 갱신합니다.

## 4. SPARK 고정 제약

프로젝트별 상세 requirement는 `docs/SWE1.md`가 authoritative source입니다. 다음은 구현 Agent가 항상 지켜야 할 핵심 경계입니다.

- MCP baseline은 현재 `2026-07-28`입니다.
- 프로젝트 전용 MCP protocol extension을 추가하지 않습니다.
- Sprint-1은 `read_file`, `list_directory`만 제공합니다.
- OpenAI model/Responses API를 runtime transport로 사용하지 않습니다.
- local daemon은 loopback-only를 기본값으로 합니다.
- filesystem access는 configured allowed root 안으로 제한합니다.
- secret/API key를 source나 log에 저장하지 않습니다.

## 5. 검증 규칙

- path traversal, absolute path, symlink/junction escape는 negative test가 있어야 합니다.
- MCP discovery/list/call은 protocol test가 있어야 합니다.
- Sprint-1에서는 write/delete/exec tool이 발견되지 않는 것을 검증합니다.
- local test 통과와 ChatGPT/Secure MCP Tunnel E2E 통과를 구분합니다.
- Windows/macOS별 OS behavior가 material하면 해당 target에서 재검증합니다.

## 6. Baseline

Baseline은 `MAJOR.MINOR.PATCH` 형식을 사용합니다. 현재 초기 baseline은 `0.0.0`입니다.

Accepted baseline은 요구사항, Architecture, source, test, evidence가 서로 모순되지 않아야 합니다.
