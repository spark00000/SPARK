# SWE2 — SPARK_Transport Architecture / Decision Ledger

**Baseline:** 0.0.0  
**Target:** 0.0.1

## 1.22. Reference architecture study

### User requirement

Before adding more features, compare existing projects so SPARK does not reimplement solved problems.

### Reviewed projects

- CatDesk
- Local Coding Agent
- ChatGPT Local Coder
- Jan

Detailed evidence: `ARCH_REFERENCE_STUDY.md`.

### Decision

The target architecture is not copied from one project. SPARK combines:

- CatDesk: process ownership / timeout / bounded output / Windows process-tree pattern.
- Local Coding Agent: authorization-root separation, capability/policy concepts, private authority state, large-output indirection.
- ChatGPT Local Coder: structured result and activity/audit stream.
- Jan: future provider-neutral/local-model client architecture reference.

GUI implementation was removed from Sprint-2.

## 1.23. Historical `3,000/week` discovery

### Finding

CatDesk README explicitly states `3,000 messages/week` for `ChatGPT Chat + CatDesk`, citing an archived OpenAI GPT-5.5 Help Center page dated 2026-05-19. The same README labels the current GPT-5.6 limit as unknown.

### Decision

The prior cost model was incomplete because it compared Work/Codex/API but omitted **consumer Chat allowance + MCP** as a separate execution route.

New comparison axes:

```text
A. Consumer Chat allowance + MCP
B. Coding product allowance
C. Pay-as-you-go API/usage credit
D. Local model
```

Historical quota numbers are not Core constants.

## 1.23.1. Claude as alternate Brain Host

### Evidence

Anthropic currently supports custom remote MCP connectors on Claude consumer/business plans. Pro has variable usage with five-hour session reset plus weekly allowance. Max offers 5x or 20x Pro session usage, still with five-hour and weekly limits.

### Decision

Claude is a valid future Brain Host, but no Claude runtime implementation is included in 0.0.1 because a real target account/environment is not available for verification.

Architecture must nevertheless support:

```text
Claude
  -> Brain Gateway / MCP adapter
  -> same SPARK Agent Core
```

Details: `BRAIN_HOST_COMPARISON.md`.

## 1.23.2. Brain Gateway introduced

### Problem

The previous architecture separated UX from Core but still showed ChatGPT/MCP too directly coupled to Agent Core. Provider-specific session, connector, quota and confirmation behavior would otherwise leak into Core.

### Decision

Insert a **Brain Gateway Layer** between Brain Host and Agent Core.

Responsibilities:

- connector/ingress adaptation;
- standard protocol adaptation;
- client/session identity normalization;
- capability discovery/invocation boundary;
- optional provider quota/status observation;
- no login scraping or quota bypass.

MCP remains the current standard adapter, not the Core domain model.

## 1.23.3. Body Port generalized

### Problem

SPARK is intended to grow beyond local files. Future actions may target drones, robots, sensors and actuators.

### Decision

Physical capability is separated from Agent Core through Body Ports.

Current ports:

```text
PlatformFilePort
PlatformTrashPort
PlatformProcessPort
PlatformPermissionPort
PlatformInfoPort
```

Future ports may include:

```text
PlatformComputerPort
DronePort
RobotPort
SensorPort
ActuatorPort
```

Thus the durable shape is:

```text
AI Brain
  -> Brain Gateway
  -> SPARK Agent Core + Human UX plane
  -> Body Port
  -> Physical/Execution adapter
```

## 1.23.4. Result and observability

### Decision

Every external tool invocation uses one normalized result envelope with operation ID, success/failure, changed flag, data, error, duration and elevation/retry metadata.

A local JSONL operation ledger is maintained separately from the chat transcript. This is required because AI wording is not a sufficient audit/status surface.

## 1.23.5. Private state

### Decision

Default runtime/recovery/ledger state moves from repo-local `.runtime` toward a user-private state directory. Explicit state-directory override remains available for tests/development.

## 1.23.6. Command containment

### Finding

`cwd` confinement does not provide OS-level filesystem confinement.

### Decision

0.0.1 `run_command` is explicitly a **trusted local, non-elevated simple execution capability**.

Mandatory 0.0.1 behavior:

- shell false by default;
- timeout;
- bounded stdout/stderr;
- verified descendant cleanup for the timeout test;
- no automatic elevation.

Windows Job Object remains the preferred production mechanism. An equivalent tested tree-termination mechanism can satisfy the Small PoC but is recorded as technical debt if Job Object is not used.

## 1.23.7. Verification strategy

A GitHub Actions matrix is added for:

- `windows-latest`, Node 24;
- `ubuntu-latest`, Node 24.

Windows-specific acceptance includes:

- junction escape;
- actual Recycle Bin delete;
- process-tree timeout cleanup.

Linux validates the OS-neutral Core/path/result/lifecycle behavior and POSIX process-group cleanup.

## 1.23.8. 0.0.1 promotion rule

Version SHALL remain `0.0.0` until mandatory automated source/CI gates pass. After pass:

- update source/package version to `0.0.1`;
- update SWE3/evidence;
- run CI again on the version-promotion commit.

Live ChatGPT mutation/exec E2E remains a separate deployment acceptance because it requires the user's running tunnel/workspace.
