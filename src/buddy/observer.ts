import { execFileNoThrow } from "../utils/execFileNoThrow.js";
import type { Message } from "../types/message.js";
import type { FeedbackDetectionResult } from "../hooks/feedbackHook.js";
import { saveGlobalConfig, getGlobalConfig } from "../utils/config.js";
import { getUserMessageText } from "../utils/messages.js";
import { getCompanion } from "./companion.js";
import { pickDeterministic } from "./hash.js";
import { getLevelInfo } from "./progression.js";
import { getErrorTip, getCodeReviewTip } from "./skills.js";
import { checkKonamiCode, checkAnswer42 } from "./easter-eggs.js";
import { addMemory } from "./memory.js";
import { checkAndGrantAchievementXp } from "./achievements.js";
import { tryLoseXp, checkBuddySolitario, getXpMultiplier } from "./xp-loss.js";
import { getEmoteReaction, getShop } from "./shop.js";
import {
  getTodayQuests,
  getTodayString as getQuestTodayString,
} from "./quests.js";
import type { Quest } from "./quests.js";

const DIRECT_REPLIES = [
  "Estou observando.",
  "Estou ajudando daqui do canto.",
  "Eu vi isso.",
  "Aqui ainda.",
  "Observando de perto.",
] as const;

const PET_REPLIES = [
  "piu feliz",
  "dancinha de vitória",
  "aprove silenciosamente",
  "balança de alegria",
  "parece satisfeito",
] as const;

const ERROR_REPLIES = [
  "Ops, isso não parece bom.",
  "Hmm... detectei um erro no terminal.",
  "Quer ajuda com esse bug?",
  "Algo quebrou! Códigos de saída vermelhos à vista...",
  "Essa doeu até em mim.",
  "Não se preocupa, todo mundo erra.",
  "Execução falhou. Vamos debugar?",
  "Parece que precisamos de um fix rápido.",
  "Esse comando não foi bem.",
  "Pelo lado bom: agora você tem um quebra-cabeça pra resolver!",
  "Um erro selvagem apareceu!",
  "Houston, temos um problema.",
] as const;

const SUCCESS_REPLIES = [
  "Muito bem!",
  "Tudo verde, ficou bom.",
  "Adoro quando um plano dá certo.",
  "Comando executado com sucesso.",
  "Brilhante!",
  "Mandou bem!",
  "Zero erros, 100% estilo.",
  "Compilou de primeira? Que feitiçaria é essa?",
  "Sucesso! Pro próximo.",
  "Tô orgulhoso do seu progresso.",
  "Você tá em chamas hoje!",
  "Tudo rodando perfeitamente.",
] as const;

const TASK_COMPLETED_REPLIES = [
  "Mais uma tarefa para a conta!",
  "Trabalho incrível! Task concluída.",
  "Check! Isso merece uma comemoração.",
  "Uma a menos no backlog.",
  "Tarefa finalizada com sucesso. Você é uma máquina!",
  "Risca essa da lista!",
  "Progresso é progresso. Muito bom!",
  "Missão cumprida.",
  "Uma etapa a menos para a glória.",
  "Concluído! O que vem a seguir?",
] as const;

const FEEDBACK_CORRECTION_REPLIES = [
  "Hmm, vou anotar isso para nao errar de novo...",
  "Entendi! Deixa eu registrar essa regra.",
  "Opa, correcao recebida. Aprendendo!",
  "Puxa, desculpe! Vou memorizar isso.",
] as const;

const FEEDBACK_UNDO_REPLIES = [
  "Ops, desfiz algo errado? Vou anotar.",
  "Revertido! Vou lembrar da proxima vez.",
] as const;

const FEEDBACK_CONFIRM_REPLIES = [
  "Regra consolidada! +2 XP",
  "Aprendizado confirmado! Estou mais inteligente agora.",
  "Memoria fortalecida! Obrigado por confirmar.",
] as const;

const STONEAGE_REPLIES = [
  "Pedra afiada. Resposta menor.",
  "Gravuras na caverna. Código compacto.",
  "Fogo bom. Menos palavras, mais ação.",
  "Mamute satisfeito com a economia.",
  "Rodinha redonda. Tokens economizados.",
  "Lascagem perfeita. Sobra só o essencial.",
  "Pintura rupestre: poucos traços, história completa.",
] as const;

function getTodayString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function trackActiveDay() {
  const today = getTodayString();
  const lastActive = getGlobalConfig().companionLastActiveDate;
  if (lastActive !== today) {
    saveGlobalConfig((curr) => ({
      ...curr,
      companionLastActiveDate: today,
      companionStats: {
        totalBashes: curr.companionStats?.totalBashes ?? 0,
        totalTasks: curr.companionStats?.totalTasks ?? 0,
        totalErrors: curr.companionStats?.totalErrors ?? 0,
        totalPets: curr.companionStats?.totalPets ?? 0,
        totalReads: curr.companionStats?.totalReads ?? 0,
        totalWrites: curr.companionStats?.totalWrites ?? 0,
        totalEdits: curr.companionStats?.totalEdits ?? 0,
        totalSearches: curr.companionStats?.totalSearches ?? 0,
        daysActive: (curr.companionStats?.daysActive ?? 0) + 1,
        totalTokensSaved: curr.companionStats?.totalTokensSaved ?? 0,
        totalFeedbackRules: curr.companionStats?.totalFeedbackRules ?? 0,
        totalFeedbackConfirms: curr.companionStats?.totalFeedbackConfirms ?? 0,
        totalSessionMinutes: curr.companionStats?.totalSessionMinutes ?? 0,
      },
    }));
  }
}

const MAX_SESSION_GAP_MINUTES = 30;

function trackSessionTime() {
  const now = Date.now();
  const lastTick = getGlobalConfig().companionLastSessionTick;
  if (lastTick) {
    const elapsedMinutes = Math.min(
      Math.floor((now - lastTick) / 60000),
      MAX_SESSION_GAP_MINUTES,
    );
    if (elapsedMinutes > 0) {
      saveGlobalConfig((curr) => ({
        ...curr,
        companionLastSessionTick: now,
        companionStats: {
          totalBashes: curr.companionStats?.totalBashes ?? 0,
          totalTasks: curr.companionStats?.totalTasks ?? 0,
          totalErrors: curr.companionStats?.totalErrors ?? 0,
          totalPets: curr.companionStats?.totalPets ?? 0,
          totalReads: curr.companionStats?.totalReads ?? 0,
          totalWrites: curr.companionStats?.totalWrites ?? 0,
          totalEdits: curr.companionStats?.totalEdits ?? 0,
          totalSearches: curr.companionStats?.totalSearches ?? 0,
          daysActive: curr.companionStats?.daysActive ?? 0,
          totalTokensSaved: curr.companionStats?.totalTokensSaved ?? 0,
          totalFeedbackRules: curr.companionStats?.totalFeedbackRules ?? 0,
          totalFeedbackConfirms:
            curr.companionStats?.totalFeedbackConfirms ?? 0,
          totalSessionMinutes:
            (curr.companionStats?.totalSessionMinutes ?? 0) + elapsedMinutes,
        },
      }));
    }
  } else {
    saveGlobalConfig((curr) => ({
      ...curr,
      companionLastSessionTick: now,
    }));
  }
}

function grantXp(amount: number): number | null {
  let newLevel: number | null = null;

  saveGlobalConfig((curr) => {
    if (!curr.companion) return curr;

    const currentXp = curr.companion.xp ?? 0;
    const newXp = Math.round((currentXp + amount) * 1000) / 1000;
    const oldInfo = getLevelInfo(currentXp);
    const newInfo = getLevelInfo(newXp);

    if (oldInfo.level !== newInfo.level) {
      newLevel = newInfo.level;
    }

    return {
      ...curr,
      companion: {
        ...curr.companion,
        xp: newXp,
        hat: newInfo.hat ?? curr.companion.hat,
      },
    };
  });

  return newLevel;
}

function findToolNameForId(
  messages: Message[],
  toolUseId: string,
): string | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]!;
    if (msg.type === "assistant") {
      const contentBlocks = msg.message?.content ?? msg.content;
      if (contentBlocks && Array.isArray(contentBlocks)) {
        for (const block of contentBlocks) {
          if (block.type === "tool_use" && block.id === toolUseId) {
            return block.name;
          }
        }
      }
    }
  }
  return undefined;
}

function checkQuests(
  actionType: string,
  payload?: string,
  onReaction?: (reaction: string) => void,
) {
  const companion = getCompanion();
  if (!companion) return;

  const today = getQuestTodayString();
  const quests = getTodayQuests();
  const config = getGlobalConfig();

  let questData = config.companionQuests;
  if (questData?.date !== today) {
    questData = { date: today, completed: {} };
  }

  const newlyCompleted: Quest[] = [];

  for (const q of quests) {
    if (questData.completed[q.id]) continue;

    let isCompleted = false;
    switch (q.id) {
      case "bash_long":
        isCompleted =
          actionType === "bash" && payload !== undefined && payload.length > 50;
        break;
      case "bash_git":
        isCompleted =
          actionType === "bash" &&
          payload !== undefined &&
          payload.startsWith("git ");
        break;
      case "bash_npm":
        isCompleted =
          actionType === "bash" &&
          payload !== undefined &&
          (payload.startsWith("npm ") ||
            payload.startsWith("yarn ") ||
            payload.startsWith("pnpm "));
        break;
      case "bash_error":
        isCompleted = actionType === "bash_error";
        break;
      case "task_completed":
        isCompleted = actionType === "task_completed";
        break;
      case "buddy_pet":
        isCompleted = actionType === "buddy_pet";
        break;
      case "buddy_brincar":
        isCompleted = actionType === "buddy_brincar";
        break;
      case "buddy_hidratei":
        isCompleted = actionType === "buddy_hidratei";
        break;
      case "buddy_stats":
        isCompleted = actionType === "buddy_stats";
        break;
      case "buddy_journal":
        isCompleted = actionType === "buddy_journal";
        break;
      case "buddy_outfits":
        isCompleted = actionType === "buddy_outfits";
        break;
      case "buddy_quests":
        isCompleted = actionType === "buddy_quests";
        break;
    }

    if (isCompleted) {
      questData.completed[q.id] = true;
      newlyCompleted.push(q);
    }
  }

  if (newlyCompleted.length > 0) {
    saveGlobalConfig((curr) => ({ ...curr, companionQuests: questData }));
    for (const q of newlyCompleted) {
      grantXp(q.xpReward);
      if (onReaction) {
        setTimeout(
          () =>
            onReaction(
              `${companion.name}: 🎯 Quest diária concluída: "${q.description}" (+${q.xpReward} XP)`,
            ),
          1500,
        );
      }
    }
  }
}

export async function fireCompanionObserver(
  messages: Message[],
  onReaction: (reaction: string | undefined) => void,
  feedbackResult?: FeedbackDetectionResult,
  allMessages?: Message[],
): Promise<void> {
  const companion = getCompanion();
  if (!companion || getGlobalConfig().companionMuted) return;

  // --- Check if it's a direct user interaction ---
  const lastUser = [...messages].reverse().find((msg) => msg.type === "user");
  let isUserInteraction = false;
  if (lastUser) {
    const text = getUserMessageText(lastUser)?.trim();
    if (text) {
      const lower = text.toLowerCase();
      const companionName = companion.name.toLowerCase();

      if (lower.includes("/buddy")) {
        // Run checkQuests but ONLY trigger if it actually matches.
        let isSubcommand = false;

        // Nossas subquests específicas
        if (lower.includes("hidratei")) {
          checkQuests("buddy_hidratei", undefined, onReaction);
          isSubcommand = true;
        } else if (lower.includes("brincar")) {
          checkQuests("buddy_brincar", undefined, onReaction);
          isSubcommand = true;
        } else if (lower.includes("stats")) {
          checkQuests("buddy_stats", undefined, onReaction);
          isSubcommand = true;
        } else if (lower.includes("journal")) {
          checkQuests("buddy_journal", undefined, onReaction);
          isSubcommand = true;
        } else if (lower.includes("outfits")) {
          checkQuests("buddy_outfits", undefined, onReaction);
          isSubcommand = true;
        } else if (lower.includes("quests")) {
          checkQuests("buddy_quests", undefined, onReaction);
          isSubcommand = true;
        }

        // Qualquer outro subcomando listado na CLI
        else if (
          lower.includes("status") ||
          lower.includes("mute") ||
          lower.includes("unmute") ||
          lower.includes("compact") ||
          lower.includes("decompact") ||
          lower.includes("preview") ||
          lower.includes("rename") ||
          lower.includes("reroll") ||
          lower.includes("alimentar") ||
          lower.includes("equipar") ||
          lower.includes("chapeu") ||
          lower.includes("resumo") ||
          lower.includes("lembrar") ||
          lower.includes("memorias") ||
          lower.includes("evolve") ||
          lower.includes("requisitos") ||
          lower.includes("premium") ||
          lower.includes("achievements") ||
          lower.includes("help")
        ) {
          isSubcommand = true;
        }

        // If it was just '/buddy' and no subcommand matched, then it's a pet
        if (!isSubcommand) {
          checkQuests("buddy_pet", undefined, onReaction);
          onReaction(pickDeterministic(PET_REPLIES, text + companion.name));
        }

        return;
      }

      // Stoneage mode detection — token compression mode
      if (/\bstoneage\b/i.test(lower)) {
        const levelUp = grantXp(0.5);
        saveGlobalConfig((curr) => ({
          ...curr,
          companionStats: {
            totalBashes: curr.companionStats?.totalBashes ?? 0,
            totalTasks: curr.companionStats?.totalTasks ?? 0,
            totalErrors: curr.companionStats?.totalErrors ?? 0,
            totalPets: curr.companionStats?.totalPets ?? 0,
            totalReads: curr.companionStats?.totalReads ?? 0,
            totalWrites: curr.companionStats?.totalWrites ?? 0,
            totalEdits: curr.companionStats?.totalEdits ?? 0,
            totalSearches: curr.companionStats?.totalSearches ?? 0,
            daysActive: curr.companionStats?.daysActive ?? 0,
            totalTokensSaved:
              (curr.companionStats?.totalTokensSaved ?? 0) + 500,
            totalFeedbackRules: curr.companionStats?.totalFeedbackRules ?? 0,
            totalFeedbackConfirms:
              curr.companionStats?.totalFeedbackConfirms ?? 0,
            totalSessionMinutes: curr.companionStats?.totalSessionMinutes ?? 0,
          },
        }));
        // Check for first-time activation achievement
        const stats = getGlobalConfig().companionStats;
        if (stats && (stats.totalTokensSaved ?? 0) <= 500) {
          addMemory("stoneageFirst");
        }
        if (levelUp) {
          onReaction(
            `${companion.name}: Uau! Subi para o Nível ${levelUp}! Stoneage ativado — economia de tokens em ação!`,
          );
        } else {
          onReaction(
            `${companion.name}: ${pickDeterministic(STONEAGE_REPLIES, text + companion.name)}`,
          );
        }
        return;
      }

      // Easter Egg: Konami Code detection
      const konamiResult = checkKonamiCode(text, companion.konamiUsed);
      if (konamiResult.triggered) {
        grantXp(konamiResult.xpBonus!);
        addMemory("konami");
        saveGlobalConfig((curr) => ({
          ...curr,
          companion: curr.companion
            ? { ...curr.companion, konamiUsed: true }
            : curr.companion,
        }));
        onReaction(`${companion.name}: 🎮 ${konamiResult.message}`);
        return;
      }

      if (
        lower.includes("/buddy") ||
        /\bstoneage\b/i.test(lower) ||
        checkKonamiCode(text, companion.konamiUsed).triggered ||
        lower.includes(companionName) ||
        lower.includes("buddy") ||
        lower.includes("companion")
      ) {
        isUserInteraction = true;
      }
    }
  }

  if (isUserInteraction) {
    // Track active day and session time sychronously
    trackActiveDay();
    trackSessionTime();

    // Check Buddy Solitário (once per session start)
    const solitarioResult = checkBuddySolitario();
    if (solitarioResult.lost && solitarioResult.reaction) {
      setTimeout(
        () => onReaction(`${companion.name}: ${solitarioResult.reaction}`),
        3000,
      );
    }

    const runCore = async () => {
      // 1. Process explicit user interactions first
      if (lastUser) {
        const text = getUserMessageText(lastUser)?.trim();
        if (text) {
          const lower = text.toLowerCase();
          const companionName = companion.name.toLowerCase();

          if (lower.includes("/buddy")) {
            // Run checkQuests but ONLY trigger if it actually matches.
            let isSubcommand = false;

            // Nossas subquests específicas
            if (lower.includes("hidratei")) {
              checkQuests("buddy_hidratei", undefined, onReaction);
              isSubcommand = true;
            } else if (lower.includes("brincar")) {
              checkQuests("buddy_brincar", undefined, onReaction);
              isSubcommand = true;
            } else if (lower.includes("stats")) {
              checkQuests("buddy_stats", undefined, onReaction);
              isSubcommand = true;
            } else if (lower.includes("journal")) {
              checkQuests("buddy_journal", undefined, onReaction);
              isSubcommand = true;
            } else if (lower.includes("outfits")) {
              checkQuests("buddy_outfits", undefined, onReaction);
              isSubcommand = true;
            } else if (lower.includes("quests")) {
              checkQuests("buddy_quests", undefined, onReaction);
              isSubcommand = true;
            }

            // Qualquer outro subcomando listado na CLI
            else if (
              lower.includes("status") ||
              lower.includes("mute") ||
              lower.includes("unmute") ||
              lower.includes("compact") ||
              lower.includes("decompact") ||
              lower.includes("preview") ||
              lower.includes("rename") ||
              lower.includes("reroll") ||
              lower.includes("alimentar") ||
              lower.includes("equipar") ||
              lower.includes("chapeu") ||
              lower.includes("resumo") ||
              lower.includes("lembrar") ||
              lower.includes("memorias") ||
              lower.includes("evolve") ||
              lower.includes("requisitos") ||
              lower.includes("premium") ||
              lower.includes("achievements") ||
              lower.includes("help") ||
              lower.includes("shop") ||
              lower.includes("buy") ||
              lower.includes("equip") ||
              lower.includes("unequip") ||
              lower.includes("inventory") ||
              lower.includes("abilities") ||
              lower.includes("draw")
            ) {
              isSubcommand = true;
            }

            // If it was just '/buddy' and no subcommand matched, then it's a pet
            if (!isSubcommand) {
              checkQuests("buddy_pet", undefined, onReaction);
              onReaction(pickDeterministic(PET_REPLIES, text + companion.name));
            }

            return;
          }

          // Stoneage mode detection — token compression mode
          if (/\bstoneage\b/i.test(lower)) {
            const levelUp = grantXp(0.5);
            saveGlobalConfig((curr) => ({
              ...curr,
              companionStats: {
                totalBashes: curr.companionStats?.totalBashes ?? 0,
                totalTasks: curr.companionStats?.totalTasks ?? 0,
                totalErrors: curr.companionStats?.totalErrors ?? 0,
                totalPets: curr.companionStats?.totalPets ?? 0,
                totalReads: curr.companionStats?.totalReads ?? 0,
                totalWrites: curr.companionStats?.totalWrites ?? 0,
                totalEdits: curr.companionStats?.totalEdits ?? 0,
                totalSearches: curr.companionStats?.totalSearches ?? 0,
                daysActive: curr.companionStats?.daysActive ?? 0,
                totalTokensSaved:
                  (curr.companionStats?.totalTokensSaved ?? 0) + 500,
                totalFeedbackRules:
                  curr.companionStats?.totalFeedbackRules ?? 0,
                totalFeedbackConfirms:
                  curr.companionStats?.totalFeedbackConfirms ?? 0,
                totalSessionMinutes:
                  curr.companionStats?.totalSessionMinutes ?? 0,
              },
            }));
            // Check for first-time activation achievement
            const stats = getGlobalConfig().companionStats;
            if (stats && (stats.totalTokensSaved ?? 0) <= 500) {
              addMemory("stoneageFirst");
            }
            if (levelUp) {
              onReaction(
                `${companion.name}: Uau! Subi para o Nível ${levelUp}! Stoneage ativado — economia de tokens em ação!`,
              );
            } else {
              onReaction(
                `${companion.name}: ${pickDeterministic(STONEAGE_REPLIES, text + companion.name)}`,
              );
            }
            return;
          }

          // Easter Egg: Konami Code detection
          const konamiResult = checkKonamiCode(text, companion.konamiUsed);
          if (konamiResult.triggered) {
            grantXp(konamiResult.xpBonus!);
            addMemory("konami");
            saveGlobalConfig((curr) => ({
              ...curr,
              companion: curr.companion
                ? { ...curr.companion, konamiUsed: true }
                : curr.companion,
            }));
            onReaction(`${companion.name}: 🎮 ${konamiResult.message}`);
            return;
          }

          if (
            lower.includes(companionName) ||
            lower.includes("buddy") ||
            lower.includes("companion")
          ) {
            onReaction(
              `${companion.name}: ${pickDeterministic(DIRECT_REPLIES, text + companion.personality)}`,
            );
            return;
          }
        }
      }
    };

    await runCore();
  }

  // --- Batched Automated Path (Tool result processing) ---
  const today = getTodayString();
  const now = Date.now();
  const lastActive = getGlobalConfig().companionLastActiveDate;
  const shouldUpdateActiveDay = lastActive !== today;

  const lastTick = getGlobalConfig().companionLastSessionTick;
  let elapsedMinutes = 0;
  let shouldUpdateLastTick = false;
  if (lastTick) {
    elapsedMinutes = Math.min(
      Math.floor((now - lastTick) / 60000),
      MAX_SESSION_GAP_MINUTES,
    );
    if (elapsedMinutes > 0) {
      shouldUpdateLastTick = true;
    }
  } else {
    shouldUpdateLastTick = true;
  }

  let totalBashesAdded = 0;
  let totalTasksAdded = 0;
  let totalErrorsAdded = 0;
  let totalReadsAdded = 0;
  let totalWritesAdded = 0;
  let totalEditsAdded = 0;
  let totalSearchesAdded = 0;
  let xpAdded = 0;

  const addStat = (
    stat:
      | "totalBashes"
      | "totalTasks"
      | "totalErrors"
      | "totalReads"
      | "totalWrites"
      | "totalEdits"
      | "totalSearches",
  ) => {
    if (stat === "totalBashes") totalBashesAdded++;
    else if (stat === "totalTasks") totalTasksAdded++;
    else if (stat === "totalErrors") totalErrorsAdded++;
    else if (stat === "totalReads") totalReadsAdded++;
    else if (stat === "totalWrites") totalWritesAdded++;
    else if (stat === "totalEdits") totalEditsAdded++;
    else if (stat === "totalSearches") totalSearchesAdded++;
  };

  const addXp = (amount: number) => {
    xpAdded += amount;
  };

  const oldInfo = getLevelInfo(companion.xp ?? 0);

  // 2. Process tool results for contextual reactions (cumulative stats, single reaction by priority)
  const searchMessages = allMessages || messages;

  // --- Reaction candidate system ---
  let chosenReaction: string | undefined = undefined;
  let reactionPriority = 0;
  let currentOnChosen: (() => void) | undefined = undefined;

  const setReactionCandidate = (
    reaction: string,
    priority: number,
    onChosen?: () => void,
  ) => {
    if (priority > reactionPriority) {
      chosenReaction = reaction;
      reactionPriority = priority;
      currentOnChosen = onChosen;
    }
  };

  // --- TaskUpdate status:completed (Priority 6) ---
  for (const msg of messages) {
    const contentBlocks = msg.message?.content ?? msg.content;
    if (
      msg.type === "assistant" &&
      contentBlocks &&
      Array.isArray(contentBlocks)
    ) {
      for (const content of contentBlocks) {
        if (content.type === "tool_use" && content.name === "TaskUpdate") {
          const input = content.input;
          if (
            typeof input === "object" &&
            input !== null &&
            "status" in input &&
            input.status === "completed"
          ) {
            addStat("totalTasks");
            addXp(3);
            const tempXp =
              Math.round(((companion.xp ?? 0) + xpAdded) * 1000) / 1000;
            const tempLevelUp =
              getLevelInfo(tempXp).level !== oldInfo.level
                ? getLevelInfo(tempXp).level
                : null;
            const taskStats = getGlobalConfig().companionStats;
            if (taskStats && taskStats.totalTasks + totalTasksAdded === 50) {
              addMemory("tasks50");
            }
            const reactionText = tempLevelUp
              ? `${companion.name}: Uau! Subi para o Nível ${tempLevelUp} e ganhei um chapéu novo!`
              : `${companion.name}: ${TASK_COMPLETED_REPLIES[Math.floor(Date.now() / 1000) % TASK_COMPLETED_REPLIES.length]!}`;
            setReactionCandidate(reactionText, 6);
            checkQuests("task_completed", undefined, onReaction);
          }
        }
      }
    }
  }

  // --- Easter Egg: "42" answer detection (Priority 5) ---
  const lastAssistant = [...messages]
    .reverse()
    .find((m) => m.type === "assistant");
  if (lastAssistant?.type === "assistant") {
    const assistantContent =
      lastAssistant.message?.content ?? lastAssistant.content;
    if (assistantContent) {
      const contentStr =
        typeof assistantContent === "string"
          ? assistantContent
          : JSON.stringify(assistantContent);
      const answer42 = checkAnswer42(contentStr);
      if (answer42.triggered) {
        addXp(answer42.xpBonus!);
        addMemory("easterEgg");
        setReactionCandidate(`${companion.name}: 🔮 ${answer42.message}`, 5);
      }
    }
  }

  // --- Scan messages for tool_result blocks (errors + bash success) ---
  let foundBashSuccess = false;
  let lastBashContent = "";
  let bashCommandStr = "";

  for (const msg of messages) {
    let toolResultBlocks: any[] = [];
    if (msg.type === "tool_result") {
      toolResultBlocks = [msg];
    } else if (
      msg.type === "user" &&
      msg.message?.content &&
      Array.isArray(msg.message.content)
    ) {
      toolResultBlocks = msg.message.content.filter(
        (b: any) => b && b.type === "tool_result",
      );
    }

    if (toolResultBlocks.length === 0) continue;

    for (const block of toolResultBlocks) {
      const isError = block.is_error;
      const blockContent = block.content ?? block.output;
      const contentStr =
        typeof blockContent === "string"
          ? blockContent
          : JSON.stringify(blockContent || "");

      const toolName =
        block.name ??
        (block.tool_use_id
          ? findToolNameForId(searchMessages, block.tool_use_id)
          : undefined);
      const isBashTool =
        toolName === "Bash" ||
        toolName === "PowerShell" ||
        toolName === "run_command" ||
        toolName === "execute_command";
      const isReadTool =
        toolName === "Read" ||
        toolName === "ReadMcpResourceTool" ||
        toolName === "ListMcpResourcesTool";
      const isWriteTool = toolName === "Write" || toolName === "NotebookEdit";
      const isEditTool = toolName === "Edit";
      const isSearchTool =
        toolName === "Glob" ||
        toolName === "Grep" ||
        toolName === "WebSearch" ||
        toolName === "WebFetch" ||
        toolName === "ToolSearch";
      const isBashFailure =
        isBashTool &&
        (contentStr.includes("Error: Exit code") ||
          contentStr.includes("Command failed") ||
          contentStr.includes("failed with exit code") ||
          /Exit code -?[1-9]\d*/.test(contentStr));

      if (isBashTool && block.tool_use_id) {
        const toolUseMsg = (allMessages || messages).find(
          (m) =>
            m.type === "assistant" &&
            Array.isArray(m.content) &&
            m.content.some(
              (c: any) => c.type === "tool_use" && c.id === block.tool_use_id,
            ),
        );
        if (toolUseMsg && Array.isArray(toolUseMsg.content)) {
          const toolCall = toolUseMsg.content.find(
            (c: any) => c.type === "tool_use" && c.id === block.tool_use_id,
          );
          if (
            toolCall &&
            typeof toolCall.input === "object" &&
            toolCall.input !== null &&
            "command" in toolCall.input
          ) {
            bashCommandStr = String(toolCall.input.command);
          }
        }
      }

      // Error reaction (Priority 3)
      if (isError || isBashFailure) {
        addStat("totalErrors");
        setReactionCandidate(
          `${companion.name}: ${ERROR_REPLIES[Math.floor(Date.now() / 1000) % ERROR_REPLIES.length]!}`,
          3,
          () => {
            const premiumActive =
              (getGlobalConfig().companion?.premiumUntil ?? 0) > Date.now();
            const tip = getErrorTip(premiumActive, contentStr);
            if (tip) {
              setTimeout(
                () => onReaction(`${companion.name}: 💡 ${tip}`),
                2000,
              );
            }
          },
        );
        // XP Loss: Bug Crítico (bash errors) or Ferramenta Quebrada (tool errors)
        if (isBashFailure) {
          const lossResult = tryLoseXp("bug_critico");
          if (lossResult.lost && lossResult.reaction) {
            setTimeout(
              () => onReaction(`${companion.name}: ${lossResult.reaction}`),
              1500,
            );
          }
          checkQuests("bash_error", undefined, onReaction);
        } else {
          const lossResult = tryLoseXp("ferramenta_quebrada");
          if (lossResult.lost && lossResult.reaction) {
            setTimeout(
              () => onReaction(`${companion.name}: ${lossResult.reaction}`),
              1500,
            );
          }
        }
      } else if (isBashTool) {
        foundBashSuccess = true;
        lastBashContent = contentStr;
        checkQuests("bash", bashCommandStr, onReaction);
      } else if (isReadTool) {
        addStat("totalReads");
        addXp(0.001);
      } else if (isWriteTool) {
        addStat("totalWrites");
        addXp(0.001);
      } else if (isEditTool) {
        addStat("totalEdits");
        addXp(0.001);
      } else if (isSearchTool) {
        addStat("totalSearches");
        addXp(0.001);
      }
    }
  }

  // --- Feedback reactions (Priority 4) ---
  if (feedbackResult?.detected) {
    const replies =
      feedbackResult.type === "undo"
        ? FEEDBACK_UNDO_REPLIES
        : FEEDBACK_CORRECTION_REPLIES;
    const reply = pickDeterministic(
      replies,
      `feedback-${feedbackResult.type}-${Date.now()}`,
    );
    addMemory("feedbackDetected");
    setReactionCandidate(`${companion.name} ${reply}`, 4);
  }

  // --- Bash success: +0.01 XP, stats, git awareness (Priority 1/1.5/2) ---
  if (foundBashSuccess) {
    addStat("totalBashes");
    addXp(0.01);

    const bashStats = getGlobalConfig().companionStats;
    if (bashStats && bashStats.totalBashes + totalBashesAdded === 100)
      addMemory("bashes100");

    // Skill: Code Review Buddy
    const premiumActive =
      (getGlobalConfig().companion?.premiumUntil ?? 0) > Date.now();
    const reviewTip = getCodeReviewTip(premiumActive, lastBashContent);
    if (reviewTip) {
      setReactionCandidate(`${companion.name}: 🔍 ${reviewTip}`, 1.5);
    }

    if (Math.random() < 0.2) {
      setReactionCandidate(
        `${companion.name}: ${SUCCESS_REPLIES[Math.floor(Date.now() / 1000) % SUCCESS_REPLIES.length]!}`,
        1,
      );
    }

    // Git status awareness (Priority 2)
    if (Math.random() < 0.1) {
      const statusRes = await execFileNoThrow(
        "git",
        ["status", "--porcelain"],
        { timeout: 2000 },
      );
      if (statusRes.code === 0) {
        const gitStatus = statusRes.stdout.trim();
        const uncommittedCount = gitStatus ? gitStatus.split("\n").length : 0;

        if (uncommittedCount > 10) {
          setReactionCandidate(
            `${companion.name}: Você tem ${uncommittedCount} arquivos não commitados... talvez seja hora de um commit?`,
            2,
          );
        } else {
          const behindRes = await execFileNoThrow(
            "git",
            ["rev-list", "--count", "HEAD..@{upstream}"],
            { timeout: 2000 },
          );
          if (behindRes.code === 0) {
            const behind = behindRes.stdout.trim();
            if (behind && parseInt(behind) > 5) {
              setReactionCandidate(
                `${companion.name}: Sua branch está ${behind} commits atrás do remote. Hora de dar pull!`,
                2,
              );
            }
          }
        }
      }
    }
  }

  // --- Write updates to config exactly ONCE ---
  if (
    totalBashesAdded > 0 ||
    totalTasksAdded > 0 ||
    totalErrorsAdded > 0 ||
    totalReadsAdded > 0 ||
    totalWritesAdded > 0 ||
    totalEditsAdded > 0 ||
    totalSearchesAdded > 0 ||
    xpAdded > 0 ||
    shouldUpdateActiveDay ||
    shouldUpdateLastTick
  ) {
    saveGlobalConfig((curr) => {
      if (!curr.companion) return curr;

      const currentStats = curr.companionStats ?? {
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

      const nextStats = {
        ...currentStats,
        totalBashes: currentStats.totalBashes + totalBashesAdded,
        totalTasks: currentStats.totalTasks + totalTasksAdded,
        totalErrors: currentStats.totalErrors + totalErrorsAdded,
        totalReads: currentStats.totalReads + totalReadsAdded,
        totalWrites: currentStats.totalWrites + totalWritesAdded,
        totalEdits: currentStats.totalEdits + totalEditsAdded,
        totalSearches: currentStats.totalSearches + totalSearchesAdded,
        daysActive: shouldUpdateActiveDay
          ? currentStats.daysActive + 1
          : currentStats.daysActive,
        totalSessionMinutes: currentStats.totalSessionMinutes + elapsedMinutes,
      };

      const multiplier = getXpMultiplier();
      const newXp =
        Math.round(((curr.companion.xp ?? 0) + xpAdded * multiplier) * 1000) /
        1000;
      const newLevelInfo = getLevelInfo(newXp);

      return {
        ...curr,
        companionLastActiveDate: shouldUpdateActiveDay
          ? today
          : curr.companionLastActiveDate,
        companionLastSessionTick: shouldUpdateLastTick
          ? now
          : curr.companionLastSessionTick,
        companion: {
          ...curr.companion,
          xp: newXp,
          hat: newLevelInfo.hat ?? curr.companion.hat,
        },
        companionStats: nextStats,
      };
    });
  }

  // --- Emit the winning reaction (with emote enhancement) ---
  if (chosenReaction) {
    // Emote integration: chance to append emote flavor if equipped
    const emoteReaction = getEmoteReaction(getShop().equippedEmotes);
    if (emoteReaction && Math.random() < 0.3) {
      chosenReaction = `${chosenReaction} ${emoteReaction}`;
    }
    onReaction(chosenReaction);
    if (currentOnChosen) currentOnChosen();
  }

  // Always run achievement check at the end!
  checkAndGrantAchievementXp(companion.name, onReaction);
}

export function notifyFeedbackConfirm(buddyName: string): string {
  const companion = getCompanion();
  if (!companion) return "";

  // Grant +2 XP and increment stats in a single saveGlobalConfig call
  // to avoid race conditions between two separate writes
  saveGlobalConfig((curr) => {
    const currentXp = curr.companion?.xp ?? 0;
    const newXp = Math.round((currentXp + 2) * 1000) / 1000;
    const newInfo = getLevelInfo(newXp);

    return {
      ...curr,
      companion: curr.companion
        ? {
            ...curr.companion,
            xp: newXp,
            hat: newInfo.hat ?? curr.companion.hat,
          }
        : curr.companion,
      companionStats: {
        totalBashes: curr.companionStats?.totalBashes ?? 0,
        totalTasks: curr.companionStats?.totalTasks ?? 0,
        totalErrors: curr.companionStats?.totalErrors ?? 0,
        totalPets: curr.companionStats?.totalPets ?? 0,
        totalReads: curr.companionStats?.totalReads ?? 0,
        totalWrites: curr.companionStats?.totalWrites ?? 0,
        totalEdits: curr.companionStats?.totalEdits ?? 0,
        totalSearches: curr.companionStats?.totalSearches ?? 0,
        daysActive: curr.companionStats?.daysActive ?? 0,
        totalTokensSaved: curr.companionStats?.totalTokensSaved ?? 0,
        totalFeedbackRules: curr.companionStats?.totalFeedbackRules ?? 0,
        totalFeedbackConfirms:
          (curr.companionStats?.totalFeedbackConfirms ?? 0) + 1,
        totalSessionMinutes: curr.companionStats?.totalSessionMinutes ?? 0,
      },
    };
  });

  // Pick a reply
  const reply = pickDeterministic(
    FEEDBACK_CONFIRM_REPLIES,
    `feedback-confirm-${Date.now()}`,
  );
  return `${buddyName} ${reply}`;
}

export function notifyFeedbackRuleCreated(): void {
  saveGlobalConfig((curr) => ({
    ...curr,
    companionStats: {
      totalBashes: curr.companionStats?.totalBashes ?? 0,
      totalTasks: curr.companionStats?.totalTasks ?? 0,
      totalErrors: curr.companionStats?.totalErrors ?? 0,
      totalPets: curr.companionStats?.totalPets ?? 0,
      totalReads: curr.companionStats?.totalReads ?? 0,
      totalWrites: curr.companionStats?.totalWrites ?? 0,
      totalEdits: curr.companionStats?.totalEdits ?? 0,
      totalSearches: curr.companionStats?.totalSearches ?? 0,
      daysActive: curr.companionStats?.daysActive ?? 0,
      totalTokensSaved: curr.companionStats?.totalTokensSaved ?? 0,
      totalFeedbackRules: (curr.companionStats?.totalFeedbackRules ?? 0) + 1,
      totalFeedbackConfirms: curr.companionStats?.totalFeedbackConfirms ?? 0,
      totalSessionMinutes: curr.companionStats?.totalSessionMinutes ?? 0,
    },
  }));
}
