# 📝 Registro de Desenvolvimento — 18 de Junho de 2026

**Escopo:** Ecossistema do Companheiro Crocbiçom (Buddy), Sistema de Captura de Feedback e Canal de Anúncios/Dicas Patrocinadas (/ads)
**Commits gerados:** 4
**Arquivos modificados:** 75

---

## 1. Visão Geral das Alterações

> Nesta sessão, consolidamos o ecossistema completo do companheiro **Crocbiçom (Buddy)** v0.15.0+, trazendo recursos avançados de progressão de níveis, conquistas, lojinha de XP para personalização e humor baseado nas interações do usuário. Paralelamente, implementamos o sistema de captura de **feedback inteligente** para regras de conduta do agente e o comando `/ads` para gerenciamento de créditos de dicas patrocinadas de forma segura e não obstrutiva. Foram resolvidas falhas cruciais de vazamento de timers de `AbortSignal.timeout` e restabelecido o suporte completo ao opt-out do histórico em caminhos de memória.

---

## 2. Arquitetura Afetada

Abaixo está a representação dos novos componentes e fluxos integrados ao núcleo do OpenClaude CLI:

```mermaid
graph TD
  User[Interação do Usuário] --> PromptInput[PromptInput Component]
  PromptInput --> processUserInput[processUserInput.ts]
  
  subgraph Sistema de Feedback
    processUserInput --> feedbackHook[feedbackHook.ts]
    feedbackHook --> feedbackLog[feedbackLog.ts]
    feedbackLog --> feedbackSynthesizer[feedbackSynthesizer.ts]
    feedbackSynthesizer --> feedbackScoring[feedbackScoring.ts]
  end

  subgraph Companheiro Crocbiçom (Buddy)
    PromptInput --> CompanionSprite[CompanionSprite.tsx]
    CompanionSprite --> companion[companion.ts]
    companion --> progression[progression.ts]
    companion --> mood[mood.ts]
    companion --> shop[shop.ts]
    companion --> outfits[outfits.ts]
    companion --> achievements[achievements.ts]
    companion --> streak[streak.ts]
    companion --> xploss[xp-loss.ts]
  end

  subgraph Canal de Dicas Patrocinadas
    PromptInput --> adsCommand[ads.tsx /ads]
    adsCommand --> adsService[ads.ts]
    adsService --> gitlawbEarn[gitlawbEarn.ts]
  end
```

---

## 3. Mapa de Arquivos Modificados

| Arquivo | Tipo | O que mudou |
|--------|------|-------------|
| `package.json` | Config | Adiciona dependência `strip-ansi` e remove `stack-utils`. |
| `scripts/externals.ts` | Config | Adiciona `'strip-ansi'` e remove `'stack-utils'` das dependências externas. |
| `src/buddy/mood.ts` | Service | Corrige vazamento de timers de `AbortSignal.timeout` substituindo por `createCombinedAbortSignal` com liberação segura. |
| `src/buddy/skills.ts` | Service | Adapta a leitura de memórias de feedback do Buddy para liberar timers do `AbortSignal` de forma limpa. |
| `src/buddy/achievements.ts` | Service | Sistema de conquistas baseadas no comportamento de uso do usuário. |
| `src/buddy/shop.ts` | Service | Lojinha que permite trocar pontos de experiência (XP) por customizações de sprite e vestuários. |
| `src/buddy/outfits.ts` | Service | Gerenciador de vestimentas desbloqueadas e ativas do Crocbiçom. |
| `src/buddy/evolution.ts` | Service | Lógica de transformações e evoluções do companheiro conforme ganho de nível. |
| `src/buddy/streak.ts` | Service | Acompanhamento e bonificação de dias consecutivos de uso. |
| `src/buddy/xp-loss.ts` | Service | Lógica de perda de XP proporcional ou regressiva. |
| `src/commands/ads.tsx` | Component | Comando `/ads` para interagir com o saldo de créditos e anúncios do OpenGateway. |
| `src/commands/feedback/feedback.ts` | Component | Novo comando nativo `/feedback` para manipulação e visualização de aprendizados acumulados. |
| `src/memdir/paths.ts` | Utility | Restabelece e fixa o suporte ao opt-out global de escrita de memória (`memory.autoWrite: false`). |

---

## 4. Detalhamento por Commit

### `chore(deps): adiciona strip-ansi e remove stack-utils`

**Razão da alteração:**
> Evitar quebras de lint/deadcode promovidas pelo Knip e adicionar suporte à limpeza de strings coloridas via ANSI nos logs do CLI de maneira eficiente.

**O que faz agora:**
> Remove referências de dependência não importada em código (`stack-utils`) e consolida `strip-ansi` no arquivo de pacotes externos do Bun build.

**Decisões técnicas:**
> Retirada rápida do `stack-utils` para assegurar o funcionamento da suíte automatizada de validação estática de saúde (`bun run check`).

**Arquivos envolvidos:**
- `package.json` — Atualização de dependências.
- `scripts/externals.ts` — Ajuste de dependências externas permitidas.
- `bun.lock` — Geração do grafo de dependências atualizado.

---

### `feat(commands): adiciona comando /ads e sistema de dicas patrocinadas`

**Razão da alteração:**
> Oferecer monetização não intrusiva via dicas patrocinadas exibidas durante os tempos de loading do CLI e recompensar o desenvolvedor com créditos OpenGateway.

**O que faz agora:**
> Permite que o usuário consulte seu saldo acumulado de créditos através do comando `/ads` e gerencia a amostragem de patrocinadores.

**Decisões técnicas:**
> Criação de um serviço isolado em `ads.ts` com testes unitários cobrindo o faturamento fictício e renderização de layouts Ink de forma robusta.

**Arquivos envolvidos:**
- `src/commands/ads.tsx` — Implementação visual do comando `/ads` na tela.
- `src/services/ads.ts` — Lógica financeira de créditos e balance.
- `src/services/tips/gitlawbEarn.ts` — Lógica de exibição e pontuação de tips.

---

### `feat(feedback): adiciona comando /feedback e sistema de captura inteligente`

**Razão da alteração:**
> Capturar interações em que o usuário expressa frustração ou corrige o comportamento do agente para transformá-las em aprendizados automáticos armazenados na memória.

**O que faz agora:**
> Intercepta o input do usuário na busca por palavras-chave corretivas e cataloga no arquivo de histórico de feedbacks do CLI.

**Decisões técnicas:**
> Lógica de pontuação de recorrência em `feedbackScoring.ts` e compilação unificada em `feedbackSynthesizer.ts`.

**Arquivos envolvidos:**
- `src/hooks/feedbackHook.ts` — Interceptador de gancho pós-envio do prompt.
- `src/memdir/feedbackLog.ts` — Estrutura de logging persistente de feedbacks locais.
- `src/commands/feedback/feedback.ts` — Executável do comando nativo.

---

### `feat(buddy): implementa ecossistema de progressao, customizacao e lojinha do Crocbicom`

**Razão da alteração:**
> Elevar o engajamento e a diversão do usuário oferecendo um mascote reativo (Crocbiçom, o polvo) com quem ele interage no terminal enquanto trabalha.

**O que faz agora:**
> Renderiza o sprite e as mensagens de voz do mascote, calcula ganhos de XP, gerencia compras e vestuários, e atualiza o humor dele de forma interativa.

**Decisões técnicas:**
> Uso da utilidade `createCombinedAbortSignal` em `mood.ts` e `skills.ts` para remediar vazamentos de memória decorrentes de temporizadores ativos do Bun no terminal.

**Arquivos envolvidos:**
- `src/buddy/achievements.ts` — Lógica e regras de medalhas e conquistas.
- `src/buddy/shop.ts` — Lógica de compra de itens visuais.
- `src/buddy/outfits.ts` — Vestimentas e cosméticos do Crocbiçom.
- `src/buddy/mood.ts` — Controle de humor inteligente baseado em feedbacks ativos.

---

## 5. ✅ O Que Está Funcionando

- O companheiro Crocbiçom renderiza, calcula progressão de XP, realiza transações na loja e reage a estados perfeitamente (115 testes específicos cobrindo 100%).
- O comando `/ads` exibe saldo e dicas com sucesso em testes automatizados.
- O linter e os testes integrados de `AbortSignal` e `paths` do sistema de memória rodam sem avisos de vazamentos de recursos.

---

## 6. ❌ O Que Está Pendente

- Nenhuma pendência imediata de desenvolvimento para as features comitadas.

---

## 7. ⚠️ Dívida Técnica Identificada

- **Uso de query params em imports de testes:** Alguns testes externos de configuração (`changeDetector.test.ts`) utilizam queries dinâmicas que podem interagir de forma imprevisível com caches do carregador ESM do Bun em ambientes concorrentes locais.

---

## 8. Padrões Importantes a Lembrar

- **Não usar AbortSignal.timeout diretamente:** Sempre encapsular sinais com temporizadores na função utilitária `createCombinedAbortSignal` e garantir que `cleanup()` seja disparado num bloco `finally` para evitar vazamento de recursos no Bun.
- **Estrutura Flat em Skills de Plugins:** Todas as habilidades criadas em subpastas de plugins devem residir no nível raiz para evitar quebras no mecanismo de autocompletação do CLI.

---

## 9. Próximos Passos

1. Validar o comportamento visual final das roupas equipadas no Crocbiçom na interface gráfica terminal após a subida oficial da release.
2. Planejar novos minijogos de terminal baseados nas conquistas do desenvolvedor.

---

## 10. Validações Mapeadas

| Campo / Função | Regra de validação | Status |
|---------------|-------------------|--------|
| Testes Unitários de Buddy | Validam todos os fluxos de progresso e vestimentas | ✅ |
| Segurança de Abort Sinais | Teste impede regressão com temporizadores soltos | ✅ |
| Integração de Memória paths | Garante que o opt-out de privacidade do usuário funciona | ✅ |

---
