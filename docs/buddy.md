🐾 OpenClaw Buddy — Documentação Completa

## Visão Geral

O Buddy é um companion virtual que vive no canto da sua tela no OpenClaw. Ele observa seu trabalho, reage a eventos, ganha XP, sobe de nível, desbloqueia habilidades, outfits, chapéus, e pode evoluir.

---

## Primeiro Uso

Execute `/buddy` pela primeira vez para chocar seu companion. Ele será gerado deterministicamente a partir do seu userId, com:

- **Espécie** — uma de 24 (duck, goose, blob, cat, dragon, octopus, owl, penguin, turtle, snail, ghost, axolotl, capybara, cactus, robot, rabbit, mushroom, chonk, lion, crab, bear, ufo, sprout, bat)
- **Raridade** — common (60%), uncommon (25%), rare (10%), epic (4%), legendary (1%)
- **Olhos** — um de 6 estilos (·, ✦, ×, ◉, @, °)
- **Personalidade** — uma de 5
- **Nome** — gerado deterministicamente (ex: "Bytebud", "Echobit", "Glintspark")

---

## Sistema de XP

### Fontes de XP

| Ação           | XP      | Detalhes                                         |
| ---------------- | ------- | ------------------------------------------------ |
| Bash com sucesso | +0.1    | Cada comando que roda sem erro                   |
| Read (leitura)   | +0.1    | Arquivos lidos (Read, MCP resources, list)       |
| Write (escrita)  | +0.1    | Arquivos criados (Write, NotebookEdit)           |
| Edit (edição)  | +0.1    | Arquivos editados (Edit)                         |
| Search (busca)   | +0.1    | Buscas realizadas (Grep, Glob, WebSearch, etc)   |
| Pet diário      | +1      | Primeiro `/buddy` do dia                       |
| Task concluída  | +3      | Quando o assistente completa um TaskUpdate       |
| Alimentar        | +0.5    | `/buddy alimentar` (cooldown: 1h)              |
| Hidratei         | +0.5    | `/buddy hidratei` (cooldown: 1h)               |
| Quests Diárias  | +1 a +5 | Completar missões listadas em `/buddy quests` |
| Brincar          | +0.5    | `/buddy brincar` (cooldown: 1h)                |
| Feedback confirm | +2      | `/feedback confirm` — consolida aprendizado   |
| Stoneage ativado | +0.5    | Cada ativação do modo stoneage                 |
| Streak 3 dias    | +0.5    | Bônus por 3 dias seguidos                       |
| Streak 7 dias    | +1      | Bônus por 7 dias seguidos                       |
| Streak 14 dias   | +2      | Bônus por 14 dias seguidos                      |
| Streak 30 dias   | +3      | Bônus por 30 dias seguidos                      |
| Easter egg       | +3~+20  | Vários tipos (ver seção Easter Eggs)          |

### Níveis e Chapéus

| Nível | XP necessário | Chapéu   | Status                            |
| ------ | -------------- | --------- | --------------------------------- |
| 1      | 0              | —        | "Aprendendo o fluxo de trabalho." |
| 2      | 5              | beanie    | "Gostando do progresso!"          |
| 3      | 25             | propeller | "Trabalhando duro!"               |
| 4      | 50             | tophat    | "Cozinhando código!"             |
| 5      | 80             | wizard    | "Dominou as artes!"               |
| 6      | 120            | pirate    | "Navegando os mares!"             |
| 7      | 170            | halo      | "Angelical!"                      |
| 8      | 230            | tinyduck  | "Tem um amiguinho!"               |
| 9      | 300            | chef      | "Mestre-cuca!"                    |
| 10     | 400            | crown     | "Lendário!"                      |

### Custo de XP

| Ação               | Custo | Requisito           |
| -------------------- | ----- | ------------------- |
| Renomear             | 5 XP  | Level 2+            |
| Rerrolar             | 15 XP | —                  |
| Pet Premium          | 1 XP  | —                  |
| Equipar Outfit       | 2 XP  | Outfit desbloqueado |
| Evoluir              | 50 XP | Level 5+            |
| Evoluir (meia-noite) | 40 XP | Level 5+            |

---

## Comandos

### `/buddy` (sem argumentos)

- **Primeira vez:** Choca um novo companion
- **Depois:** Acaricia o companion (+1 XP diário, streak, easter egg, outfits)

### `/buddy status`

Mostra informações do companion:

- Nome, espécie, raridade, tier de evolução
- Nível e XP
- Estado (ouvindo/silenciado)
- Personalidade
- Humor (dinâmico)
- Modo premium (se ativo)
- Evolução (se aplicável)

### `/buddy stats`

Mostra estatísticas detalhadas:

- Nível e XP atual
- Streak de dias seguidos
- Total de comandos bash executados
- Total de tasks concluídas
- Total de erros encontrados
- Total de leituras (Read) realizadas
- Total de escritas (Write) realizadas
- Total de edições (Edit) realizadas
- Total de buscas (Search) realizadas
- Total de pets recebidos
- Dias ativos
- Tokens economizados (stoneage)
- Regras de feedback aprendidas
- Confirmações de feedback

### `/buddy rename <nome>`

Renomeia o companion.

- **Custo:** 5 XP
- **Requisito:** Level 2+
- **Limite:** 1-30 caracteres

### `/buddy reroll`

Muda a aparência do companion (espécie, olhos, stats).

- **Custo:** 15 XP

### `/buddy brincar`

Brinca com o companion. Reações divertidas.

- **XP:** +0.5
- **Cooldown:** 1 hora

### `/buddy alimentar`

Alimenta o companion.

- **XP:** +0.5
- **Cooldown:** 1 hora

### `/buddy pet premium`

Ativa o modo premium por 1 hora.

- **Custo:** 1 XP
- **Efeito:** Code Review com 98% de chance (normal: 75%), Dicas de Erro com 98% (normal: 85%)
- **Cooldown:** 1 hora (não acumula)
- **Visual:** Emoji 🔥/⭐ alternando, mood premium

### `/buddy outfit <nome>`

Equipa um outfit com custo de XP.

- **Custo:** 2 XP
- **Requisito:** Outfit desbloqueado
- **Diferença do equipar:** Custo de XP adicional

### `/buddy evolve`

Evolui o companion para a próxima espécie na cadeia de evolução.

- **Custo:** 50 XP (40 XP à meia-noite)
- **Requisito:** Level 5+
- **Animação:** Sprite pisca por 3 segundos
- **Ver seção Evolução para cadeias**

### `/buddy hidratei`

Avisa que você se hidratou e arrumou a postura! O buddy comemora com você e fica temporariamente com o humor "Refrescado".

- **XP:** +0.5
- **Cooldown:** 1 hora

### `/buddy quests`

Mostra o painel com as suas 3 missões diárias. Cada missão garante um bônus de XP após concluída.

### `/buddy resumo`

Mostra um resumo da sessão atual.

- **Requisito:** Level 4+

### `/buddy lembrar <minutos> <texto>`

Define um lembrete. O companion te avisa quando o tempo acabar.

- **Tempo:** 1 a 1440 minutos (24h)
- **Exemplo:** `/buddy lembrar 10 revisar PR`

### `/buddy memorias`

Mostra as memórias do companion (eventos marcantes).

### `/buddy journal`

Mostra o diário de hoje com estatísticas da sessão.

### `/buddy achievements` / `/buddy conquistas`

Mostra todas as conquistas com status desbloqueado/bloqueado.

### `/buddy requisitos`

Mostra o progresso de outfits e chapéus (requisitos e status).

### `/buddy outfits`

Mostra os outfits disponíveis, desbloqueados e equipados.

### `/buddy equipar <nome>`

Equipa um outfit desbloqueado (sem custo de XP).

### `/buddy mute` / `/buddy unmute`

Silencia ou reativa as reações do companion.

### `/buddy compact` / `/buddy decompact`

Ativa ou desativa o modo compacto do sprite.

- **Compacto:** Mostra apenas a face do companion (1 linha) na barra inferior
- **Completo:** Mostra o sprite inteiro (24x10) quando o terminal tiver 120+ colunas
- **Padrão:** Comportamento baseado na largura do terminal (compacto se < 120 cols)

### `/buddy preview`

Mostra todas as 24 espécies com seus 3 frames de animação lado a lado.

### `/buddy help`

Mostra a ajuda com todos os comandos.

---

## Sistema de Evolução

O companion pode evoluir para uma forma mais forte. Existem 8 cadeias de evolução:

| Tier 1  | Tier 2   | Tier 3  | Tema                        |
| ------- | -------- | ------- | --------------------------- |
| duck    | goose    | dragon  | Aves da Fúria              |
| cat     | chonk    | lion    | A Realeza Felina            |
| snail   | turtle   | crab    | Esquadrão da Carapaça     |
| rabbit  | capybara | bear    | Os Peludos da Paz           |
| penguin | axolotl  | octopus | Profundezas Aquáticas      |
| blob    | robot    | ufo     | Vida Artificial             |
| sprout  | mushroom | cactus  | Botânica de Sobrevivência |
| bat     | owl      | ghost   | Criaturas da Noite          |

**Requisitos:** Level 5+, 50 XP
**Especial:** À meia-noite (00:00-01:00), custa apenas 40 XP

---

## Sistema de Mood

O humor do companion é dinâmico e muda baseado na sua atividade:

| Prioridade | Humor         | Condição                               |
| ---------- | ------------- | ---------------------------------------- |
| 1          | 🔥/⭐ Premium | Modo premium ativo                       |
| 2          | 🧊 Refrescado | Reportou hidratação nos últimos 30min |
| 3          | 😴 Sonolento  | Não fez pet hoje                        |
| 4          | 🧠 Orgulhoso  | Score médio de feedback >= 80           |
| 5          | 🤔 Preocupado | Score médio de feedback < 40            |
| 6          | 📝 Neutro     | Sem regras de feedback aprendidas        |
| 7          | 😟 Preocupado | Taxa de erro > 40%                       |
| 8          | 🤩 Empolgado  | Múltiplo de 10 tasks concluídas        |
| 9          | 😤 Orgulhoso  | Streak >= 7 dias                         |
| 10         | 😄 Feliz      | Pet feito, sem problemas                 |

> **Nota:** Os moods de feedback (prioridades 3-5) têm prioridade sobre error rate e task milestones. Se o buddy tiver regras de feedback consolidadas (score alto), ele fica orgulhoso. Se tiver regras esquecidas (score baixo), fica preocupado.

---

## Sistema de Outfits

Outfits são skins visuais com efeitos profundos (cor, olhos, símbolos, linhas extras, dim, blink).

### Outfits Disponíveis (13)

| Outfit     | Requisito                | Cor     | Olhos | Efeitos Extras            |
| ---------- | ------------------------ | ------- | ----- | ------------------------- |
| Dourado    | 100 tasks concluídas    | yellow  | ✦    | Sparkles topo + fundo     |
| Neon       | Streak de 30 dias        | cyan    | ◉    | Glow fundo                |
| Cyber      | 500 comandos bash        | green   | @     | Matrix topo + fundo       |
| Fantasma   | Streak de 7 dias         | gray    | ×    | Semi-transparente         |
| Arco-Íris | Encontrar easter egg     | magenta | ◈    | Sparkles topo             |
| Viking     | 50 tasks + streak 7 dias | red     | ◉    | Escudo topo + fundo       |
| Pixel Art  | 100h de uso              | blue    | []    | Blocos fundo              |
| Invisível | 5+ easter eggs           | gray    | ·    | Quase invisível          |
| Fogo       | Streak de 60 dias        | red     | ◉    | Chamas fundo              |
| Geladeira  | 3 projetos diferentes    | cyan    | ❄    | Gelo topo + fundo         |
| Hacker     | 1000 comandos bash       | green   | @     | Terminal topo + fundo     |
| Festivo    | Usar em dezembro         | yellow  | ★    | Confetti topo + fundo     |
| Ninja      | 20 tasks + 0 erros       | gray    | >     | Stealth, blink 3x rápido |

### Efeitos Visuais por Outfit

Cada outfit pode ter:

- **Cor** — cor do texto do sprite (sobrescreve raridade)
- **Olhos** — caractere personalizado (substitui olho do companion)
- **Símbolo** — caractere nas laterais do sprite
- **Extra Top** — linhas acima do sprite
- **Extra Bottom** — linhas abaixo do sprite
- **Dim** — sprite semi-transparente
- **Blink Speed** — velocidade de piscar (1x padrão, 3x ninja)

Para manter a cor da raridade mesmo com outfit ativo, use `keepRarityColor: true`.

---

## Sistema de Skills (Habilidades)

### Dicas em Erros (Level 2+)

Quando um bash falha, o companion pode mostrar uma dica contextual.

- **Chance:** 85% (normal), 98% (premium)
- **Lógica:** Analisa a mensagem de erro e escolhe a dica mais relevante.

#### Categorias de Diagnóstico de Erros (19)

| Categoria                           | Padrões de Texto Detectados (Regex)                                              | Exemplo de Dica do Buddy                                                                 |
| :---------------------------------- | :-------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------- |
| **Dependência**              | `cannot find module`, `module not found`, `missing dependency`, `npm err` | "Roda `npm install` ou `yarn` pra instalar as dependências."                        |
| **Arquivo**                   | `enoent`, `no such file`, `não encontrado`, `file not found`             | "Já conferiu se o arquivo existe e o caminho está correto?"                            |
| **Permissão**                | `permission`, `eacces`, `eperm`, `acesso negado`, `forbidden`           | "Pode ser permissão de arquivo. Tenta `chmod` ou `sudo`."                           |
| **Sintaxe**                   | `syntax`, `unexpected`, `parse`, `syntaxerror`                            | "Erro de sintaxe! Confere parênteses, chaves e vírgulas."                              |
| **Rede**                      | `econnrefused`, `timeout`, `fetch failed`, `socket hang up`               | "Parece ser problema de rede. O servidor tá rodando?"                                   |
| **Merge/Conflito**            | `merge conflict`, `CONFLICT`                                                  | "Conflito de merge! Abre o arquivo e resolve os marcadores `<<<<<<<`."                 |
| **Git / Repos**               | `git detached`, `not a git repository`, `nothing to commit`, `rebase`     | "Parece problema com git.`git status` mostra o estado atual."                          |
| **Build & TS**                | `build failed`, `compilation`, `type error`, `typescript`                 | "Erro de tipo! Confere os tipos das variáveis e parâmetros."                           |
| **Testes**                    | `test fail`, `assertion`, `expect`, `jest`, `vitest`                    | "Teste falhou! Lê a mensagem de erro pra entender o esperado vs atual."                 |
| **Porta em Uso**              | `port in use`, `eaddrinuse`, `address already in use`                       | "Porta já em uso!`lsof -i :<porta>` pra ver quem tá usando."                         |
| **Falta de Memória**         | `out of memory`, `heap limit`, `javascript heap`, `oom`                   | "Falta de memória! Tenta aumentar:`NODE_OPTIONS=--max-old-space-size=4096`."          |
| **Disco Cheio**               | `no space left`, `disk full`, `ENOSPC`                                      | "Disco cheio!`df -h` pra ver o uso."                                                   |
| **Variáveis de Env**         | `env not defined`, `missing env`, `dotenv`, `.env`                        | "Variável de ambiente não definida! Confere o `.env`."                               |
| **CORS**                      | `cors`, `access-control`, `blocked by cors`                                 | "Erro de CORS! Configura os headers no servidor."                                        |
| **SSL/Certificado**           | `ssl`, `certificate`, `cert`, `TLS`, `self.signed`                      | "Erro de SSL/Certificado! Confere se o cert é válido e não expirou."                  |
| **Docker**                    | `docker not found`, `cannot connect docker`, `daemon`                       | "Docker não tá rodando?`docker info` pra checar."                                    |
| **Linting**                   | `eslint`, `prettier`, `lint`                                                | "Erro de lint!`npx eslint . --fix` pra corrigir auto."                                 |
| **Banco de Dados** _(Nova)_ | `postgres`, `psql`, `mongodb`, `redis`, `sqlite`, `prisma`            | "Erro de banco de dados! O serviço do PostgreSQL/MongoDB/Redis tá rodando localmente?" |
| **CI/CD & Deploy** _(Nova)_ | `action`, `workflow`, `pipeline`, `job`, `vercel`, `netlify`          | "O deploy falhou no pipeline! Confere o log completo da action ou da plataforma."        |

---

### Dicas de Feedback (Level 2+)

Quando uma correção ou erro de ferramenta é detectado, o companion pode sugerir uma regra de feedback aprendida.

- **Chance:** 60% (normal), 85% (premium)
- **Lógica:** Carrega regras de feedback da memória (score >= 20, não ignoradas) e faz match por keywords do contexto
- **Exemplo:** "💡 Regra aprendida: Use vitest para testes unitários neste projeto"

---

### Code Review Buddy (Level 2+)

Após um bash bem-sucedido, o companion pode sugerir melhorias.

- **Chance:** 75% (normal), 98% (premium)
- **Lógica:** Analisa o comando executado e sugere boas práticas.

#### Categorias de Revisão de Código e Comandos (19)

| Categoria                           | Padrões de Comando Correspondidos (Regex)                                   | Exemplo de Sugestão / Boas Práticas                                                        |
| :---------------------------------- | :--------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------- |
| **Banco de Dados** _(Nova)_ | `prisma`, `migrate`, `psql`, `mongosh`, `redis-cli`, `sequelize` | "Sempre faça backup do banco de dados de produção antes de rodar migrations destrutivas!" |
| **Frontend & Dev** _(Nova)_ | `vite`, `next`, `astro`, `webpack`, `npm run dev`, `bun dev`     | "Para imagens mais rápidas e otimizadas, prefira formatos modernos como WebP ou AVIF."      |
| **Lint & Formato** _(Nova)_ | `eslint`, `prettier`, `lint`                                           | "Prettier garante formatação consistente. Configure o VS Code para 'Format on Save'."      |
| **Git Add/Commit/Push**       | `git add`, `git commit`, `git push`                                    | "Antes de commitar, roda `git diff --cached` pra ver o que tá staged."                    |
| **Git Branch**                | `git checkout`, `git switch`, `git branch`                             | "Conferiu se tá no branch certo antes de começar?"                                         |
| **Git Pull/Fetch/Rebase**     | `git pull`, `git fetch`, `git rebase`                                  | "Pull com rebase mantém histórico linear:`git pull --rebase`."                           |
| **Instalação de Pacotes**   | `npm install`, `yarn add`, `pnpm add`, `bun add`                     | "Conferiu se a versão do pacote é compatível com o projeto?"                              |
| **Build do Projeto**          | `npm run build`, `yarn build`, `make`                                  | "Se o build passou, que tal rodar os testes antes de commitar?"                              |
| **Execução de Testes**      | `npm test`, `jest`, `vitest`, `pytest`, `cargo test`               | "Se os testes passaram, tá quase pronto! Só falta revisar o diff."                         |
| **Docker & Containers**       | `docker`, `docker-compose`, `podman`                                   | "Conferiu se o Dockerfile tá otimizado com multi-stage build?"                              |
| **Exclusão de Arquivos**     | `rm -rf`, `rm -r`, `del`, `rmdir`                                    | "Cuidado com `rm -rf`! Confere o caminho antes de rodar."                                  |
| **Requisições de Rede**     | `curl`, `wget`, `fetch`                                                | "Conferiu se a URL é HTTPS e não HTTP?"                                                    |
| **Permissões & Admin**       | `chmod`, `chown`, `sudo`                                               | "Cuidado com `sudo`! Tem certeza que precisa de privilégios de admin?"                    |
| **Gestão de Pastas**         | `cd `, `mkdir`, `cp `, `mv `                                         | "`mkdir -p` cria diretórios pai sem erro se já existirem."                               |
| **Execução Node/TS**        | `npx`, `node `, `ts-node`, `tsx`                                     | "ts-node vs tsx: tsx é mais rápido pra scripts, ts-node pra debug."                        |
| **Dependências Python**      | `pip install`, `poetry`, `pipenv`                                      | "Usa virtualenv pra isolar dependências Python."                                            |
| **Rust & Cargo**              | `cargo`, `rustc`                                                         | "Clippy (`cargo clippy`) pega patterns inseguros que o compilador ignora."                 |
| **Linguagem Go**              | `go run`, `go build`, `go test`, `go mod`                            | "Go mod tidy limpa dependências não usadas."                                               |
| **GitHub CLI**                | `gh pr`, `gh issue`, `gh repo`                                         | "PR pronto? Confere se CI tá verde antes de pedir review."                                  |

### Resumo da Sessão (Level 4+)

`/buddy resumo` mostra estatísticas da sessão atual.

### Sugestões de Próximo Passo (Level 6)

O companion sugere o que fazer depois.

---

## Easter Eggs (7 tipos)

| Easter Egg      | Trigger                                      | Recompensa       | Frequência |
| --------------- | -------------------------------------------- | ---------------- | ----------- |
| Konami Code     | Digitar `upupdowndownleftrightleftrightba` | +10 XP           | One-time    |
| Shiny Bug       | 0.5% de chance no pet                        | +5 XP            | Infinito    |
| Resposta 42     | Mensagem termina com "42" isolado            | +3 XP            | Infinito    |
| Midnight Hatch  | Nascer entre 00:00-01:00                     | Ghost + olhos ✦ | One-time    |
| Loop Infinito   | Mesmo bash falha 3x seguidas                 | +2 XP            | Infinito    |
| Double Rainbow  | Shiny + outfit arco-íris                    | +20 XP           | Infinito    |
| Midnight Evolve | Evoluir entre 00:00-01:00                    | -10 XP no custo  | Infinito    |

---

## Conquistas (28)

| Emoji | Conquista            | Descrição                   | Condição     |
| ----- | -------------------- | ----------------------------- | -------------- |
| 🎯    | Primeiro Commit      | Primeiro comando bash         | 1 bash         |
| 🏃    | Maratonista          | 100 comandos bash             | 100 bashes     |
| 🏅    | Maratonista de Elite | 1000 comandos bash            | 1000 bashes    |
| 🐛    | Bug Hunter           | 20 erros                      | 20 erros       |
| ⚔️  | Bug Slayer           | 100 erros                     | 100 erros      |
| ✅    | Task Master          | 50 tasks                      | 50 tasks       |
| 🏆    | Task Legend          | 200 tasks                     | 200 tasks      |
| 🔥    | Streak Warrior       | Streak de 30 dias             | 30 dias        |
| 💎    | Streak Obsessed      | Streak de 90 dias             | 90 dias        |
| ❤️  | Pet Lover            | 100 pets                      | 100 pets       |
| 💖    | Pet Addict           | 500 pets                      | 500 pets       |
| 🧬    | Evolver              | Evoluir o buddy               | 1 evolução   |
| 🎮    | Konami Master        | Ativar Konami Code            | 1 konami       |
| 👗    | Fashionista          | 5 outfits desbloqueados       | 5 outfits      |
| 👑    | Fashion King         | 10 outfits desbloqueados      | 10 outfits     |
| 👑    | Lendário            | Level 10                      | 400 XP         |
| 🥚    | Easter Hunter        | 3 easter eggs diferentes      | 3 triggers     |
| 🦉    | Night Owl            | Usar à meia-noite            | midnightEvolve |
| 🌈    | Rainbow Warrior      | Double Rainbow                | doubleRainbow  |
| ⭐    | Premium User         | Modo premium                  | petPremium     |
| 🔍    | Code Reviewer        | 50+ comandos bash             | 50 bashes      |
| 🪨    | Primeiro Contato     | Ativar stoneage               | 1 ativação   |
| 🔥    | Economia de Fogo     | 1000 tokens economizados      | 1000 tokens    |
| 🦣    | Mamute de Ouro       | 10000 tokens economizados     | 10000 tokens   |
| ⛏️  | Mestre das Pedras    | 50 ativações stoneage       | 25000 tokens   |
| 📚    | Aprendiz             | 5 confirmações de feedback  | 5 confirms     |
| 🎓    | Mestre               | 15 confirmações de feedback | 15 confirms    |
| 🧙    | Sábio               | 30 confirmações de feedback | 30 confirms    |

---

## Eventos Sazonais

O companion reage a datas especiais com mensagens temáticas:

| Evento             | Data      | Emoji | Mensagens                             |
| ------------------ | --------- | ----- | ------------------------------------- |
| Natal              | 25/12     | 🎄    | 5 frases (inclui "Jesus é o motivo") |
| Réveillon         | 31/12     | 🎆    | 5 frases (ano dinâmico)              |
| Carnaval           | Variável | 🎭    | 5 frases (data calculada via Páscoa) |
| Halloween          | 31/10     | 🎃    | 5 frases                              |
| Dia do Programador | 13/09     | 💻    | 5 frases                              |
| Dia dos Namorados  | 12/06     | 💕    | 5 frases                              |
| Páscoa            | Variável | 🐰    | 5 frases (data calculada via Páscoa) |

---

## Memórias

O companion lembra de eventos importantes (16 triggers):

| Trigger        | Quando                             |
| -------------- | ---------------------------------- |
| firstLevelUp   | Primeiro level up                  |
| streak7        | Streak de 7 dias                   |
| streak30       | Streak de 30 dias                  |
| bashes100      | 100 comandos bash                  |
| tasks50        | 50 tasks                           |
| easterEgg      | Shiny bug encontrado               |
| reroll         | Reroll feito                       |
| rename         | Rename feito                       |
| evolve         | Evolução                         |
| konami         | Konami Code ativado                |
| petPremium     | Modo premium ativado               |
| doubleRainbow  | Double Rainbow                     |
| midnightEvolve | Evolução à meia-noite           |
| loopInfinite   | Loop infinito detectado            |
| answer42       | Resposta 42 encontrada             |
| stoneageFirst  | Stoneage ativado pela primeira vez |

Máximo de 20 memórias (FIFO — as mais antigas saem).

---

## Diário

O companion mantém um diário automático com estatísticas do dia:

- Tasks concluídas
- Comandos executados
- Erros encontrados
- XP total
- Streak
- Eventos do dia (memórias)

**Comando:** `/buddy journal`

---

## Reações do Observer

O companion reage automaticamente a eventos. Após cada turno do query loop, o observer analisa as mensagens do turno atual (passando apenas as novas mensagens, não o histórico completo) para detectar tool results, tasks concluídas, erros e categorias de ferramentas.

| Evento               | Reação                                                 |
| -------------------- | -------------------------------------------------------- |
| Bash com sucesso     | +0.1 XP + 20% chance de reação + Code Review (75%)     |
| Bash com erro        | +1 erro + reação + dica contextual (85%, 98% premium)  |
| Read (leitura)       | +0.1 XP + 1 leitura                                      |
| Write (escrita)      | +0.1 XP + 1 escrita                                      |
| Edit (edição)      | +0.1 XP + 1 edição                                     |
| Search (busca)       | +0.1 XP + 1 busca                                        |
| Task concluída      | +3 XP + reação de celebração                         |
| Feedback detectado   | Reação de aprendizado + memória + dica de regra (60%) |
| Git status           | Avisa sobre commits pendentes ou branch divergente       |
| Menciona o companion | Reage quando você fala o nome dele                      |
| Stoneage ativado     | Reação temática pré-histórica + 0.5 XP              |
| Konami Code          | Reação especial + XP                                   |
| Resposta 42          | Reação especial + XP                                   |

> **Nota técnica:** O observer usa o padrão **Reaction Candidate by Priority** — todas as estatísticas de um turno são acumuladas, mas apenas a reação de maior prioridade é emitida (task > easter42 > feedback > error > git > reviewTip > bashSuccess). O histórico completo (`allMessages`) é passado apenas para buscas de definições de ferramentas via `findToolNameForId`.

---

## Lembretes de Produtividade

O companion monitora seu trabalho e te avisa:

- **1 hora trabalhando sem parar** — sugere uma pausa para descansar os olhos
- **1 hora e 30 minutos codando** — manda um lembrete para arrumar a postura e beber água
- **15 minutos inativo** — pergunta se está travado

---

## Chapéus

### Por Nível (10)

| Chapéu   | Nível |
| --------- | ------ |
| beanie    | 2      |
| propeller | 3      |
| tophat    | 4      |
| wizard    | 5      |
| pirate    | 6      |
| halo      | 7      |
| tinyduck  | 8      |
| chef      | 9      |
| crown     | 10     |

### Por Achievement (3)

| Chapéu    | Condição            |
| ---------- | --------------------- |
| santa      | Usar no Natal (25/12) |
| party      | Aniversário do hatch |
| headphones | 500 comandos bash     |

---

## Renderização do Sprite

Cada espécie tem sprites ASCII art com **24 caracteres de largura × 10 linhas de altura**, com 3 frames de animação (idle fidget).

### Modos de Exibição

| Modo     | Condição                                   | Visual                                   |
| -------- | -------------------------------------------- | ---------------------------------------- |
| Completo | Terminal >= 120 colunas                      | Sprite 24x10 com nome e animação       |
| Compacto | Terminal < 120 colunas ou `/buddy compact` | Apenas a face (1 linha, ex:`\|°  °\|`) |

- O sprite completo aparece como **overlay flutuante** (fullscreen) ou **lado a lado** com o input (non-fullscreen)
- O modo compacto economiza espaço vertical no terminal
- Use `/buddy compact` para forçar o modo compacto em qualquer terminal
- Use `/buddy decompact` para voltar ao comportamento automático

### Placeholder de Olho

O placeholder `{E}` no código-fonte ocupa 3 caracteres mas é substituído por 1 caractere do olho do companion (ex: ·, ✦, ×, ◉, @, °). Isso permite trocar olhos sem quebrar o alinhamento do sprite.

### Slot do Chapéu

A linha 0 de cada frame é reservada para o chapéu. Se não houver chapéu e todos os frames tiverem a linha 0 vazia, ela é removida automaticamente (altura reduz de 10 para 9).

---

## Arquitetura

### Arquivos

| Arquivo                           | Função                                                       |
| --------------------------------- | -------------------------------------------------------------- |
| `src/buddy/types.ts`            | Tipos e constantes (espécies, raridades, hats)                |
| `src/buddy/companion.ts`        | Geração determinística do companion                         |
| `src/buddy/observer.ts`         | Reações a eventos do sistema                                 |
| `src/buddy/progression.ts`      | Níveis e thresholds de XP                                     |
| `src/buddy/mood.ts`             | Sistema de humor dinâmico                                     |
| `src/buddy/skills.ts`           | Habilidades desbloqueáveis (contextual)                       |
| `src/buddy/memory.ts`           | Memórias do companion (15 triggers)                           |
| `src/buddy/outfits.ts`          | Sistema de outfits (13 outfits)                                |
| `src/buddy/evolution.ts`        | Sistema de evolução (8 cadeias)                              |
| `src/buddy/easter-eggs.ts`      | Easter eggs (7 tipos)                                          |
| `src/buddy/streak.ts`           | Sistema de streak diário                                      |
| `src/buddy/reminders.ts`        | Lembretes de produtividade e customizados                      |
| `src/buddy/prompt.ts`           | Injeção no system prompt                                     |
| `src/buddy/CompanionSprite.tsx` | Renderização visual (ASCII art 24x10 + outfits)              |
| `src/buddy/quests.ts`           | Pool de Missões Diárias e gerador de rotinas                 |
| `src/buddy/sprites.ts`          | Sprites das 24 espécies (24x10, 3 frames) + estilos de outfit |
| `src/buddy/journal.ts`          | Diário do companion                                           |
| `src/buddy/seasonal.ts`         | Eventos sazonais (7 eventos)                                   |
| `src/buddy/achievements.ts`     | Conquistas (28, incluindo 4 stoneage + 3 feedback)             |
| `src/buddy/feature.ts`          | Feature flag (sempre true)                                     |
| `src/buddy/hash.ts`             | Hash compartilhado                                             |
| `src/commands/buddy/buddy.tsx`  | Handler do comando `/buddy`                                  |
| `src/commands/buddy/index.ts`   | Registro do comando                                            |

### Config Fields

```typescript
companion?: StoredCompanion          // Alma do companion
companionMuted?: boolean             // Silenciado?
companionCompact?: boolean           // Modo compacto forçado
companionLastPetDate?: string        // Último pet (data local)
companionStreakCount?: number        // Dias seguidos
companionLastStreakDate?: string     // Último streak (data local)
companionStats?: {                   // Estatísticas
  totalBashes: number
  totalTasks: number
  totalErrors: number
  totalPets: number
  daysActive: number
  totalTokensSaved: number           // Tokens economizados via stoneage
}
companionLastAction?: Record<string, number>  // Cooldowns
companionReminders?: Array<{...}>    // Lembretes customizados
companionMemory?: Array<{...}>       // Memórias
companionOutfits?: string[]          // Outfits desbloqueados
companionActiveOutfit?: string       // Outfit equipado
companionQuests?: {                  // Progresso das missões
  date: string
  completed: Record<string, boolean>
}
```

---

## Integracao Stoneage

O Buddy e integrado ao **Stoneage**, o modo de compressao de tokens do OpenClaw. Quando voce ativa o stoneage, o companion:

1. **Reage** com frases tematicas pre-historicas
2. **Ganha XP** (+0.5 por ativacao)
3. **Rastreia tokens economizados** em `/buddy stats`
4. **Desbloqueia conquistas** ao atingir milestones

### Skills Stoneage (estrutura flat em `.claude/skills/`)

| Skill             | Slash Command          | Descricao                               |
| ----------------- | ---------------------- | --------------------------------------- |
| stoneage          | `/stoneage`          | Modo de comunicacao compacto (3 niveis) |
| stoneage-commit   | `/stoneage-commit`   | Mensagens de commit ultra-compactas     |
| stoneage-review   | `/stoneage-review`   | Code review em 1 linha                  |
| stoneage-compress | `/stoneage-compress` | Comprimir arquivos .md                  |
| stoneage-stats    | `/stoneage-stats`    | Estatisticas de economia                |
| stoneage-help     | `/stoneage-help`     | Cartao de referencia                    |
| token-economy     | `/token-economy`     | Skill mestra (liga/desliga todas)       |
| answer-first      | `/answer-first`      | Respostas sem preambulo                 |
| code-only         | `/code-only`         | So o codigo                             |
| context-trim      | `/context-trim`      | Resumir tool results grandes            |
| memory-prune      | `/memory-prune`      | Limpar MEMORY.md stale                  |
| session-budget    | `/session-budget`    | Controle de gastos por sessao           |
| silent-tools      | `/silent-tools`      | Resumir output de ferramentas           |
| task-batch        | `/task-batch`        | Agrupar tool calls de tasks             |

> **Importante:** Skills ficam em `.claude/skills/<nome>/SKILL.md` (flat). Nunca aninhar em subpastas.

### Conquistas Stoneage

| Emoji | Conquista         | Descricao                         | Condicao     |
| ----- | ----------------- | --------------------------------- | ------------ |
| 🪨    | Primeiro Contato  | Ativar stoneage pela primeira vez | 1 ativacao   |
| 🔥    | Economia de Fogo  | Economizar 1000 tokens estimados  | 1000 tokens  |
| 🦣    | Mamute de Ouro    | Economizar 10000 tokens estimados | 10000 tokens |
| ⛏️  | Mestre das Pedras | Ativar stoneage 50 vezes          | 25000 tokens |

### Reacoes do Companion

Quando stoneage e ativado, o companion escolhe aleatoriamente entre:

- "Pedra afiada. Resposta menor."
- "Gravuras na caverna. Codigo compacto."
- "Fogo bom. Menos palavras, mais acao."
- "Mamute satisfeito com a economia."
- "Rodinha redonda. Tokens economizados."
- "Lascagem perfeita. Sobra so o essencial."
- "Pintura rupestre: poucos tracos, historia completa."

### Memoria

A primeira ativacao do stoneage e registrada como memoria do companion com o trigger `stoneageFirst`.

> **Documentacao completa:** [docs/stoneage.md](../docs/stoneage.md)
