# Guia Universal de Integração de Graph Engineering em Repositórios de Software

## Diagnóstico e Engenharia de Grafos

Projetos de software modernos com suporte a agentes de IA (**OpenClaude**, **Claude Code**, **Gemini CLI**, **Codex**) beneficiam-se enormemente de um **knowledge graph operacional e consultável**, que os agentes podem indexar e navegar automaticamente durante o desenvolvimento.

A engenharia de grafos de código utiliza ferramentas como o **Graphify** para extração de AST e mapeamento de dependências estruturais entre rotas/endpoints, regras de negócio, persistência de dados e componentes de interface, persistindo os artefatos na pasta `graphify-out/` e respeitando o `.graphifyignore`.

---

## Escolha da Ferramenta de Graph Engineering

Entre as soluções mais bem avaliadas e padronizadas do ecossistema para transformar um repositório em um grafo de conhecimento navegável por agentes de IA, destacam-se:

| Ferramenta | Tipo de integração | Principais Recursos | Casos de Uso Ideais |
| :--- | :--- | :--- | :--- |
| **Graphify** (`graphifyy` no PyPI) | Skill nativa (`/graphify`) instalável via CLI | Extração via AST sem custo de LLM, gera `graph.html`, `graph.json`, `GRAPH_REPORT.md`, suporta Claude Code, Gemini CLI e OpenClaude | **Padrão de Referência:** Redução drástica de tokens ao mapear rotas, serviços, modelos e componentes |
| **code-review-graph** (CRG) | MCP server + skill CLI | SQLite/AST local, blast-radius analysis, prompts MCP (`architecture_map`) | Foco em análise de impacto de mudanças e code review |
| **Understand Anything** | Plugin nativo / Web UI | Dashboard visual interativo, tours guiados de onboarding | Onboarding visual e documentação interativa |

A recomendação padrão para projetos agênticos é o uso do **Graphify** como camada central de graph engineering de código, com os artefatos mantidos em `graphify-out/`.

---

## Passo a Passo — Claude Code / OpenClaude

### 1. Pré-requisitos
- OpenClaude ou Claude Code instalado no terminal.
- Python 3.12 com `uv` ou `pip` instalado.
- Repositório do projeto clonado.

### 2. Instalar o Graphify como skill
```bash
# Instala o pacote CLI (pacote PyPI: graphifyy)
uv tool install graphifyy
# ou via pip: pip install graphifyy
```

### 3. Configurar exclusões (`.graphifyignore`)
Configure o arquivo `.graphifyignore` na raiz do projeto para evitar indexação de dependências e artefatos de build:
```
backend/.venv/
backend/venv/
backend/__pycache__/
frontend/node_modules/
frontend/dist/
frontend/.angular/
.git/
.trunk/
graphify-out/
```

### 4. Gerar o grafo de conhecimento do repositório
Execute dentro do assistente ou terminal:
```bash
graphify run .
```
Ou dentro da sessão:
```
/graphify .
```

O comando escaneia `backend/app/`, `frontend/src/app/` e `docs/`, gerando:
- `graphify-out/graph.html` — visualização interativa do grafo,
- `graphify-out/GRAPH_REPORT.md` — nós centrais, métricas de conectividade e hubs,
- `graphify-out/graph.json` — grafo estruturado para consultas rápidas.

### 5. Consultar o grafo durante o desenvolvimento
```
/graphify query "quais endpoints dependem de ContatoCRUD e LogService?"
/graphify explain backend/app/services/auth_service.py
/graphify path "backend/app/api/v1/endpoints/contatos.py" "frontend/src/app/pages/main"
```

Isso elimina a necessidade de ler dezenas de arquivos com `grep`/`find`, mantendo a janela de contexto limpa e focada.

---

## Passo a Passo — Gemini CLI / Antigravity

O ecossistema Antigravity no diretório `.agent/` utiliza a mesma base de grafo estruturada em `graphify-out/`.

### 1. Pré-requisitos
- Gemini CLI / Antigravity configurado no workspace.
- Acesso aos diretórios `.agent/rules/GEMINI.md` e `.agent/skills/`.

### 2. Geração e Consulta Compartilhada
Como os artefatos `graphify-out/graph.json` e `graphify-out/GRAPH_REPORT.md` são compartilhados na raiz do monorepo, qualquer agente (OpenClaude ou Gemini) pode consultar o mesmo grafo estruturado para entender os fluxos:

- Fluxo de Autenticação: `backend/app/api/v1/endpoints/auth.py` → `services/auth_service.py` → `services/ldap_service.py` → `frontend/src/app/pages/login/`.
- Fluxo de Contatos: `backend/app/api/v1/endpoints/contatos.py` → `crud/contato.py` → `models/contato.py` → `frontend/src/app/services/servidor.service.ts` → `frontend/src/app/pages/main/`.

---

## Tabela Comparativa de Operação

| Aspecto | OpenClaude / Claude Code | Gemini CLI / Antigravity |
| :--- | :--- | :--- |
| Configuração de Regras | `CLAUDE.md` (raiz) | `.agent/rules/GEMINI.md` |
| Local do Grafo AST | `graphify-out/` (`graph.json`, `graph.html`) | `graphify-out/` (`graph.json`, `graph.html`) |
| Comando de Consulta | `/graphify query <termo>` | Consulta a `graphify-out/graph.json` / `GRAPH_REPORT.md` |
| Regras de Exclusão | `.graphifyignore` | `.graphifyignore` |
| Sincronização Multi-Repo | `./sync-repos.sh` | `./sync-repos.sh` |
