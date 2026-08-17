# Especificação de Design: Migração de Skills do Stoneage e Alias oc para Nativos

**Data:** 2026-07-27
**Status:** Em Revisão
**Autor:** OpenClaude (AI Agent)

## 1. Objetivos

1. **Alias `oc` nativo para todos os desenvolvedores:** Tornar o alias `oc` disponível automaticamente no PATH global de qualquer desenvolvedor ao instalar ou realizar link do OpenClaude, sem depender de scripts manuais no perfil do shell (`~/.zshrc` ou similares).
2. **Skills 100% nativas (Bundled):** Migrar as 14 skills que compõem o ecossistema do `stoneage` e da `token-economy` (atualmente localizadas no diretório legador de plugins em `plugins/stoneage/skills/`) para serem embutidas nativamente no código-fonte do OpenClaude, garantindo sua disponibilidade imediata a todos os desenvolvedores pós-clone, sem necessidade de rodar scripts locais de setup (`setup-stoneage.sh`).

---

## 2. Abordagem e Arquitetura

### 2.1. Alias `oc` via `package.json`

A forma mais robusta e portátil de expor o comando `oc` nativamente para todas as plataformas (macOS, Linux e Windows) é mapeando-o diretamente na chave `"bin"` do `package.json` do OpenClaude:

```json
"bin": {
  "openclaude": "./bin/openclaude",
  "oc": "./bin/openclaude"
}
```

Quando o NPM ou Bun realiza a instalação do pacote global (`npm install -g .` ou `bun link`), o gerenciador de pacotes cria um link simbólico ou wrapper no PATH do sistema chamado `oc` apontando para o script de entrada `./bin/openclaude`. Isso elimina o acoplamento com o shell de cada usuário e garante que o alias funcione nativamente.

### 2.2. Skills Bundled Unificadas (`stoneage.ts`)

Para evitar "file bloat" (criação de 14 novos arquivos TypeScript pequenos com boilerplate repetitivo), adotamos a **Abordagem de Registro Unificado**:

1. **Criação de `src/skills/bundled/stoneage.ts`:**
   Este arquivo centralizará as strings estáticas contendo os prompts e as definições das 14 skills.
2. **Função `registerStoneageSkills()`:**
   Uma única função exportada registrará sequencialmente cada uma das 14 skills na infraestrutura nativa do OpenClaude via `registerBundledSkill`.

---

## 3. Lista e Configurações das 14 Skills Nativas

| Nome da Skill | Descrição e Propriedades |
|---|---|
| `stoneage` | Modo de comunicação ultra-compacto com identidade pré-histórica. Reduz ~75% dos tokens de saída mantendo precisão técnica total. |
| `token-economy` | Skill mestra de economia de tokens. Controla todas as 12 skills secundárias de economia de tokens. |
| `answer-first` | Responde direto, sem preâmbulo. Resposta técnica primeiro, contexto depois (se pedido). |
| `code-only` | Responde pedidos de código com apenas o código e no máximo 1 linha de contexto explicativo. |
| `silent-tools` | Comprime o output de ferramentas verbosas (Bash, Grep, logs) em um resumo compacto de 2 a 3 linhas. |
| `task-batch` | Agrupa chamadas das ferramentas TaskCreate e TaskUpdate em chamadas paralelas no mesmo turno. |
| `context-trim` | Reduz consumo de contexto resumindo e ignorando outputs de ferramentas gigantescas (>50 linhas). |
| `memory-prune` | Mantém o arquivo MEMORY.md e índices associados limpos, consolidados e eficientes de forma semiautomática. |
| `session-budget` | Sistema de controle de gastos de tokens por sessão com escalabilidade automática. |
| `stoneage-commit` | Gerador de mensagens de commit ultra-compacto seguindo estilo pré-histórico. |
| `stoneage-compress` | Comprime arquivos de memória de linguagem natural (.md, .txt) para formato de pedra lascada. |
| `stoneage-help` | Cartão de referência rápida e ajuda para todos os comandos e intensidades do Stoneage. |
| `stoneage-review` | Comentários de code review ultra-compactos e diretos ao ponto com estilo pré-histórico. |
| `stoneage-stats` | Exibe estatísticas consolidadas de economia de tokens na sessão ativa. |

---

## 4. Plano de Alterações em Arquivos

1. **`openclaude/package.json`:**
   * Adicionar `"oc": "./bin/openclaude"` ao objeto `"bin"`.

2. **`openclaude/src/skills/bundled/stoneage.ts` (Novo):**
   * Definir os prompts estáticos de todas as 14 skills de forma compacta e direta.
   * Chamar `registerBundledSkill` para registrar cada uma com as propriedades de `whenToUse`, `userInvocable`, e a função de construção de prompt dinâmica baseada em argumentos.

3. **`openclaude/src/skills/bundled/index.ts`:**
   * Importar `registerStoneageSkills` de `./stoneage.js`.
   * Invocá-lo dentro de `initBundledSkills()`.

---

## 5. Próximos Passos e Verificação

Após a aprovação desta especificação:
1. Criar e configurar as tarefas detalhadas de implementação.
2. Executar as modificações de código e executar os builds locais para validar a tipagem.
3. Executar o comando de fumaça (`bun run smoke`) para verificar que o CLI compila corretamente e aceita os novos comandos nativos das skills.
4. Testar o executável global `oc` via link simbólico local.
