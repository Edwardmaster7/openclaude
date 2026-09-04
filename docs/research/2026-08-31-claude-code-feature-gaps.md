# Gaps de features entre o Claude Code oficial e o OpenClaude (2026-08-31)

## Metodologia

Esta pesquisa compara o Claude Code oficial da Anthropic (o produto real, closed-source, distribuído via `@anthropic-ai/claude-code` / `claude.ai/code`) com o estado atual deste repositório (`@gitlawb/openclaude`, branch `merge/upstream-sync`, HEAD em `56237bf4`, último sync de upstream em `912f1b82` — "merge: sync upstream/main (91 commits)", datado do próprio dia da pesquisa).

**Fontes primárias consultadas (lado Claude Code oficial):**
- `https://code.claude.com/docs/en/overview` (a antiga URL `docs.claude.com/en/docs/claude-code/overview` faz 301 para este domínio)
- `https://code.claude.com/docs/en/sandboxing`
- `https://code.claude.com/docs/en/checkpointing`
- `https://code.claude.com/docs/en/github-actions`
- `https://code.claude.com/docs/en/hooks`

**Fontes primárias consultadas (lado OpenClaude):** leitura direta do código-fonte em `src/`, `docs/`, `package.json`, `.github/workflows/`, `vscode-extension/`, `CHANGELOG.md` e histórico git — não houve inferência sem checar o arquivo real.

**Achado estrutural importante, que molda toda a análise:** este não é um "clone" que reimplementa a UX do Claude Code do zero. É um fork que sincroniza literalmente o código-fonte real do Claude Code (comentários internos com nomes de engenheiros da Anthropic, nomes de feature flags internas como `tengu_harbor`, `tengu_harbor_ledger`, dependências reais como `@anthropic-ai/sandbox-runtime`, `@anthropic-ai/sdk`, `@anthropic-ai/bedrock-sdk` no `package.json`) e adiciona por cima o roteamento multi-provider. Por isso, a paridade de features client-side é **muito alta** — recursos como `/rewind` (checkpointing), sandbox de Bash via Seatbelt/Landlock, subagents, skills, plugins, output styles, hooks e MCP já existem quase 1:1 com o produto oficial e **não entraram nesta lista de gaps**.

Os gaps genuínos encontrados caem em duas categorias:
1. **Infraestrutura hospedada pela Anthropic** que o código cliente referencia mas que não tem como funcionar sem os serviços da Anthropic (contas `claude.ai`, GitHub App oficial, Slack App oficial, GrowthBook — o serviço interno de feature flags da Anthropic que vários trechos do código consultam via `getFeatureValue_CACHED_MAY_BE_STALE`, e que por padrão retorna `false`/desabilitado para qualquer instalação fora da Anthropic).
2. **Superfícies de produto que a Anthropic distribui separadamente** (apps nativos, plugins de IDE, GitHub Action publicada) que o OpenClaude não empacota nem publica, mesmo tendo parte do código de suporte.

**Ressalva:** "faltando" é julgado contra o estado do branch atual (`merge/upstream-sync`) nesta data. Dado o ritmo de sync com upstream, alguns destes gaps podem já estar sendo trabalhados.

---

## Tabela-resumo

| Feature | Complexidade | Viabilidade | Reaproveitamento | Prioridade recomendada |
|---|---|---|---|---|
| Channels (Telegram/Discord/iMessage/webhooks → sessão) | S | Alta (gate é do próprio OpenClaude decidir) | Muito alta | **1 — quick win** |
| GitHub Actions multi-provider (`@claude` em CI, não só Anthropic) | M | Alta | Alta | **2** |
| GitLab CI/CD | M | Alta | Alta | 3 |
| App desktop nativo | L | Alta | Alta | 4 |
| Plugin JetBrains | M | Alta | Média | 5 |
| Routines na nuvem (cron que roda com a máquina desligada) | L–XL | Média | Alta | 6 |
| Claude Code on the web (sessões hospedadas em `claude.ai/code`) | XL | Baixa–Média | Média | 7 |
| Code Review automático via GitHub App / Slack "Claude Tag" | XL | Baixa | Média | 8 |

---

## 1. Channels — mensagens de Telegram/Discord/iMessage/webhooks empurradas para a sessão

**Claude Code oficial:** a página de overview lista, na tabela "Use Claude Code everywhere": *"Push events from Telegram, Discord, iMessage, or my own webhooks into a session → Channels"*, apontando para `/docs/en/channels` (`https://code.claude.com/docs/en/overview`).

**Estado no OpenClaude:** o recurso está **implementado quase por completo** em `src/services/mcp/channelNotification.ts` e `src/services/mcp/channelPermissions.ts` — o mecanismo de notificação MCP `notifications/claude/channel`, o parsing de aprovações de permissão vindas de um canal externo, tudo presente. Mas o próprio código documenta por que está morto em produção:

```
feature('KAIROS') || feature('KAIROS_CHANNELS'). Runtime gate tengu_harbor.
Requires claude.ai OAuth auth — API key users are blocked until
console gets a channelsEnabled admin surface.
```

E em `src/services/mcp/channelAllowlist.ts`, `isChannelsEnabled()` lê a flag `tengu_harbor` do GrowthBook (serviço de feature flag da própria Anthropic) com default `false`.

**Complexidade:** S — o "trabalho difícil" (protocolo, parsing, UI de permissão, race entre canal/bridge/hooks) já está escrito e testado.

**Viabilidade:** Alta para o OpenClaude especificamente, porque o gate (`tengu_harbor`) e a exigência de OAuth `claude.ai` são decisões da Anthropic para o *próprio* produto dela — nada impede o OpenClaude de substituir esse gate por uma flag local em `settings.json` e permitir habilitar channels também com chaves de API/outros providers, já que a lógica de canal em si (MCP server externo empurrando mensagens) não depende de o modelo por trás ser Claude.

**Reaproveitamento:** muito alto — é essencialmente "trocar o portão", não construir a casa. Falta escrever (ou empacotar) os próprios MCP servers de canal (bot do Telegram, bot do Discord etc.), que são triviais dado o protocolo já implementado.

---

## 2. GitHub Actions multi-provider (equivalente ao `claude-code-action` mas roteado pelos providers do OpenClaude)

**Claude Code oficial:** `https://code.claude.com/docs/en/github-actions` descreve o `anthropics/claude-code-action`, instalável via `/install-github-app` (setup automático: GitHub App + secret `ANTHROPIC_API_KEY`/`CLAUDE_CODE_OAUTH_TOKEN` + workflow YAML), respondendo a menções `@claude` em issues/PRs e rodando em modo automação (`prompt` input, ex. cron).

**Estado no OpenClaude:** o comando `/install-github-app` **existe** (`src/commands/install-github-app/`, com passos completos: `OAuthFlowStep.tsx`, `ApiKeyStep.tsx`, `InstallAppStep.tsx`, `setupGitHubActions.ts`). Porém, ele configura o repositório para usar a Action real da Anthropic: `setupGitHubActions.ts` referencia literalmente `https://github.com/anthropics/claude-code-action` como o workflow instalado. Ou seja, a automação em CI do OpenClaude, tal como está, só roda com uma `ANTHROPIC_API_KEY`/token real — não há uma Action publicada que rode `openclaude` com OpenAI/Gemini/Ollama/etc. em CI.

**Complexidade:** M — o modo headless (`-p`) e o roteamento multi-provider já existem no CLI (usados localmente); "só" falta empacotar um `action.yml`/Docker action fina que invoca `openclaude -p` dentro do runner do GitHub, e adaptar `setupGitHubActions.ts` para gerar um workflow que referencie essa action (com o secret do provider escolhido, não fixo em `ANTHROPIC_API_KEY`).

**Viabilidade:** Alta — nenhuma dependência de infraestrutura da Anthropic; é puro empacotamento de CI.

**Reaproveitamento:** Alto — CLI headless, motor de roteamento de provider, e a própria UX de `/install-github-app` (steps de OAuth/API key, criação de PR de setup) já existem; o trabalho é majoritariamente wrapping.

---

## 3. GitLab CI/CD

**Claude Code oficial:** a tabela de overview lista "Automate PR reviews and issue triage → GitHub Actions or GitLab CI/CD" (link `/docs/en/gitlab-ci-cd`), indicando doc dedicada para pipelines GitLab.

**Estado no OpenClaude:** não encontrado. A única menção a "gitlab" no código é um comentário de skip em `src/skills/bundled/scheduleRemoteAgents.ts` ("Non-github.com hosts (GHE/GitLab/etc.): silently skip"), confirmando que hosts GitLab são explicitamente ignorados por essa automação, não suportados.

**Complexidade:** M — mesma base do item 2 (modo headless `-p`), mas com um template `.gitlab-ci.yml` e possivelmente um wrapper de imagem Docker.

**Viabilidade:** Alta — sem dependência de serviços proprietários da Anthropic.

**Reaproveitamento:** Alto — mesmíssima base do CLI headless do item 2; poderia nascer do mesmo esforço.

---

## 4. App desktop nativo

**Claude Code oficial:** a aba "Desktop app" do overview descreve um app standalone para macOS/Windows/Linux(beta via apt), com "review diffs visualmente, rodar múltiplas sessões lado a lado, agendar tarefas recorrentes, e iniciar sessões na nuvem", te tab `/docs/en/desktop`, `/docs/en/desktop-quickstart`.

**Estado no OpenClaude:** não encontrado nenhum app desktop empacotado. Não há dependência `electron` em `package.json`, nem diretório `desktop/` no repo top-level. O único resquício de código é `src/utils/desktopDeepLink.ts`, que trata deep-links (`openclaude://...`) mas pressupõe a existência de um app que os receba — não há esse app.

**Complexidade:** L — construir/empacotar um shell desktop (Electron ou Tauri), reaproveitando a UI existente e o backend de sessão, mais o trabalho de assinatura/distribuição multi-plataforma.

**Viabilidade:** Alta — 100% client-side, sem dependência de infraestrutura Anthropic; o próprio `grpc-server` (`docs/grpc-server.md`, `src/grpc/server.ts`) e o mecanismo de bridge/remote já fornecem o "motor" que um app desktop chamaria.

**Reaproveitamento:** Alto — `src/grpc`, `src/server`, `src/bridge`, `src/remote` e a UI Ink existente cobrem quase toda a lógica de sessão; falta a casca visual nativa e o empacotamento (instaladores, auto-update).

---

## 5. Plugin JetBrains

**Claude Code oficial:** aba "JetBrains" do overview — plugin para IntelliJ IDEA, PyCharm, WebStorm etc., com "interactive diff viewing and selection context sharing", distribuído via JetBrains Marketplace (`/docs/en/jetbrains`).

**Estado no OpenClaude:** só existe `vscode-extension/openclaude-vscode` — uma extensão VS Code própria e mais simples ("Practical VS Code companion... project-aware launch, Control Center... chat", `publisher: devnull-bootloader`), não uma extensão que espelha a rica integração oficial (nem sequer JetBrains). `src/utils/jetbrains.ts` existe, mas é apenas detecção de ambiente (para saber se está rodando dentro de um IDE JetBrains), não um plugin publicado.

**Complexidade:** M — protocolo de IDE (`src/utils/ide.ts`, `useIDEIntegration.tsx`) já existe do lado do CLI; falta escrever o plugin Kotlin/Java do lado da IDE e publicá-lo no Marketplace.

**Viabilidade:** Alta — sem amarras a infraestrutura Anthropic.

**Reaproveitamento:** Médio — o protocolo de comunicação CLI↔IDE já está pronto (o mesmo usado pela detecção `jetbrains.ts`/`ide.ts`); o trabalho novo é majoritariamente no lado do plugin da IDE em si.

---

## 6. Routines na nuvem (cron que sobrevive à máquina desligada)

**Claude Code oficial:** overview: *"Routines run in the cloud, so they keep running even when your computer is off. They can also trigger on API calls or GitHub events."* (`/docs/en/routines`), distinto de "Desktop scheduled tasks" (roda local) e `/loop` (repete dentro da própria sessão CLI).

**Estado no OpenClaude:** `src/tools/ScheduleCronTool/` (`CronCreateTool.ts`, `CronDeleteTool.ts`, `CronListTool.ts`) implementa agendamento cron, mas é local ao processo/host: por padrão em memória ("dies when this Claude session ends"), e mesmo o modo `durable: true` só persiste em `.openclaude/scheduled_tasks.json` — ainda depende de o host continuar rodando o processo do OpenClaude para disparar o gatilho. Não há um worker hospedado que dispare a tarefa com a máquina do usuário desligada.

**Complexidade:** L–XL — para paridade completa (serviço sempre ativo, multi-tenant, disparo por eventos do GitHub/API) seria um produto de infraestrutura novo; um MVP self-hosted (rodar o `daemon`/`self-hosted-runner` num servidor próprio do usuário) é bem mais barato.

**Viabilidade:** Média — plenamente possível de forma *self-hosted* (o usuário roda o worker em um servidor próprio), mas uma oferta "cloud" multi-tenant como a da Anthropic exigiria o OpenClaude operar sua própria infraestrutura hospedada, o que foge do modelo BYOK do projeto.

**Reaproveitamento:** Alto — `src/self-hosted-runner/main.ts`, `src/environment-runner/main.ts` e `src/daemon/` (processo sempre-ativo, `workerRegistry.ts`) já fornecem boa parte do desenho de "worker que roda tarefas fora de uma sessão interativa"; o `ScheduleCronTool` já tem o parsing/agendamento cron pronto.

---

## 7. Claude Code on the web (sessões hospedadas em `claude.ai/code`)

**Claude Code oficial:** aba "Web" do overview: *"Run Claude Code in your browser with no local setup... work on repos you don't have locally, or run multiple tasks in parallel"*, disponível também no app mobile (`/docs/en/claude-code-on-the-web`, `/docs/en/web-quickstart`).

**Estado no OpenClaude:** não encontrado. O diretório `web/` no repositório é um site Astro (marketing/changelog/documentação — `web:dev`, `web:build` no `package.json`), não um runner de sessões na nuvem. O OpenClaude tem, sim, um mecanismo *próprio* de sessão remota (`src/remote/RemoteSessionManager.ts`, `SessionsWebSocket.ts`, `src/bridge/*`, `src/ssh/SSHSessionManager.ts`) — mas isso é para conectar a uma sessão rodando em uma máquina que o usuário já controla (via SSH/bridge), não para provisionar sandboxes efêmeros na nuvem sob demanda como o `claude.ai/code`.

**Complexidade:** XL — exige provisionamento de sandboxes de código sob demanda, isolamento entre tenants, storage, billing — um produto de infraestrutura completo.

**Viabilidade:** Baixa–Média — nada impede tecnicamente (o OpenClaude já resolve deploy/orquestração local via `grpc-server`/`daemon`), mas construir e *operar* uma versão hospedada multi-tenant é um investimento de infraestrutura e custo recorrente incompatível com o modelo atual do projeto (rodar localmente, BYOK).

**Reaproveitamento:** Médio — `src/grpc/server.ts`, `src/remote`, `src/bridge` e `src/ssh` cobrem a camada de protocolo/transporte de sessão; falta inteiramente a camada de provisionamento de sandbox efêmero na nuvem.

---

## 8. Code Review automático via GitHub App (sem workflow) e Slack "Claude Tag"

**Claude Code oficial:** `https://code.claude.com/docs/en/github-actions` cita "Code Review: automatic review on every pull request, without writing a workflow" (`/docs/en/code-review`) como produto irmão do `claude-code-action`, e a tabela de overview cita "Route bug reports from Slack to pull requests → Slack" (`/docs/en/slack`, "Claude Tag"). Ambos dependem do GitHub App oficial da Anthropic (permissões compartilhadas descritas na doc de GitHub Actions) e de um Slack App hospedado pela Anthropic.

**Estado no OpenClaude:** não encontrado um serviço hospedado equivalente. O OpenClaude tem a "inteligência" de revisão local — comandos como `src/commands/review.ts`, `src/commands/security-review.ts`, `bughunter`/`bughunter-security`/`bughunter-perf` em `src/commands/` — mas isso roda dentro de uma sessão CLI/CI já disparada pelo usuário, não como um serviço que reage automaticamente a todo PR aberto em qualquer repo instalado, nem uma integração Slack com app próprio.

**Complexidade:** XL — requer operar um serviço sempre-ativo, multi-tenant, com App próprio registrado no GitHub Marketplace e no Slack App Directory, gerenciando webhooks, autenticação e billing.

**Viabilidade:** Baixa — depende de o OpenClaude assumir o papel de operador de um serviço hospedado (algo bem diferente do modelo atual "CLI local, BYOK"); não há bloqueio de API específico da Anthropic, mas o custo operacional é alto para um projeto open-source mantido por fork.

**Reaproveitamento:** Médio — a lógica de revisão (`review.ts`, `security-review.ts`, comandos `bughunter*`) é reutilizável como "cérebro" por trás de um futuro serviço; falta toda a camada de entrega (webhook receiver, GitHub App, Slack App).

---

## Divergências notáveis (OpenClaude tem algo que o Claude Code oficial não tem)

Não exaustivo, apenas o que chamou atenção durante a exploração:

- **Roteamento multi-provider nativo** (`src/integrations/`, `docs/smart-routing.md`, `docs/agent-routing.md`): suporte a 200+ modelos (OpenAI, Gemini, DeepSeek, Ollama, xAI/Grok, MiniMax, Z.ai, AIML API etc.) com descoberta dinâmica de modelo (`discoveryService.ts`) e mapeamento de custo por provider (`cost-tracker.customPricing.test.ts`) — obviamente ausente no produto oficial, que é Anthropic-only.
- **"Buddy" — companheiro gamificado** (`src/buddy/`: `achievements.ts`, `xp-loss.ts`, `mood.ts`, `outfits.ts`, `quests.ts`, `seasonal.ts`) — um sistema de progressão/gamificação sem equivalente conhecido no Claude Code oficial.
- **Memória combinando grafo de conhecimento + "conversation arc"** (`src/memdir/`, commit `c461a036`: "merge knowledge graph + conversation arc into memdir") — parece ir além do "auto memory" simples descrito na doc oficial de `/docs/en/memory`.
- **`TeamCreateTool`/`TeamDeleteTool`** em `src/tools/`, sugerindo um modelo de "times" de agentes mais explícito do que o `sub-agents` padrão documentado oficialmente.
- **Vim mode completo** (`src/vim/motions.ts`, `operators.ts`, `textObjects.ts`) para o input do CLI.
- **Suporte a PowerShell como shell tool de primeira classe** (`src/tools/PowerShellTool/`) ao lado do Bash, além de gateways próprios de providers (`aimlapi/`, `gateways/`) documentados em `docs/aimlapi-setup.md`, `docs/litellm-setup.md`.

---

## Recomendação

**Prioridade #1: destravar Channels (item 1).** É o gap com melhor relação custo/benefício de longe — a implementação já existe quase inteira no código (protocolo MCP de canal, resolução de permissão via canal, tudo testado), e o único motivo de estar "faltando" é um `feature flag` (`tengu_harbor`) e uma exigência de auth `claude.ai` que são decisões de produto da Anthropic, não limitações técnicas. Trocar esse gate por uma opção local em `settings.json` e escrever 1-2 MCP servers de canal (ex. bot de Telegram) destrava o recurso quase por completo, e é o único item da lista classificado como complexidade S.
