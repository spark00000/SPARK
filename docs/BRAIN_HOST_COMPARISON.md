# SPARK_Transport — Brain Host / Cost / Quota Comparison

**Date:** 2026-09-12  
**Scope:** API/Codex/Work 대신 subscription/chat allowance를 SPARK Brain으로 사용할 수 있는지 검토

## 1. CatDesk의 `3,000 messages/week`는 어디서 왔는가

CatDesk README의 현재 문구는 다음 근거를 명시한다.

- CatDesk는 `ChatGPT Chat + CatDesk` usage를 **3,000 messages/week**라고 표기한다.
- 같은 README에서 이 숫자의 source를 **GPT-5.5 ChatGPT Help Center의 2026-05-19 archived page**로 연결한다.
- CatDesk README 스스로 **GPT-5.6은 현재 한도가 unknown**이라고 적고, 단지 개발자가 아직 limit에 도달하지 않았다고 설명한다.

Source:

- CatDesk README: https://github.com/Xeift/CatDesk/blob/main/README.md
- CatDesk가 인용한 archived OpenAI GPT-5.5 page: https://web.archive.org/web/20260519111010/https://help.openai.com/en/articles/11909943-gpt-55-in-chatgpt
- Current OpenAI GPT-5.6 Help: https://help.openai.com/en/articles/20001354-gpt-56-in-chatgpt

### Architecture interpretation

`3,000/week`를 현재 SPARK constant나 guaranteed GPT-5.6 quota로 사용하면 안 된다. 그것은 **historical GPT-5.5 Chat allowance**다.

따라서 SPARK는 다음을 구분한다.

```text
Historical observed/documented allowance
!=
Current provider contract
```

Current GPT-5.6 limits는 plan/model/workspace setting에 따라 달라지며 OpenAI가 현재 Help Center에서 plan-dependent allowance로 설명한다. Brain Gateway는 quota를 hard-code하지 않는다.

## 2. 왜 기존 cost comparison에서 이 항목이 빠졌는가

기존 비교가 Work/Codex/API allowance와 token/credit cost를 중심으로 정리되면서 **consumer Chat message allowance + MCP**라는 별도의 execution route를 비교축으로 넣지 않았다.

SPARK 관점에서는 이 축이 중요하다.

```text
A. Consumer Chat allowance + MCP tools
B. Coding product allowance (Work/Codex/Claude Code)
C. Pay-as-you-go API
D. Local model
```

앞으로 cost comparison은 이 네 경로를 별도로 비교한다.

## 3. Brain Host comparison

| Brain Host | Subscription/chat allowance로 SPARK tool 사용 | MCP/connector path | Limit form | 0.0.1 |
|---|---|---|---|---|
| ChatGPT | **Yes, current proven path** | Custom MCP/App + Secure MCP Tunnel | Plan/model dependent; old GPT-5.5 3,000/week는 historical | Implemented/current |
| Claude.ai | **Yes, technically viable** | Custom remote MCP connector | Variable usage; 5-hour session reset + weekly cap | Architecture only |
| Claude Max 5x/20x | **Yes, strong candidate** | Same custom remote MCP | 5x/20x Pro session usage, 5-hour reset + weekly cap | Architecture only |
| Gemini Apps | Chat subscription usage exists | Comparable web-chat custom MCP route **not verified in this study** | Compute-based; refreshes every 5h until weekly limit | Do not implement |
| Jan + local model | API fee not required for local inference | Local MCP host | Local compute/resource limit | Future |
| Direct provider API | Yes | API | Pay per usage/tokens | SPARK daemon does not require it |

## 4. Claude viability

### 4.1. Custom MCP connector

Anthropic documents custom connectors using **remote MCP** for Claude, Cowork and Claude Desktop on Free, Pro, Max, Team and Enterprise plans. Pro/Max individual users can add a custom connector in Claude's connector settings.

Important network difference from current OpenAI setup:

- Claude remote custom connector requests originate from Anthropic cloud.
- The MCP endpoint therefore must be reachable from Anthropic's infrastructure.
- Claude Desktop also has a separate local MCP mechanism, but that is not the same as claude.ai remote connectors.

Source: https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp

### 4.2. Usage capacity

Claude Pro does **not** publish one fixed message number comparable to historical `3,000/week`. Anthropic states that usable messages vary with:

- message length
- attached files
- conversation length
- model/feature
- tool usage
- effort level

Pro session allowance resets every five hours and also has a weekly allowance across models.

Source: https://support.claude.com/en/articles/8325606-what-is-the-pro-plan

Claude Max is more interesting for SPARK:

- Max 5x: five times Pro usage per session
- Max 20x: twenty times Pro usage per session
- five-hour session reset
- weekly cap still applies

Source: https://support.claude.com/en/articles/11049741-what-is-the-max-plan

### 4.3. Practical conclusion

Claude can support the same architectural pattern:

```text
Claude subscription chat
    -> Remote MCP Connector
    -> SPARK Brain Gateway
    -> Agent Core
    -> Body Port
```

This can avoid direct API billing **while included subscription usage remains available**. However, unlike CatDesk's historical GPT-5.5 example, the current Claude allowance is compute/context-sensitive, not a fixed high message count. Long tool logs and long chats consume more allowance, so SPARK's bounded output, short handoff, operation ledger, and new-chat workflow remain important.

Anthropic also offers optional usage credits after included limits; those are extra consumption charges and are therefore a separate cost mode, not the free-in-subscription path.

## 5. Gemini Apps

Google currently describes Gemini Apps limits as **compute-based**, affected by prompt complexity, model/features and chat length. Limits refresh every five hours until a weekly limit is reached.

Source: https://support.google.com/gemini/answer/16275805

This is conceptually similar to Claude's variable quota, but this study did **not** verify an official Gemini web-chat custom remote MCP path equivalent to ChatGPT/Claude. Therefore Gemini remains a Brain Host research item rather than an implementation target.

## 6. SPARK architecture rule

Brain quota/cost belongs to the **Brain Gateway / deployment policy**, not Agent Core.

```text
Brain Host
  ├─ subscription allowance
  ├─ connector/MCP availability
  ├─ quota/reset policy
  └─ optional paid overage
        ↓
Brain Gateway
        ↓
SPARK Agent Core
        ↓
Body Port / PAL
```

Agent Core SHALL NOT:

- assume a fixed message quota;
- depend on one provider's billing model;
- contain consumer login/session scraping;
- bypass provider usage limits;
- require provider API keys for its own local execution.

## 7. Recommendation

For the near term:

1. **ChatGPT + MCP remains the tested primary Brain Host.**
2. **Claude Max/Pro + remote MCP is the strongest second Brain Host candidate** because Anthropic officially supports custom remote MCP on consumer plans.
3. Claude implementation is intentionally deferred until a target account/environment is available for real E2E testing.
4. Gemini remains research-only until the comparable chat-to-custom-MCP path is verified.
5. Local-model/Jan path remains a future no-cloud-API alternative.
