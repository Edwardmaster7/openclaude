# Buddy XP Shop & Spending System — Design Spec

**Data:** 2026-05-27
**Status:** Draft

---

## 1. Contexto

O sistema Buddy acumula XP passivamente (reads, writes, searches, edits, bash, tasks). Com as mudanças recentes, o XP ganho por operações passivas foi nerfado significativamente:

| Ação        | Antes | Depois |
| ------------- | ----- | ------ |
| Read          | 0.1   | 0.001  |
| Write         | 0.1   | 0.001  |
| Edit          | 0.1   | 0.001  |
| Search        | 0.1   | 0.001  |
| Bash          | 0.1   | 0.01   |
| Task completa | 3     | 3      |
| Pet diário   | 1     | 1      |
| Conquistas    | 1-50  | 1-50   |

**Problema:** Não existem formas criativas de gastar XP. Depois do Level 10 (400 XP), o XP acumula sem propósito. Os únicos gastos atuais são:

- Rename: 5 XP
- Reroll: 15 XP
- Pet premium: 1 XP
- Outfit equip: 2 XP
- Evolve: 50 XP

---

## 2. Tabela de XP por Fonte (Estimativa de Acúmulo)

Considerando uma sessão típica de 2h com uso moderado:

| Fonte                   | Operações/sessão | XP/sessão                 |
| ----------------------- | ------------------- | -------------------------- |
| Read                    | ~80                 | 0.08                       |
| Write                   | ~15                 | 0.015                      |
| Edit                    | ~30                 | 0.03                       |
| Search                  | ~60                 | 0.06                       |
| Bash                    | ~20                 | 0.2                        |
| Task                    | ~5                  | 15                         |
| Pet diário             | 1                   | 1                          |
| **Total típico** |                     | **~16.4 XP/sessão** |

Com esse ritmo, um usuário ativo ganha ~100 XP/semana (5 sessões). Isso dá base para precificar a loja.

---

## 3. Loja de Itens (Buddy Shop)

### 3.1 Acessórios Cosméticos

Itens que alteram a aparência visual do buddy. Desbloqueados APENAS via compra com XP.

| Item            | Preço XP | Descrição                             |
| --------------- | --------- | --------------------------------------- |
| Óculos escuros | 10        | Buddy ganha um par de óculos no sprite |
| Mochila         | 15        | Mochilinha nas costas                   |
| Asas de anjo    | 20        | Asas brilhantes                         |
| Capa de herói  | 25        | Capa esvoaçante                        |
| Chifres         | 15        | Chifres pequenos                        |
| Coroa de flores | 10        | Floral crown                            |
| Bandana ninja   | 12        | Faixa na testa                          |
| Monóculo       | 8         | Sofisticação clássica                |
| Laço/bowtie    | 5         | Formal buddy                            |
| Aura mágica    | 50        | Brilho especial ao redor                |

### 3.2 Sprites/Temas Especiais

| Item                | Preço XP | Descrição                 |
| ------------------- | --------- | --------------------------- |
| Fundo noturno       | 20        | Buddy com estrelas ao fundo |
| Fundo oceânico     | 20        | Ondas e bolhas              |
| Fundo espacial      | 30        | Galáxia ao redor           |
| Partículas de fogo | 40        | Embers flutuantes           |
| Partículas de neve | 35        | Snowflakes                  |
| Glitch effect       | 45        | Efeito visual digital       |
| Pixel hearts        | 25        | Corações flutuantes       |

### 3.3 Títulos Personalizados

Título que aparece abaixo do nome do buddy no status.

| Item           | Preço XP | Exemplo                                      |
| -------------- | --------- | -------------------------------------------- |
| Título comum  | 5         | "Code Apprentice"                            |
| Título raro   | 20        | "Bug Destroyer"                              |
| Título épico | 50        | "Architect of Dreams"                        |
| Título custom | 100       | Usuário escolhe o texto (com sanitização) |

### 3.4 Emotes/Reações Custom

Reações que o buddy pode usar em vez das padrão.

| Item              | Preço XP | Descrição          |
| ----------------- | --------- | -------------------- |
| Pack comemorativo | 15        | "Vamos celebrar!"    |
| Pack motivacional | 15        | "Você consegue!"    |
| Pack snarky       | 20        | Humor ácido premium |
| Pack zen          | 10        | Calma e foco         |

---

## 4. Habilidades/Abilities (Unlock com XP)

Funcionalidades reais que desbloqueiam novas capabilities do buddy.

### 4.1 Habilidades Passivas (permanentes)

| Ability                 | Preço XP | Efeito                                       |
| ----------------------- | --------- | -------------------------------------------- |
| **Memory Boost**  | 50        | Buddy lembra até 30 memórias (vs 20)       |
| **Lucky Star**    | 60        | Chance de shiny no reroll vai de 1% → 5%    |
| **Deep Scan**     | 35        | Buddy detecta mais patterns de erro          |
| **Streak Shield** | 45        | Protege streak por 1 dia se esquecer de usar |

### 4.2 Habilidades com Duração (consumíveis temporizados)

| Ability                   | Preço XP | Duração  | Efeito                                                        |
| ------------------------- | --------- | ---------- | ------------------------------------------------------------- |
| **Quick Tips**      | 20        | 2 horas    | Dicas de erro aparecem 100% das vezes (vs 85%)                |
| **Code Review Pro** | 25        | 2 horas    | Dicas de code review aparecem 100% das vezes                  |
| **XP Magnet**       | 50        | 1 dia      | +25% XP em todas as fontes                                    |
| **XP Boost**        | 15        | 2 horas    | Dobro de XP                                                   |
| **Premium Hour**    | 20        | 1 hora     | Modo premium (dicas 98%+)                                     |
| **Free Reroll**     | 8         | uso único | Reroll sem gastar os 15 XP padrão                            |
| **Free Rename**     | 3         | uso único | Rename sem gastar os 5 XP padrão                             |
| **Skip Cooldown**   | 5         | uso único | Pula cooldown de brincar/alimentar                            |
| **Force Evolve**    | 50        | uso único | Força evolução sem verificar requisitos (tier disponível) |
| **Reset Stats**     | 25        | uso único | Reseta stats do buddy para recalcular                         |

### 4.3 Habilidades de Interação

| Ability                   | Preço XP | Efeito                                                          |
| ------------------------- | --------- | --------------------------------------------------------------- |
| **Teach Trick**     | 10        | Buddy aprende um "truque" personalizado (frase que repete)      |
| **Mood Swing**      | 5         | Força mudança de humor do buddy                               |
| **Story Time**      | 20        | Buddy conta uma história/micro-ficção gerada                 |
| **Daily Challenge** | 10        | Buddy propõe um mini-desafio (ex: "refatore 3 funções hoje") |
| **Lucky Draw**      | 25        | Sorteia um item aleatório da loja (pode ser raro)              |

---

## 5. Interações Novas (Gasto Social/Expressivo)

### 5.1 Exibições e Status

| Feature                | Preço XP | Descrição                                           |
| ---------------------- | --------- | ----------------------------------------------------- |
| **Profile Card** | 30        | Gera um "card de perfil" ASCII art do buddy com stats |
| **Wall of Fame** | 50        | Buddy aparece com efeito especial por 24h             |
| **Name Glow**    | 25        | Nome do buddy fica colorido por 1 dia                 |
| **Badge**        | 35        | Badge especial no perfil (ex: "Veterano", "Explorer") |

### 5.2 De Bônus (para a sessão)

| Feature               | Preço XP | Descrição                                        |
| --------------------- | --------- | -------------------------------------------------- |
| **Party Mode**  | 10        | Buddy fica festivo por 1h (confetti reactions)     |
| **Zen Mode**    | 8         | Buddy fica calmo, sem reações aleatórias por 2h |
| **Chatty Mode** | 5         | Buddy reage a TUDO por 30min                       |
| **Silent Mode** | 3         | Buddy cala a boca por 1h (sem dicas)               |

---

## 6. Lucky Draw / Gacha

Uma mecânica de sorteio que dá itens aleatórios da loja.

| Opção               | Preço XP | Pool                  |
| --------------------- | --------- | --------------------- |
| **Draw comum**  | 10        | Itens até 15 XP      |
| **Draw raro**   | 30        | Itens até 40 XP      |
| **Draw épico** | 60        | Qualquer item da loja |

Chance de "jackpot": 5% de ganhar item do tier acima.

---

## 7. XP Loss Events (Buddy se Confundiu!)

O buddy não é perfeito. Às vezes ele comete erros e o usuário perde XP. Isso adiciona stakes reais ao sistema e torna o XP mais valioso.

### 7.1 Eventos de Perda de XP

Cada evento tem uma **chance** de acontecer e uma **quantia** de XP perdido.

| Evento                        | Chance                | XP Perdido | Trigger                                |
| ----------------------------- | --------------------- | ---------- | -------------------------------------- |
| **Bug Crítico**        | 40% em bash com erro  | 0.5-2 XP   | Bash retorna `is_error: true`        |
| **Buddy Confundiu**     | 5% por mensagem       | 0.1-0.5 XP | Observer detecta confusão no contexto |
| **Ferramenta Quebrada** | 40% em erro de tool   | 0.3-1 XP   | Tool result com `is_error: true`     |
| **Merge Conflict**      | 35% em git conflict   | 1-3 XP     | Detecta conflito no output do bash     |
| **Loop Infinito**       | 5% em bash longo      | 2-5 XP     | Bash executa > 30 segundos             |
| **Wrong File**          | 15% em edit errado    | 0.5-1.5 XP | Edit falha ou edita arquivo errado     |
| **Buddy Solitário**    | 100% ao abrir sessão | 1-5 XP     | 1+ dia sem pet/brincar/alimentar       |

### 7.2 Proteções contra Perda

| Proteção               | Efeito                                       | Como Obtiver                       |
| ------------------------ | -------------------------------------------- | ---------------------------------- |
| **XP Shield**      | Bloqueia perda de XP por 1 hora              | Comprar na loja (15 XP)            |
| **Streak Guard**   | Perda de XP reduzida em 50%                  | Streak de 7+ dias (passivo)        |
| **Bug Buddy**      | Perda de XP em erros reduzida em 50%         | Conquista "Bug Slayer" (100 erros) |
| **Veteran's Luck** | 10% de chance de ignorar perda completamente | Level 8+                           |

### 7.3 Buddy Solitário (Negligência)

O buddy precisa de atenção! Se o usuário não interage com ele (pet, brincar, alimentar) por mais de 24 horas, o buddy fica triste e perde XP.

**Mecânica:**

- Verificado no início de cada sessão (quando o observer inicializa)
- Compara `companionLastPetDate` com a data atual
- Se passou 1+ dia sem interação: perda de 1-3 XP
- Escala com o tempo: 1 dia = 1 XP, 3 dias = 2 XP, 7+ dias = 3 XP, 10+ dias = 5XP
- Buddy reage com frases tristes: "Tô sozinho há X dias... -Y XP 😢"

**Proteção:** XP Shield bloqueia. Streak de 7+ reduz em 50%.

**Resolução:** Fazer `/buddy pet` reseta o contador e para a perda.

### 7.4 Reações do Buddy quando Perde XP

Quando o buddy causa perda de XP, ele reagir com frases como:

- "Ops! Acho que eu errei... perdemos X XP 😅"
- "Culpa minha! Perdemos X XP, desculpa!"
- "Bug meu! -X XP... vou tentar melhorar!"
- "Confusão aqui! -X XP, mas a gente se recupera!"

### 7.4 Mecânica Anti-Frustração

- XP nunca fica negativo (mínimo 0)
- Perda máxima por evento: 5 XP
- Perda máxima por sessão: 10 XP (cap diário)
- Se o buddy tiver XP Shield ativo, perda é bloqueada
- Se o buddy tiver streak de 7+, perda é reduzida em 50%
- Conquista "Phoenix" (recuperar 50 XP perdidos total): +10 XP bônus

---

## 8. Economia — Balanço de XP

### Fontes de entrada (por semana, uso ativo):

- Tasks (~25): 75 XP
- Bash (~100): 1 XP
- Operações passivas (~1000): 1 XP
- Pet diário (7): 7 XP
- Conquistas (eventual): ~10 XP
- **Total: ~94 XP/semana**

### Perdas estimadas (por semana):

- Bug Crítico (~5 ocorrências): -5 XP
- Ferramenta Quebrada (~3 ocorrências): -2 XP
- Buddy Confundiu (~2 ocorrências): -0.5 XP
- Merge Conflict (~1 ocorrência): -2 XP
- Buddy Solitário (~1 ocorrência se negligenciar): -1-3 XP
- **Total perdas: ~10.5-12.5 XP/semana**

### Gastos desejáveis (por semana):

- 1-2 itens cosméticos: 10-30 XP
- 1 ability ativa: 5-15 XP
- 1 interação social: 10-30 XP
- XP Shield (para dias arriscados): 15 XP
- **Total desejável: ~30-75 XP/semana**

### Balanço líquido:

- **Entrada:** 94 XP
- **Saída (gastos + perdas):** 40-85 XP
- **Sobra:** 9-54 XP/semana

Isso cria um ciclo saudável: o usuário ganha o suficiente pra comprar algo legal toda semana, mas precisa escolher com sabedoria e lidar com perdas ocasionais. O XP Shield vira uma decisão tática: "vale a pena gastar 15 XP pra me proteger hoje?"

---

## 9. Armazenamento

Novos campos no global config:

```
companionShop: {
  ownedAccessories: string[]     // IDs dos acessórios comprados
  ownedThemes: string[]          // IDs dos temas comprados
  ownedEmotes: string[]          // IDs dos packs de emotes
  ownedAbilities: string[]       // IDs das abilities permanentes
  activeAbilities: string[]      // Abilities ativas com duração
  equippedAccessories: string[]  // Acessórios equipados (max 3)
  equippedTheme: string | null   // Tema ativo
  equippedEmotes: string | null  // Pack de emotes ativo
  equippedTitle: string | null   // Título ativo
  customTitle: string | null     // Título customizado
  dailyChallenge: { text: string, date: string, completed: boolean } | null
  streakShieldActive: boolean
  xpBoostUntil: number | null
  quickTipsUntil: number | null    // timestamp de expiração
  codeReviewProUntil: number | null
  nameGlowUntil: number | null
  wallOfFameUntil: number | null
  xpShieldUntil: number | null    // timestamp de expiração do XP Shield
  veteranLuckUnlocked: boolean    // Level 8+ desbloqueia
  bugBuddyUnlocked: boolean       // Conquista "Bug Slayer"
}

companionXpLossLog: {
  totalLost: number               // Total de XP perdido (para conquista Phoenix)
  lastLossDate: string            // Último dia com perda
  dailyLossToday: number          // Perda acumulada hoje (para cap diário)
  solitarioCount: number          // Vezes que tomou penalidade de Buddy Solitário
}
```

---

## 10. Comandos Novos

| Comando                     | Descrição                                                 |
| --------------------------- | ----------------------------------------------------------- |
| `/buddy shop`             | Abre a loja com todas as categorias                         |
| `/buddy shop <categoria>` | Filtra por categoria (acessorios, temas, abilities, emotes) |
| `/buddy buy <item>`       | Compra um item com XP                                       |
| `/buddy equip <item>`     | Equipa um acessório/tema/título                           |
| `/buddy unequip <item>`   | Desequipa                                                   |
| `/buddy inventory`        | Mostra tudo que o buddy possui                              |
| `/buddy draw`             | Faz um lucky draw                                           |
| `/buddy challenge`        | Moja o desafio diário atual                                |
| `/buddy title <texto>`    | Define título custom (se desbloqueado)                     |

---

## 11. Conquistas Relacionadas ao XP Loss

| Conquista                 | Descrição                                        | XP Reward |
| ------------------------- | -------------------------------------------------- | --------- |
| **Phoenix**         | Recuperar 50 XP perdidos total                     | +10 XP    |
| **Streak Guard**    | Manter streak de 7 dias (ativa proteção passiva) | +5 XP     |
| **Bug Slayer**      | Encontrar 100 erros (ativa Bug Buddy)              | +15 XP    |
| **Shield Master**   | Usar XP Shield 10 vezes                            | +20 XP    |
| **Lucky Charm**     | Veteran's Luck bloquear 5 perdas                   | +10 XP    |
| **Resiliente**      | Perder 20 XP em uma sessão e continuar            | +5 XP     |
| **Descuidado**      | Tomar penalidade de Buddy Solitário 3 vezes       | +5 XP     |
| **Cuidador Devoto** | Fazer pet 30 dias seguidos sem falhar              | +25 XP    |

---

## 12. Fases de Implementação

### Fase 1 — Loja Básica + XP Loss

- Shop com cosméticos simples (óculos, monóculo, laço, coroa de flores)
- Comando `/buddy shop`, `/buddy buy`, `/buddy equip`
- Armazenamento no global config
- Sistema de XP loss com Bug Crítico (40%) e Ferramenta Quebrada (40%)
- **Buddy Solitário** — perda de XP por negligência (1+ dia sem pet)
- Reações do buddy quando perde XP
- Cap diário de perda (10 XP)

### Fase 2 — Abilities + Proteções

- Habilidades passivas (Memory Boost, Lucky Star, Deep Scan)
- Habilidades temporizadas (Quick Tips 2h, Code Review Pro 2h, XP Magnet 1d)
- XP Shield (compra na loja)
- Streak Guard (passivo, streak 7+)
- Bug Buddy (conquista "Bug Slayer")
- Veteran's Luck (Level 8+)

### Fase 3 — Interações + Perdas Extras

- Títulos customizados
- Party Mode, Zen Mode, Chatty Mode
- Lucky Draw
- Profile Card ASCII art
- Merge Conflict, Loop Infinito, Wrong File como triggers de perda
- Conquista Phoenix

### Fase 4 — Polish

- Mais acessórios e temas
- Daily Challenge system
- Wall of Fame / Name Glow (1 dia)
- Achievements para compras na loja
- Balanceamento fino das chances de perda

---

## 13. Abordagens Alternativas

### Abordagem A — Loja Direta (recomendada)

Usuário vê itens, escolhe, compra com XP. Simples, previsível, controle total.

- **Pró:** Fácil de entender, baixa frustração
- **Contra:** Sem surpresa

### Abordagem B — Gacha First

Lucky draw é o principal mecanismo. Loja existe mas é secundária.

- **Pró:** Emocionante, dopamine hit
- **Contra:** Pode frustrar quem quer item específico, sensação pay-to-win

### Abordagem C — Hybrid

Loja para itens específicos + Lucky draw para itens exclusivos.

- **Pró:** Melhor dos dois mundos
- **Contra:** Mais complexo de implementar

**Recomendação:** Abordagem A (Loja Direta) como base, com Lucky Draw opcional como feature divertida depois. O sistema deve ser justo e transparente.
