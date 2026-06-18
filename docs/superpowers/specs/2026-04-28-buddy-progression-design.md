# Buddy XP and Progression Design Spec

## Overview
This specification details the XP (Experience Points) and progression system for the Buddy companion within OpenClaude. The system uses task-based progression to reward the user for completing actual work items, unlocking cosmetic hats for the Buddy as they level up.

## Motivation & Context
Currently, the Buddy has randomly assigned attributes (including hats) based on a deterministic seed at generation, but it does not evolve. Adding a progression system transforms the Buddy from a static avatar into a dynamic partner that tracks the user's productivity and rewards them with visual changes (hats) and contextual dialogue. We chose task-based progression over command-based progression to avoid heavy I/O operations (saving config on every shell command) and to reward meaningful productivity rather than spam.

## Architecture & Data Flow

### 1. State Persistence
The Buddy's state is stored in the global configuration file (`~/.claude.json`) under the `companion` key. We will extend the `StoredCompanion` type:

```typescript
// in src/buddy/types.ts
export type StoredCompanion = {
  name: string
  personality: string
  xp?: number // New field
  hat?: string // Optional override for the currently unlocked hat
}
```

### 2. XP Gain Logic
The observer logic (`src/buddy/observer.ts`) will be extended. We already monitor for `TaskUpdate` tool calls with `status === 'completed'` to trigger text reactions. When this is detected:
1. Fetch the current `GlobalConfig`.
2. Extract the current `xp` from `companion` (defaults to 0).
3. Increment `xp` by 1.
4. Calculate the new Level based on the XP brackets.
5. If a new Level bracket is reached, unlock the corresponding hat.
6. Persist the updated `companion` object back to the global config using `saveGlobalConfig`.

### 3. Level Brackets and Rewards
Levels and their corresponding hats are defined as follows:

| Level | XP Required | Hat Unlocked | Status Message (in `/buddy status`) |
| :--- | :--- | :--- | :--- |
| 1 | 0 - 2 | None | "Buddy is learning the workflow." |
| 2 | 3 - 9 | `leaf` | "Buddy is enjoying the progress!" |
| 3 | 10 - 19 | `hardhat` | "Buddy is hard at work!" |
| 4 | 20 - 34 | `chef` | "Buddy is cooking up code!" |
| 5 | 35 - 49 | `wizard` | "Buddy has mastered the arts!" |
| 6 (MAX) | 50+ | `crown` | "Buddy is legendary!" |

### 4. UI / Visual Updates
When the companion is fetched in `src/buddy/companion.ts` (`getCompanion()`), its properties are generated using the original deterministic seed. We will modify `getCompanion` so that if `StoredCompanion` contains an explicit `hat` property (unlocked via leveling), it overrides the randomly seeded hat.

We will also update the `/buddy status` command handler in `src/commands/buddy/buddy.tsx` to display the current XP, Level, and the contextual status message.

### 5. Level Up Celebration
In `observer.ts`, if the XP increment causes a level up (i.e., crosses a threshold boundary), the `onReaction` callback will trigger a special level-up message instead of the generic `TASK_COMPLETED_REPLIES`. For example: *"Level up! I earned a new hat!"*

## Error Handling & Edge Cases
- **Missing XP Field:** Legacy users won't have an `xp` field. The system will default `undefined` to `0`.
- **Hat Overrides:** If a user later manually changes their hat via customization commands (future scope), the `hat` string in `StoredCompanion` must respect that. The automatic hat application should only occur precisely when crossing an XP threshold.

## Testing Strategy
- Ensure `bun run tsc --noEmit` passes after modifying types.
- Ensure the config write logic utilizes the proper lock and functional updates (`saveGlobalConfig(current => ...)`) to avoid race conditions.