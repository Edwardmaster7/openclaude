# Buddy + Feedback Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate the Feedback Learning System with the Buddy companion so the buddy reacts to feedback events, offers contextual tips, rewards confirmations with XP, and tracks feedback achievements.

**Architecture:** Direct integration in `observer.ts` via a new optional `feedbackResult` parameter. New `getFeedbackTip()` skill in `skills.ts`. New feedback-aware moods in `mood.ts`. Tiered achievements in `achievements.ts`. Stats extended in config type.

**Tech Stack:** TypeScript, bun:test, existing buddy/feedback modules

---

## File Structure

| File | Responsibility |
|---|---|
| `src/utils/config.ts` | Add `totalFeedbackRules` and `totalFeedbackConfirms` to `companionStats` type |
| `src/buddy/skills.ts` | New `getFeedbackTip()` function — contextual feedback rule suggestions |
| `src/buddy/mood.ts` | New feedback-aware moods (orgulhoso, preocupado, neutro) |
| `src/buddy/achievements.ts` | Three new tiered achievements (Aprendiz, Mestre, Sabio) |
| `src/buddy/observer.ts` | Accept `feedbackResult`, react emotionally, call skills, update stats |
| `src/commands/buddy/buddy.tsx` | Display new feedback stats in `/buddy stats` |
| `src/commands/feedback/feedback.ts` | On confirm: grant +2 XP, increment stats, notify observer |

---

### Task 1: Extend companionStats Type

**Files:**
- Modify: `src/utils/config.ts:312-317`

- [ ] **Step 1: Add new fields to companionStats type**

In `src/utils/config.ts`, find the `companionStats` type definition (around line 312) and add the two new fields:

```typescript
companionStats?: {
  totalBashes: number
  totalTasks: number
  totalErrors: number
  totalPets: number
  daysActive: number
  totalFeedbackRules: number    // NEW
  totalFeedbackConfirms: number // NEW
}
```

- [ ] **Step 2: Verify type compiles**

Run: `cd openclaude && bun run tsc --noEmit 2>&1 | head -20`
Expected: No errors related to companionStats

- [ ] **Step 3: Commit**

```bash
git add src/utils/config.ts
git commit -m "feat(buddy): add feedback fields to companionStats type"
```

---

### Task 2: Add getFeedbackTip() to skills.ts

**Files:**
- Modify: `src/buddy/skills.ts`
- Test: `src/buddy/skills.test.ts` (create if doesn't exist)

- [ ] **Step 1: Write the failing test**

Create or append to `src/buddy/skills.test.ts`:

```typescript
import { describe, it, expect, mock, beforeEach } from 'bun:test'

describe('getFeedbackTip', () => {
  beforeEach(() => {
    mock.restore()
  })

  it('returns null when no feedback rules exist', async () => {
    // Mock scanMemoryFiles to return empty
    mock.module('../memdir/memoryScan.js', () => ({
      scanMemoryFiles: async () => [],
    }))

    const { getFeedbackTip } = await import('./skills.js')
    const result = getFeedbackTip(false, 'some context')
    expect(result).toBeNull()
  })

  it('returns a tip when feedback rules exist and random allows', async () => {
    mock.module('../memdir/memoryScan.js', () => ({
      scanMemoryFiles: async () => [
        {
          filename: 'feedback-testing-patterns.md',
          filePath: '/test/feedback-testing-patterns.md',
          mtimeMs: Date.now(),
          description: 'Padroes de framework de teste',
          type: 'feedback',
          score: 80,
          confirmations: 3,
        },
      ],
    }))

    // Force random to always return 0 (guarantees tip appears)
    const originalRandom = Math.random
    Math.random = () => 0

    const { getFeedbackTip } = await import('./skills.js')
    const result = getFeedbackTip(false, 'jest test failed')
    expect(result).not.toBeNull()
    expect(typeof result).toBe('string')

    Math.random = originalRandom
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd openclaude && bun test src/buddy/skills.test.ts 2>&1 | tail -10`
Expected: FAIL — `getFeedbackTip` does not exist

- [ ] **Step 3: Implement getFeedbackTip()**

Add to `src/buddy/skills.ts`, after the `getCodeReviewTip` function and before `getSessionSummary`. Add the necessary imports at the top of the file:

```typescript
import { scanMemoryFiles } from '../memdir/memoryScan.js'
import { getAutoMemPath } from '../memdir/paths.js'
```

Then add the function:

```typescript
// ─── Feedback Tips (60% chance, 85% premium) ─────────────────────────────

export async function getFeedbackTip(
  premiumActive: boolean,
  context?: string,
  signal?: AbortSignal,
): Promise<string | null> {
  const chance = premiumActive ? 0.85 : 0.60
  if (Math.random() > chance) return null

  try {
    const memories = await scanMemoryFiles(getAutoMemPath(), signal ?? AbortSignal.timeout(2000))
    const feedbackRules = memories.filter(
      m => m.type === 'feedback' && !m.ignored && (m.score ?? 0) >= 20,
    )

    if (feedbackRules.length === 0) return null

    // If we have context, try to match by keywords
    if (context) {
      const contextLower = context.toLowerCase()
      const matched = feedbackRules.find(m => {
        const desc = (m.description ?? '').toLowerCase()
        const name = m.filename.toLowerCase()
        const words = contextLower.split(/\s+/).filter(w => w.length > 3)
        return words.some(w => desc.includes(w) || name.includes(w))
      })

      if (matched) {
        return `💡 Regra aprendida: ${matched.description ?? matched.filename}`
      }
    }

    // Fallback: pick a random feedback rule
    const picked = feedbackRules[Math.floor(Date.now() / 1000) % feedbackRules.length]!
    return `💡 Regra aprendida: ${picked.description ?? picked.filename}`
  } catch {
    return null
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd openclaude && bun test src/buddy/skills.test.ts 2>&1 | tail -10`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/buddy/skills.ts src/buddy/skills.test.ts
git commit -m "feat(buddy): add getFeedbackTip() contextual skill"
```

---

### Task 3: Add Feedback Moods to mood.ts

**Files:**
- Modify: `src/buddy/mood.ts`

- [ ] **Step 1: Write the failing test**

Create or append to `src/buddy/mood.test.ts`:

```typescript
import { describe, it, expect, mock } from 'bun:test'

describe('feedback moods', () => {
  it('returns orgulhoso when avg feedback score >= 80', async () => {
    mock.module('../utils/config.js', () => ({
      getGlobalConfig: () => ({
        companionStats: {
          totalBashes: 10,
          totalTasks: 5,
          totalErrors: 1,
          totalPets: 3,
          daysActive: 5,
          totalFeedbackRules: 8,
          totalFeedbackConfirms: 5,
        },
        companionLastPetDate: new Date().toISOString().split('T')[0],
        companionStreakCount: 3,
        companionMemory: [],
      }),
    }))

    // Need to mock scanMemoryFiles for feedback score calculation
    mock.module('../memdir/memoryScan.js', () => ({
      scanMemoryFiles: async () => [
        { type: 'feedback', score: 90, ignored: false },
        { type: 'feedback', score: 85, ignored: false },
      ],
    }))

    const { getMood } = await import('./mood.js')
    const mood = getMood()
    expect(mood.mood).toBe('orgulhoso')
    expect(mood.emoji).toBe('🧠')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd openclaude && bun test src/buddy/mood.test.ts 2>&1 | tail -10`
Expected: FAIL — mood is not 'orgulhoso'

- [ ] **Step 3: Add feedback moods to getMood()**

In `src/buddy/mood.ts`, add a new helper function and integrate it into the mood priority chain. Add after the imports:

```typescript
import { scanMemoryFiles } from '../memdir/memoryScan.js'
import { getAutoMemPath } from '../memdir/paths.js'
```

Add a new function before `getMood`:

```typescript
async function getFeedbackMood(): Promise<BuddyMood | null> {
  try {
    const memories = await scanMemoryFiles(getAutoMemPath(), AbortSignal.timeout(1000))
    const feedbackRules = memories.filter(m => m.type === 'feedback' && !m.ignored)

    if (feedbackRules.length === 0) {
      return { emoji: '📝', text: 'Ainda nao aprendi regras. Me corrija quando eu errar!', mood: 'neutro' }
    }

    const avgScore = feedbackRules.reduce((sum, m) => sum + (m.score ?? 50), 0) / feedbackRules.length

    if (avgScore >= 80) {
      return {
        emoji: '🧠',
        text: `Voce tem ${feedbackRules.length} regras consolidadas! Aprendendo rapido.`,
        mood: 'orgulhoso',
      }
    }

    if (avgScore < 40) {
      return {
        emoji: '🤔',
        text: `Tenho ${feedbackRules.length} regras esquecidas... quer revisar?`,
        mood: 'preocupado',
      }
    }

    return null // No special feedback mood
  } catch {
    return null
  }
}
```

Then modify `getMood()` to integrate the feedback moods. The priority chain becomes:
1. Premium mode
2. Not pet today (sonolento)
3. **Feedback moods** (NEW — after sonolento, before error rate)
4. Error rate > 0.4 (preocupado)
5. Task milestones (empolgado)
6. Streak >= 7 (orgulhoso)
7. Default happy

Insert after the sonolento check and before the `if (!stats)` check:

```typescript
  // Feedback moods (async, best-effort)
  try {
    const feedbackMood = await getFeedbackMood()
    if (feedbackMood) return feedbackMood
  } catch {
    // Ignore feedback mood errors
  }
```

Note: `getMood()` needs to become `async` for this. Update its signature and all callers.

- [ ] **Step 4: Update getMood signature to async**

Change:
```typescript
export function getMood(): BuddyMood {
```
To:
```typescript
export async function getMood(): Promise<BuddyMood> {
```

Then find all callers of `getMood()` and add `await`:
- `src/buddy/observer.ts` — wherever `getMood()` is called
- `src/commands/buddy/buddy.tsx` — wherever `getMood()` is called

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd openclaude && bun test src/buddy/mood.test.ts 2>&1 | tail -10`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/buddy/mood.ts src/buddy/mood.test.ts src/buddy/observer.ts src/commands/buddy/buddy.tsx
git commit -m "feat(buddy): add feedback-aware moods (orgulhoso, preocupado, neutro)"
```

---

### Task 4: Add Tiered Feedback Achievements

**Files:**
- Modify: `src/buddy/achievements.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/buddy/achievements.test.ts` (create if doesn't exist):

```typescript
import { describe, it, expect, mock } from 'bun:test'

describe('feedback achievements', () => {
  it('unlocks aprendiz at 5 confirms', async () => {
    mock.module('../utils/config.js', () => ({
      getGlobalConfig: () => ({
        companionStats: {
          totalBashes: 10,
          totalTasks: 5,
          totalErrors: 1,
          totalPets: 3,
          daysActive: 5,
          totalFeedbackRules: 5,
          totalFeedbackConfirms: 5,
        },
        companion: { xp: 50 },
        companionMemory: [],
        companionOutfits: [],
        companionStreakCount: 0,
      }),
    }))

    const { getUnlockedAchievements } = await import('./achievements.js')
    const unlocked = getUnlockedAchievements()
    expect(unlocked.some(a => a.id === 'feedback-aprendiz')).toBe(true)
  })

  it('unlocks mestre at 15 confirms', async () => {
    mock.module('../utils/config.js', () => ({
      getGlobalConfig: () => ({
        companionStats: {
          totalBashes: 10,
          totalTasks: 5,
          totalErrors: 1,
          totalPets: 3,
          daysActive: 5,
          totalFeedbackRules: 15,
          totalFeedbackConfirms: 15,
        },
        companion: { xp: 50 },
        companionMemory: [],
        companionOutfits: [],
        companionStreakCount: 0,
      }),
    }))

    const { getUnlockedAchievements } = await import('./achievements.js')
    const unlocked = getUnlockedAchievements()
    expect(unlocked.some(a => a.id === 'feedback-mestre')).toBe(true)
  })

  it('unlocks sabio at 30 confirms', async () => {
    mock.module('../utils/config.js', () => ({
      getGlobalConfig: () => ({
        companionStats: {
          totalBashes: 10,
          totalTasks: 5,
          totalErrors: 1,
          totalPets: 3,
          daysActive: 5,
          totalFeedbackRules: 30,
          totalFeedbackConfirms: 30,
        },
        companion: { xp: 50 },
        companionMemory: [],
        companionOutfits: [],
        companionStreakCount: 0,
      }),
    }))

    const { getUnlockedAchievements } = await import('./achievements.js')
    const unlocked = getUnlockedAchievements()
    expect(unlocked.some(a => a.id === 'feedback-sabio')).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd openclaude && bun test src/buddy/achievements.test.ts 2>&1 | tail -10`
Expected: FAIL — feedback-aprendiz not found

- [ ] **Step 3: Add tiered feedback achievements**

Add to the `ACHIEVEMENTS` array in `src/buddy/achievements.ts`, before the closing `]`:

```typescript
  {
    id: 'feedback-aprendiz',
    name: 'Aprendiz',
    description: 'Confirme 5 regras de feedback',
    emoji: '📚',
    check: () => (getGlobalConfig().companionStats?.totalFeedbackConfirms ?? 0) >= 5,
  },
  {
    id: 'feedback-mestre',
    name: 'Mestre',
    description: 'Confirme 15 regras de feedback',
    emoji: '🎓',
    check: () => (getGlobalConfig().companionStats?.totalFeedbackConfirms ?? 0) >= 15,
  },
  {
    id: 'feedback-sabio',
    name: 'Sabio',
    description: 'Confirme 30 regras de feedback',
    emoji: '🧙',
    check: () => (getGlobalConfig().companionStats?.totalFeedbackConfirms ?? 0) >= 30,
  },
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd openclaude && bun test src/buddy/achievements.test.ts 2>&1 | tail -10`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/buddy/achievements.ts src/buddy/achievements.test.ts
git commit -m "feat(buddy): add tiered feedback achievements (aprendiz, mestre, sabio)"
```

---

### Task 5: Modify observer.ts to React to Feedback

**Files:**
- Modify: `src/buddy/observer.ts`

- [ ] **Step 1: Import FeedbackDetectionResult type**

Add at the top of `src/buddy/observer.ts`, in the imports section:

```typescript
import type { FeedbackDetectionResult } from '../hooks/feedbackHook.js'
```

Note: This type is defined and exported in Task 6 from `feedbackHook.ts`. The observer imports it — no duplicate definition.

- [ ] **Step 2: Add feedback reaction messages**

Add new reaction arrays after the existing ones (TASK_COMPLETED_REPLIES):

```typescript
const FEEDBACK_CORRECTION_REPLIES = [
  'Hmm, vou anotar isso para nao errar de novo...',
  'Entendi! Deixa eu registrar essa regra.',
  'Opa, correcao recebida. Aprendendo!',
  'Puxa, desculpe! Vou memorizar isso.',
] as const

const FEEDBACK_UNDO_REPLIES = [
  'Ops, desfiz algo errado? Vou anotar.',
  'Revertido! Vou lembrar da proxima vez.',
] as const

const FEEDBACK_CONFIRM_REPLIES = [
  'Regra consolidada! +2 XP',
  'Aprendizado confirmado! Estou mais inteligente agora.',
  'Memoria fortalecida! Obrigado por confirmar.',
] as const
```

- [ ] **Step 3: Update fireCompanionObserver signature**

Change the function signature to accept an optional feedbackResult parameter:

```typescript
export async function fireCompanionObserver(
  messages: Message[],
  onReaction: (reaction: string) => void,
  feedbackResult?: FeedbackDetectionResult,
): Promise<void> {
```

- [ ] **Step 4: Add feedback reaction logic**

Inside `fireCompanionObserver`, after the existing success/error reaction logic and before the bash tracking section, add:

```typescript
  // ─── Feedback Reactions ───────────────────────────────────────────────
  if (feedbackResult?.detected) {
    const replies = feedbackResult.type === 'undo' ? FEEDBACK_UNDO_REPLIES : FEEDBACK_CORRECTION_REPLIES
    const reply = pickDeterministic(
      replies,
      Date.now(),
      `feedback-${feedbackResult.type}`,
    )
    onReaction(`${buddyName} ${reply}`)

    // Save feedback reaction memory
    const companion = getCompanion(config)
    if (companion) {
      addMemory(companion, {
        ts: Date.now(),
        trigger: 'feedbackDetected',
        text: `Feedback ${feedbackResult.type} detectado: ${feedbackResult.message}`,
      })
      saveGlobalConfig(config)
    }
  }
```

- [ ] **Step 5: Add notifyFeedbackConfirm function**

Add a new exported function at the end of `observer.ts`:

```typescript
export function notifyFeedbackConfirm(buddyName: string): string {
  const config = getGlobalConfig()
  const companion = getCompanion(config)
  if (!companion) return ''

  // Grant +2 XP
  companion.xp = (companion.xp ?? 0) + 2

  // Increment stats
  if (!config.companionStats) {
    config.companionStats = { totalBashes: 0, totalTasks: 0, totalErrors: 0, totalPets: 0, daysActive: 0, totalFeedbackRules: 0, totalFeedbackConfirms: 0 }
  }
  config.companionStats.totalFeedbackConfirms = (config.companionStats.totalFeedbackConfirms ?? 0) + 1

  // Save
  saveGlobalConfig(config)

  // Pick a reply
  const reply = pickDeterministic(
    FEEDBACK_CONFIRM_REPLIES,
    Date.now(),
    'feedback-confirm',
  )
  return `${buddyName} ${reply}`
}
```

- [ ] **Step 6: Add notifyFeedbackRuleCreated function**

Add another exported function:

```typescript
export function notifyFeedbackRuleCreated(): void {
  const config = getGlobalConfig()
  if (!config.companionStats) {
    config.companionStats = { totalBashes: 0, totalTasks: 0, totalErrors: 0, totalPets: 0, daysActive: 0, totalFeedbackRules: 0, totalFeedbackConfirms: 0 }
  }
  config.companionStats.totalFeedbackRules = (config.companionStats.totalFeedbackRules ?? 0) + 1
  saveGlobalConfig(config)
}
```

- [ ] **Step 7: Update all callers of fireCompanionObserver**

Search for all places that call `fireCompanionObserver` and ensure they pass `undefined` as the third argument (or the feedbackResult if available). The existing callers should not break since the parameter is optional.

Run: `cd openclaude && grep -rn "fireCompanionObserver" src/ --include="*.ts" --include="*.tsx"`
Expected: Find all callers, verify they compile

- [ ] **Step 8: Verify compilation**

Run: `cd openclaude && bun run tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 9: Commit**

```bash
git add src/buddy/observer.ts
git commit -m "feat(buddy): add feedback reactions, XP on confirm, rule created notify"
```

---

### Task 6: Wire Feedback Hook to Observer

**Files:**
- Modify: `src/hooks/feedbackHook.ts`

- [ ] **Step 1: Export FeedbackDetectionResult from feedbackHook**

In `src/hooks/feedbackHook.ts`, the `detectAndLogFeedback` function already returns a result with `detected`, `message`, `file`, and `originalText`. We need to also return the `type` field and export a type for it.

Add at the top of the file:

```typescript
export type FeedbackDetectionResult = {
  detected: boolean
  type: 'correction' | 'undo'
  file?: string
  message: string
}
```

Update the return type of `detectAndLogFeedback` to include `type`:

In the undo detection block (around line 70), add `type: 'undo'` to the return:
```typescript
return {
  detected: true,
  type: 'undo' as const,
  message: `Ação de desfazer detectada...`,
  file: editedFiles[0],
}
```

In the correction detection block (around line 90), add `type: 'correction'` to the return:
```typescript
return {
  detected: true,
  type: 'correction' as const,
  message: `Padrão de correção detectado...`,
  file: editedFiles[0],
  originalText: userText,
}
```

- [ ] **Step 2: Verify compilation**

Run: `cd openclaude && bun run tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/hooks/feedbackHook.ts
git commit -m "feat(feedback): export FeedbackDetectionResult type with type field"
```

---

### Task 7: Wire /feedback confirm to Buddy XP

**Files:**
- Modify: `src/commands/feedback/feedback.ts`

- [ ] **Step 1: Import notifyFeedbackConfirm**

Add at the top of `src/commands/feedback/feedback.ts`:

```typescript
import { notifyFeedbackConfirm } from '../../buddy/observer.js'
import { getCompanion } from '../../buddy/companion.js'
```

- [ ] **Step 2: Call notifyFeedbackConfirm on confirm**

In the `case 'confirm':` block, after the successful confirmation (after `fs.appendFileSync`), add:

```typescript
      // Notify buddy and grant XP
      const companion = getCompanion(getGlobalConfig())
      const buddyName = companion?.name ?? 'Buddy'
      const buddyReaction = notifyFeedbackConfirm(buddyName)

      return {
        type: 'text',
        value: chalk.green('[Feedback System] Padrao de feedback confirmado e salvo com sucesso! O sintetizador dara prioridade extra a esta regra na proxima consolidacao.') +
          (buddyReaction ? `\n\n${buddyReaction}` : ''),
      }
```

Replace the existing return statement in the confirm case.

- [ ] **Step 3: Verify compilation**

Run: `cd openclaude && bun run tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/commands/feedback/feedback.ts
git commit -m "feat(feedback): wire confirm to buddy XP via notifyFeedbackConfirm"
```

---

### Task 8: Display Feedback Stats in /buddy stats

**Files:**
- Modify: `src/commands/buddy/buddy.tsx`

- [ ] **Step 1: Find the stats display section**

In `src/commands/buddy/buddy.tsx`, find the section that displays stats (look for `totalBashes`, `totalTasks`, etc. in the stats rendering).

- [ ] **Step 2: Add feedback stats**

After the existing stats lines, add:

```typescript
      // Feedback stats
      const feedbackRules = stats.totalFeedbackRules ?? 0
      const feedbackConfirms = stats.totalFeedbackConfirms ?? 0
      if (feedbackRules > 0 || feedbackConfirms > 0) {
        lines.push(`  Regras de feedback: ${feedbackRules}`)
        lines.push(`  Confirmacoes: ${feedbackConfirms}`)
      }
```

- [ ] **Step 3: Verify compilation**

Run: `cd openclaude && bun run tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/commands/buddy/buddy.tsx
git commit -m "feat(buddy): display feedback stats in /buddy stats"
```

---

### Task 9: Integration Test — Full Flow

**Files:**
- Test: `src/buddy/feedback-integration.test.ts` (create)

- [ ] **Step 1: Write integration test**

```typescript
import { describe, it, expect, mock } from 'bun:test'

describe('buddy-feedback integration', () => {
  it('feedback detection triggers observer reaction', async () => {
    const reactions: string[] = []
    const mockOnReaction = (r: string) => reactions.push(r)

    mock.module('../utils/config.js', () => ({
      getGlobalConfig: () => ({
        companion: { name: 'Pixelbud', xp: 10 },
        companionStats: { totalBashes: 5, totalTasks: 2, totalErrors: 0, totalPets: 1, daysActive: 1, totalFeedbackRules: 0, totalFeedbackConfirms: 0 },
        companionLastPetDate: new Date().toISOString().split('T')[0],
        companionStreakCount: 1,
        companionMemory: [],
      }),
      saveGlobalConfig: () => {},
    }))

    const { fireCompanionObserver } = await import('./observer.js')

    const messages = [
      { type: 'user', content: [{ type: 'text', text: 'nao use jest, use vitest' }] },
    ] as any[]

    await fireCompanionObserver(messages, mockOnReaction, {
      detected: true,
      type: 'correction',
      message: 'correction detected',
    })

    expect(reactions.length).toBeGreaterThan(0)
    expect(reactions.some(r => r.includes('Pixelbud'))).toBe(true)
  })

  it('notifyFeedbackConfirm grants XP and increments stats', async () => {
    let savedConfig: any = null

    mock.module('../utils/config.js', () => ({
      getGlobalConfig: () => ({
        companion: { name: 'Pixelbud', xp: 10 },
        companionStats: { totalBashes: 5, totalTasks: 2, totalErrors: 0, totalPets: 1, daysActive: 1, totalFeedbackRules: 0, totalFeedbackConfirms: 0 },
      }),
      saveGlobalConfig: (c: any) => { savedConfig = c },
    }))

    const { notifyFeedbackConfirm } = await import('./observer.js')
    const result = notifyFeedbackConfirm('Pixelbud')

    expect(result).toContain('Pixelbud')
    expect(savedConfig.companion.xp).toBe(12) // +2 XP
    expect(savedConfig.companionStats.totalFeedbackConfirms).toBe(1)
  })
})
```

- [ ] **Step 2: Run integration test**

Run: `cd openclaude && bun test src/buddy/feedback-integration.test.ts 2>&1 | tail -10`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/buddy/feedback-integration.test.ts
git commit -m "test(buddy): add integration tests for buddy-feedback flow"
```

---

### Task 10: Wire Feedback Detection to Observer in Main Loop

**Files:**
- The main message handling loop (find with: `grep -rn "detectAndLogFeedback\|fireCompanionObserver" src/ --include="*.ts" --include="*.tsx" | grep -v test | grep -v ".d.ts"`)

- [ ] **Step 1: Find the main loop integration point**

Run: `cd openclaude && grep -rn "detectAndLogFeedback\|fireCompanionObserver" src/ --include="*.ts" --include="*.tsx" | grep -v test | grep -v ".d.ts"`
Expected: Find the file(s) where both functions are called. This is likely in the REPL or message handling entry point.

- [ ] **Step 2: Import FeedbackDetectionResult**

In the file found above, ensure `FeedbackDetectionResult` is imported from `feedbackHook.ts` if needed:

```typescript
import { detectAndLogFeedback, type FeedbackDetectionResult } from '../hooks/feedbackHook.js'
```

- [ ] **Step 3: Capture feedbackResult and pass to observer**

Find where `detectAndLogFeedback` is called and where `fireCompanionObserver` is called. Connect them:

```typescript
// Before:
const feedbackResult = await detectAndLogFeedback(input, messages, sessionId)
// ... later ...
await fireCompanionObserver(messages, onReaction)

// After:
const feedbackResult = await detectAndLogFeedback(input, messages, sessionId)
// ... later ...
await fireCompanionObserver(messages, onReaction, feedbackResult ?? undefined)
```

The `feedbackResult` from `detectAndLogFeedback` already has `detected`, `message`, and `file` fields. Map `type` as `'correction'` or `'undo'` based on the existing return value (the function returns different objects for undo vs correction detection).

- [ ] **Step 4: Verify full compilation**

Run: `cd openclaude && bun run tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 5: Run all buddy tests**

Run: `cd openclaude && bun test src/buddy/ 2>&1 | tail -20`
Expected: All PASS

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(buddy): wire feedback detection to observer in main loop"
```

---

## Verification Checklist

After all tasks are complete, verify:

- [ ] `bun run tsc --noEmit` — no type errors
- [ ] `bun test src/buddy/` — all buddy tests pass
- [ ] `bun test src/commands/feedback/` — feedback tests pass
- [ ] Manual test: start OpenClaude, trigger a correction, buddy reacts
- [ ] Manual test: `/feedback confirm` shows +2 XP message
- [ ] Manual test: `/buddy stats` shows feedback rules and confirms
- [ ] Manual test: `/buddy achievements` shows feedback tiers
