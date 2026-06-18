import { getGlobalConfig } from '../utils/config.js'
import { scanMemoryFiles } from '../memdir/memoryScan.js'
import { getAutoMemPath } from '../memdir/paths.js'
import { getLevelInfo } from './progression.js'
import { createCombinedAbortSignal } from '../utils/combinedAbortSignal.js'

// ─── Error Tips (Level 2+) ──────────────────────────────────────────────────

type ErrorTipCategory = {
  patterns: RegExp[]
  tips: readonly string[]
}

const ERROR_TIP_CATEGORIES: ErrorTipCategory[] = [
  {
    patterns: [/cannot find module/i, /module not found/i, /cannot resolve/i, /missing dependency/i, /npm err/i, /yarn err/i],
    tips: [
      'Roda `npm install` ou `yarn` pra instalar as dependências.',
      'Verifica se o package.json tem a dependência listada.',
      'Tenta deletar node_modules e reinstalar: `rm -rf node_modules && npm i`.',
      'Conferiu se o lockfile tá atualizado?',
      'Se usa monorepo, verifica se o workspace link tá correto.',
      'Tenta limpar o cache: `npm cache clean --force`.',
    ],
  },
  {
    patterns: [/enoent/i, /no such file/i, /não encontrado/i, /file.*not.*found/i],
    tips: [
      'Já conferiu se o arquivo existe e o caminho está correto?',
      'Verifica se o diretório pai existe antes de criar o arquivo.',
      'Tenta usar `ls` ou `find` pra confirmar que o arquivo tá lá.',
      'As vezes é só um typo no nome do arquivo ou extensão errada.',
      'Confere se o working directory tá certo — `pwd` ajuda.',
      'Se é import relativo, verifica a depth do path (`../`).',
    ],
  },
  {
    patterns: [/permission/i, /eacces/i, /eperm/i, /acesso negado/i, /forbidden/i],
    tips: [
      'Pode ser permissão de arquivo. Tenta `chmod` ou `sudo`.',
      'Verifica se o arquivo não tá com permissão de só leitura.',
      'Se é um socket ou porta, outro processo pode estar usando.',
      'Conferiu se tem permissão de escrita no diretório?',
      'No macOS, pode ser System Integrity Protection. Checa com `csrutil status`.',
      'Se é Docker, verifica o user do container vs owner do arquivo.',
    ],
  },
  {
    patterns: [/syntax/i, /unexpected/i, /parse/i, /unexpected token/i, /syntaxerror/i],
    tips: [
      'Erro de sintaxe! Confere parênteses, chaves e vírgulas.',
      'Tenta formatar o arquivo pra achar o erro mais fácil.',
      'Verifica se não falta uma vírgula ou ponto e vírgula.',
      'As vezes é um caractere invisível. Tenta recolar o código.',
      'Se é JSON, valida com `jq . arquivo.json`.',
      'Confere se não tem trailing comma em lugar que não aceita.',
    ],
  },
  {
    patterns: [/econnrefused/i, /econnreset/i, /timeout/i, /etimedout/i, /network/i, /fetch failed/i, /socket hang up/i],
    tips: [
      'Parece ser problema de rede. O servidor tá rodando?',
      'Verifica se a URL/porta está correta.',
      'Tenta novamente — pode ser timeout temporário.',
      'Conferiu se não tem firewall bloqueando a conexão?',
      'Se é localhost, tenta `curl localhost:<porta>` pra testar.',
      'Pode ser DNS — tenta com IP direto pra isolar.',
    ],
  },
  {
    patterns: [/merge conflict/i, /CONFLICT/i],
    tips: [
      'Conflito de merge! Abre o arquivo e resolve os marcadores `<<<<<<<`.',
      'Tenta `git mergetool` pra resolver visualmente.',
      'Se quiser abortar: `git merge --abort`.',
      'Conferiu qual branch tá tentando merge?',
      'Pra ver só os arquivos com conflito: `git diff --name-only --diff-filter=U`.',
    ],
  },
  {
    patterns: [/git.*detached/i, /not a git repository/i, /nothing to commit/i, /diverge/i, /rebase/i],
    tips: [
      'Parece problema com git. `git status` mostra o estado atual.',
      'Se detached HEAD, volta com `git checkout <branch>`.',
      'Se rebase preso: `git rebase --abort` ou `git rebase --continue`.',
      'Branch divergente? `git pull --rebase` reescreve o histórico local.',
    ],
  },
  {
    patterns: [/build failed/i, /compilation/i, /type error/i, /typescript/i, /ts\d+/i],
    tips: [
      'Erro de tipo! Confere os tipos das variáveis e parâmetros.',
      'Tenta rodar `tsc --noEmit` pra ver todos os erros de uma vez.',
      'Verifica se o tsconfig.json tá configurado corretamente.',
      'As vezes é só adicionar uma checagem de null/undefined.',
      'Se é `any` implícito, confere `strict` no tsconfig.',
      'Type assertion errada? Tenta usar type guard em vez de `as`.',
    ],
  },
  {
    patterns: [/test fail/i, /assertion/i, /expect/i, /jest/i, /vitest/i, /mocha/i, /assert.*equal/i],
    tips: [
      'Teste falhou! Lê a mensagem de erro pra entender o esperado vs atual.',
      'Tenta rodar só o teste que falhou pra isolar o problema.',
      'Verifica se o mock/setup do teste tá correto.',
      'Conferiu se o teste não depende de estado de outro teste?',
      'Se é teste assíncrono, confere se tem `await` faltando.',
      'Snapshot desatualizado? `npm test -- -u` pra atualizar.',
    ],
  },
  {
    patterns: [/port.*in use/i, /eaddrinuse/i, /address already in use/i, /EACCES.*:.*\d+/i],
    tips: [
      'Porta já em uso! `lsof -i :<porta>` pra ver quem tá usando.',
      'Mata o processo: `kill -9 <PID>` ou troca a porta no config.',
      'Se é porta baixa (<1024), precisa de sudo ou use porta acima.',
      'Docker pode estar segurando a porta. `docker ps` pra checar.',
    ],
  },
  {
    patterns: [/out of memory/i, /heap.*limit/i, /javascript heap/i, /ENOMEM/i, /oom/i],
    tips: [
      'Falta de memória! Tenta aumentar: `NODE_OPTIONS=--max-old-space-size=4096`.',
      'Pode ser memory leak. Usa `--inspect` e Chrome DevTools pra analisar.',
      'Se é build grande, tenta em batches ou aumenta swap.',
      'Confere se não tá rodando muitos processos ao mesmo tempo.',
    ],
  },
  {
    patterns: [/no space left/i, /disk full/i, /ENOSPC/i],
    tips: [
      'Disco cheio! `df -h` pra ver o uso.',
      'Limpa caches: `npm cache clean --force`, `docker system prune`.',
      'Confere se não tem logs grandes: `du -sh /var/log/*`.',
      'WSL? O disco virtual pode ter limite. `wsl --shutdown` libera espaço.',
    ],
  },
  {
    patterns: [/env.*not.*defined/i, /missing.*env/i, /dotenv/i, /\.env/i, /process\.env/i],
    tips: [
      'Variável de ambiente não definida! Confere o `.env`.',
      'Se usa dotenv, verifica se `dotenv.config()` tá no início.',
      '.env não versionado? Cria `.env.example` com as chaves necessárias.',
      'Se é CI/CD, confere se as env vars tão no pipeline.',
    ],
  },
  {
    patterns: [/cors/i, /access-control/i, /blocked by cors/i],
    tips: [
      'Erro de CORS! Configura os headers no servidor.',
      'Em dev, proxy reverso resolve: `http-proxy-middleware` ou vite proxy.',
      'Confere se `Access-Control-Allow-Origin` não tá com `*` em produção.',
      'Preflight (OPTIONS) precisa retornar 200/204.',
    ],
  },
  {
    patterns: [/ssl/i, /certificate/i, /cert/i, /TLS/i, /self.signed/i, /UNABLE_TO_VERIFY/i],
    tips: [
      'Erro de SSL/Certificado! Confere se o cert é válido e não expirou.',
      'Em dev, `NODE_TLS_REJECT_UNAUTHORIZED=0` (NÃO em produção!).',
      'Se é self-signed, adiciona ao trust store: `NODE_EXTRA_CA_CERTS`.',
      'Confere se a cadeia de certificados tá completa.',
    ],
  },
  {
    patterns: [/docker.*not found/i, /cannot connect.*docker/i, /daemon/i, /docker.*error/i],
    tips: [
      'Docker não tá rodando? `docker info` pra checar.',
      'No macOS, abre o Docker Desktop ou `colima start`.',
      'Se é permissão: `sudo usermod -aG docker $USER` (re-login depois).',
      'Container não sobe? `docker logs <container>` pra ver o erro.',
    ],
  },
  {
    patterns: [/eslint/i, /prettier/i, /lint/i],
    tips: [
      'Erro de lint! `npx eslint . --fix` pra corrigir auto.',
      'Confere o `.eslintrc` / `eslint.config` pra regras conflitantes.',
      'Se é Prettier vs ESLint, usa `eslint-config-prettier` pra desabilitar overlap.',
      'Ignorar regra específica: `// eslint-disable-next-line <regra>`.',
    ],
  },
  {
    patterns: [/postgres/i, /psql/i, /mongodb/i, /redis/i, /connection refused/i, /connection reset/i, /invalid password/i, /authentication failed/i, /sqlite/i, /prisma.*error/i, /db.*error/i, /database/i],
    tips: [
      'Erro de banco de dados! O serviço do PostgreSQL/MongoDB/Redis tá rodando localmente?',
      'Confere a string de conexão (ex: `DATABASE_URL`) no seu arquivo `.env`.',
      'Usuário, senha ou nome do banco de dados incorretos? Verifica as credenciais.',
      'Se você usa migrations, já rodou `prisma migrate dev` ou similar para atualizar o schema?',
      'Erro de timeout? Pode ser sobrecarga no servidor ou alguma regra de firewall bloqueando a porta.',
    ],
  },
  {
    patterns: [/action/i, /workflow/i, /pipeline/i, /job/i, /failed job/i, /vercel/i, /netlify/i, /ci\/cd/i],
    tips: [
      'O deploy falhou no pipeline! Confere o log completo da action ou da plataforma.',
      'As variáveis de ambiente (secrets) estão devidamente configuradas nas configurações do repositório/plataforma?',
      'A versão do Node/Python no runner do CI coincide com a versão local que funciona?',
      'Se é na Vercel/Netlify, tente rodar o CLI deles localmente pra reproduzir o ambiente de build.',
    ],
  },
]

const ERROR_TIPS_GENERIC = [
  'Tenta verificar o log de erro completo antes de tentar de novo.',
  'Talvez um `git diff` ajude a ver o que mudou.',
  'As vezes rodar o comando sem pipe ajuda a isolar o erro.',
  'Verifica se tem algum arquivo de config faltando.',
  'Tenta rodar com mais verbose flags pra ver mais detalhes.',
  'Que tal um `git status` pra ver o estado atual do repositório?',
  'Se funcionava antes, tenta `git stash` e testa sem as mudanças.',
  'Googleia o erro? As vezes tem issue no GitHub com a solução.',
  'Tenta rodar num ambiente limpo — `git stash` e testa do zero.',
  'Confere se não tem dependência circular no projeto.',
] as const

// ─── Code Review Tips (50% chance, 95% premium) ────────────────────────────

type CodeReviewCategory = {
  patterns: RegExp[]
  tips: readonly string[]
}

const CODE_REVIEW_CATEGORIES: CodeReviewCategory[] = [
  {
    patterns: [/prisma/i, /migrate/i, /psql/i, /mongosh/i, /redis-cli/i, /sequelize/i, /knex/i, /typeorm/i],
    tips: [
      'Sempre faça backup do banco de dados de produção antes de rodar migrations destrutivas!',
      'Monitore queries lentas (slow query log) e adicione índices nas colunas mais buscadas.',
      'Se usa ORM (como Prisma), lembre de rodar `prisma generate` após atualizar o schema.',
      'Nunca coloque credenciais de banco hardcoded no código; use variáveis de ambiente com segurança.',
      'Evite o problema de N+1 queries fazendo eager loading das relações necessárias.',
    ],
  },
  {
    patterns: [/vite/i, /next/i, /astro/i, /webpack/i, /parcel/i, /npm run dev/i, /yarn dev/i, /bun dev/i],
    tips: [
      'Para imagens mais rápidas e otimizadas, prefira formatos modernos como WebP ou AVIF.',
      'Lembre de habilitar compressão (gzip/brotli) no servidor para diminuir o tamanho dos assets.',
      'Confira se não há imports não utilizados inflando o bundle final com um analyzer.',
      'Usa Next.js? Lembre-se de usar componentes de servidor (Server Components) por padrão para melhor performance.',
      'Aproveite o caching de build e assets estáticos para acelerar o carregamento da página.',
    ],
  },
  {
    patterns: [/eslint/i, /prettier/i, /lint/i],
    tips: [
      'Prettier garante formatação consistente. Configure o VS Code para "Format on Save".',
      'O ESLint ajuda a evitar bugs silenciosos em produção. Não ignore warnings, resolva-os!',
      'Que tal adicionar um pre-commit hook com `husky` e `lint-staged` para automatizar o lint?',
      'Mantenha as regras do ESLint e Prettier integradas de forma limpa para evitar conflitos de estilo.',
    ],
  },
  {
    patterns: [/^git add/i, /^git commit/i, /^git push/i],
    tips: [
      'Antes de commitar, roda `git diff --cached` pra ver o que tá staged.',
      'Lembre de escrever uma mensagem de commit descritiva.',
      'Se fez muitas mudanças, que tal dividir em commits menores?',
      'Já rodou os testes antes de pushar?',
      'Commit assinado? `git commit -S` pra verificação GPG.',
      'Conventional Commits ajudam no changelog: `feat:`, `fix:`, `chore:`.',
    ],
  },
  {
    patterns: [/^git checkout/i, /^git switch/i, /^git branch/i],
    tips: [
      'Conferiu se tá no branch certo antes de começar?',
      'Se vai criar branch novo, lembra de puxar main atualizado.',
      'Branch naming: `feat/`, `fix/`, `chore/` organizam o fluxo.',
      'Antes de trocar de branch, commita ou stasha as mudanças.',
    ],
  },
  {
    patterns: [/git pull/i, /git fetch/i, /git rebase/i],
    tips: [
      'Pull com rebase mantém histórico linear: `git pull --rebase`.',
      'Fetch antes de pull pra ver o que mudou: `git fetch && git log HEAD..origin/main`.',
      'Rebase interativo (`git rebase -i`) pra limpar commits antes de merge.',
    ],
  },
  {
    patterns: [/npm install/i, /yarn add/i, /pnpm add/i, /bun add/i],
    tips: [
      'Conferiu se a versão do pacote é compatível com o projeto?',
      'Lembre de commitar o lockfile junto com as mudanças.',
      'Verifica se o pacote tem vulnerabilidades conhecidas: `npm audit`.',
      'Pacote novo? Confere se tem alternativas menores ou built-in.',
      'Use `--save-dev` pra dependências de dev que não vão pra produção.',
    ],
  },
  {
    patterns: [/npm run build/i, /yarn build/i, /pnpm build/i, /bun build/i, /make/i],
    tips: [
      'Se o build passou, que tal rodar os testes antes de commitar?',
      'Conferiu se não tem warning no build que deveria resolver?',
      'Build lento? `--profile` ou `time` pra identificar gargalos.',
      'Cache de build pode acelerar: verifica se tá configurado.',
    ],
  },
  {
    patterns: [/npm test/i, /yarn test/i, /jest/i, /vitest/i, /pytest/i, /go test/i, /cargo test/i],
    tips: [
      'Se os testes passaram, tá quase pronto! Só falta revisar o diff.',
      'Conferiu se tem teste novo pra feature nova?',
      'Se cobriu tudo, que tal rodar com --coverage pra ver a cobertura?',
      'Teste flaky? Isola com `--bail` pra parar no primeiro erro.',
      'Teste demorado? `--shard` ou `--parallel` pra paralelizar.',
    ],
  },
  {
    patterns: [/docker/i, /docker-compose/i, /podman/i],
    tips: [
      'Conferiu se o Dockerfile tá otimizado com multi-stage build?',
      'Verifica se não tá rodando como root no container.',
      'Lembre de adicionar .dockerignore pra não copiar node_modules.',
      'Layer order importa! Copia package.json antes do código pra cache de deps.',
      'Use `.dockerignore` pra excluir .git, node_modules, .env.',
    ],
  },
  {
    patterns: [/rm -rf/i, /rm -r/i, /\bdel\b/i, /rmdir/i],
    tips: [
      'Cuidado com `rm -rf`! Confere o caminho antes de rodar.',
      'Tem certeza que quer deletar isso? Pode ser útil manter.',
      'Tenta `rm -ri` (interativo) pra confirmar cada arquivo.',
      'Backup antes: `cp -r <dir> <dir>.backup` nunca machucou ninguém.',
    ],
  },
  {
    patterns: [/curl/i, /wget/i, /fetch/i],
    tips: [
      'Conferiu se a URL é HTTPS e não HTTP?',
      'Verifica se tem autenticação necessária no endpoint.',
      'Lembre de tratar erros de rede na requisição.',
      'Em produção, confere se tem retry e timeout configurados.',
    ],
  },
  {
    patterns: [/chmod/i, /chown/i, /sudo/i],
    tips: [
      'Cuidado com `sudo`! Tem certeza que precisa de privilégios de admin?',
      'Se tá mudando permissão, conferiu se não vai quebrar outro processo?',
      'Permissões 777 é quase sempre errado. Usa 755 ou 644.',
    ],
  },
  {
    patterns: [/cd /i, /mkdir/i, /cp /i, /mv /i],
    tips: [
      'Se tá copiando arquivos, confere se o destino já existe.',
      `mkdir -p\` cria diretórios pai sem erro se já existirem.`,
      'Antes de mover, `ls` no destino pra ver o que tem lá.',
    ],
  },
  {
    patterns: [/npx/i, /node /i, /ts-node/i, /tsx/i],
    tips: [
      'Se roda script com `node`, confere se o entry point tá correto.',
      'npx usa versão local primeiro — confere se é a que quer.',
      'ts-node vs tsx: tsx é mais rápido pra scripts, ts-node pra debug.',
    ],
  },
  {
    patterns: [/pip install/i, /pip3 install/i, /poetry/i, /pipenv/i],
    tips: [
      'Usa virtualenv pra isolar dependências Python.',
      'Confere se o requirements.txt/poetry.lock tá atualizado.',
      'pip freeze > requirements.txt pra capturar versões exatas.',
    ],
  },
  {
    patterns: [/cargo/i, /rustc/i],
    tips: [
      'Cargo build demora? `cargo build --release` pra binário otimizado.',
      'Confere se não tem warning do compilador — Rust warnings são sérios.',
      'Clippy (`cargo clippy`) pega patterns inseguros que o compilador ignora.',
    ],
  },
  {
    patterns: [/go run/i, /go build/i, /go test/i, /go mod/i],
    tips: [
      'Go mod tidy limpa dependências não usadas.',
      'Go vet antes de build: `go vet ./...` pega erros comuns.',
      'Race detector: `go test -race` pra detectar data races.',
    ],
  },
  {
    patterns: [/gh pr/i, /gh issue/i, /gh repo/i],
    tips: [
      'PR pronto? Confere se CI tá verde antes de pedir review.',
      'Issue description clara economiza iterações de review.',
      'Linka issues no PR: `Closes #123` auto-close no merge.',
    ],
  },
]

const CODE_REVIEW_TIPS_GENERIC = [
  'Lembre de revisar o diff antes de pushar.',
  'Já pensou em adicionar um .gitignore atualizado?',
  'Que tal um `git status` pra ver o que tá staged?',
  'Se tá debugando, tenta isolar o problema com testes menores.',
  'Antes de refactorar, garanta que tem cobertura de testes.',
  'Se mudou dependências, conferiu o lockfile?',
  'Se fez mudanças em config, lembra de não commitar segredos.',
  'Que tal adicionar um README atualizado com as mudanças?',
  'Confere se não tem console.log ou debug solto no código.',
  'Antes de PR, roda lint + test + build localmente.',
] as const

// ─── Contextual Selection ───────────────────────────────────────────────────

function pickContextual(
  categories: { patterns: RegExp[]; tips: readonly string[] }[],
  genericTips: readonly string[],
  input: string,
): string {
  // Find matching category
  for (const cat of categories) {
    if (cat.patterns.some(p => p.test(input))) {
      return cat.tips[Math.floor(Date.now() / 1000) % cat.tips.length]!
    }
  }
  // Fallback to generic
  return genericTips[Math.floor(Date.now() / 1000) % genericTips.length]!
}

// ─── Exports ────────────────────────────────────────────────────────────────

export function getErrorTip(premiumActive: boolean, errorOutput?: string): string | null {
  const chance = premiumActive ? 0.98 : 0.85
  if (Math.random() > chance) return null

  if (errorOutput) {
    return pickContextual(ERROR_TIP_CATEGORIES, ERROR_TIPS_GENERIC, errorOutput)
  }
  return ERROR_TIPS_GENERIC[Math.floor(Date.now() / 1000) % ERROR_TIPS_GENERIC.length]!
}

export function getCodeReviewTip(premiumActive: boolean, bashCommand?: string): string | null {
  const chance = premiumActive ? 0.98 : 0.75
  if (Math.random() > chance) return null

  if (bashCommand) {
    return pickContextual(CODE_REVIEW_CATEGORIES, CODE_REVIEW_TIPS_GENERIC, bashCommand)
  }
  return CODE_REVIEW_TIPS_GENERIC[Math.floor(Date.now() / 1000) % CODE_REVIEW_TIPS_GENERIC.length]!
}

// ─── Feedback Tips (60% chance, 85% premium) ─────────────────────────────

export async function getFeedbackTip(
  premiumActive: boolean,
  context?: string,
  signal?: AbortSignal,
): Promise<string | null> {
  const chance = premiumActive ? 0.85 : 0.60
  if (Math.random() > chance) return null

  try {
    const { signal: combinedSignal, cleanup } = createCombinedAbortSignal(signal, { timeoutMs: 2000 })
    try {
      const memories = await scanMemoryFiles(getAutoMemPath(), combinedSignal)
      const feedbackRules = memories.filter(
        m => m.type === 'feedback' && !m.ignored && (m.score ?? 0) >= 20,
      )

      if (feedbackRules.length === 0) return null

      if (context) {
        const contextLower = context.toLowerCase()
        const matched = feedbackRules.find(m => {
          const desc = (m.description ?? '').toLowerCase()
          const name = m.filename.toLowerCase()
          const words = contextLower.split(/\s+/).filter(w => w.length > 3)
          return words.some(w => desc.includes(w) || name.includes(w))
        })

        if (matched) {
          return `💡 Regra aprendida: ${matched.description ?? matched.filename}`
        }
      }

      const picked = feedbackRules[Math.floor(Date.now() / 1000) % feedbackRules.length]!
      return `💡 Regra aprendida: ${picked.description ?? picked.filename}`
    } finally {
      cleanup()
    }
  } catch {
    return null
  }
}

// ─── Session Summary (Level 4+) ─────────────────────────────────────────────

export function getSessionSummary(): string | null {
  const config = getGlobalConfig()
  const companion = config.companion
  if (!companion) return null

  const xp = companion.xp ?? 0
  const levelInfo = getLevelInfo(xp)
  if (levelInfo.level < 4) return null

  const stats = config.companionStats
  if (!stats) return null

  return `📊 Resumo da sessão:
Bash executados: ${stats.totalBashes}
Tasks concluídas: ${stats.totalTasks}
Erros encontrados: ${stats.totalErrors}
XP: ${xp} (Nível ${levelInfo.level})
Streak: ${config.companionStreakCount ?? 0} dias`
}
