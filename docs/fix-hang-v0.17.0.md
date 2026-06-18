# Correção de Travamentos — OpenClaude v0.17.0

## Contexto

O OpenClaude, quando executado via Bun runtime, apresentava múltiplos cenários de
travamento (hang/freeze) que impediam o uso normal da ferramenta. Os travamentos
ocorriam em três frentes distintas, cada uma com uma causa raiz diferente.

---

## Problema 1: Deadlock no File Watcher do Bun (fs.watch)

### Sintomas

- O processo congelava silenciosamente ao monitorar mudanças em `settings.json` e
  diretórios de skills
- O travamento era intermitente — acontecia mais em operações git que tocavam muitos
  diretórios simultaneamente (ex: `git checkout`, `git pull` com muitas mudanças)
- Em ambientes com grandes árvores de skills (centenas de subdiretórios), o travamento
  era reproduzível quase 100% das vezes

### Causa Raiz

O Bun tem um bug conhecido no `PathWatcherManager` (oven-sh/bun#27469, #26385):
quando um watcher é fechado na thread principal enquanto a thread de File Watcher está
entregando eventos, ambas as threads ficam presas em `__ulock_wait2` indefinidamente.

O chokidar (biblioteca de file watching usada internamente) com `depth: 2` em árvores
grandes de skills gerencia FSWatchers por diretório — ao adicionar/remover diretórios,
ele fecha e reabre watchers internamente, o que gatilha o deadlock do Bun de forma
confiável.

### Solução Implementada

**Detecção de runtime + fallback para polling** em dois arquivos:

`src/utils/settings/changeDetector.ts` e `src/utils/skills/skillChangeDetector.ts`:

- `USE_POLLING = typeof Bun !== 'undefined'` — detecta runtime Bun
- `POLLING_INTERVAL_MS = 2000` — intervalo de stat() polling
- `usePolling: USE_POLLING` no config do chokidar

Quando executado sob Bun, o chokidar usa `stat()` polling em vez de `fs.watch()`.
Isso elimina completamente o PathWatcherManager da equação — sem FSWatcher, sem
deadlock. O intervalo de 2s é aceitável porque settings e skills mudam raramente.

**Estabilização adicional no useTaskListWatcher** (`src/hooks/useTaskListWatcher.ts`):

Props instáveis (`isLoading`, `onSubmitTask`) foram estabilizadas via refs para evitar
re-execução do efeito de watcher a cada render do React, reduzindo a janela de
deadlock mesmo em cenários de alta reatividade.

### Referências

- Bun issue: oven-sh/bun#27469
- Bun issue: oven-sh/bun#26385
- Mecanismo: `__ulock_wait2` entre main thread e File Watcher thread

---

## Problema 2: Travamento no Keychain do macOS (security command)

### Sintomas

- O processo congelava por tempo indeterminado ao tentar ler credenciais do Keychain
- Ocorria especialmente após retorno do sleep/lock da máquina ou com keychain travado
- Afetava tanto a detecção de API key (`auth.ts`) quanto o armazenamento seguro
  (`macOsKeychainStorage.ts`)

### Causa Raiz

O comando `security find-generic-password` do macOS pode travar indefinidamente quando:

1. O keychain está bloqueado e aguardando desbloqueio do usuário
2. O agente do keychain (`securityd`) está sobrecarregado ou travado
3. A chamada é síncrona e bloqueia o event loop do Node/Bun

Antes do fix, as chamadas ao `security` **não tinham timeout**, então qualquer
resposta lenta do keychain congelava todo o processo.

### Solução Implementada

**Timeout de 1.5s em todas as chamadas ao keychain**, em 4 pontos:

1. `src/utils/auth.ts` — leitura de API key via shell (timeout: 1500)
2. `src/utils/secureStorage/macOsKeychainStorage.ts` — leitura síncrona (timeout: 1500)
3. `src/utils/secureStorage/macOsKeychainStorage.ts` — leitura assíncrona via
   `execFileNoThrow` (timeout: 1500)
4. `src/utils/secureStorage/macOsKeychainStorage.ts` — verificação de keychain lock
   via `execaSync` (timeout: 1500)

O valor de 1.5s foi escolhido como compromisso: rápido o suficiente para não travar
a UX, lento o suficiente para keychains em redes corporativas com latência.

---

## Problema 3: Detecção de IDE Travando com Múltiplas Chamadas ao Processo

### Sintomas

- Startup lento ou congelado quando o OpenClaude era iniciado a partir de um IDE
  (VS Code, Cursor, Antigravity, etc.)
- Em alguns casos, o processo travava completamente ao detectar o IDE pai

### Causa Raiz

A função `getVSCodeIDECommandByParentProcess()` em `src/utils/ide.ts` caminhava pela
árvore de processos fazendo **múltiplas chamadas síncronas** ao comando do sistema em
sequência — até 20 processos spawnados (2 por iteração × 10 iterações máximas).

Cada iteração do loop fazia 2 chamadas bloqueantes para obter o comando e o PID pai.
Se qualquer chamada demorasse (sistema sob carga, processo zombie), o event loop
ficava bloqueado indefinidamente.

### Solução Implementada

**Substituição por chamada async única com timeout:**

A função `getAncestorCommandsAsync` (nova, em `src/utils/genericProcessUtils.ts`)
executa um único script shell que percorre toda a árvore de processos de uma vez,
com timeout de 3s garantido.

Ganho: de até 20 processos spawnados sequencialmente para 1 único, com timeout
garantido. A função `getVSCodeIDECommandByParentProcess` foi convertida de síncrona
para `async` para suportar a nova abordagem.

---

## Resumo das Alterações (v0.17.0)

| Arquivo | Mudança | Impacto |
|---------|---------|---------|
| `src/utils/settings/changeDetector.ts` | `usePolling: true` no Bun + interval 2s | Elimina deadlock do fs.watch |
| `src/utils/skills/skillChangeDetector.ts` | `usePolling: true` no Bun + interval 2s | Elimina deadlock do fs.watch em skills |
| `src/hooks/useTaskListWatcher.ts` | Refs para props instáveis | Reduz re-execução do watcher |
| `src/utils/auth.ts` | `timeout: 1500` no security command | Elimina hang do keychain |
| `src/utils/secureStorage/macOsKeychainStorage.ts` | `timeout: 1500` em 3 pontos | Elimina hang do keychain |
| `src/utils/ide.ts` | async ancestor commands substitui N×ps sync | Elimina hang na detecção de IDE |
| `src/utils/genericProcessUtils.ts` | Função `getAncestorCommandsAsync` | Uma chamada shell com timeout 3s |
| `package.json` | Version bump 0.16.0 → 0.17.0 | Release |

---

## Testes

- Testado no macOS com Bun runtime
- Cenário de keychain travado: processo retorna em ~1.5s em vez de hang infinito
- Cenário de git operations massivas em skill dirs: sem deadlock com polling
- Detecção de IDE (Antigravity, VS Code): startup em <3s em vez de hang

---

## Status

**Fix upstream do Bun pendente** — a solução de polling é um workaround. Quando
oven-sh/bun#27469 for resolvido, `USE_POLLING` pode ser removido e voltar para
fs.watch() nativo.
