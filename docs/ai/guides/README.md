# 🤖 Guias de Engenharia de IA, Harness & Sandboxing

<div align="center">

[![Category](https://img.shields.io/badge/Category-AI%20Engineering%20%26%20Harness-7C3AED?style=for-the-badge)](../../README.md)
[![Harness Level](https://img.shields.io/badge/Harness%20Maturity-Level%203%20(Robusto)-10B981?style=for-the-badge)](guia-construcao-harness.md)

<p align="center">
  <b>Padrões de engenharia para infraestrutura de agentes inteligentes, isolamento em sandbox, notificações visuais/sonoras e navegação relacional por Knowledge Graphs.</b>
</p>

</div>

---

## 📂 Guias Disponíveis no Diretório

```text
guides/ai-engineering/
├── guia-construcao-harness.md                     ──> Arquitetura e os 7 Pilares de Harness Nível 3
├── guia-ai-jail-sandbox.md                        ──> Isolamento e contenção segura em sandbox (ai-jail)
├── guia-configuracao-notificacoes-openclaude.md   ──> Notificações desktop e alertas sonoros para agentes
├── guia-graph-engineering-knowledge-graph.md      ──> Fundamentos e modelagem de Knowledge Graphs
└── guia-integracao-graph-engineering.md            ──> Orquestração prática de Graphify com agentes de IA
```

---

## 📋 Detalhamento dos Guias

| Guia Técnico | Descrição & Propósito |
| :--- | :--- |
| [`guia-construcao-harness.md`](guia-construcao-harness.md) | Guia mestre sobre a arquitetura de **Harness de Nível 3** (Maduro/Robusto): Filosofia Dual-Harness (Claude Code ↔ Antigravity), os 7 Pilares de sustentação, hooks de ciclo de vida zero-turn, taxonomia de skills e ciclo em 5 fases. |
| [`guia-ai-jail-sandbox.md`](guia-ai-jail-sandbox.md) | Especificação técnica de contenção em sandbox (`ai-jail`) para agentes de IA autônomos, isolando chamadas de sistema, comandos de rede e acessos a arquivos fora do repositório. |
| [`guia-configuracao-notificacoes-openclaude.md`](guia-configuracao-notificacoes-openclaude.md) | Configuração de alertas visuais no desktop (macOS/Linux) e notificações sonoras para alertar o desenvolvedor quando o agente conclui tarefas longas ou solicita intervenção humana. |
| [`guia-graph-engineering-knowledge-graph.md`](guia-graph-engineering-knowledge-graph.md) | Fundamentos teóricos e estruturação de Grafos de Conhecimento de código via AST, mapeamento de topologia de entidades, dependências cross-file e comunidades arquiteturais. |
| [`guia-integracao-graph-engineering.md`](guia-integracao-graph-engineering.md) | Guia operacional de integração do **Graphify** ao workflow do agente: diretriz compulsória *"Graphify Before Grep/Glob"*, hook-guards de interceptação e comandos de query, path e explain. |
