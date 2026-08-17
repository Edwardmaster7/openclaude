# Design Spec: Ads System High-Yield Optimization (/ads)

**Date:** 2026-07-29
**Status:** Approved by User
**Target Surface:** OpenClaude CLI (`/ads`, Spinner, Ads Service, Buddy Observer)

---

## 1. Overview & Objectives

The `/ads` system enables users to opt-in to sponsored tips shown during AI model inference waiting periods. In return, users earn OpenGateway credits towards model usage.

This optimization redesign improves both user experience and monetization yield through four core pillars:

1. **eCPM & Context Qualification:** Enrich context payload (project technologies, prompt length, turn depth) so the ads backend can serve higher-paying, highly-relevant developer ads.
2. **Dynamic Rotation & Cooldown:** In long inference waits (> dwell time), cycle to subsequent sponsored tips without repeating ads already seen in the current session (`seenImpressionIds`).
3. **Transparency & Real-time Earnings Feedback:** Display earned credits in the CLI upon completion of dwell time and provide an enriched dashboard in `/ads`.
4. **Buddy Integration:** Optional subtle reaction from Crocbiçom (Buddy) when credits are earned.

---

## 2. Architecture & File Modifications

### 2.1 `openclaude/src/services/ads.ts`

- **Context Payload Expansion:** Add `sessionContext` fields (`turnCount`, `sessionDurationSec`, `seenImpressionIds`) to `fetchNextTip()`.
- **Sanitizer & Safety Guarantees:** Ensure all context remains strictly sanitized (`sanitizeForAds()`) with zero secret leakage. Hard timeout remains bounded at 5,000ms. "Ads never block inference."

### 2.2 `openclaude/src/components/Spinner.tsx`

- **Multi-Ad Carousel during Long Waits:**
  - When `dwellMs` is reached for the current ad, trigger background `confirmTip()`.
  - Fetch and transition smoothly to the next sponsored tip if the AI model is still streaming / processing.
  - Keep a local Set of `seenImpressionIds` to prevent repeating ads in the same session.
- **Credit Notification Badge:** Show a subtle inline credit confirmation message (e.g. `[+$0.005 OpenGateway Credit | Balance: $1.25]`).

### 2.3 `openclaude/src/commands/ads.tsx`

- **Dashboard Enhancements:**
  - Show active opt-in status (Context Sharing, Earn Code status).
  - Show Current Session Earnings vs. Lifetime Balance.
  - Show Ad Impression Statistics (ads viewed in session, average dwell time, yield multiplier).

### 2.4 `openclaude/src/buddy/observer.ts`

- **Companion Event:** Trigger a soft positive reaction from Buddy upon earning credits (e.g., "+$0.005 earned!").

---

## 3. Safety & Non-Functional Requirements

1. **Non-blocking Execution:** Network latency or errors in fetching/confirming ads must never delay LLM generation or crash the CLI process.
2. **Privacy First:** Sanitization strips JWTs, API keys, bearer tokens, emails, and hex hashes before sending any prompt context.
3. **Graceful Fallback:** If inventory is empty or offline, spinner renders normal developer tips without errors.

---

## 4. Verification Plan

- `bun test src/services/ads.test.ts`: Verify sanitized payload construction and timeout safety.
- `bun test src/commands/ads.test.ts`: Verify `/ads` status rendering and earn code validation.
- `bun run build`: Ensure zero TypeScript or bundler errors.
