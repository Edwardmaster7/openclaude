# Buddy New Skills — Design Spec

**Date:** 2026-05-25
**Status:** Approved
**Scope:** 7 new skills across 4 domains, following existing architecture (functions in skills.ts, triggers in observer.ts)

---

## Overview

Expanding the buddy skill system with 7 new deep skills across 4 domains: Code Quality, Engagement/Emotion, Productivity/Focus, and DevOps/Pipeline. All skills follow the existing pattern of pure functions in `skills.ts` with triggers in `observer.ts`.

### Current State

- **Error Tips** — 17 categories, 93 tips, 25%/85% premium
- **Code Review** — 16 categories, 73 tips, 50%/95% premium
- **Git Status Awareness** — 10% chance after bash success
- **Session Summary** — Level 4+, command-based
- **Productivity Reminders** — 1h work / 15min idle

### New Skills Summary

| #   | Skill                         | Domain       | Trigger                | Chance          | Level |
| --- | ----------------------------- | ------------ | ---------------------- | --------------- | ----- |
| 1   | Code Complexity Advisor       | Quality      | Edit/Write tool_use    | 30%/80% premium | 3+    |
| 2   | Missing Test Detector         | Quality      | Edit/Write tool_use    | 35%/85% premium | 3+    |
| 3   | Milestone Celebrator          | Engagement   | Stats increment        | 100%            | —     |
| 4   | Session Coach                 | Engagement   | Time-based (45-60min)  | 100%            | 2+    |
| 5   | Pomodoro                      | Productivity | `/buddy foco`          | 100%            | 2+    |
| 6   | Next Step Suggestion          | Productivity | TaskUpdate completed   | 40%/80% premium | 6+    |
| 7   | Dependency & Security Auditor | DevOps       | npm install / git push | 25%/70% premium | 4+    |

---

## Skill 1: Code Complexity Advisor

**File:** `src/buddy/skills.ts`
**Export:** `getCodeQualityTip(filePath: string, content: string): string | null`
**Trigger in observer:** After `Edit` or `Write` tool_use on `.ts`, `.js`, `.tsx`, `.jsx`, `.py` files
**Chance:** 30% (normal), 80% (premium)
**Level:** 3+ (XP >= 25)
**Delay:** 2s after tool completion

### Categories (10)

| #   | Category            | Patterns                          | Tips                                                               |
| --- | ------------------- | --------------------------------- | ------------------------------------------------------------------ |
| 1   | **Long function**   | Function with >40 lines           | "Essa funcao ta grande. Que tal extrair partes em helpers?"        |
| 2   | **Too many params** | Function with >5 params           | "5+ params? Tenta passar um objeto `{ opts }` em vez."             |
| 3   | **Deep nesting**    | >4 levels of indentation          | "Callback hell detected. Tenta async/await ou extrair funcoes."    |
| 4   | **TODO/FIXME**      | `// TODO`, `// FIXME`, `// HACK`  | "Tem TODO pendente aqui. Resolve ou cria issue pra nao esquecer."  |
| 5   | **Console.log**     | `console.log(` without `// debug` | "Console.log no codigo? Tenta logger ou remove antes de commitar." |
| 6   | **Any type**        | `: any`, `as any`                 | "`any` detected. Tenta tipar melhor — TypeScript agradece."        |
| 7   | **Empty catch**     | `catch {}` or `catch (e) {}`      | "Catch vazio engole erros. Loga ou re-throw."                      |
| 8   | **Magic numbers**   | Hardcoded numbers in logic        | "Numero magico! Tenta extrair em constante com nome descritivo."   |
| 9   | **Unused import**   | Import not referenced in body     | "Import nao utilizado — remove pra manter limpo."                  |
| 10  | **Large file**      | >300 lines                        | "Arquivo ta crescendo. Sera que precisa ser dividido em modulos?"  |

### Implementation Notes

- The observer detects `Edit` or `Write` tool_use in assistant messages
- Filters by file extension (`.ts`, `.js`, `.tsx`, `.jsx`, `.py`)
- Reads the file content after edit completes
- Passes `filePath` and `content` to `getCodeQualityTip()`
- Uses regex patterns on content to detect issues
- Generic tips as fallback (10 items)

---

## Skill 2: Missing Test Detector

**File:** `src/buddy/skills.ts`
**Export:** `getMissingTestTip(filePath: string, content: string): string | null`
**Trigger in observer:** After `Edit` or `Write` tool_use that creates/modifies exported functions
**Chance:** 35% (normal), 85% (premium)
**Level:** 3+ (XP >= 25)
**Delay:** 3s after tool completion

### Categories (5)

| #   | Category                  | Patterns                             | Tips                                                                 |
| --- | ------------------------- | ------------------------------------ | -------------------------------------------------------------------- |
| 1   | **Export without test**   | `export function` without `*.test.*` | "Essa funcao exportada nao tem teste. `/buddy teste` pra sugestao."  |
| 2   | **Handler without test**  | Route handler / API endpoint         | "Endpoint sem teste = bomba relogio. Cobre pelo menos o happy path." |
| 3   | **Mutation without test** | Function that modifies state         | "Mutacao de state sem teste? Risco alto de regressao."               |
| 4   | **Edge case visible**     | Null check, division, array access   | "Edge case detectado. Testa com null, [], e 0."                      |
| 5   | **Async without test**    | Async function without coverage      | "Funcao async precisa testar success, error, e timeout."             |

### Implementation Notes

- Compares exports in the edited file with existence of `*.test.*` or `__tests__/` files
- Uses `Glob` to check for corresponding test files
- If no test file exists for the module, triggers the tip
- Generic tips as fallback (5 items)

---

## Skill 3: Milestone Celebrator

**File:** `src/buddy/skills.ts`
**Export:** `checkMilestone(stats: CompanionStats, config: CompanionConfig): string | null`
**Trigger in observer:** After any stat increment (`totalBashes`, `totalTasks`, `totalErrors`) or pet
**Chance:** 100% (always fires on milestone)
**Level:** None
**Delay:** Immediate (no delay)

### Milestone Categories (7)

| #   | Category              | Thresholds                  | Example Phrase                                       |
| --- | --------------------- | --------------------------- | ---------------------------------------------------- |
| 1   | **Bash milestones**   | 10, 50, 100, 250, 500, 1000 | "100 comandos bash! Voce ta viciado no terminal!"    |
| 2   | **Task milestones**   | 5, 10, 25, 50, 100, 200     | "50 tasks concluidas! Uma maquina de produtividade!" |
| 3   | **Error milestones**  | 10, 25, 50, 100             | "100 erros — mas cada um e uma licao, ne?"           |
| 4   | **XP milestones**     | 25, 50, 100, 200, 400       | "100 XP! Buddy ta ficando forte!"                    |
| 5   | **Streak milestones** | 3, 7, 14, 30, 60, 90        | "30 dias seguidos! Compromimento e tudo!"            |
| 6   | **Pet milestones**    | 10, 50, 100, 500            | "100 pets! Esse buddy e muito amado!"                |
| 7   | **Special days**      | 1st, 7th, 30th day of use   | "1 mes usando OpenClaw! Parabens pela jornada!"      |

### Deduplication

- Store `companionMilestonesReached: string[]` in config (e.g., `["bash:100", "tasks:50"]`)
- On each stat check, generate milestone key, check if already in array
- If new, add to array and return celebration phrase
- Max 100 entries (FIFO — oldest removed if full)

### Phrase Selection

Each milestone threshold has 3-5 varied phrases. Uses `pickDeterministic` with companion name + milestone key as seed.

---

## Skill 4: Session Coach

**File:** `src/buddy/skills.ts`
**Export:** `getSessionCoachTip(sessionData: SessionData): string | null`
**Trigger in observer:** Timer-based, checked every 5 min after first bash
**Chance:** 100% when timer fires and condition matches
**Level:** 2+ (XP >= 5)
**Delay:** Immediate

### Session Data Interface

```typescript
type SessionData = {
  sessionStartTime: number; // timestamp of first bash in session
  lastActivityTime: number; // timestamp of last bash/task
  totalBashes: number; // bashes in this session
  totalTasks: number; // tasks in this session
  totalErrors: number; // errors in this session
  currentHour: number; // 0-23
};
```

### Categories (6)

| #   | Category               | Condition                  | Example                                                                |
| --- | ---------------------- | -------------------------- | ---------------------------------------------------------------------- |
| 1   | **High error rate**    | >40% error rate in session | "Ta complicado hoje? Que tal dar um passo atras e revisar o approach." |
| 2   | **Productive streak**  | 5+ tasks without error     | "Fluxo excelente! 5 tasks sem erro. Ta no zone!"                       |
| 3   | **Long session**       | >2h working                | "2 horas ja! Sua mente precisa de uma pausa. Levanta, bebe agua."      |
| 4   | **Quick productivity** | <30min with 3+ tasks       | "Sessao rapida e eficiente! Short bursts > long marathons."            |
| 5   | **Stuck**              | 15min without task/bash    | "Travou em algo? Tenta quebrar o problema em partes menores."          |
| 6   | **Late night**         | Between 00:00-05:00        | "Coding a meia-noite? Coruja detectada. Nao esquece de dormir!"        |

### Implementation Notes

- Observer stores `sessionStartTime` in a module-level variable (reset on new session detection)
- A `setInterval` (every 5 min) calls `getSessionCoachTip()` with collected data
- Coach fires once per condition per session (uses flags like `hasTriggeredLongSession`, `hasTriggeredStuck`)
- Resets flags when new session detected (gap > 30 min between activities)

---

## Skill 5: Pomodoro Integrado

**File:** `src/buddy/skills.ts` (timer logic) + `src/buddy/pomodoro.ts` (new file)
**Export:** `startPomodoro()`, `stopPomodoro()`, `getPomodoroStatus()`, `firePomodoroTick()`
**Trigger:** Command `/buddy foco` (start), `/buddy foco stop` (stop), `/buddy foco status` (check)
**Chance:** 100% (command-based)
**Level:** 2+ (XP >= 5)

### Config Fields

```typescript
companionPomodoro?: {
  active: boolean
  startedAt: number        // timestamp
  count: number            // pomodoros completed today
  dailyXpEarned: number    // XP earned from pomodoros today
}
```

### Phases

| Phase     | Minutes | Message                                                      |
| --------- | ------- | ------------------------------------------------------------ |
| Start     | 0       | "Foco iniciado! 25 minutos de concentracao. Sem distracoes!" |
| Check-in  | 10      | "10 minutos no foco. Ta fluindo?"                            |
| Half      | 15      | "Metade do pomodoro! Mantem o ritmo."                        |
| Almost    | 20      | "5 minutos faltando! Finaliza o que ta fazendo."             |
| Complete  | 25      | "Pomodoro completo! +2 XP. Hora de uma pausa de 5 min."      |
| Break end | 30      | "Pausa acabou! Bora pro proximo pomodoro? `/buddy foco`"     |

### Daily XP Limit

| Rule            | Value                                                                             |
| --------------- | --------------------------------------------------------------------------------- |
| XP per pomodoro | +2                                                                                |
| Daily limit     | 8 pomodoros (16 XP/day)                                                           |
| After limit     | Pomodoro works but no XP                                                          |
| Limit message   | "8 pomodoros hoje! Voce ja ganhou todo o XP de foco. Mas pode continuar focando!" |
| Reset           | Midnight (same as streak)                                                         |

### Streak Bonus

- 3 consecutive pomodoros: +1 XP extra
- Counts toward daily limit

### Implementation Notes

- `pomodoro.ts` manages timer state via `setInterval` (30s ticks)
- Each tick checks elapsed time and fires appropriate phase message
- Observer integration: `/buddy foco` calls `startPomodoro()`, which sets config and starts timer
- Timer stores interval ID in module-level variable
- `/buddy foco stop` calls `stopPomodoro()`, clears interval
- `/buddy foco status` returns remaining time
- On pomodoro complete: grant XP (if under daily limit), increment count, check for streak bonus

---

## Skill 6: Next Step Suggestion

**File:** `src/buddy/skills.ts`
**Export:** `getNextStepTip(sessionContext: SessionContext): string | null`
**Trigger in observer:** After `TaskUpdate` with `status: completed`
**Chance:** 40% (normal), 80% (premium)
**Level:** 6+ (XP >= 120)
**Delay:** 4s after task completion

### Session Context Interface

```typescript
type SessionContext = {
  editedFiles: string[]; // files modified this session
  lastBuildTime: number | null; // timestamp of last build command
  lastBuildSuccess: boolean; // did last build pass?
  gitAhead: number; // commits ahead of remote
  gitBehind: number; // commits behind remote
  stagedFiles: number; // files in staging area
  hasNewDependency: boolean; // package.json was modified
};
```

### Categories (8)

| #   | Category               | Condition                 | Suggestion                                                           |
| --- | ---------------------- | ------------------------- | -------------------------------------------------------------------- |
| 1   | **Tests pending**      | Edited file without test  | "Voce acabou de editar um arquivo. Que tal rodar os testes?"         |
| 2   | **Diff not committed** | Many staged changes       | "Ta com bastante mudanca. Revisa o diff antes de commitar."          |
| 3   | **Branch divergent**   | Branch behind remote      | "Branch ta atras do remote. `git pull --rebase` antes de continuar." |
| 4   | **Build pending**      | Changes after last build  | "Mudancas desde o ultimo build. Rode `npm run build` pra verificar." |
| 5   | **PR ready**           | Branch with commits ahead | "Ta com commits ahead. Hora de abrir um PR?"                         |
| 6   | **Docs outdated**      | README older than code    | "README parece desatualizado. Da uma revisada?"                      |
| 7   | **New dependency**     | package.json modified     | "Dependencia nova? Confere se o lockfile ta commitado."              |
| 8   | **Refactor suggested** | Function >50 lines edited | "Essa funcao ta crescendo. Considera quebrar em partes menores."     |

### Implementation Notes

- Observer maintains `sessionContext` object updated on each tool_use
- On `TaskUpdate` completed, passes context to `getNextStepTip()`
- Uses `execSync` for git status checks (same pattern as git status awareness)
- Generic tips as fallback (5 items)

---

## Skill 7: Dependency & Security Auditor

**File:** `src/buddy/skills.ts`
**Export:** `getSecurityTip(context: SecurityContext): string | null`
**Trigger in observer:** After `npm install`/`yarn add`/`pip install` or `git push` in bash output
**Chance:** 25% (normal), 70% (premium)
**Level:** 4+ (XP >= 50)
**Delay:** 2s after bash completion

### Security Context Interface

```typescript
type SecurityContext = {
  command: string; // the bash command executed
  output: string; // command output
  filePath?: string; // file being pushed/installed
};
```

### Categories (8)

| #   | Category                 | Patterns                                | Tip                                                      |
| --- | ------------------------ | --------------------------------------- | -------------------------------------------------------- |
| 1   | **Known vulnerability**  | `npm audit` issues in output            | "Dependencia com vulnerabilidade! Rode `npm audit fix`." |
| 2   | **Outdated lockfile**    | package.json newer than lock            | "Lockfile desatualizado. Rode install pra sincronizar."  |
| 3   | **Deprecation**          | Deprecation warnings                    | "Pacote depreciado! Confere a alternativa recomendada."  |
| 4   | **Secret in diff**       | `API_KEY`, `SECRET`, `PASSWORD` in diff | "Possivel secret no diff! Usa `.env` e `.gitignore`."    |
| 5   | **.env staged**          | `.env` in `git status`                  | ".env no staging! Adiciona ao `.gitignore` AGORA."       |
| 6   | **Dangerous permission** | `chmod 777` or `0777`                   | "777 e perigoso. Usa 755 ou 644."                        |
| 7   | **Push to main**         | Push to main/master                     | "Pushando direto pra main? Usa branch e PR."             |
| 8   | **Large commit**         | >20 files in commit                     | "Commit gigante! Considera dividir em commits menores."  |

### Implementation Notes

- Observer detects install/push commands via regex on bash command
- For npm install: runs `npm audit --json` briefly to check vulnerabilities
- For git push: checks target branch and staged file count
- For .env: checks `git status --porcelain` for `.env` files
- Generic tips as fallback (5 items)

---

## Observer Integration

### New Trigger Points in `observer.ts`

All existing triggers remain unchanged. New triggers added:

1. **Edit/Write detection** — Check `lastMessage.content` for `tool_use` with `name === 'Edit'` or `name === 'Write'`. Extract `file_path` and content. Call `getCodeQualityTip()` and `getMissingTestTip()` with 30%/35% chance.

2. **Milestone check** — After every `incrementStat()` call, run `checkMilestone()`. If non-null, emit celebration. Also check after `grantXp()` for XP milestones.

3. **Session coach timer** — Initialize `setInterval` (5 min) in observer module. Track session state in module-level variables. Fire `getSessionCoachTip()` when conditions match.

4. **Pomodoro commands** — New command handling in the `/buddy` command handler for `foco`, `foco stop`, `foco status`.

5. **Next step** — After `TaskUpdate` completed (existing block), add `getNextStepTip()` call with 40%/80% chance at 4s delay.

6. **Security auditor** — After bash success, if command matches install/push patterns, call `getSecurityTip()` with 25%/70% chance.

### New Delay Schedule

| Skill           | Delay            |
| --------------- | ---------------- |
| Error Tips      | 2s (existing)    |
| Code Review     | 3s (existing)    |
| Code Complexity | 2s (new)         |
| Missing Test    | 3s (new)         |
| Milestone       | 0s (immediate)   |
| Session Coach   | 0s (timer-based) |
| Next Step       | 4s (new)         |
| Security        | 2s (new)         |

Multiple skills can fire on the same event. Delays are staggered to avoid message flooding:

- 0s: Milestone (immediate, rare)
- 2s: Error Tips OR Code Complexity OR Security
- 3s: Code Review OR Missing Test
- 4s: Next Step

---

## Probability Summary

| Skill           | Normal | Premium | Level |
| --------------- | ------ | ------- | ----- |
| Error Tips      | 25%    | 85%     | 2+    |
| Code Review     | 50%    | 95%     | 2+    |
| Code Complexity | 30%    | 80%     | 3+    |
| Missing Test    | 35%    | 85%     | 3+    |
| Milestone       | 100%   | 100%    | —     |
| Session Coach   | 100%   | 100%    | 2+    |
| Next Step       | 40%    | 80%     | 6+    |
| Security        | 25%    | 70%     | 4+    |

---

## Config Changes

New fields in companion config:

```typescript
companionMilestonesReached?: string[]     // ["bash:100", "tasks:50", ...]
companionPomodoro?: {
  active: boolean
  startedAt: number
  count: number
  dailyXpEarned: number
}
companionLastPomodoroResetDate?: string   // "2026-05-25"
```

---

## New Files

| File                    | Purpose                        |
| ----------------------- | ------------------------------ |
| `src/buddy/pomodoro.ts` | Pomodoro timer state and logic |

---

## Files to Modify

| File                    | Changes                                                               |
| ----------------------- | --------------------------------------------------------------------- |
| `src/buddy/skills.ts`   | Add 5 new exported functions + types + category arrays                |
| `src/buddy/observer.ts` | Add 6 new trigger points, session tracking, pomodoro command handling |

---

## Testing Strategy

- Each skill function is a pure function testable in isolation
- Test `pickContextual` patterns against sample inputs
- Test milestone deduplication (same milestone not firing twice)
- Test pomodoro XP daily limit (8 pomodoros = 16 XP cap)
- Test session coach condition flags (fire once per condition per session)
