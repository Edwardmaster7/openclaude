# Buddy Customization and Reminders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement time-based productivity reminders and XP-spending customization commands (`rename` and `reroll`).

**Architecture:** Extend `StoredCompanion` with `rerollSeed`. Track state (last message time) inside the observer module for idle/break reminders. Parse subcommands in `buddy.tsx` and process XP deductions.

**Tech Stack:** TypeScript, React, Ink.

---

### Task 1: Type Definitions & Companion Core

**Files:**
- Modify: `src/buddy/types.ts`
- Modify: `src/buddy/companion.ts`

- [ ] **Step 1: Extend `StoredCompanion` type**
In `src/buddy/types.ts`, add `rerollSeed`:
```typescript
export type CompanionSoul = {
  name: string
  personality: string
  xp?: number
  hat?: string
  rerollSeed?: string
}
```

- [ ] **Step 2: Utilize rerollSeed in generator**
In `src/buddy/companion.ts`, update `getCompanion` to use the seed if present.
```typescript
export function getCompanion(): Companion | undefined {
  const stored = getGlobalConfig().companion
  if (!stored) return undefined
  
  const seedBase = stored.rerollSeed ? `${companionUserId()}:${stored.rerollSeed}` : companionUserId()
  const { bones } = roll(seedBase)
  
  // stored last so the unlocked hat overrides the bones hat
  return { ...bones, ...stored }
}
```

- [ ] **Step 3: Commit**
```bash
git add src/buddy/types.ts src/buddy/companion.ts
git commit -m "feat(buddy): support companion visual rerolling via seeds"
```

### Task 2: Productivity Reminders

**Files:**
- Modify: `src/buddy/observer.ts`

- [ ] **Step 1: Add vocabulary and state tracking variables**
At the top of `observer.ts`:
```typescript
const WATER_AND_BREAK_REPLIES = [
  'Lembrete: Beba água! 💧',
  'Você está focado há um bom tempo. Que tal esticar as pernas?',
  'Piscar os olhos e olhar para o horizonte faz bem!',
  'A postura tá em dia? Ajeita essa coluna aí! 🪑',
  'Se estiver travado no código, uma caminhada de 5 minutos ajuda muito.',
  'Café é bom, mas água é essencial. ☕ -> 🚰',
] as const;

const IDLE_REPLIES = [
  'Zzz... (Buddy está cochilando)',
  'Tirou uma merecida pausa?',
  'Estou aqui aguardando as ordens.',
  'Pausa pro café? Me traz um pouco de dados.',
] as const;

// Module state for tracking time (resets if the CLI restarts, which is acceptable)
let sessionStartTime = Date.now();
let lastUserMsgTime = Date.now();
let lastBreakReminder = 0;
let lastIdleReminder = 0;
```

- [ ] **Step 2: Add time check logic**
Inside `fireCompanionObserver`:
```typescript
  // Update idle tracking on user messages
  const lastUser = [...messages].reverse().find(msg => msg.type === 'user')
  if (lastUser) {
    lastUserMsgTime = Date.now();
    // ... existing user message parsing ...
  }
  
  const now = Date.now();
  
  // 1. Idle Check: > 15 mins since last user message
  if (now - lastUserMsgTime > 15 * 60 * 1000) {
    if (now - lastIdleReminder > 30 * 60 * 1000) { // Remind at most every 30m
      lastIdleReminder = now;
      onReaction(`${companion.name}: ${pickDeterministic(IDLE_REPLIES, now.toString())}`)
      return;
    }
  }
  
  // 2. Break Check: Every 1.5 hours
  if (now - sessionStartTime > 90 * 60 * 1000) {
    if (now - lastBreakReminder > 60 * 60 * 1000) { // Remind at most every 60m
      lastBreakReminder = now;
      // Also reset session start so it checks again in 1.5 hours
      sessionStartTime = now;
      onReaction(`${companion.name}: ${pickDeterministic(WATER_AND_BREAK_REPLIES, now.toString())}`)
      return;
    }
  }
```

- [ ] **Step 3: Commit**
```bash
git add src/buddy/observer.ts
git commit -m "feat(buddy): add time-based productivity and idle reminders"
```

### Task 3: Customization Commands (Pair Programming)

**Files:**
- Modify: `src/commands/buddy/buddy.tsx`

- [ ] **Step 1: Implement rename and reroll handlers**
We will implement logic to intercept `args[0] === 'rename'` and `args[0] === 'reroll'`, check XP balances, update `GlobalConfig` and deduct XP. (Will be done interactively).

- [ ] **Step 2: Commit**
```bash
git add src/commands/buddy/buddy.tsx
git commit -m "feat(buddy): add rename and reroll customization commands"
```
