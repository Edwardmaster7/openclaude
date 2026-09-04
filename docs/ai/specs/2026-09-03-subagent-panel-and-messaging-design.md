# Subagent Panel and Messaging — Design

**Date:** 2026-09-03
**Status:** Approved for planning
**Goal:** Give openclaude the Claude Code experience of reading a subagent's full
chat and sending it messages, with identical interface and usability.

## Problem

openclaude cannot read a subagent's transcript or talk to a subagent. Not because
the capability is missing — nearly all of it is implemented — but because the one
component that lets the user *select* an agent is never rendered.

## Method note

This repo is the decompiled Claude Code source, so "parity" is mostly a question
of running code that already exists. Three evidence sources were used, in
increasing order of authority:

1. **The repo itself** — component and state code.
2. **The shipped binary** (`~/.local/bin/claude`, v2.1.259, ~200MB bun-compiled)
   inspected with `strings`. Minified, so only symbol names, string literals and
   a few call sites are recoverable.
3. **The live TUI**, driven under `tmux` (`new-session -d`, `send-keys`,
   `capture-pane -p`), plus the on-disk subagent transcripts at
   `~/.claude/projects/<project>/<sessionId>/subagents/agent-<agentId>.jsonl`.

Source 3 settled every question that 1 and 2 left open, and corrected two wrong
conclusions drawn from 1 and 2. Prefer it for any future parity question.

## What already works (verified, do not rebuild)

| Capability | Location |
| --- | --- |
| Subagent transcript held in memory | `LocalAgentTaskState.messages` (`src/tasks/LocalAgentTask/LocalAgentTask.tsx:130`) |
| Sidechain JSONL bootstrap + UUID merge | `src/screens/REPL.tsx:761-786` |
| Agent transcript replaces main transcript | `src/screens/REPL.tsx:5132` |
| Enter / exit agent view | `src/state/teammateViewHelpers.ts` |
| User input routed to the viewed agent | `src/screens/REPL.tsx:4216` (`onAgentSubmit`) |
| Immediate echo of the user's message | `appendMessageToLocalAgent` — matches Claude Code |
| Delivery to a **running** agent | `queuePendingMessage` → `drainPendingMessages` → `getAgentPendingMessageAttachments`, already wired at `src/utils/attachments.ts:975` |
| Resume of a **finished** agent | `resumeAgentBackground` (`src/screens/REPL.tsx:4222`) |
| `@agent` banner + `Message @agent…` placeholder | `useSwarmBanner.ts:108`, `usePromptInputPlaceholder.ts:43` |
| Keyboard navigation of the panel | `src/components/PromptInput/PromptInput.tsx:1880-1935` |

## Live-verified Claude Code behaviour (v2.1.259)

- Panel row format is identical to our `MainLine` / `AgentLine`:
  `⏺ main` / `◯ Explore  <description>   19s · ↓ 23.1k tokens`, with `⏺` marking
  the viewed agent and the arrow flipping `↑`/`↓` on `progress.lastActivity`.
- The panel renders **below** `PromptInputFooter`, separated by one blank line.
- Affordance is `↓ to manage` while an agent runs; `/tasks to see subagents`
  once all have finished.
- Selecting a row shows footer `↑/↓ to select · Enter to view`; on a running
  agent it becomes `Enter to view · x to stop`, and `x to clear` when terminal.
- `/tasks` detail for a running `local_agent` shows footer
  `← to go back · Esc/Enter/Space to close · x to stop · f to foreground`.
  `f` foregrounds into the inline view. There is **no** transcript and **no**
  message input inside the dialog — the dialog is a route, not a second chat UI.
- `/tasks` rows show the model: `Find formatDuration definition (done) · Haiku 4.5`.
- A message typed while viewing a **running** agent is echoed into its transcript
  immediately, delivered at the next turn boundary, and acted on by the model.
  Proven with a marker token: the agent's sidechain contains the message
  (`role:"user"`, `isMeta:true`, `origin:{"kind":"human"}`) and the agent's own
  reply containing the token (`role:"assistant"`).

## Gaps to close

1. **`CoordinatorTaskPanel` is never rendered.** Defined at
   `src/components/CoordinatorAgentStatus.tsx:34`; every other reference in the
   repo is a comment. Without it there is no way to select an agent, so the whole
   feature is unreachable. This is the only structural gap.
2. **No `f to foreground`** in `AsyncAgentDetailDialog` — `local_agent` has no
   route from `/tasks` into the inline view (`in_process_teammate` has one).
3. **No model on the `/tasks` row.** `LocalAgentTaskState.model` exists but the
   row label is only `task.description`.
4. **Hint placement differs.** `AgentLine` appends `· x to stop` / `· x to clear`
   inside the row text; Claude Code puts `Enter to view · x to stop` in the
   footer and leaves the row clean.

## Decisions

- **No gate.** The panel renders whenever a subagent exists; it already returns
  `null` on an empty list, so sessions without agents are unchanged. Neither
  `CoordinatorAgentStatus` nor `useSwarmBanner` is gated today.
- **Keep this repo's navigation.** v2.1.259 dropped `viewSelectionMode:
  'selecting-agent'`, which this repo still uses (`useBackgroundTaskNavigation.ts:40`)
  and which works. Porting that refactor touches `Spinner`/`TeammateSpinnerTree`
  and teammate code that functions today; the user-visible keys and screens are
  the same either way. Explicitly out of scope.
- **`/tasks` stays a route.** No transcript or input inside the dialog — that
  would be an invention, not parity.

## Out of scope

In-process teammates; `--agent-teams` / `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS`;
KAIROS and GrowthBook gates; the v2.1.259 navigation refactor.

## Risks

- `AsyncAgentDetailDialog.tsx` is react-compiler output (manual `_c(54)` memo
  cache). Editing it requires renumbering cache slots or extending the array;
  getting this wrong causes stale renders rather than a crash. Mitigation: keep
  edits to the smallest possible slice and assert on rendered output.
- Panel render is confirmed identical only at the level of visible text captured
  from the TUI. Colors, hover and click behaviour were not compared.

## Corrections made during investigation

Recorded so the same mistakes are not repeated:

- **Claimed `getAgentPendingMessageAttachments` was never called.** It is called,
  in the same file where it is defined (`attachments.ts:975`). The original grep
  filtered out `attachments.ts` to hide the definition and hid the call with it.
  An entire design item was built on this artifact. Never exclude the defining
  file when looking for call sites.
- **Claimed Claude Code does not echo a user message into the agent transcript.**
  It does. The earlier test's keystrokes never submitted, because focus was on
  the panel row (`Enter to view`) rather than the input; the `Enter` was consumed
  by the panel. Verify focus from the footer text before typing.
- **Documentation was treated as evidence of absence.** The docs do not describe
  the inline panel, which was read as "the panel does not exist". It exists.
