# Design Specification: Session Auto-Recovery on Unexpected Shutdown / Crash

**Date:** 2026-07-29  
**Status:** Approved  
**Feature:** Session Auto-Recovery (`autoResumeOnCrash`)

## Problem Statement
When a user's computer crashes, loses power, or terminal closes unexpectedly during an active OpenClaude session, the session context is preserved on disk in JSONL files (`~/.openclaude/projects/<project-slug>/<session-id>.jsonl`), but upon starting OpenClaude again, the user enters a brand-new blank session unless they manually remember to run `openclaude --resume` or `/resume`.

## Solution Overview
Implement an automatic crash detection and session recovery mechanism in OpenClaude.
1. Track active session state in a project-level lock/state file (`active-session.json`).
2. Mark session state on clean shutdown (`cleanExit: true`).
3. On CLI startup (when launched without explicit subcommands or prompt arguments), detect whether the previous session terminated abruptly (`cleanExit: false` and process not active).
4. Prompt the user: `"Voltar para a sessão interrompida? (Sim / Não)"`.
5. Support `settings.json` configuration for `autoResumeOnCrash` (`"prompt"` | `"always"` | `"never"`).

## Architecture & Components

### 1. Active Session State Tracking (`src/utils/sessionLock.ts`)
- File path: `~/.openclaude/projects/<project-slug>/active-session.json`
- Schema:
  ```json
  {
    "sessionId": "uuid-v4-session-id",
    "startedAt": 1785283200000,
    "lastUpdatedAt": 1785283250000,
    "pid": 12345,
    "cleanExit": false
  }
  ```
- **Lifecycle hooks**:
  - `onSessionStart`: Write/overwrite `active-session.json` with current `sessionId`, `pid`, `startedAt`, `lastUpdatedAt`, and `cleanExit: false`.
  - `onTurnComplete` / `onMessageLogged`: Update `lastUpdatedAt`.
  - `gracefulShutdown` (`/exit`, `SIGINT`, `SIGTERM`, `Ctrl+D`): Update `cleanExit: true` before process exit.

### 2. Startup Recovery Detection (`src/utils/sessionRecoveryCheck.ts`)
When `openclaude` boots in interactive REPL mode:
- Check if `active-session.json` exists for current project directory.
- Parse `active-session.json`:
  - If `cleanExit === true`: No recovery needed.
  - If `pid` is still running in the operating system: Do not recover (another instance is active).
  - If `lastUpdatedAt` is older than 7 days (168 hours): Ignore stale session.
  - Otherwise: Return session metadata as candidate for recovery.

### 3. User Experience & CLI Prompt
When a crash candidate is detected and `autoResumeOnCrash` setting is `"prompt"`:
- Before rendering the full REPL prompt, display:
  ```text
  Sessão anterior interrompida encontrada (ID: a1b2c3d4, há X minutos).
  Voltar para a sessão interrompida? (Sim / Não) [S/n]:
  ```
- **If User accepts (Yes / Enter / 's' / 'y')**:
  - Load and resume conversation using existing `resumeConversation(candidate.sessionId)`.
- **If User declines (No / 'n')**:
  - Mark `active-session.json` as acknowledged/removed.
  - Proceed to open a new blank session as normal.

### 4. Configuration (`settings.json`)
New settings key in `GlobalConfig` / `Settings`:
- `autoResumeOnCrash`: `"prompt"` (default) | `"always"` | `"never"`
  - `"prompt"`: Interactively ask the user on boot.
  - `"always"`: Auto-resume without asking if an abrupt shutdown is detected.
  - `"never"`: Disable auto-recovery checks on boot.

## Edge Cases
1. **Multiple Concurrent Terminals**: The `pid` check prevents terminal B from trying to "auto-recover" a session currently active in terminal A.
2. **Crash during Tool Execution**: Reconstructed transcript filtering already handles orphaned thinking/unresolved tool results via `conversationRecovery.ts`.
3. **Stale Lock Files**: Sessions older than 7 days automatically expire from auto-recovery prompting.

## Testing Strategy
- Unit tests for `sessionLock.ts`:
  - Verify state creation, update, and clean exit handling.
  - Verify detection of abrupt exit (`cleanExit: false`).
  - Verify stale session threshold (> 7 days ignored).
- Integration test for startup check:
  - Simulate interrupted session state file and verify prompt logic / resume decision.
