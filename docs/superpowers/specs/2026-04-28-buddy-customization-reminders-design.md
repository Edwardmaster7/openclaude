# Buddy Customization and Productivity Design Spec

## Overview
This specification expands the Buddy companion system by adding productivity reminders and customization commands (`/buddy rename` and `/buddy reroll`). These features leverage the recently implemented XP system, acting as an "XP sink" and introducing time-based and inactivity-based background reactions.

## 1. Customization Commands

We will introduce two new subcommands to the `/buddy` CLI interface:

### `/buddy reroll`
- **Purpose:** Allows the user to completely regenerate the core visual identity (species, eyes, body) of their companion.
- **Cost:** 10 XP.
- **Logic:**
  1. Check if user has ≥ 10 XP. If not, reject with a polite system message.
  2. Deduct 10 XP.
  3. Generate a new pseudo-random suffix or seed (e.g., storing a `rerollSeed` string in `StoredCompanion` or modifying the name temporarily to trick the deterministic PRNG, though storing `rerollSeed` is safest).
  4. Preserve the `hat`, `name`, and `personality`.
  5. Save to global config.

### `/buddy rename <new_name>`
- **Purpose:** Change the display name of the companion.
- **Cost & Requirement:** 2 XP AND user must be at least Level 2 (≥ 3 XP).
- **Logic:**
  1. Check if user is Level 2+ and has ≥ 2 XP. Reject if not.
  2. Deduct 2 XP.
  3. Update the `name` field in `StoredCompanion`.
  4. Save to global config.
  5. Companion reacts acknowledging the new name.

## 2. Productivity Reminders

The Buddy will proactively remind the user to maintain healthy habits using a mix of fixed-interval and inactivity-based triggers.

### The Observer Timing Mechanism
Since `fireCompanionObserver` runs on every REPL tick (when messages arrive), we cannot rely on it for strict real-time cron jobs if the terminal is completely idle. 
- *Idle Check:* We can check the timestamp of the last `user` message. If `Date.now() - lastUserMsgTime > 15 * 60 * 1000` (15 mins), and we haven't reacted to this idle period yet, the Buddy shows a "Zzz" or "Tirou uma pausa?" message.
- *Session Time Check:* We will track the session start time in memory. Every time an action happens, we check if `Date.now() - sessionStart` has crossed a 2-hour boundary (or 1 hour). If it has, and we haven't reminded them for that boundary, we emit a random productivity reminder.

### Reminder Vocabulary Arrays
To provide variety, we will add arrays to `observer.ts`:

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
```

## Architecture Changes
- **`src/buddy/types.ts`:** Add `rerollSeed?: string` to `StoredCompanion` to allow re-rolling visual attributes while keeping the same username seed.
- **`src/commands/buddy/buddy.tsx`:** Parse args for `rename` and `reroll`. Apply logic, compute XP costs using `getLevelInfo()`.
- **`src/buddy/companion.ts`:** Update `getCompanion` to use `config.companion.rerollSeed` alongside `companionUserId()` to alter the RNG outcome.
- **`src/buddy/observer.ts`:** Add local module variables to track `lastBreakReminder` and `lastIdleReminder` to ensure we don't spam the user. Add the timing logic inside `fireCompanionObserver`.

## Edge Cases
- **Insufficient Funds:** Clear system messaging must explain exactly why a command failed (e.g., "You need 10 XP to reroll, you only have 4").
- **Rename Limits:** Prevent empty strings or excessively long names (limit to ~20 chars).