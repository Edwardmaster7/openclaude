# Feedback Learning System — Design Spec

**Date:** 2026-05-25
**Status:** Design approved, ready for implementation planning
**Scope:** OpenClaude CLI agent — memory-based feedback learning system

---

## Problem Statement

The OpenClaude agent currently has no mechanism to learn from its own mistakes or user corrections. When the user undoes an edit, says "não era isso", or corrects the agent's approach, that signal is lost. The next session starts from zero — the same mistakes repeat.

The existing `feedback` memory type exists but is entirely manual: the user (or agent) must explicitly decide to save a correction. There is no automatic detection, no scoring, no consolidation of patterns.

## Goal

Build a feedback learning system where:
1. **Errors are detected automatically** (undo, revert, explicit correction, tool failure)
2. **Patterns are consolidated** into per-theme memory files (not one memory per event)
3. **Scoring is bidirectional** — repeated errors increase weight, consistent success decreases it
4. **Activation is semi-automatic** — agent detects and proposes, user confirms

## Architecture

Three layers:

```
┌─────────────────────────────────────────────────────────┐
│                    COLLECTION LAYER                       │
│  PostToolUse Hook ──→ feedback-log.jsonl                 │
│  • Detects undo/revert                                   │
│  • Detects explicit user corrections                     │
│  • Records tool call success/failure                     │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│                    RETENTION LAYER                        │
│  Memory Files (type: feedback)                           │
│  • One memory per theme/project                          │
│  • Frontmatter: score, lastSuccess, lastFailure          │
│  • Bidirectional scoring affects recall priority         │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│                    SYNTHESIS LAYER                        │
│  /feedback synthesize (skill)                            │
│  • Runs Opus over feedback-log.jsonl                     │
│  • Consolidates events into themes                       │
│  • Updates/creates memory files per theme                │
│  • Proposes to user (semi-automatic)                     │
└─────────────────────────────────────────────────────────┘
```

---

## Component 1: Collection Layer (Feedback Hook)

### Trigger Detection

A `PostToolUse` hook observes three signals:

#### Signal 1: Undo/Revert Detection

- User runs an undo command or `git checkout -- <file>` immediately after an agent edit
- Logged as: `{ type: "undo", tool: "Edit", file: path, context: snippet }`

#### Signal 2: Explicit Correction Detection

- User message matches correction patterns:
  - "não, faz assim..."
  - "não era isso"
  - "troca X por Y"
  - "use [outra abordagem]"
- Logged as: `{ type: "correction", original: what agent did, correction: what user asked }`

#### Signal 3: Tool Call Outcome Tracking

- Every completed tool call
- Logged as: `{ type: "outcome", tool: name, success: bool, error: message_if_any }`

### Log Format

All events go to `~/.openclaude/feedback-log.jsonl`:

```jsonl
{"ts":"2026-05-25T14:30:00Z","session":"abc123","type":"undo","tool":"Edit","file":"src/auth.ts","context":"swapped middleware for wrong import"}
{"ts":"2026-05-25T14:31:00Z","session":"abc123","type":"correction","original":"used bcrypt","correction":"user asked for argon2"}
{"ts":"2026-05-25T14:32:00Z","session":"abc123","type":"outcome","tool":"Bash","success":false,"error":"command not found: prisma"}
```

Events with `confirmed: true` (user accepted the proposal) carry extra weight in synthesis.

### Semi-Automatic Activation

When the hook detects a clear pattern (undo + correction in the same turn), the agent proposes:

> "Notei que você desfez minha edição em `src/auth.ts` e pediu para usar argon2 em vez de bcrypt. Quer que eu salve isso como um padrão aprendido para este projeto?"

If user confirms → event gets `{ confirmed: true }` in the log, which gives extra weight during synthesis.

---

## Component 2: Retention Layer (Memory Files)

### Memory Format

Each feedback memory follows the existing memory format with extra frontmatter fields:

```markdown
---
name: feedback-auth-patterns
description: Learned patterns about authentication in this project — lib preferences, common errors, approaches that worked
type: feedback
score: 65
lastSuccess: "2026-05-24"
lastFailure: "2026-05-25"
confirmations: 4
---

## Pattern: Auth Library

**Rule:** Use argon2 for password hashing in this project (not bcrypt).
**Why:** User corrected on 2026-05-25 — project uses argon2 by security policy.

**Rule:** Auth middleware goes in `src/middleware/auth.ts`, not `src/routes/`.
**Why:** User undid edit that placed middleware in routes — project convention.

## Pattern: Route Structure

**Rule:** REST routes use `router.get()` with named handler, not inline arrow function.
**Why:** Pattern observed in 8 of 10 project files.
```

### Bidirectional Scoring

The `score` field (0-100) controls **when and how** the memory is loaded:

| Score | State | Behavior |
|-------|-------|----------|
| 80-100 | **Critical** | Always loaded (via `findRelevantMemories` or hard-coded) |
| 50-79 | **Relevant** | Loaded when Sonnet selects as relevant |
| 20-49 | **Weak** | Loaded only if query has high overlap |
| 0-19 | **Stale** | Candidate for removal — synthesizer suggests cleanup |

### Scoring Rules

```
Error detected (undo or outcome.fail)         → score -= 10
Correction confirmed by user                   → score -= 5 (less penalty, it's valuable info)
Consistent success (3+ sessions without error)  → score += 5
Synthesis updates memory                        → score += 3 (reward for keeping fresh)
```

### One Memory Per Theme

The synthesizer **consolidates** — it does not create one memory per correction. Instead:
- Memory `feedback-auth-patterns` accumulates **all** authentication patterns
- When a new correction arrives in the same theme, the memory is **updated** (not duplicated)
- The `confirmations` field counts how many times the user confirmed patterns in that theme

### Integration with `findRelevantMemories`

The existing infrastructure already filters memories by relevance to the query. For feedback:
- Memories with high score get **boost in selection** (Sonnet sees the score in the manifest)
- Stale memories (score < 20) are **omitted from the manifest** to avoid wasting slots

---

## Component 3: Synthesis Layer (Synthesizer)

### When It Runs

1. **Manual**: `/feedback synthesize` — user runs when they want
2. **Automatic suggestion**: When `feedback-log.jsonl` accumulates 10+ events, agent suggests:
   > "Acumulei 12 observações de feedback. Quer que eu consolide nos padrões aprendidos?"

### What It Does

```
Input:  feedback-log.jsonl (raw events)
        + existing feedback memory files (if any)

Process (Opus model):
  1. Read all events from the log
  2. Group by theme (auth, routes, tests, etc.)
  3. For each theme:
     - If memory exists → update patterns, adjust score
     - If no memory exists → create new memory
  4. Remove consolidated events from log (keep last 50 as history)
  5. Propose changes to user

Output: updated/created memory files + summary of changes
```

### Synthesis in Action Example

**Accumulated log:**
```jsonl
{"type":"correction","original":"bcrypt","correction":"argon2","confirmed":true}
{"type":"undo","tool":"Edit","file":"src/auth.ts"}
{"type":"correction","original":"inline handler","correction":"named function","confirmed":true}
{"type":"outcome","tool":"Bash","success":false,"error":"prisma not found"}
```

**Synthesizer proposes:**

> Encontrei 3 padrões:
> 1. **Auth**: Usar argon2 (não bcrypt) — 1 confirmação
> 2. **Rotas**: Handlers nomeados (não inline) — 1 confirmação
> 3. **Ferramentas**: `prisma` não está no PATH — 1 falha
>
> Quer que eu salve/atualize as memories de feedback?

**If user confirms:** memories are written/updated with initial score of 50.

### Score Integration

When the synthesizer updates a memory:
- If theme existed with high score → keeps score, adds new pattern
- If theme existed with low score → increases score by +3 (synthesis = relevance signal)
- If new theme → initial score 50 (neutral)

### What It Does NOT Do

- **Does not create memories automatically** — always proposes to user
- **Does not delete stale memories** — only suggests ("score 12, want to remove?")
- **Does not modify non-feedback memories** — respects the `type` field

---

## User Commands

| Command | Action |
|---------|--------|
| `/feedback` | Shows summary: how many feedback memories, scores, recent events |
| `/feedback list` | Lists all feedback memories with scores and dates |
| `/feedback review` | Shows stale memories (score < 20) and suggests cleanup |
| `/feedback synthesize` | Runs the synthesizer manually |
| `/feedback clear` | Clears feedback-log.jsonl (keeps memories) |
| `/feedback reset` | Removes all feedback memories (destructive!) |
| `/feedback ignore <theme>` | Tags a memory as `ignored` — not loaded |

## Required Hooks

1. **PostToolUse hook** — records tool call outcomes in the log
2. **PreCompact hook** — before compacting, suggests synthesis if pending events exist
3. **PromptInput hook** — detects correction patterns in user message (undo, "não era isso", etc.)

## Integration with Existing Systems

- **Memory system**: feedback memories use the same directory and format — `findRelevantMemories` already selects them
- **MEMORY.md index**: feedback memories appear in the index like any other
- **Session**: scoring is persisted in frontmatter, so it survives between sessions
- **Compact**: when context is compacted, synthesizer is suggested to preserve pending feedback

---

## Edge Cases

| Case | Treatment |
|------|-----------|
| User undoes but it was their own error (not the agent's) | Hook proposes, user rejects → event goes to log without `confirmed: true`, synthesizer ignores |
| Feedback contradicts existing memory | Synthesizer warns: "Memory X says A, but new feedback suggests B. Update?" |
| Log grows too large (>100 events) | Synthesizer runs automatically with warning |
| Score goes negative | Clamped at 0, memory becomes removal candidate |
| User wants to ignore a theme | `/feedback ignore <theme>` → memory gets `ignored` tag, not loaded |
| Project changes stack | Scores don't reset, but synthesis detects that old patterns no longer apply |

## Explicit Limitations

- **Not real machine learning** — heuristic based on counters and LLM for synthesis
- **Depends on detection quality** — if hook misses an undo, the event is lost
- **Token cost** — each synthesis runs Opus over the log. Frequency should be low (1x per session max)
- **Semi-automatic has friction** — user needs to confirm. If they never confirm, the system doesn't learn

---

## File Paths (Proposed)

| Component | Path |
|-----------|------|
| Feedback hook | `src/hooks/feedbackHook.ts` |
| Feedback log | `~/.openclaude/feedback-log.jsonl` |
| Feedback skill | `skills/feedback.md` (or as plugin command) |
| Feedback memory dir | Same as existing memory dir (`~/.openclaude/projects/<project>/memory/`) |
| Scoring logic | `src/memdir/feedbackScoring.ts` |
| Log reader/writer | `src/memdir/feedbackLog.ts` |

## Open Questions

1. **Should the feedback log be per-project or global?** Leaning per-project (project-specific patterns), but cross-project patterns (e.g., "always use named exports") could be valuable.
2. **Should synthesis be a plugin skill or built-in?** Leaning plugin skill for flexibility.
3. **How to handle the PreCompact hook gracefully?** Compact is time-sensitive — synthesis should be fast or deferred.
