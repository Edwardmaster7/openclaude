# Buddy XP and Progression Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement an XP system for the Buddy that grants XP when tasks complete, leveling up the companion and dynamically changing their hat.

**Architecture:** We will extend the existing `StoredCompanion` type in `src/buddy/types.ts`. Then, we update `src/buddy/observer.ts` to grant XP and write to the global configuration upon task completion. Finally, we'll implement level calculations and UI reflection in `getCompanion` and the CLI status command. 

**Tech Stack:** TypeScript, React, Ink.

---

### Task 1: Type Definitions

**Files:**
- Modify: `src/buddy/types.ts`

- [ ] **Step 1: Extend `StoredCompanion`**
Update `StoredCompanion` to include `xp` and `hat` fields.

```typescript
export type StoredCompanion = {
  name: string
  personality: string
  xp?: number
  hat?: string
}
```

- [ ] **Step 2: Commit**
```bash
git add src/buddy/types.ts
git commit -m "feat(buddy): add xp and hat fields to StoredCompanion"
```

### Task 2: Core Leveling Logic

**Files:**
- Create: `src/buddy/progression.ts`

- [ ] **Step 1: Write progression utilities**
Create functions to calculate level, get hat by level, and get status message.

```typescript
export const LEVEL_BRACKETS = [
  { level: 1, minXp: 0, hat: undefined, status: "Buddy is learning the workflow." },
  { level: 2, minXp: 3, hat: "leaf", status: "Buddy is enjoying the progress!" },
  { level: 3, minXp: 10, hat: "hardhat", status: "Buddy is hard at work!" },
  { level: 4, minXp: 20, hat: "chef", status: "Buddy is cooking up code!" },
  { level: 5, minXp: 35, hat: "wizard", status: "Buddy has mastered the arts!" },
  { level: 6, minXp: 50, hat: "crown", status: "Buddy is legendary!" }
] as const;

export function getLevelInfo(xp: number = 0) {
  let currentBracket = LEVEL_BRACKETS[0];
  for (const bracket of LEVEL_BRACKETS) {
    if (xp >= bracket.minXp) {
      currentBracket = bracket;
    } else {
      break;
    }
  }
  return currentBracket;
}
```

- [ ] **Step 2: Commit**
```bash
git add src/buddy/progression.ts
git commit -m "feat(buddy): implement progression calculation logic"
```

### Task 3: Grant XP in Observer

**Files:**
- Modify: `src/buddy/observer.ts`

- [ ] **Step 1: Update TaskUpdate check**
When `input.status === 'completed'`, give XP and check for level up.

```typescript
import { saveGlobalConfig, getGlobalConfig } from '../utils/config.js'
import { getLevelInfo } from './progression.js'
// ... inside fireCompanionObserver

        if (content.type === 'tool_use' && content.name === 'TaskUpdate') {
          const input = content.input
          if (typeof input === 'object' && input !== null && 'status' in input && input.status === 'completed') {
             
             // XP Logic
             const config = getGlobalConfig()
             const currentXp = config.companion?.xp ?? 0
             const newXp = currentXp + 1
             
             const oldInfo = getLevelInfo(currentXp)
             const newInfo = getLevelInfo(newXp)
             
             saveGlobalConfig(curr => {
               if (!curr.companion) return curr
               return {
                 ...curr,
                 companion: {
                   ...curr.companion,
                   xp: newXp,
                   hat: newInfo.hat ?? curr.companion.hat
                 }
               }
             })

             if (oldInfo.level !== newInfo.level) {
               onReaction(`${companion.name}: Uau! Subi para o Nível ${newInfo.level} e ganhei um chapéu novo!`)
             } else {
               onReaction(`${companion.name}: ${pickDeterministic(TASK_COMPLETED_REPLIES, Date.now().toString())}`)
             }
             return
          }
        }
```

- [ ] **Step 2: Commit**
```bash
git add src/buddy/observer.ts
git commit -m "feat(buddy): grant XP and level up hats on task completion"
```

### Task 4: UI Reflection

**Files:**
- Modify: `src/buddy/companion.ts`
- Modify: `src/commands/buddy/buddy.tsx`

- [ ] **Step 1: Reflect in Companion struct**
In `src/buddy/companion.ts`, update `getCompanion` to override hat.

```typescript
import { getGlobalConfig } from '../utils/config.js'
// ... inside getCompanion()
  const hatStr = config.companion.hat ?? pickDeterministic(HATS, config.companion.name)
  // make sure to use it in the return:
  return {
    name: config.companion.name,
    personality: config.companion.personality,
    color,
    eye: eyeStr,
    body: bodyStr,
    hat: hatStr,
  }
```

- [ ] **Step 2: Update `/buddy status` command**
In `src/commands/buddy/buddy.tsx`, show XP and Level.

```tsx
import { getLevelInfo } from '../../buddy/progression.js'
// inside the Buddy command component

  const xp = companionConfig.xp ?? 0
  const levelInfo = getLevelInfo(xp)

  return (
    <Box flexDirection="column" paddingY={1}>
      <Text color="gray">
        Status: {config.companionMuted ? 'Muted' : 'Listening'} | 
        Level: {levelInfo.level} ({xp} XP)
      </Text>
      <Text color="gray">"{levelInfo.status}"</Text>
    </Box>
  )
```

- [ ] **Step 3: Commit**
```bash
git add src/buddy/companion.ts src/commands/buddy/buddy.tsx
git commit -m "feat(buddy): render XP, level, and unlocked hats in UI"
```
