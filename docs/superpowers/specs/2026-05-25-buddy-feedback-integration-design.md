# Buddy + Feedback Integration Design

**Date:** 2026-05-25
**Status:** Approved
**Architecture:** Approach A — Direct integration in observer

---

## Overview

Integrate the Feedback Learning System with the Buddy companion so the buddy becomes aware of feedback events, reacts emotionally to corrections, offers contextual feedback tips, and rewards the user for consolidating learned rules.

## Goals

1. Buddy reacts emotionally when feedback is detected (corrections, undos)
2. Buddy offers contextual feedback tips via a new skill (`getFeedbackTip`)
3. Buddy mood reflects feedback health (score-based)
4. `/feedback confirm` grants +2 XP to buddy
5. Tiered feedback achievements (Aprendiz, Mestre, Sabio)
6. New stats in `/buddy stats` for feedback rules and confirms

## Data Flow

```
User types correction
       |
       v
feedbackHook.ts
  detectAndLogFeedback()
       |
       +-> logFeedbackEvent()     (existing)
       |
       v
  returns: { detected, type, file, message }
       |
       v
fireCompanionObserver(messages, onReaction, feedbackResult)
       |                                    ^
       |                            NEW optional param
       |
       +-> Emotional reaction (correction/undo)
       +-> getFeedbackTip()  (contextual skill)
       +-> XP on confirm (+2)
       +-> Mood update
       +-> Achievement check
```

The key integration point: `fireCompanionObserver` receives an optional `feedbackResult` parameter with the detection output from the hook. Callers that don't use feedback are unaffected.

---

## Component Changes

### 1. Reactions (observer.ts)

**Correction detected:**
- Buddy says one of: "Hmm, vou anotar isso para nao errar de novo...", "Entendi! Deixa eu registrar essa regra.", "Opa, correcao recebida. Aprendendo!", "Puxa, desculpe! Vou memorizar isso."

**Undo detected:**
- Buddy says one of: "Ops, desfiz algo errado? Vou anotar.", "Revertido! Vou lembrar da proxima vez."

**`/feedback confirm` (+2 XP):**
- Buddy says: "Regra consolidada! +2 XP" or "Aprendizado confirmado! Estou mais inteligente agora."

### 2. Contextual Skill — getFeedbackTip() (skills.ts)

Similar to `getErrorTip()` and `getCodeReviewTip()`. Reads active feedback rules (score >= 20) and after errors or corrections, suggests a relevant rule.

- Loads feedback rules from memory (scanMemoryFiles with type=feedback)
- Filters by score >= 20 (not obsolete)
- Matches by keywords from context (file, error, correction)
- 60% chance to appear (85% premium)

**Trigger points:**
- After tool error: suggest rule related to error context
- After correction detected: check if existing rule already covers this

### 3. Mood (mood.ts)

New feedback-aware moods added to the priority chain:

| Condition | Mood | Emoji | Text |
|---|---|---|---|
| avg score >= 80 | orgulhoso | brain | "Voce tem {n} regras consolidadas! Aprendendo rapido." |
| avg score < 40 and rules > 0 | preocupado | thinking | "Tenho {n} regras esquecidas... quer revisar?" |
| 0 rules | neutro | memo | "Ainda nao aprendi regras. Me corrija quando eu errar!" |

Priority: premium > feedback moods > error rate > task milestones > streak > default happy

### 4. XP (observer.ts + feedback.ts)

- `/feedback confirm` -> +2 XP to buddy via `grantXp`
- Feedback detection alone -> no XP (being corrected is not an achievement)
- XP granted in the feedback confirm command handler, not in the observer

### 5. Stats (config + buddy.tsx)

New fields in `companionStats`:

```typescript
companionStats: {
  totalBashes: number
  totalTasks: number
  totalErrors: number
  totalPets: number
  daysActive: number
  totalFeedbackRules: number    // NEW
  totalFeedbackConfirms: number // NEW
}
```

Displayed in `/buddy stats`:
```
Regras de feedback: 7
Confirmacoes: 4
```

Increment `totalFeedbackConfirms` on `/feedback confirm`. The confirm handler calls a new `notifyFeedbackConfirm()` helper in observer.ts that grants +2 XP, increments the stat, and checks achievements.

Increment `totalFeedbackRules` when synthesizer creates a new rule file. The synthesizer calls a new `notifyFeedbackRuleCreated()` helper in observer.ts that increments the stat.

### 6. Achievements (achievements.ts)

Tiered feedback achievements:

| Tier | Name | Requirement | Emoji |
|---|---|---|---|
| 1 | Aprendiz | 5 confirmed rules | books |
| 2 | Mestre | 15 confirmed rules | graduation |
| 3 | Sabio | 30 confirmed rules | wizard |

Check unlocked tier based on `totalFeedbackConfirms` in stats.

---

## Files to Modify

| File | Change |
|---|---|
| `src/hooks/feedbackHook.ts` | Export `FeedbackDetectionResult` type |
| `src/buddy/observer.ts` | Accept `feedbackResult`, react, XP, stats |
| `src/buddy/mood.ts` | Add feedback moods |
| `src/buddy/skills.ts` | New `getFeedbackTip()` |
| `src/buddy/achievements.ts` | Add tiered feedback achievements |
| `src/commands/buddy/buddy.tsx` | New stats in `/buddy stats` |
| `src/commands/feedback/feedback.ts` | Call observer on confirm (+2 XP) |

**New files:** None (Approach A).

---

## Implementation Order

1. Export `FeedbackDetectionResult` type from feedbackHook.ts
2. Add `getFeedbackTip()` to skills.ts
3. Add feedback moods to mood.ts
4. Add feedback achievements to achievements.ts
5. Modify observer.ts to accept and react to feedback
6. Update buddy.tsx stats display
7. Wire `/feedback confirm` to grant XP and increment stats

## Testing

- Unit test: `getFeedbackTip()` returns relevant rule for given context
- Unit test: feedback mood priority chain correct
- Unit test: achievements unlock at correct thresholds
- Integration: feedback detect -> observer reaction -> XP granted
- Integration: `/feedback confirm` -> buddy XP +2, stats incremented

---

## Non-Goals

- No new files or modules (all changes in existing files)
- No event bus or pub/sub system
- No persistent background process
- No changes to feedback scoring system itself
- No changes to synthesizer logic
