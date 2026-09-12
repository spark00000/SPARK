# SPARK_Transport Migration Report

**Baseline:** 0.0.0

## 1. 목적

이 문서는 과거 실험 자료에서 SPARK_Transport Sprint-1으로 옮겨온 개념과 폐기한 요소를 기록합니다.

## 2. 재사용한 개념

- loopback-only local MCP daemon
- independent start/status/stop lifecycle
- configured allowed filesystem root
- parent traversal 차단
- symlink/junction escape 차단
- local runtime state/log directory
- Secure MCP Tunnel을 통한 private-machine 연결
- daemon 자체에서 OpenAI model API를 호출하지 않는 구조

## 3. 재사용하지 않은 요소

- 과거 write-oriented tool set
- 특정 개인 directory에 묶인 path/bucket 구조
- 구형 session/initialize 기반 MCP 동작
- 과거 executable/build artifact와 backup
- 과거 repository identity/history

## 4. Sprint-1 구현 방향

Sprint-1은 과거 실험 구현을 그대로 복사하지 않고 현재 요구사항과 MCP `2026-07-28` 기준으로 새로 구성했습니다.

현재 project boundary는 SPARK_Transport 자체에 한정하며 다른 프로젝트의 구조나 구현 세부사항을 본 repository 문서에 포함하지 않습니다.

## 5. 현재 기준선

- Project: `SPARK_Transport`
- Baseline: `0.0.0`
- Sprint-1: read-only (`read_file`, `list_directory`)
- MCP: `2026-07-28`
- Secure MCP Tunnel E2E: 사용자 환경 검증 대기
