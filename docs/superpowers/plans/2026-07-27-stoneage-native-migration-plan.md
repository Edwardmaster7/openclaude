# Migração do Stoneage e Alias oc para Nativos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tornar o alias `oc` nativo por meio do `package.json` e migrar as 14 skills do ecossistema `stoneage` e `token-economy` para serem nativas (bundled) no OpenClaude.

**Architecture:** Mapear o alias `oc` na chave `"bin"` de `package.json` para expor o comando globalmente no PATH. Centralizar todas as 14 skills do stoneage no novo arquivo `src/skills/bundled/stoneage.ts` usando strings de prompts estáticas e registrá-las de forma unificada no `initBundledSkills()`.

**Tech Stack:** TypeScript, Bun, Node.js, NPM (Package Binaries).

## Global Constraints

- O alias `oc` deve apontar para o script `./bin/openclaude`.
- Todas as 14 skills devem ser migradas estaticamente sem criar redundância de arquivos (usando apenas `src/skills/bundled/stoneage.ts`).
- Nenhuma dependência externa nova deve ser introduzida.
- Os testes unitários devem verificar o registro correto de todas as novas skills.

---

### Task 1: Alias oc Nativo no package.json

**Files:**
- Modify: `package.json:6-8`

**Interfaces:**
- Produces: Executável `oc` mapeado globalmente no PATH após build/link.

- [ ] **Step 1: Escrever teste de verificação da chave bin**

Como é uma mudança de configuração estrutural de pacote, vamos verificar diretamente no `package.json` se as chaves de entrada estão corretas.

- [ ] **Step 2: Adicionar o alias oc ao package.json**

Modificar `"bin"` no `package.json`:
```json
  "bin": {
    "openclaude": "./bin/openclaude",
    "oc": "./bin/openclaude"
  },
```

- [ ] **Step 3: Compilar e testar localmente**

Run: `bun run build`
Expected: Compilação com sucesso (`dist/cli.mjs` atualizado).

- [ ] **Step 4: Commit**

```bash
git add package.json
git commit -m "feat(cli): add oc as native binary shortcut in package.json"
```

---

### Task 2: Implementar arquivo unificado stoneage.ts e registrar skills

**Files:**
- Create: `src/skills/bundled/stoneage.ts`
- Modify: `src/skills/bundled/index.ts`
- Create: `src/skills/bundled/stoneage.test.ts`

**Interfaces:**
- Consumes: `registerBundledSkill` de `../bundledSkills.js`
- Produces: `registerStoneageSkills` que registra as 14 novas skills nativas do stoneage e token-economy.

- [ ] **Step 1: Criar o teste unitário falhante para registro das skills**

Criar `src/skills/bundled/stoneage.test.ts`:
```typescript
import { expect, test } from 'bun:test'
import { getBundledSkills } from '../bundledSkills.js'
import { initBundledSkills } from './index.js'

test('all 14 stoneage and token-economy skills are registered as bundled skills', () => {
  // Inicializa todas as skills bundled
  initBundledSkills()
  
  const skills = getBundledSkills()
  const skillNames = skills.map(s => s.name)
  
  const expectedSkills = [
    'stoneage',
    'token-economy',
    'answer-first',
    'code-only',
    'silent-tools',
    'task-batch',
    'context-trim',
    'memory-prune',
    'session-budget',
    'stoneage-commit',
    'stoneage-compress',
    'stoneage-help',
    'stoneage-review',
    'stoneage-stats'
  ]
  
  for (const expected of expectedSkills) {
    expect(skillNames).toContain(expected)
  }
})
```

- [ ] **Step 2: Executar teste e verificar que falha**

Run: `bun test src/skills/bundled/stoneage.test.ts`
Expected: FAIL (as 14 novas skills não estão contidas no array retornado)

- [ ] **Step 3: Criar o arquivo `src/skills/bundled/stoneage.ts`**

Implementar os registros e prompts das 14 skills do stoneage em `src/skills/bundled/stoneage.ts`. Devido ao tamanho das strings de prompt, utilizaremos strings estáticas extraídas dos arquivos originais do plugin.

Exemplo de estrutura:
```typescript
import { registerBundledSkill } from '../bundledSkills.js'

const STONEAGE_PROMPT = `Responda como pedra lascada: poucas palavras, significado total...`
const TOKEN_ECONOMY_PROMPT = `Sistema de controle de gastos de tokens...`
const ANSWER_FIRST_PROMPT = `Respostas como commits: corpo mínimo, mensagem clara...`
const CODE_ONLY_PROMPT = `Pedidos de código = código. Não narração...`
const SILENT_TOOLS_PROMPT = `Ferramentas verbose poluem contexto. Resumo = menos tokens, mesma info...`
const CONTEXT_TRIM_PROMPT = `Tool results grandes poluem contexto. Extraia dados, descarte ruído...`
const MEMORY_PRUNE_PROMPT = `MEMORY.md carregado em toda sessão. Entradas stale = tokens desperdiçados...`

export function registerStoneageSkills(): void {
  registerBundledSkill({
    name: 'stoneage',
    description: 'Modo de comunicação ultra-compacto com identidade pré-histórica. Reduz ~75% dos tokens de saída mantendo precisão técnica total.',
    userInvocable: true,
    async getPromptForCommand(args) {
      return [{ type: 'text', text: args ? `${STONEAGE_PROMPT}\n\nNível selecionado: ${args}` : STONEAGE_PROMPT }]
    }
  })
  
  registerBundledSkill({
    name: 'token-economy',
    description: 'Skill mestra de economia de tokens. Controla todas as skills de redução de tokens.',
    userInvocable: true,
    async getPromptForCommand() {
      return [{ type: 'text', text: TOKEN_ECONOMY_PROMPT }]
    }
  })

  registerBundledSkill({
    name: 'answer-first',
    description: 'Responde direto, sem preâmbulo. Pula "Vou verificar...", "Deixe-me explicar...".',
    userInvocable: true,
    async getPromptForCommand() {
      return [{ type: 'text', text: ANSWER_FIRST_PROMPT }]
    }
  })

  registerBundledSkill({
    name: 'code-only',
    description: 'Responde pedidos de código com apenas o código e 1 linha de contexto.',
    userInvocable: true,
    async getPromptForCommand() {
      return [{ type: 'text', text: CODE_ONLY_PROMPT }]
    }
  })

  registerBundledSkill({
    name: 'silent-tools',
    description: 'Comprime output de ferramentas (Bash, grep, logs) em resumo de 2-3 linhas.',
    userInvocable: true,
    async getPromptForCommand() {
      return [{ type: 'text', text: SILENT_TOOLS_PROMPT }]
    }
  })

  registerBundledSkill({
    name: 'context-trim',
    description: 'Reduz consumo de contexto ignorando output de ferramentas grandes.',
    userInvocable: true,
    async getPromptForCommand() {
      return [{ type: 'text', text: CONTEXT_TRIM_PROMPT }]
    }
  })

  registerBundledSkill({
    name: 'memory-prune',
    description: 'Mantém MEMORY.md limpo e eficiente. Remove entradas stale, consolida duplicatas, mantém índice enxuto.',
    userInvocable: true,
    async getPromptForCommand() {
      return [{ type: 'text', text: MEMORY_PRUNE_PROMPT }]
    }
  })

  // Registrar as demais 7 skills (task-batch, session-budget, stoneage-commit, stoneage-compress, stoneage-help, stoneage-review, stoneage-stats) da mesma forma...
}
```

- [ ] **Step 4: Conectar o registro no ponto de entrada `src/skills/bundled/index.ts`**

Adicionar a importação e chamada de `registerStoneageSkills` em `initBundledSkills()`:
```typescript
import { registerStoneageSkills } from './stoneage.js'

export function initBundledSkills(): void {
  // ...outros registros
  registerStoneageSkills()
}
```

- [ ] **Step 5: Executar testes de unidade e verificar sucesso**

Run: `bun test src/skills/bundled/stoneage.test.ts`
Expected: PASS

- [ ] **Step 6: Executar testes completos do repositório**

Run: `bun run typecheck`
Expected: Sem erros de digitação de TypeScript.

- [ ] **Step 7: Commit**

```bash
git add src/skills/bundled/stoneage.ts src/skills/bundled/stoneage.test.ts src/skills/bundled/index.ts
git commit -m "feat(skills): register all 14 stoneage and token-economy skills natively"
```
