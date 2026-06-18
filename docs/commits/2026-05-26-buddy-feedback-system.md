# Documentação da Atualização: Sistema Buddy & Aprendizado por Feedback
**Data da Atualização:** 26 de Maio de 2026
**Módulo Principal:** Buddy (Companheiro Virtual) & Core Observer

---

## 1. Visão Geral

Esta atualização transforma o **Buddy** de um assistente puramente reativo em um sistema proativo de **Aprendizado Contínuo e Gamificação**. O OpenClaude agora é capaz de analisar o comportamento do usuário, interpretar correções contextuais, consolidar regras de fluxo de trabalho e expressar "emoções" com base na saúde da sua memória de aprendizado e no estado do repositório.

---

## 2. Sistema de Feedback e Aprendizado Contínuo

O motor de feedback permite que o assistente memorize preferências e evite repetir erros.

### Como funciona o fluxo:
1. **Edição e Erro:** O assistente edita um arquivo via `FileWriteTool` ou `Edit`.
2. **Intervenção do Usuário:** O usuário reverte a mudança (`git checkout`, `undo`) ou corrige o assistente ("não era isso", "troca X por Y").
3. **Detecção (`detectAndLogFeedback`):** O sistema identifica o padrão, rastreia qual arquivo foi alterado e sugere a criação de uma regra.
4. **Consolidação:** O usuário utiliza o comando `/feedback confirm`. A regra é salva na memória com um `score` base.
5. **Aplicação Proativa (`getFeedbackTip`):** Em interações futuras, o sistema varre a memória e sugere a regra aprendida caso o contexto (arquivo ou comando) seja semelhante.

### Funções Core:
*   `extractLastEditedFiles(messages: Message[]): string[]`
    *   *Localização:* `src/hooks/feedbackHook.ts`
    *   *Uso:* Varre o histórico de mensagens para mapear quais arquivos o assistente tentou modificar na sessão atual.
*   `detectAndLogFeedback(input, messages, sessionId)`
    *   *Localização:* `src/hooks/feedbackHook.ts`
    *   *Uso:* Utiliza Regex para categorizar mensagens do usuário em `undo` ou `correction` e gera a notificação de feedback.

---

## 3. Progressão de XP e Gamificação (Achievements)

O sistema de recompensas foi balanceado para incentivar boas práticas e o uso de recursos avançados.

### Tabela de XP Atualizada:
| Ação | Recompensa (XP) | Descrição |
| :--- | :--- | :--- |
| **Task Concluída** | `+3.0 XP` | Detectado via `TaskUpdate` status `completed`. |
| **Feedback Confirmado** | `+2.0 XP` | Ao utilizar o comando `/feedback confirm`. |
| **Uso do Stoneage** | `+0.5 XP` | Recompensa por utilizar o modo de economia de tokens. |
| **Sucesso no Bash** | `+0.1 XP` | Comando executado sem erros no terminal. |

### Novas Categorias de Conquistas (`ACHIEVEMENTS`):
Adicionadas 28 novas conquistas no arquivo `src/buddy/achievements.ts`, categorizadas em:
1.  **Feedback (Aprendizado):** *Aprendiz* (5 regras), *Mestre* (15 regras), *Sábio* (30 regras).
2.  **Stoneage (Eficiência):** *Primeiro Contato*, *Economia de Fogo* (1K tokens salvos), *Mamute de Ouro* (10K tokens salvos), *Mestre das Pedras*.
3.  **Especiais & Easter Eggs:** *Night Owl* (uso pós meia-noite), *Premium User*, *Code Reviewer*.

---

## 4. Inteligência Emocional: O Sistema de Humor (Mood System)

O Buddy agora reflete o estado do projeto e da sua memória de aprendizado.

### Cálculo de Humor (`src/buddy/mood.ts`):
*   **Orgulhoso (`🧠`):** Ativado se a média de `score` das regras de feedback aprendidas for `>= 80`. Indica alta consolidação.
*   **Preocupado (`🤔`):** Ativado se a média de `score` for `< 40` (regras esquecidas) ou se a taxa de erros no terminal (Error Rate) ultrapassar 40% em mais de 10 comandos.
*   **Empolgado (`🔥` / `⭐`):** Ativado quando o usuário está operando com privilégios Premium ou conclui múltiplas de 10 Tasks.
*   **Sonolento (`😴`):** Ativado caso o usuário não tenha feito a interação diária (Pet) com o Buddy.

---

## 5. Reestruturação do Core Observer

O ciclo de vida do `fireCompanionObserver` (`src/buddy/observer.ts`) foi otimizado para evitar loops e reações fora de contexto.

### Pipeline de Execução:
1.  **Rastreio de Atividade:** `trackActiveDay()` garante que o dia atual conte para a sequência (Streak).
2.  **Interações de Usuário:** Prioridade máxima para comandos `/buddy`, easter eggs (Konami Code) e modo Stoneage.
3.  **Varredura de Resultados (Tool Results):** O Observer agora varre apenas os últimos 10 eventos (`messages.slice(-10)`) buscando falhas (`isError` ou saídas Bash indicando falha).
4.  **Reação de Feedback:** Se o `feedbackResult` for detectado, o Buddy gera uma resposta personalizada de `undo` ou `correction`.
5.  **Consciência de Git (Ambiental):**
    *   Verifica passivamente o estado do Git via `execSync`.
    *   *Aviso de Staging:* Alerta se existirem > 10 arquivos não commitados.
    *   *Aviso de Sync:* Alerta se o repositório local estiver > 5 commits atrás da branch remota.

---

## 6. Correções de Segurança e UI

*   **CLI Rendering (`src/entrypoints/cli.tsx`):**
    *   Resolvido um artefato visual em que o logo inicial do OpenClaude desaparecia repentinamente ao carregar o modo de tela alternativo (`alternate screen`).
*   **Dependências de Segurança (`package.json` & `bun.lock`):**
    *   Update da biblioteca `ws`.
    *   Override de versão para a biblioteca `uuid` devido a reportes de segurança.

---

## 7. Referência Rápida da API (Internal)

| Função | Arquivo Origem | Papel no Sistema |
| :--- | :--- | :--- |
| `getFeedbackTip(premium, context, signal)` | `skills.ts` | Retorna uma string de dica baseada no histórico de feedback do usuário. |
| `getMood()` | `mood.ts` | Avalia estatísticas e memória para retornar um objeto `BuddyMood` (emoji, texto, estado). |
| `grantXp(companionName, amount)` | `observer.ts` | Adiciona XP e verifica transições de nível. |
| `incrementStat(statName)` | `observer.ts` | Atualiza contadores globais (bashes, erros, tasks). |
| `notifyFeedbackConfirm(buddyName)` | `observer.ts` | Injeta os efeitos de confirmação (+2 XP) e reações textuais. |