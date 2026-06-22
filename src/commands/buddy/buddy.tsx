import type {
  LocalJSXCommandContext,
  LocalJSXCommandOnDone,
} from "../../types/command.js";
import { getGlobalConfig, saveGlobalConfig } from "../../utils/config.js";
import { getLevelInfo } from "../../buddy/progression.js";
import {
  companionUserId,
  getCompanion,
  rollWithSeed,
} from "../../buddy/companion.js";
import type {
  StoredCompanion,
  Companion,
  CompanionBones,
} from "../../buddy/types.js";
import { SPECIES } from "../../buddy/types.js";
import { renderSprite, spriteFrameCount } from "../../buddy/sprites.js";
import { pickDeterministic } from "../../buddy/hash.js";
import { processStreak } from "../../buddy/streak.js";
import { getMood } from "../../buddy/mood.js";
import { getSessionSummary } from "../../buddy/skills.js";
import { addReminder } from "../../buddy/reminders.js";
import {
  OUTFITS,
  getUnlockedOutfits,
  getActiveOutfit,
  equipOutfit,
  unequipOutfit,
  equipHat,
  unequipHat,
  checkAndUnlockOutfits,
  getOutfitRequirements,
  getHatRequirements,
} from "../../buddy/outfits.js";
import { addMemory, getMemories } from "../../buddy/memory.js";
import {
  getEvolution,
  getEvolutionChain,
  getEvolutionTier,
  EVOLUTION_CHAINS,
} from "../../buddy/evolution.js";
import {
  checkShinyBug,
  checkDoubleRainbow,
  checkMidnightEvolve,
} from "../../buddy/easter-eggs.js";
import { getTodayJournal, formatJournal } from "../../buddy/journal.js";
import { getSeasonalMessage } from "../../buddy/seasonal.js";
import { getAchievementProgress } from "../../buddy/achievements.js";
import { COMMON_HELP_ARGS, COMMON_INFO_ARGS } from "../../constants/xml.js";
import {
  buyItem,
  equipItem,
  unequipItem,
  getInventory,
  formatShop,
  luckyDraw,
  addToInventory,
  getAllOwnedIds,
  consumeAbility,
  hasAbility,
  formatAbilities,
} from "../../buddy/shop.js";

import { getTodayQuests, getTodayString } from '../../buddy/quests.js'

const NAME_PREFIXES = [
  "Byte",
  "Echo",
  "Glint",
  "Miso",
  "Nova",
  "Pixel",
  "Rune",
  "Static",
  "Vector",
  "Whisk",
] as const;

const NAME_SUFFIXES = [
  "bean",
  "bit",
  "bud",
  "dot",
  "ling",
  "loop",
  "moss",
  "patch",
  "puff",
  "spark",
] as const;

const PERSONALITIES = [
  "Curioso e encorajador silenciosamente",
  "Um pequeno observador paciente com fortes instintos de debug",
  "Brincalhão, observador, e desconfiado de testes instáveis",
  "Calmo sob pressão e fã de diffs limpos",
  "Um pequeno gremlin de terminal que adora builds bem-sucedidos",
] as const;

const PET_REACTIONS = [
  "se encosta no cafuné",
  "faz um pulinho orgulhoso",
  "emite um beep satisfeito",
  "parece encantado",
  "balança feliz",
] as const;

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function createStoredCompanion(): StoredCompanion {
  const userId = companionUserId();
  const prefix = pickDeterministic(NAME_PREFIXES, `${userId}:prefix`);
  const suffix = pickDeterministic(NAME_SUFFIXES, `${userId}:suffix`);
  const personality = pickDeterministic(PERSONALITIES, `${userId}:personality`);

  return {
    name: `${prefix}${suffix}`,
    personality: `${personality}.`,
    hatchedAt: Date.now(),
  };
}

function setCompanionReaction(
  context: LocalJSXCommandContext,
  reaction: string | undefined,
  pet = false,
  evolve = false,
): void {
  context.setAppState((prev) => ({
    ...prev,
    companionReaction: reaction,
    companionPetAt: pet ? Date.now() : prev.companionPetAt,
    companionEvolvingAt: evolve ? Date.now() : prev.companionEvolvingAt,
  }));
}

function showHelp(onDone: LocalJSXCommandOnDone): void {
  onDone(
    "Uso: /buddy [status|mute|unmute|compact|decompact|preview|rename|reroll|brincar|alimentar|hidratei|quests|stats|outfits|equipar|outfit|chapeu|resumo|lembrar|memorias|evolve|requisitos|pet premium|achievements|journal|shop|buy|equip|unequip|inventory|abilities|draw|help]\n\nExecute /buddy sem argumentos para chocar seu companion na primeira vez, depois acaricie nas próximas.\n\nFontes de XP:\n  Bash com sucesso: +0.1 XP\n  Read/Write/Edit/Search: +0.1 XP\n  Pet diário: +1 XP (primeiro /buddy do dia)\n  Task concluída: +3 XP\n  Alimentar: +0.5 XP (cooldown: 1h)\n  Brincar: +0.5 XP (cooldown: 1h)\n  Hidratei: +0.5 XP (cooldown: 1h)\n  Quests: +1 a +5 XP (diário)\n  Easter eggs: +3 a +20 XP\n\nComandos:\n  /buddy rename <nome> — Custo: 5 XP, Requer Level 2\n  /buddy reroll — Gratuito (Temporariamente)\n  /buddy reroll especie — Custo: 50 XP (Rerrola para outra espécie do mesmo Tier de evolução)\n  /buddy brincar — Brinque com seu buddy (+0.5 XP, cooldown: 1h)\n  /buddy alimentar — Alimente seu buddy (+0.5 XP, cooldown: 1h)\n  /buddy hidratei — Avisa que você bebeu água e arrumou a postura (+0.5 XP, cooldown: 1h)\n  /buddy quests — Veja suas missões diárias\n  /buddy pet premium — Ativa modo premium 1h (1 XP)\n  /buddy outfit <nome> — Equipa outfit (2 XP)\n  /buddy evolve — Evolui species (50 XP, Level 4+)\n  /buddy compact — Modo compacto (face de 1 linha)\n  /buddy decompact — Modo completo (sprite 24x10)\n  /buddy preview — Mostra todas as espécies\n  /buddy stats — Mostra estatísticas do buddy\n  /buddy resumo — Resumo da sessão (Level 4+)\n  /buddy outfits — Veja os outfits disponíveis\n  /buddy equipar <nome> — Equipe um outfit\n  /buddy chapeu <nome> — Troque seu chapéu\n  /buddy requisitos — Veja requisitos de outfits e chapéus\n  /buddy lembrar <min> <texto> — Define um lembrete\n  /buddy memorias — Veja as memórias do seu buddy\n  /buddy journal — Diário de hoje\n  /buddy achievements — Veja suas conquistas\n  /buddy shop — Visite a loja de itens\n  /buddy shop <categoria> — Filtra por categoria\n  /buddy buy <item-id> — Compra um item com XP\n  /buddy equip <item-id> — Equipa um item\n  /buddy unequip <item-id> — Desequipa um item\n  /buddy inventory — Veja seus itens\n  /buddy abilities — Veja abilities ativas\n  /buddy draw [comum|raro|epico] — Lucky Draw",
    { display: 'system' },
  )
}

export async function call(
  onDone: LocalJSXCommandOnDone,
  context: LocalJSXCommandContext,
  args?: string,
): Promise<null> {
  let arg = args?.trim().toLowerCase() ?? "";

  if (COMMON_HELP_ARGS.includes(arg) || arg === "") {
    const existing = getCompanion();
    if (arg !== "" || existing) {
      if (arg !== "") {
        showHelp(onDone);
        return null;
      }
    }
  }

  if (arg === "preview") {
    const defaultBones: CompanionBones = {
      species: "duck" as any,
      eye: "·",
      hat: "none",
      rarity: "common",
      shiny: false,
      stats: { DEBUGGING: 0, PATIENCE: 0, CHAOS: 0, WISDOM: 0, SNARK: 0 },
    };
    const lines: string[] = [];
    for (const species of SPECIES) {
      const bones = { ...defaultBones, species };
      const frameCount = spriteFrameCount(species);
      const frames: string[][] = [];
      for (let f = 0; f < frameCount; f++) {
        frames.push(renderSprite(bones, f));
      }
      // Pad all frames to same height
      const maxLines = Math.max(...frames.map((f) => f.length));
      for (const frame of frames) {
        while (frame.length < maxLines) frame.unshift("");
      }
      lines.push(`\n=== ${species} ===`);
      for (let row = 0; row < maxLines; row++) {
        const rowParts = frames.map((f) => (f[row] || "").padEnd(24));
        lines.push(rowParts.join(" | "));
      }
    }
    onDone(lines.join("\n"), { display: "system" });
    return null;
  }

  if (COMMON_INFO_ARGS.includes(arg) || arg === "status") {
    const companion = getCompanion();
    if (!companion) {
      onDone("No buddy hatched yet. Run /buddy to hatch one.", {
        display: "system",
      });
      return null;
    }
    const xp = companion.xp ?? 0;
    const levelInfo = getLevelInfo(xp);
    const mutedStatus = getGlobalConfig().companionMuted
      ? "Silenciado"
      : "Ouvindo";
    const xpDisplay = xp % 1 === 0 ? xp.toString() : xp.toFixed(1);
    const mood = await getMood();
    const premiumUntil = companion.premiumUntil ?? 0;
    const premiumActive = premiumUntil > Date.now();
    const premiumDisplay = premiumActive
      ? ` (${Math.ceil((premiumUntil - Date.now()) / 60000)}min restantes)`
      : "";
    const evolvedFrom = companion.evolvedFrom
      ? `\nEvolução: ${companion.evolvedFrom} → ${companion.species}`
      : "";
    const tier = getEvolutionTier(companion.species);
    const tierDisplay = tier > 0 ? ` [Tier ${tier}]` : "";

    onDone(
      `Nome: ${companion.name} (${titleCase(companion.rarity)} ${companion.species}${tierDisplay})
Nível: ${levelInfo.level} (${xpDisplay} XP)
Estado: ${mutedStatus}${premiumDisplay ? " | Premium 🔥" : ""}
Personalidade: ${companion.personality}
Humor: ${mood.emoji} "${mood.text}"${evolvedFrom}`,
      { display: "system" },
    );
    return null;
  }

  if (arg === "stats") {
    const companion = getCompanion();
    if (!companion) {
      onDone("Nenhum buddy ainda. Use /buddy para criar um.", {
        display: "system",
      });
      return null;
    }

    // Force observer validation for 'stats' to complete itself
    saveGlobalConfig(current => {
      const today = getTodayString()
      let questData = current.companionQuests
      if (questData?.date !== today) questData = { date: today, completed: {} }

      const q = getTodayQuests().find(q => q.id === 'buddy_stats')
      if (q && !questData.completed[q.id]) {
        questData.completed[q.id] = true
        return {
          ...current,
          companionQuests: questData,
          companion: current.companion ? {
            ...current.companion,
            xp: Math.round(((current.companion.xp ?? 0) + q.xpReward) * 10) / 10
          } : undefined
        }
      }
      return current
    })

    const config = getGlobalConfig();
    const stats = config.companionStats ?? {
      totalBashes: 0,
      totalTasks: 0,
      totalErrors: 0,
      totalPets: 0,
      totalReads: 0,
      totalWrites: 0,
      totalEdits: 0,
      totalSearches: 0,
      daysActive: 0,
      totalTokensSaved: 0,
      totalFeedbackRules: 0,
      totalFeedbackConfirms: 0,
      totalSessionMinutes: 0,
    };
    const xp = companion.xp ?? 0;
    const levelInfo = getLevelInfo(xp);
    const streak = config.companionStreakCount ?? 0;

    onDone(
      `📊 Estatísticas do ${companion.name}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `Level: ${levelInfo.level} (${xp} XP)\n` +
        `Streak: ${streak} dias\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `Comandos executados: ${stats.totalBashes}\n` +
        `Tasks concluídas: ${stats.totalTasks}\n` +
        `Erros encontrados: ${stats.totalErrors}\n` +
        `Leituras (Read): ${stats.totalReads ?? 0}\n` +
        `Escritas (Write): ${stats.totalWrites ?? 0}\n` +
        `Edições (Edit): ${stats.totalEdits ?? 0}\n` +
        `Buscas (Search): ${stats.totalSearches ?? 0}\n` +
        `Pets recebidos: ${stats.totalPets}\n` +
        `Dias ativos: ${stats.daysActive}\n` +
        `Tempo de uso: ${((stats.totalSessionMinutes ?? 0) / 60).toFixed(1)} horas (${stats.totalSessionMinutes ?? 0} minutos)\n` +
        `Tokens economizados (stoneage): ${stats.totalTokensSaved}` +
        ((stats.totalFeedbackRules ?? 0) > 0 ||
        (stats.totalFeedbackConfirms ?? 0) > 0
          ? `\n━━━━━━━━━━━━━━━━━━━━━━\n` +
            `Regras de feedback: ${stats.totalFeedbackRules ?? 0}\n` +
            `Confirmações: ${stats.totalFeedbackConfirms ?? 0}`
          : ""),
      { display: "system" },
    );
    return null;
  }

  if (arg === "resumo") {
    const summary = getSessionSummary();
    if (!summary) {
      onDone("Seu buddy precisa estar no Level 4 para dar resumos.", {
        display: "system",
      });
      return null;
    }
    onDone(summary, { display: "system" });
    return null;
  }

  if (arg.startsWith("lembrar ")) {
    const companion = getCompanion();
    if (!companion) {
      onDone("Nenhum buddy ainda. Use /buddy para criar um.", {
        display: "system",
      });
      return null;
    }

    const lembrarArgs = arg.slice("lembrar ".length);
    const parts = lembrarArgs.match(/^(\d+)\s+(.+)$/);
    if (!parts) {
      onDone(
        "Uso: /buddy lembrar <minutos> <texto>\nExemplo: /buddy lembrar 10 revisar PR",
        { display: "system" },
      );
      return null;
    }

    const minutes = parseInt(parts[1]!);
    const text = parts[2]!.trim();

    if (minutes < 1 || minutes > 1440) {
      onDone("O tempo deve ser entre 1 e 1440 minutos (24 horas).", {
        display: "system",
      });
      return null;
    }

    if (!text) {
      onDone("Preciso de um texto para o lembrete.", { display: "system" });
      return null;
    }

    addReminder(minutes, text);
    onDone(
      `${companion.name}: Beleza! Vou te lembrar em ${minutes} minuto${minutes > 1 ? "s" : ""}: "${text}"`,
      { display: "system" },
    );
    return null;
  }

  if (arg === "memorias") {
    const companion = getCompanion();
    if (!companion) {
      onDone("Nenhum buddy ainda. Use /buddy para criar um.", {
        display: "system",
      });
      return null;
    }

    const memories = getMemories();
    if (memories.length === 0) {
      onDone(`${companion.name} ainda não tem memórias.`, {
        display: "system",
      });
      return null;
    }

    const list = memories
      .map((m) => {
        const date = new Date(m.timestamp).toLocaleDateString("pt-BR");
        return `  • ${m.text} (${date})`;
      })
      .join("\n");

    onDone(`🧠 Memórias do ${companion.name}:\n${list}`, { display: "system" });
    return null;
  }

  // --- BEGIN NEW COMMANDS: RENAME & REROLL ---

  const [baseCommand, ...restArgs] = arg.split(" ");

  if (baseCommand === "rename") {
    const companion = getCompanion();
    if (!companion) {
      onDone("Nenhum buddy ainda. Use /buddy para criar um.", {
        display: "system",
      });
      return null;
    }

    const newName = restArgs.join(" ").trim();
    if (!newName || newName.length > 30) {
      onDone(
        "Uso: /buddy rename <novo nome>\nO nome deve ter entre 1 e 30 caracteres.\nCusto: 5 XP, Requer Level 2",
        { display: "system" },
      );
      return null;
    }

    const xp = companion.xp ?? 0;
    const levelInfo = getLevelInfo(xp);

    if (levelInfo.level < 2) {
      onDone(
        `Seu buddy precisa estar pelo menos no Level 2 para ser renomeado. (Atual: Level ${levelInfo.level})`,
        { display: "system" },
      );
      return null;
    }

    const freeRename = hasAbility("free-rename");
    if (!freeRename && xp < 5) {
      onDone(`Renomear custa 5 XP. Você só tem ${xp} XP. (Ou compre Free Rename na loja!)`, {
        display: "system",
      });
      return null;
    }

    if (freeRename) {
      consumeAbility("free-rename");
    }

    saveGlobalConfig((current) => ({
      ...current,
      companion: current.companion
        ? {
            ...current.companion,
            name: titleCase(newName),
            xp: freeRename ? xp : xp - 5,
          }
        : undefined,
    }));

    addMemory("rename", titleCase(newName));
    setCompanionReaction(
      context,
      `*sons felizes* Gostei do meu novo nome!`,
      true,
    );
    onDone(
      `Buddy renomeado para ${titleCase(newName)} com sucesso! (Custo: 5 XP)`,
      { display: "system" },
    );
    return null;
  }

  if (baseCommand === "reroll") {
    const companion = getCompanion();
    if (!companion) {
      onDone("Nenhum buddy ainda. Use /buddy para criar um.", {
        display: "system",
      });
      return null;
    }

    const subOption = restArgs[0]?.trim().toLowerCase();
    const isSpeciesReroll = subOption === "especie" || subOption === "espécie";
    const cost = isSpeciesReroll ? 50 : 15;

    const xp = companion.xp ?? 0;
    const freeReroll = hasAbility("free-reroll") && !isSpeciesReroll;

    if (!freeReroll && xp < cost) {
      onDone(
        `Rerrolar ${isSpeciesReroll ? "a espécie " : ""}custa ${cost} XP. Você só tem ${xp} XP. (Ou compre Free Reroll na loja!)`,
        { display: "system" },
      );
      return null;
    }

    if (freeReroll) {
      consumeAbility("free-reroll");
    }

    const newSeed = Math.random().toString(36).substring(7);

    let newSpecies = companion.species;
    let newEvolvedFrom = companion.evolvedFrom;

    if (isSpeciesReroll) {
      const tier = getEvolutionTier(companion.species) || 1;
      const tierIndex = tier - 1;
      const pool = EVOLUTION_CHAINS.map((chain) => chain[tierIndex] as string);
      const candidatePool = pool.filter((s) => s !== companion.species);

      if (candidatePool.length > 0) {
        newSpecies = candidatePool[Math.floor(Math.random() * candidatePool.length)]! as any;
        const newChain = getEvolutionChain(newSpecies);
        if (tier === 2 && newChain) {
          newEvolvedFrom = newChain[0];
        } else if (tier === 3 && newChain) {
          newEvolvedFrom = newChain[1];
        } else {
          newEvolvedFrom = undefined;
        }
      }
    }

    // Shiny roll: 1% normal, 5% with Lucky Star
    const shinyChance = hasAbility("lucky-star") ? 0.05 : 0.01;
    const newShiny = companion.shiny || Math.random() < shinyChance;

    saveGlobalConfig((current) => ({
      ...current,
      companion: current.companion
        ? {
            ...current.companion,
            xp: freeReroll ? xp : xp - cost,
            seed: newSeed,
            species: newSpecies as any,
            evolvedFrom: newEvolvedFrom,
            shiny: newShiny,
          }
        : undefined,
    }));

    addMemory("reroll");
    const shinyMsg = newShiny && !companion.shiny ? " ✨ SHINY!" : "";
    setCompanionReaction(context, `*puf* Me sinto diferente!${shinyMsg}`, true);

    const speciesMsg = isSpeciesReroll ? ` para um ${newSpecies}` : "";
    const costMsg = freeReroll ? "(Free Reroll!)" : `(Custo: ${cost} XP)`;
    onDone(
      `Buddy rerrolado com sucesso${speciesMsg}! ${costMsg}. Execute /buddy status para ver as mudanças.`,
      { display: "system" },
    );
    return null;
  }

  // --- END NEW COMMANDS ---

  // Pet interactivo — brincar
  if (arg === "brincar") {
    const companion = getCompanion();
    if (!companion) {
      onDone("Nenhum buddy ainda. Use /buddy para criar um.", {
        display: "system",
      });
      return null;
    }

    // Force observer validation for 'brincar' to complete itself
    saveGlobalConfig(current => {
      const today = getTodayString()
      let questData = current.companionQuests
      if (questData?.date !== today) questData = { date: today, completed: {} }

      const q = getTodayQuests().find(q => q.id === 'buddy_brincar')
      if (q && !questData.completed[q.id]) {
        questData.completed[q.id] = true
        return {
          ...current,
          companionQuests: questData,
          companion: current.companion ? {
            ...current.companion,
            xp: Math.round(((current.companion.xp ?? 0) + q.xpReward) * 10) / 10
          } : undefined
        }
      }
      return current
    })

    const config = getGlobalConfig();
    const lastBrincar = config.companionLastAction?.brincar ?? 0;
    const now = Date.now();
    const cooldown = 60 * 60 * 1000; // 1 hora
    const skipCooldown = hasAbility("skip-cooldown");

    if (!skipCooldown && now - lastBrincar < cooldown) {
      const remaining = Math.ceil((cooldown - (now - lastBrincar)) / 60000);
      onDone(
        `${companion.name} ainda está cansado da última brincadeira. Tente novamente em ${remaining} minutos. (Ou compre Skip Cooldown na loja!)`,
        { display: "system" },
      );
      return null;
    }

    if (skipCooldown) {
      consumeAbility("skip-cooldown");
    }

    const reactions = [
      `${companion.name} corre em círculos felizes! 🎾`,
      `${companion.name} pula de alegria! 🦘`,
      `${companion.name} faz uma dança engraçada! 💃`,
      `${companion.name} rola no chão de barriga pra cima! 🤸`,
      `${companion.name} brinca de esconde-esconde! 🫣`,
    ];
    const reaction =
      reactions[Math.floor(Date.now() / 1000) % reactions.length]!;

    // +0.5 XP por brincar
    const xp = companion.xp ?? 0;
    const newXp = Math.round((xp + 0.5) * 1000) / 1000;

    saveGlobalConfig((current) => ({
      ...current,
      companionLastAction: {
        ...current.companionLastAction,
        brincar: now,
      },
      companion: current.companion
        ? {
            ...current.companion,
            xp: newXp,
          }
        : undefined,
    }));

    setCompanionReaction(context, reaction, true);
    onDone(undefined, { display: "skip" });
    return null;
  }

  // Pet interactivo — alimentar
  if (arg === "alimentar") {
    const companion = getCompanion();
    if (!companion) {
      onDone("Nenhum buddy ainda. Use /buddy para criar um.", {
        display: "system",
      });
      return null;
    }

    const config = getGlobalConfig();
    const lastAlimentar = config.companionLastAction?.alimentar ?? 0;
    const now = Date.now();
    const cooldown = 60 * 60 * 1000; // 1 hora
    const skipCooldownFeed = hasAbility("skip-cooldown");

    if (!skipCooldownFeed && now - lastAlimentar < cooldown) {
      const remaining = Math.ceil((cooldown - (now - lastAlimentar)) / 60000);
      onDone(
        `${companion.name} não está com fome agora. Tente novamente em ${remaining} minutos. (Ou compre Skip Cooldown na loja!)`,
        { display: "system" },
      );
      return null;
    }

    if (skipCooldownFeed) {
      consumeAbility("skip-cooldown");
    }

    const reactions = [
      `${companion.name} come com vontade! Yum! 🍕`,
      `${companion.name} saboreia o lanche! 😋`,
      `${companion.name} lambe os beiços! 🤤`,
      `${companion.name} faz uma refeição deliciosa! 🍽️`,
    ];
    const reaction =
      reactions[Math.floor(Date.now() / 1000) % reactions.length]!;

    // +0.5 XP por alimentar
    const xp = companion.xp ?? 0;
    const newXp = Math.round((xp + 0.5) * 1000) / 1000;

    saveGlobalConfig((current) => ({
      ...current,
      companionLastAction: {
        ...current.companionLastAction,
        alimentar: now,
      },
      companion: current.companion
        ? {
            ...current.companion,
            xp: newXp,
          }
        : undefined,
    }));

    setCompanionReaction(context, reaction, true);
    onDone(undefined, { display: "skip" });
    return null;
  }

  // Interação de saúde — hidratei
  if (arg === 'hidratei') {
    const companion = getCompanion()
    if (!companion) {
      onDone('Nenhum buddy ainda. Use /buddy para criar um.', { display: 'system' })
      return null
    }

    // Force observer validation for 'hidratei' to complete itself
    saveGlobalConfig(current => {
      const today = getTodayString()
      let questData = current.companionQuests
      if (questData?.date !== today) questData = { date: today, completed: {} }

      const q = getTodayQuests().find(q => q.id === 'buddy_hidratei')
      if (q && !questData.completed[q.id]) {
        questData.completed[q.id] = true
        return {
          ...current,
          companionQuests: questData,
          companion: current.companion ? {
            ...current.companion,
            xp: Math.round(((current.companion.xp ?? 0) + q.xpReward) * 10) / 10
          } : undefined
        }
      }
      return current
    })

    const config = getGlobalConfig()
    const lastHidratei = config.companionLastAction?.hidratei ?? 0
    const now = Date.now()
    const cooldown = 60 * 60 * 1000 // 1 hora

    const reactions = [
      `${companion.name} enche um copinho de água também! 🥤`,
      `${companion.name} aprova sua postura de não-camarão! 🦐🚫`,
      `${companion.name} faz um brinde com sua garrafinha d'água! 🚰`,
      `${companion.name} sorri ao ver você cuidando da saúde! 🧘`,
    ]
    const reaction = reactions[Math.floor(Date.now() / 1000) % reactions.length]!

    if (now - lastHidratei < cooldown) {
      // Já ganhou XP recentemente, mas vamos registrar a ação para o humor e dar a mensagem normal (sem XP extra).
      saveGlobalConfig(current => ({
        ...current,
        companionLastAction: {
          ...current.companionLastAction,
          hidratei: now,
        },
      }))
      setCompanionReaction(context, reaction, true)
      onDone(`Boa! Postura reta e hidratado! (XP em cooldown)`, { display: 'system' })
      return null
    }

    // +0.5 XP por hidratar/postura (primeira vez na hora)
    const xp = companion.xp ?? 0
    const newXp = Math.round((xp + 0.5) * 10) / 10

    saveGlobalConfig(current => ({
      ...current,
      companionLastAction: {
        ...current.companionLastAction,
        hidratei: now,
      },
      companion: current.companion ? {
        ...current.companion,
        xp: newXp,
      } : undefined,
    }))

    setCompanionReaction(context, reaction, true)
    onDone(`Boa! Postura reta e hidratado! (+0.5 XP)`, { display: 'system' })
    return null
  }

  if (arg === 'quests') {
    const companion = getCompanion()
    if (!companion) {
      onDone('Nenhum buddy ainda. Use /buddy para criar um.', { display: 'system' })
      return null
    }

    // Force observer validation for 'quests' to complete itself
    saveGlobalConfig(current => {
      const today = getTodayString()
      let questData = current.companionQuests
      if (questData?.date !== today) questData = { date: today, completed: {} }

      const q = getTodayQuests().find(q => q.id === 'buddy_quests')
      if (q && !questData.completed[q.id]) {
        questData.completed[q.id] = true
        return {
          ...current,
          companionQuests: questData,
          companion: current.companion ? {
            ...current.companion,
            xp: Math.round(((current.companion.xp ?? 0) + q.xpReward) * 10) / 10
          } : undefined
        }
      }
      return current
    })

    const quests = getTodayQuests()
    const config = getGlobalConfig()
    const today = getTodayString()
    const questData = config.companionQuests?.date === today ? config.companionQuests : { completed: {} }

    const list = quests.map(q => {
      const isCompleted = questData.completed[q.id]
      return `  [${isCompleted ? 'x' : ' '}] ${q.description} (+${q.xpReward} XP)`
    }).join('\n')

    onDone(`📋 Missões Diárias do ${companion.name}:\n\n${list}`, { display: 'system' })
    return null
  }

  if (arg === 'outfits') {
    const companion = getCompanion()
    if (!companion) {
      onDone("Nenhum buddy ainda. Use /buddy para criar um.", {
        display: "system",
      });
      return null;
    }

    // Force observer validation for 'outfits' to complete itself
    saveGlobalConfig(current => {
      const today = getTodayString()
      let questData = current.companionQuests
      if (questData?.date !== today) questData = { date: today, completed: {} }

      const q = getTodayQuests().find(q => q.id === 'buddy_outfits')
      if (q && !questData.completed[q.id]) {
        questData.completed[q.id] = true
        return {
          ...current,
          companionQuests: questData,
          companion: current.companion ? {
            ...current.companion,
            xp: Math.round(((current.companion.xp ?? 0) + q.xpReward) * 10) / 10
          } : undefined
        }
      }
      return current
    })

    const unlocked = getUnlockedOutfits()
    const active = getActiveOutfit()

    const list = OUTFITS.map((o) => {
      const isUnlocked = unlocked.includes(o.id);
      const isActive = active === o.id;
      const status = isActive ? " ✅ (equipado)" : isUnlocked ? " 🔓" : " 🔒";
      return `  ${status} ${o.name} — ${o.description}${!isUnlocked ? `\n      Requisito: ${o.requirement}` : ""}`;
    }).join("\n");

    onDone(`🎨 Outfits do ${companion.name}:\n${list}`, { display: "system" });
    return null;
  }

  if (baseCommand === "equipar") {
    const companion = getCompanion();
    if (!companion) {
      onDone("Nenhum buddy ainda. Use /buddy para criar um.", {
        display: "system",
      });
      return null;
    }

    const outfitName = restArgs.join(" ").trim().toLowerCase();
    if (!outfitName) {
      onDone(
        "Uso: /buddy equipar <nome do outfit>\nVeja os outfits disponíveis com /buddy outfits",
        { display: "system" },
      );
      return null;
    }

    if (outfitName === "nenhum" || outfitName === "none" || outfitName === "remover") {
      unequipOutfit();
      setCompanionReaction(context, `${companion.name}: Ah... de volta ao normal!`, true);
      onDone(`Outfit removido com sucesso!`, { display: "system" });
      return null;
    }

    const outfit = OUTFITS.find(
      (o) => o.name.toLowerCase() === outfitName || o.id === outfitName,
    );
    if (!outfit) {
      onDone(
        `Outfit "${outfitName}" não encontrado. Use /buddy outfits para ver os disponíveis.`,
        { display: "system" },
      );
      return null;
    }

    if (!equipOutfit(outfit.id)) {
      onDone(
        `${outfit.name} ainda não foi desbloqueado! Requisito: ${outfit.requirement}`,
        { display: "system" },
      );
      return null;
    }

    setCompanionReaction(
      context,
      `${companion.name}: Uau! Estou usando o outfit ${outfit.name}!`,
      true,
    );
    onDone(`Outfit ${outfit.name} equipado!`, { display: "system" });
    return null;
  }

  // Chapéu: equipa chapéu desbloqueado
  if (baseCommand === "chapeu" || baseCommand === "chapéu") {
    const companion = getCompanion();
    if (!companion) {
      onDone("Nenhum buddy ainda. Use /buddy para criar um.", {
        display: "system",
      });
      return null;
    }

    const hatName = restArgs.join(" ").trim().toLowerCase();
    if (!hatName) {
      const hatReqs = getHatRequirements();
      const currentHat = companion.hat ?? "none";
      const list = hatReqs
        .map((h) => {
          const equipped = h.hat === currentHat ? " ✅ (equipado)" : "";
          return `  ${h.unlocked ? "🔓" : "🔒"} ${h.hat} — ${h.requirement}${equipped}`;
        })
        .join("\n");
      onDone(
        `🎩 Chapéus do ${companion.name}:\n${list}\n\nUse /buddy chapeu <nome> para equipar.`,
        { display: "system" },
      );
      return null;
    }

    if (hatName === "nenhum" || hatName === "none" || hatName === "remover") {
      unequipHat();
      setCompanionReaction(context, `${companion.name}: Cabelos ao vento!`, true);
      onDone(`Chapéu removido com sucesso!`, { display: "system" });
      return null;
    }

    if (!equipHat(hatName)) {
      onDone(
        `Chapéu "${hatName}" não disponível ou ainda não desbloqueado. Use /buddy chapeu para ver os disponíveis.`,
        { display: "system" },
      );
      return null;
    }

    setCompanionReaction(
      context,
      `${companion.name}: Uau! Estou usando o chapéu ${hatName}!`,
      true,
    );
    onDone(`Chapéu ${hatName} equipado!`, { display: "system" });
    return null;
  }

  // Pet Premium: 1 XP, ativa modo premium por 1h
  if (baseCommand === "pet") {
    if (restArgs[0] === "premium") {
      const companion = getCompanion();
      if (!companion) {
        onDone("Nenhum buddy ainda. Use /buddy para criar um.", {
          display: "system",
        });
        return null;
      }

      const xp = companion.xp ?? 0;
      if (xp < 1) {
        onDone(`Pet premium custa 1 XP. Você só tem ${xp} XP.`, {
          display: "system",
        });
        return null;
      }

      const now = Date.now();
      const currentPremium = companion.premiumUntil ?? 0;
      if (currentPremium > now) {
        const remaining = Math.ceil((currentPremium - now) / 60000);
        onDone(
          `${companion.name} já está em modo premium! Restam ${remaining} minutos.`,
          { display: "system" },
        );
        return null;
      }

      saveGlobalConfig((current) => ({
        ...current,
        companion: current.companion
          ? {
              ...current.companion,
              xp: Math.round((xp - 1) * 1000) / 1000,
              premiumUntil: now + 3600000,
            }
          : undefined,
      }));

      addMemory("petPremium");
      setCompanionReaction(
        context,
        `${companion.name}: 🔥 Modo premium ativado! Tô em chamas por 1 hora!`,
        true,
      );
      onDone(
        `Modo premium ativado! Por 1 hora: Code Review com 90% chance, Dicas de Erro com 70% chance. (Custo: 1 XP)`,
        { display: "system" },
      );
      return null;
    } else {
      // Treating '/buddy pet' as a normal pet action: clear the argument so it falls through to petting at the end of call
      arg = "";
    }
  }

  // Outfit com custo de XP: 2 XP para equipar
  if (baseCommand === "outfit") {
    const companion = getCompanion();
    if (!companion) {
      onDone("Nenhum buddy ainda. Use /buddy para criar um.", {
        display: "system",
      });
      return null;
    }

    const outfitName = restArgs.join(" ").trim().toLowerCase();
    if (!outfitName) {
      onDone(
        "Uso: /buddy outfit <nome do outfit>\nCusto: 2 XP. Veja os disponíveis com /buddy outfits",
        { display: "system" },
      );
      return null;
    }

    if (outfitName === "nenhum" || outfitName === "none" || outfitName === "remover") {
      unequipOutfit();
      setCompanionReaction(context, `${companion.name}: Ah... de volta ao normal!`, true);
      onDone(`Outfit removido com sucesso!`, { display: "system" });
      return null;
    }

    const outfit = OUTFITS.find(
      (o) => o.name.toLowerCase() === outfitName || o.id === outfitName,
    );
    if (!outfit) {
      onDone(
        `Outfit "${outfitName}" não encontrado. Use /buddy outfits para ver os disponíveis.`,
        { display: "system" },
      );
      return null;
    }

    const xp = companion.xp ?? 0;
    if (xp < 2) {
      onDone(`Equipar outfit custa 2 XP. Você só tem ${xp} XP.`, {
        display: "system",
      });
      return null;
    }

    if (!equipOutfit(outfit.id)) {
      onDone(
        `${outfit.name} ainda não foi desbloqueado! Requisito: ${outfit.requirement}`,
        { display: "system" },
      );
      return null;
    }

    saveGlobalConfig((current) => ({
      ...current,
      companion: current.companion
        ? {
            ...current.companion,
            xp: Math.round((xp - 2) * 1000) / 1000,
          }
        : undefined,
    }));

    setCompanionReaction(
      context,
      `${companion.name}: Uau! Estou usando o outfit ${outfit.name}!`,
      true,
    );
    onDone(`Outfit ${outfit.name} equipado! (Custo: 2 XP)`, {
      display: "system",
    });
    return null;
  }

  // Evolução: 50 XP, Level 4+, cadeia fixa
  if (baseCommand === "evolve") {
    const companion = getCompanion();
    if (!companion) {
      onDone("Nenhum buddy ainda. Use /buddy para criar um.", {
        display: "system",
      });
      return null;
    }

    const xp = companion.xp ?? 0;
    const levelInfo = getLevelInfo(xp);

    if (levelInfo.level < 4) {
      onDone(
        `Evolução requer Level 4. Seu buddy está no Level ${levelInfo.level}.`,
        { display: "system" },
      );
      return null;
    }

    if (xp < 50) {
      onDone(`Evolução custa 50 XP. Você só tem ${xp} XP.`, {
        display: "system",
      });
      return null;
    }

    const nextSpecies = getEvolution(companion.species);
    if (!nextSpecies) {
      onDone(`${companion.name} já está no estágio máximo de evolução!`, {
        display: "system",
      });
      return null;
    }

    const currentSpecies = companion.species;

    // Easter Egg: Midnight Evolve
    const midnightEvolve = checkMidnightEvolve();
    const midnightBonus = midnightEvolve.triggered
      ? midnightEvolve.xpBonus!
      : 0;
    const totalCost = 50 - midnightBonus;

    saveGlobalConfig((current) => ({
      ...current,
      companion: current.companion
        ? {
            ...current.companion,
            xp: Math.round((xp - totalCost) * 1000) / 1000,
            species: nextSpecies as any,
            evolvedFrom: currentSpecies,
          }
        : undefined,
    }));

    addMemory("evolve", currentSpecies, nextSpecies);
    if (midnightEvolve.triggered) {
      addMemory("midnightEvolve");
    }
    setCompanionReaction(
      context,
      `${companion.name}: ✨ EVOLUÇÃO! ${currentSpecies} → ${nextSpecies}!${midnightEvolve.triggered ? " 🌙" : ""}`,
      true,
      true,
    );
    onDone(
      `Evolução completa! ${currentSpecies} → ${nextSpecies}! (Custo: ${totalCost} XP)` +
        (midnightEvolve.triggered ? `\n🌙 ${midnightEvolve.message}` : ""),
      { display: "system" },
    );
    return null;
  }

  // Journal: mostra diário de hoje
  if (arg === "journal") {
    const companion = getCompanion();
    if (!companion) {
      onDone("Nenhum buddy ainda. Use /buddy para criar um.", {
        display: "system",
      });
      return null;
    }

    // Force observer validation for 'journal' if run as a direct hook (bypass standard observer loop gap)
    saveGlobalConfig(current => {
      const today = getTodayString()
      let questData = current.companionQuests
      if (questData?.date !== today) questData = { date: today, completed: {} }

      const q = getTodayQuests().find(q => q.id === 'buddy_journal')
      if (q && !questData.completed[q.id]) {
        questData.completed[q.id] = true
        return {
          ...current,
          companionQuests: questData,
          companion: current.companion ? {
            ...current.companion,
            xp: Math.round(((current.companion.xp ?? 0) + q.xpReward) * 10) / 10
          } : undefined
        }
      }
      return current
    })

    const entry = getTodayJournal();
    onDone(formatJournal(entry), { display: "system" });
    return null;
  }

  // Achievements: mostra conquistas
  if (arg === "achievements" || arg === "conquistas") {
    const companion = getCompanion();
    if (!companion) {
      onDone("Nenhum buddy ainda. Use /buddy para criar um.", {
        display: "system",
      });
      return null;
    }
    const progress = getAchievementProgress();
    const unlocked = progress.filter((p) => p.unlocked).length;
    const list = progress
      .map(
        (p) =>
          `  ${p.unlocked ? "✅" : "🔒"} ${p.achievement.emoji} ${p.achievement.name} — ${p.achievement.description}`,
      )
      .join("\n");
    onDone(
      `🏆 Conquistas do ${companion.name} (${unlocked}/${progress.length}):\n${list}`,
      { display: "system" },
    );
    return null;
  }

  // Requisitos: mostra progresso de outfits e chapéus
  if (arg === "requisitos") {
    const companion = getCompanion();
    if (!companion) {
      onDone("Nenhum buddy ainda. Use /buddy para criar um.", {
        display: "system",
      });
      return null;
    }

    const outfitReqs = getOutfitRequirements();
    const hatReqs = getHatRequirements();

    const outfitList = outfitReqs
      .map((o) => `  ${o.unlocked ? "✅" : "🔒"} ${o.name} — ${o.requirement}`)
      .join("\n");

    const hatList = hatReqs
      .map((h) => `  ${h.unlocked ? "✅" : "🔒"} ${h.hat} — ${h.requirement}`)
      .join("\n");

    onDone(
      `📋 Requisitos do ${companion.name}\n\n` +
        `🎨 Outfits:\n${outfitList}\n\n` +
        `🎩 Chapéus:\n${hatList}`,
      { display: "system" },
    );
    return null;
  }

  if (arg === "mute" || arg === "unmute") {
    const muted = arg === "mute";
    saveGlobalConfig((current) => ({
      ...current,
      companionMuted: muted,
    }));
    if (muted) {
      setCompanionReaction(context, undefined);
    } else {
      const companion = getCompanion();
      setCompanionReaction(
        context,
        `${companion?.name ?? "Buddy"}: Voltei!`,
        true,
      );
    }
    onDone(`Buddy ${muted ? "silenciado" : "reativado"}.`, {
      display: "system",
    });
    return null;
  }

  if (arg === "compact" || arg === "decompact") {
    const compact = arg === "compact";
    saveGlobalConfig((current) => ({
      ...current,
      companionCompact: compact,
    }));
    onDone(`Buddy modo ${compact ? "compacto" : "completo"}.`, {
      display: "system",
    });
    return null;
  }

  // Shop
  if (baseCommand === "shop") {
    const companion = getCompanion();
    if (!companion) {
      onDone("Nenhum buddy ainda. Use /buddy para criar um.", { display: "system" });
      return null;
    }
    const category = restArgs[0]?.toLowerCase() as any;
    onDone(formatShop(category || undefined), { display: "system" });
    return null;
  }

  // Abilities
  if (baseCommand === "abilities") {
    const companion = getCompanion();
    if (!companion) {
      onDone("Nenhum buddy ainda. Use /buddy para criar um.", { display: "system" });
      return null;
    }
    onDone(formatAbilities(), { display: "system" });
    return null;
  }

  // Buy
  if (baseCommand === "buy") {
    const companion = getCompanion();
    if (!companion) {
      onDone("Nenhum buddy ainda. Use /buddy para criar um.", { display: "system" });
      return null;
    }
    const itemId = restArgs.join("-").toLowerCase();
    if (!itemId) {
      onDone("Uso: /buddy buy <item-id>\nVeja os itens com /buddy shop", { display: "system" });
      return null;
    }
    const result = buyItem(itemId);
    if (result.success) {
      setCompanionReaction(context, `${companion.name}: ${result.message}`, true);
    }
    onDone(result.message, { display: "system" });
    return null;
  }

  // Equip
  if (baseCommand === "equip") {
    const companion = getCompanion();
    if (!companion) {
      onDone("Nenhum buddy ainda. Use /buddy para criar um.", { display: "system" });
      return null;
    }
    const itemId = restArgs.join("-").toLowerCase();
    if (!itemId) {
      onDone("Uso: /buddy equip <item-id>\nVeja seus itens com /buddy inventory", { display: "system" });
      return null;
    }
    const result = equipItem(itemId);
    if (result.success) {
      setCompanionReaction(context, `${companion.name}: ${result.message}`, true);
    }
    onDone(result.message, { display: "system" });
    return null;
  }

  // Unequip
  if (baseCommand === "unequip") {
    const companion = getCompanion();
    if (!companion) {
      onDone("Nenhum buddy ainda. Use /buddy para criar um.", { display: "system" });
      return null;
    }
    const itemId = restArgs.join("-").toLowerCase();
    if (!itemId) {
      onDone("Uso: /buddy unequip <item-id>", { display: "system" });
      return null;
    }
    const result = unequipItem(itemId);
    onDone(result.message, { display: "system" });
    return null;
  }

  // Inventory
  if (arg === "inventory" || arg === "inventario") {
    const companion = getCompanion();
    if (!companion) {
      onDone("Nenhum buddy ainda. Use /buddy para criar um.", { display: "system" });
      return null;
    }
    const inv = getInventory();
    if (inv.owned.length === 0) {
      onDone(`${companion.name} não tem nenhum item. Visite /buddy shop!`, { display: "system" });
      return null;
    }
    const lines = inv.owned.map(item => {
      const equipped = inv.equipped.includes(item.id) ? " ✅" : "";
      return `  ${item.name}${equipped} — ${item.description}`;
    });
    onDone(`🎒 Inventário do ${companion.name}:\n${lines.join("\n")}`, { display: "system" });
    return null;
  }

  // Draw
  if (baseCommand === "draw") {
    const companion = getCompanion();
    if (!companion) {
      onDone("Nenhum buddy ainda. Use /buddy para criar um.", { display: "system" });
      return null;
    }
    const tierArg = restArgs[0]?.toLowerCase();
    const tier = tierArg === "raro" ? "rare" : tierArg === "epico" || tierArg === "épico" ? "epic" : "common";
    const prices: Record<string, number> = { common: 10, rare: 30, epic: 60 };
    const price = prices[tier]!;

    const xp = companion.xp ?? 0;
    if (xp < price) {
      onDone(`Lucky Draw (${tier}) custa ${price} XP. Você só tem ${xp} XP.`, { display: "system" });
      return null;
    }

    saveGlobalConfig(curr => ({
      ...curr,
      companion: curr.companion ? { ...curr.companion, xp: Math.round((xp - price) * 100) / 100 } : undefined,
    }));

    const result = luckyDraw(tier, getAllOwnedIds());
    addToInventory(result.item.id);

    const jackpotMsg = result.jackpot ? "\n🎰 JACKPOT! Item de tier superior!" : "";
    setCompanionReaction(context, `${companion.name}: Tirei ${result.item.name}!${jackpotMsg}`, true);
    onDone(`🎲 Lucky Draw (${tier}):\n  ${result.item.name} — ${result.item.description}${jackpotMsg}\n(-${price} XP)`, { display: "system" });
    return null;
  }

  if (arg !== "") {
    showHelp(onDone);
    return null;
  }

  let companion = getCompanion();
  if (!companion) {
    const stored = createStoredCompanion();
    saveGlobalConfig((current) => ({
      ...current,
      companion: stored,
      companionMuted: false,
    }));
    const bones = rollWithSeed(`${companionUserId()}:buddy`).bones;
    companion = {
      ...bones,
      ...stored,
      hat: stored.hat ?? bones.hat,
    } as Companion;
    setCompanionReaction(
      context,
      `${companion.name}, o ${companion.species}, chocou!`,
      true,
    );
    onDone(
      `${companion.name}, o ${companion.species}, agora é seu buddy! Execute /buddy novamente para acariciá-lo.`,
      { display: "system" },
    );
    return null;
  }

  // Force observer validation for pure '/buddy' (pet) to complete itself immediately
  saveGlobalConfig(current => {
    const todayStr = getTodayString()
    let questData = current.companionQuests
    if (questData?.date !== todayStr) questData = { date: todayStr, completed: {} }

    const q = getTodayQuests().find(q => q.id === 'buddy_pet')
    if (q && !questData.completed[q.id]) {
      questData.completed[q.id] = true
      return {
        ...current,
        companionQuests: questData,
        companion: current.companion ? {
          ...current.companion,
          xp: Math.round(((current.companion.xp ?? 0) + q.xpReward) * 10) / 10
        } : undefined
      }
    }
    return current
  })

  // Increment pet count
  saveGlobalConfig((current) => ({
    ...current,
    companionStats: {
      totalBashes: current.companionStats?.totalBashes ?? 0,
      totalTasks: current.companionStats?.totalTasks ?? 0,
      totalErrors: current.companionStats?.totalErrors ?? 0,
      totalPets: (current.companionStats?.totalPets ?? 0) + 1,
      totalReads: current.companionStats?.totalReads ?? 0,
      totalWrites: current.companionStats?.totalWrites ?? 0,
      totalEdits: current.companionStats?.totalEdits ?? 0,
      totalSearches: current.companionStats?.totalSearches ?? 0,
      daysActive: current.companionStats?.daysActive ?? 0,
      totalTokensSaved: current.companionStats?.totalTokensSaved ?? 0,
      totalFeedbackRules: current.companionStats?.totalFeedbackRules ?? 0,
      totalFeedbackConfirms: current.companionStats?.totalFeedbackConfirms ?? 0,
      totalSessionMinutes: current.companionStats?.totalSessionMinutes ?? 0,
    },
  }));

  const reaction = `${companion.name} ${pickDeterministic(
    PET_REACTIONS,
    `${Date.now()}:${companion.name}`,
  )}`;

  // Daily pet XP: +1 XP for the first pet of the day
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const lastPetDate = getGlobalConfig().companionLastPetDate;
  if (lastPetDate !== today) {
    const xp = companion.xp ?? 0;
    const newXp = Math.round((xp + 1) * 1000) / 1000;
    const oldInfo = getLevelInfo(xp);
    const newInfo = getLevelInfo(newXp);

    saveGlobalConfig((current) => ({
      ...current,
      companionLastPetDate: today,
      companion: current.companion
        ? {
            ...current.companion,
            xp: newXp,
            hat: newInfo.hat ?? current.companion.hat,
          }
        : undefined,
    }));

    if (oldInfo.level !== newInfo.level) {
      onDone(
        `${reaction}\n${companion.name}: Uau! Subi para o Nível ${newInfo.level} e ganhei um chapéu novo!`,
        { display: "system" },
      );
      return null;
    }
  }

  // Streak diário
  const streakResult = processStreak();
  if (streakResult.bonusXp > 0) {
    const xp = getGlobalConfig().companion?.xp ?? 0;
    const newXp = Math.round((xp + streakResult.bonusXp) * 1000) / 1000;
    saveGlobalConfig((current) => ({
      ...current,
      companion: current.companion
        ? { ...current.companion, xp: newXp }
        : undefined,
    }));
  }
  if (streakResult.streak === 7) addMemory("streak7");
  if (streakResult.streak === 30) addMemory("streak30");

  // Seasonal event
  const seasonalMsg = getSeasonalMessage();
  if (seasonalMsg) {
    setCompanionReaction(context, `${companion.name}: ${seasonalMsg}`, true);
  }

  // Easter eggs
  const shinyBug = checkShinyBug();
  if (shinyBug.triggered) {
    const xp = getGlobalConfig().companion?.xp ?? 0;
    const newXp = Math.round((xp + shinyBug.xpBonus!) * 1000) / 1000;
    saveGlobalConfig((current) => ({
      ...current,
      companion: current.companion
        ? { ...current.companion, xp: newXp }
        : undefined,
    }));
    addMemory("easterEgg");
    onDone(`✨ ${companion.name} ${shinyBug.message}`, { display: "system" });
    return null;
  }

  // Double Rainbow: shiny + arco-íris
  const doubleRainbow = checkDoubleRainbow(companion.shiny, getActiveOutfit());
  if (doubleRainbow.triggered) {
    const xp = getGlobalConfig().companion?.xp ?? 0;
    const newXp = Math.round((xp + doubleRainbow.xpBonus!) * 1000) / 1000;
    saveGlobalConfig((current) => ({
      ...current,
      companion: current.companion
        ? { ...current.companion, xp: newXp }
        : undefined,
    }));
    addMemory("doubleRainbow");
    onDone(
      `🌈 ${companion.name} ${doubleRainbow.message} +${doubleRainbow.xpBonus} XP!`,
      { display: "system" },
    );
    return null;
  }

  // Check for newly unlocked outfits
  const newOutfits = checkAndUnlockOutfits();
  if (newOutfits.length > 0) {
    const streakMsg = streakResult.message ? `\n${streakResult.message}` : "";
    onDone(
      `${reaction}${streakMsg}\n🎨 Novo outfit desbloqueado: ${newOutfits.join(", ")}!`,
      { display: "system" },
    );
    return null;
  }

  const streakMsg = streakResult.message ? `\n${streakResult.message}` : "";
  setCompanionReaction(context, reaction + streakMsg, true);
  onDone(undefined, { display: "skip" });
  return null;
}
