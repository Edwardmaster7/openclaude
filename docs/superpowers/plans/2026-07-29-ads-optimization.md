# Ads System High-Yield Optimization Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the `/ads` sponsored tips system to increase ad yield via contextual eCPM targeting, multi-ad rotation in long inference waits, impression deduplication, balance feedback badges, and Buddy companion integration.

**Architecture:** Extend `services/ads.ts` payload structure to send turn depth and session duration; add auto-rotation and deduplication in `Spinner.tsx`; update `commands/ads.tsx` dashboard with balance and impression stats; wire Buddy observer in `buddy/observer.ts` to react when credits land.

**Tech Stack:** TypeScript, React / Ink, Bun Test.

## Global Constraints

- Node >= 22.0.0, Bun runtime for source builds and tests.
- Hard timeout on ads network calls remains bounded at 5,000ms.
- "Ads never block inference": all network failures must degrade silently without throwing errors or blocking LLM streaming or CLI startup.
- Privacy & Sanitization (`sanitizeForAds()`) must remain active on all context payloads.

---

### Task 1: Enrich `ads.ts` with Extended Session Context and Rotation Parameters

**Files:**
- Modify: `openclaude/src/services/ads.ts`
- Modify: `openclaude/src/services/ads.test.ts`

**Interfaces:**
- Consumes: `detectProjectTechnologies()`, `sanitizeForAds()`
- Produces: `fetchNextTip(earnCode: string, surface?: string, userMessage?: string, sessionContext?: { turnCount?: number; sessionDurationSec?: number; seenImpressionIds?: string[] })`

- [ ] **Step 1: Write the failing tests for extended session context in `ads.test.ts`**

Add tests checking that `fetchNextTip` includes `turn_count`, `session_duration_sec`, and `seen_impression_ids` in the POST context body when `sessionContext` options are provided.

```typescript
test('POSTs context with turn_count and seen_impression_ids when sessionContext is provided', async () => {
  stubFetch(200, TIP)
  await fetchNextTip('code', 'openclaude', 'build a react app', {
    turnCount: 5,
    sessionDurationSec: 120,
    seenImpressionIds: ['imp_prev_1', 'imp_prev_2'],
  })
  expect(captured.method).toBe('POST')
  const ctx = (captured.body as { context: Record<string, unknown> }).context
  expect(ctx.turn_count).toBe(5)
  expect(ctx.session_duration_sec).toBe(120)
  expect(ctx.seen_impression_ids).toEqual(['imp_prev_1', 'imp_prev_2'])
})
```

- [ ] **Step 2: Run test to verify failure**

Run: `bun test src/services/ads.test.ts`
Expected: FAIL due to missing parameters / payload mismatch.

- [ ] **Step 3: Implement context payload expansion in `src/services/ads.ts`**

Update `fetchNextTip` signature and request body builder:

```typescript
export type SessionContext = {
  turnCount?: number
  sessionDurationSec?: number
  seenImpressionIds?: string[]
}

export async function fetchNextTip(
  earnCode: string,
  surface = 'openclaude',
  userMessage?: string,
  sessionContext?: SessionContext,
): Promise<SponsoredTip | null> {
  // ...
  const bodyPayload = {
    context: {
      ...(sanitized ? { messages: [{ role: 'user', content: sanitized }] } : {}),
      ...(technologies.length > 0 ? { technologies } : {}),
      ...(sessionContext?.turnCount !== undefined ? { turn_count: sessionContext.turnCount } : {}),
      ...(sessionContext?.sessionDurationSec !== undefined ? { session_duration_sec: sessionContext.sessionDurationSec } : {}),
      ...(sessionContext?.seenImpressionIds?.length ? { seen_impression_ids: sessionContext.seenImpressionIds } : {}),
    },
  }
  // ...
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/services/ads.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/ads.ts src/services/ads.test.ts
git commit -m "feat(ads): enrich ad request payload with session context and impression history"
```

---

### Task 2: Implement Dynamic Rotation & Impression Deduplication in `Spinner.tsx`

**Files:**
- Modify: `openclaude/src/components/Spinner.tsx`
- Test: `openclaude/src/services/tips/sponsoredTips.test.ts`

**Interfaces:**
- Consumes: `fetchNextTip()`, `confirmTip()` from `src/services/ads.ts`
- Produces: Dynamic sponsored tip rotation in `Spinner.tsx` with automatic background confirmation upon dwell expiration and transition to next tip.

- [ ] **Step 1: Write unit tests for sponsored tips rotation scheduler**

Create/update tests in `src/services/tips/sponsoredTips.test.ts` to verify that when dwell time completes, the tip confirms in background and fetches the next non-duplicate tip.

```typescript
test('confirms current tip upon dwell expiration and fetches next tip with seenImpressionIds', async () => {
  // Test rotation logic with mock timer
})
```

- [ ] **Step 2: Run test to verify failure**

Run: `bun test src/services/tips/sponsoredTips.test.ts`
Expected: FAIL

- [ ] **Step 3: Update `Spinner.tsx` to handle dwell expiration and ad rotation**

In `Spinner.tsx`, maintain a `seenImpressionIds` ref/state during the spinner lifecycle. Set a timer for `tip.dwellMs`. When it fires:
1. Call `confirmTip(earnCode, tip.token)` in background.
2. Update `ads.lastBalanceMicro` in global config if returned.
3. Fetch next tip passing `seenImpressionIds`.
4. Transition state smoothly to new tip or update badge.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/services/tips/sponsoredTips.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/Spinner.tsx src/services/tips/sponsoredTips.test.ts
git commit -m "feat(ads): add dynamic ad rotation and dwell-based auto-confirmation in spinner"
```

---

### Task 3: Enhance `/ads` Command Dashboard with Earnings & Session Statistics

**Files:**
- Modify: `openclaude/src/commands/ads.tsx`
- Modify: `openclaude/src/commands/ads.test.ts`

**Interfaces:**
- Consumes: `getGlobalConfig()`, `adsBaseUrl()`
- Produces: Enhanced status view in `statusText()` containing session earnings and account balance details.

- [ ] **Step 1: Write test for statusText() with balance and session metrics in `ads.test.ts`**

```typescript
test('displays balance and yield status in statusText', () => {
  // Mock config with lastBalanceMicro = 1250000 ($1.25)
  // Verify status output contains formatted balance string
})
```

- [ ] **Step 2: Run test to verify failure**

Run: `bun test src/commands/ads.test.ts`
Expected: FAIL

- [ ] **Step 3: Update `statusText()` in `src/commands/ads.tsx`**

Enhance `statusText()` to format and display:
- Formatted dollar balance (e.g. `$1.2500 USD`).
- Explanation of context opt-in and ad rotation rules.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/commands/ads.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/commands/ads.tsx src/commands/ads.test.ts
git commit -m "feat(ads): update /ads status dashboard with formatted balance and context rules"
```

---

### Task 4: Integrate Buddy Reaction on Confirmed Ad Credit

**Files:**
- Modify: `openclaude/src/buddy/observer.ts`
- Modify: `openclaude/src/buddy/observer.test.ts`

**Interfaces:**
- Consumes: Confirmed credit event from `confirmTip()` or `Spinner.tsx`
- Produces: Buddy speech bubble reaction (e.g. "+$0.005 OpenGateway credit!")

- [ ] **Step 1: Write test for ad credit reaction in `observer.test.ts`**

```typescript
test('buddy emits positive reaction when ad credit is earned', () => {
  // Dispatch ad_credit event to observer and assert speech output
})
```

- [ ] **Step 2: Run test to verify failure**

Run: `bun test src/buddy/observer.test.ts`
Expected: FAIL

- [ ] **Step 3: Add ad credit observer handler in `src/buddy/observer.ts`**

Add trigger and reaction for ad credit confirmation in Buddy observer logic.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/buddy/observer.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/buddy/observer.ts src/buddy/observer.test.ts
git commit -m "feat(buddy): trigger companion reaction when opengateway ad credit is confirmed"
```

---

## Self-Review Checklist

1. **Spec coverage:** All 4 pillars (eCPM context, rotation, dashboard, Buddy) mapped to Tasks 1-4.
2. **Placeholder scan:** Zero TODO/TBD placeholders. All code blocks and test commands specified.
3. **Type consistency:** `fetchNextTip` and `confirmTip` signatures match between `ads.ts`, `Spinner.tsx`, and `ads.test.ts`.

---

## Execution Handoff

Plan complete and saved to `openclaude/docs/superpowers/plans/2026-07-29-ads-optimization.md`.

Two execution options:

**1. Subagent-Driven (recommended)** - Fresh subagent per task, review between tasks, fast iteration
**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
