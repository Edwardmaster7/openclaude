import { join } from 'path'
import {
  readFeedbackEvents,
  clearFeedbackLog,
  resetFeedbackLog,
  getFeedbackLogPath,
  logFeedbackEvent,
  FeedbackEvent,
} from '../../memdir/feedbackLog.js'
import { scanMemoryFiles } from '../../memdir/memoryScan.js'
import { getAutoMemPath } from '../../memdir/paths.js'
import { getFsImplementation } from '../../utils/fsOperations.js'
import { parseFrontmatter } from '../../utils/frontmatterParser.js'
import type { LocalCommandCall, LocalCommandResult } from '../../types/command.js'
import { notifyFeedbackConfirm } from '../../buddy/observer.js'
import { getCompanion } from '../../buddy/companion.js'
import { getAssistantMessageText, getUserMessageText } from '../../utils/messages.js'
import chalk from 'chalk'

function stringifyFrontmatter(frontmatter: Record<string, any>): string {
  const lines = ['---']
  for (const [key, value] of Object.entries(frontmatter)) {
    if (value !== undefined && value !== null) {
      lines.push(`${key}: ${value}`)
    }
  }
  lines.push('---')
  return lines.join('\n')
}

interface InteractionPair {
  userMessage: any
  assistantMessage: any
  userText: string
  assistantText: string
}

function getRecentInteractionPairs(messages: any[]): InteractionPair[] {
  const pairs: InteractionPair[] = []
  const seenUserIds = new Set<string>()

  // Walk backwards through messages
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]
    if (!msg || msg.type !== 'user') continue

    const userText = getUserMessageText(msg)?.trim()
    if (!userText) continue

    // Ignore commands starting with '/' or internal XML-like system block strings starting with '<'
    if (userText.startsWith('/') || userText.startsWith('<')) continue

    const msgId = msg.id ?? String(i)
    if (seenUserIds.has(msgId)) continue
    seenUserIds.add(msgId)

    // Find the preceding assistant message
    let precedingAssistant: any = null
    let assistantText = ''
    for (let j = i - 1; j >= 0; j--) {
      const prevMsg = messages[j]
      if (prevMsg && prevMsg.type === 'assistant') {
        const text = getAssistantMessageText(prevMsg)?.trim()
        if (text) {
          precedingAssistant = prevMsg
          assistantText = text
          break
        }
      }
    }

    pairs.push({
      userMessage: msg,
      assistantMessage: precedingAssistant,
      userText,
      assistantText: assistantText || '(Nenhuma resposta anterior)'
    })

    if (pairs.length >= 5) {
      break
    }
  }

  return pairs
}

function formatInteractionList(pairs: InteractionPair[]): string {
  const lines = [
    chalk.bold('Interações Multiturnos Recentes Encontradas:'),
    chalk.gray('Use "/feedback approve <número>" para confirmar ou "/feedback reject <número>" para sinalizar comportamento indesejado.'),
    ''
  ]

  pairs.forEach((pair, idx) => {
    const num = idx + 1
    const cleanUser = pair.userText.length > 80 ? pair.userText.substring(0, 77) + '...' : pair.userText
    const cleanAssistant = pair.assistantText.length > 80 ? pair.assistantText.substring(0, 77) + '...' : pair.assistantText

    lines.push(
      `  ${chalk.cyan(`[${num}]`)} ${chalk.bold('Correção (User):')} "${chalk.yellow(cleanUser)}"`,
      `      ${chalk.bold('Original (IA):')}    "${chalk.gray(cleanAssistant)}"`,
      ''
    )
  })

  return lines.join('\n')
}

export const call: LocalCommandCall = async (args, context): Promise<LocalCommandResult> => {
  const fs = getFsImplementation()
  const trimmedArgs = args.trim()
  const subCommand = trimmedArgs.split(' ')[0] || ''
  const subArgs = trimmedArgs.slice(subCommand.length).trim()

  switch (subCommand) {
    case 'confirm': {
      const events = await readFeedbackEvents()
      const lastIndex = [...events].reverse().findIndex(e => !e.confirmed && (e.type === 'undo' || e.type === 'correction'))
      
      if (lastIndex === -1) {
        const pairs = getRecentInteractionPairs(context.messages || [])
        if (pairs.length === 0) {
          return {
            type: 'text',
            value: chalk.yellow('[Feedback System] Nenhum evento pendente para confirmação no log, e nenhuma interação recente encontrada no histórico.'),
          }
        }
        return {
          type: 'text',
          value: chalk.yellow('[Feedback System] Nenhum feedback pendente sugerido automaticamente. Mas você pode aprovar interações recentes:\n\n') +
            formatInteractionList(pairs),
        }
      }

      // Convert back to positive index in original array
      const actualIndex = events.length - 1 - lastIndex
      events[actualIndex]!.confirmed = true

      // Save events log back
      const logPath = getFeedbackLogPath()
      const logContent = events.map(e => JSON.stringify(e)).join('\n') + '\n'
      try {
        await fs.unlink(logPath)
      } catch {}
      fs.appendFileSync(logPath, logContent, { encoding: 'utf8' } as any)

      // Notify buddy and grant XP
      const companion = getCompanion()
      const buddyName = companion?.name ?? 'Buddy'
      const buddyReaction = notifyFeedbackConfirm(buddyName)

      return {
        type: 'text',
        value: chalk.green('[Feedback System] Padrão de feedback confirmado e salvo com sucesso! O sintetizador dará prioridade extra a esta regra na próxima consolidação.') +
          (buddyReaction ? `\n\n${buddyReaction}` : ''),
      }
    }

    case 'approve': {
      const subArgsTrimmed = subArgs.trim()
      
      // If no arguments, show recent interactions
      if (!subArgsTrimmed) {
        const pairs = getRecentInteractionPairs(context.messages || [])
        if (pairs.length === 0) {
          return {
            type: 'text',
            value: chalk.yellow('[Feedback System] Nenhuma interação recente encontrada no histórico. Você também pode digitar um texto direto para criar uma regra personalizada.'),
          }
        }
        return {
          type: 'text',
          value: formatInteractionList(pairs),
        }
      }

      // Check if it's a number between 1 and 5
      const num = parseInt(subArgsTrimmed, 10)
      if (!isNaN(num) && num >= 1 && num <= 5) {
        const pairs = getRecentInteractionPairs(context.messages || [])
        if (num > pairs.length) {
          return {
            type: 'text',
            value: chalk.red(`[Feedback System] Índice inválido. Existem apenas ${pairs.length} interações recentes disponíveis.`),
          }
        }

        const pair = pairs[num - 1]!
        // Save as confirmed correction
        await logFeedbackEvent({
          type: 'correction',
          original: pair.assistantText,
          correction: pair.userText,
          confirmed: true
        })

        // Notify buddy and grant XP
        const companion = getCompanion()
        const buddyName = companion?.name ?? 'Buddy'
        const buddyReaction = notifyFeedbackConfirm(buddyName)

        return {
          type: 'text',
          value: chalk.green(`[Feedback System] Interação [${num}] aprovada e gravada com sucesso! O sintetizador consolidará esse aprendizado.`) +
            (buddyReaction ? `\n\n${buddyReaction}` : ''),
        }
      }

      // Otherwise, it's a custom text rule!
      await logFeedbackEvent({
        type: 'correction',
        correction: subArgsTrimmed,
        confirmed: true
      })

      // Notify buddy and grant XP
      const companion = getCompanion()
      const buddyName = companion?.name ?? 'Buddy'
      const buddyReaction = notifyFeedbackConfirm(buddyName)

      return {
        type: 'text',
        value: chalk.green(`[Feedback System] Regra personalizada criada e gravada com sucesso: "${subArgsTrimmed}"`) +
          (buddyReaction ? `\n\n${buddyReaction}` : ''),
      }
    }

    case 'reject': {
      const subArgsTrimmed = subArgs.trim()
      
      // If no arguments, show recent interactions
      if (!subArgsTrimmed) {
        const pairs = getRecentInteractionPairs(context.messages || [])
        if (pairs.length === 0) {
          return {
            type: 'text',
            value: chalk.yellow('[Feedback System] Nenhuma interação recente encontrada no histórico para rejeitar.'),
          }
        }
        return {
          type: 'text',
          value: formatInteractionList(pairs),
        }
      }

      // Check if it's a number
      const num = parseInt(subArgsTrimmed, 10)
      if (!isNaN(num) && num >= 1 && num <= 5) {
        const pairs = getRecentInteractionPairs(context.messages || [])
        if (num > pairs.length) {
          return {
            type: 'text',
            value: chalk.red(`[Feedback System] Índice inválido. Existem apenas ${pairs.length} interações recentes disponíveis.`),
          }
        }

        const pair = pairs[num - 1]!
        // Save as correction with success = false and confirmed = true
        await logFeedbackEvent({
          type: 'correction',
          original: pair.assistantText,
          correction: pair.userText,
          success: false,
          confirmed: true
        })

        return {
          type: 'text',
          value: chalk.yellow(`[Feedback System] Interação [${num}] marcada como indesejada (sucesso = falso). O sintetizador usará isso para evitar tais padrões no futuro.`),
        }
      }

      return {
        type: 'text',
        value: chalk.red('[Feedback System] O comando "/feedback reject" requer um número de 1 a 5 correspondente a uma interação do histórico.'),
      }
    }

    case 'list': {
      const memories = await scanMemoryFiles(getAutoMemPath(), context.abortController.signal)
      const feedbackMemories = memories.filter(m => m.type === 'feedback')

      if (feedbackMemories.length === 0) {
        return {
          type: 'text',
          value: chalk.cyan('[Feedback System] Nenhuma memória de feedback encontrada para este projeto. Utilize o sintetizador para criá-las automaticamente ou confirme novos padrões.'),
        }
      }

      const rows = feedbackMemories.map(m => {
        const score = m.score !== undefined ? m.score : 'N/A'
        const scoreColor = typeof score === 'number' && score >= 80
          ? chalk.bold.green(score)
          : typeof score === 'number' && score < 20
            ? chalk.red(score)
            : chalk.cyan(score)
        const confirmations = m.confirmations !== undefined ? m.confirmations : 0
        const status = m.ignored ? chalk.gray('Ignorada') : (typeof score === 'number' && score >= 80 ? chalk.bold.green('Crítica') : chalk.green('Ativa'))
        return `| ${m.filename.padEnd(28)} | ${String(score).padEnd(5)} | ${String(confirmations).padEnd(13)} | ${status.padEnd(15)} | ${String(m.description || '').substring(0, 45).padEnd(45)} |`
      })

      const table = [
        `┌${'─'.repeat(30)}┬${'─'.repeat(7)}┬${'─'.repeat(15)}┬${'─'.repeat(17)}┬${'─'.repeat(47)}┐`,
        `| ${'Tema / Memória'.padEnd(28)} | ${'Score'.padEnd(5)} | ${'Confirmações'.padEnd(13)} | ${'Status'.padEnd(10)} | ${'Descrição'.padEnd(45)} |`,
        `├${'─'.repeat(30)}┼${'─'.repeat(7)}┼${'─'.repeat(15)}┼${'─'.repeat(17)}┼${'─'.repeat(47)}┤`,
        ...rows,
        `└${'─'.repeat(30)}┴${'─'.repeat(7)}┴${'─'.repeat(15)}┴${'─'.repeat(17)}┴${'─'.repeat(47)}┘`,
      ].join('\n')

      return {
        type: 'text',
        value: chalk.bold('Memórias de Feedback Aprendidas:\n\n') + table,
      }
    }

    case 'review': {
      const memories = await scanMemoryFiles(getAutoMemPath(), context.abortController.signal)
      const feedbackMemories = memories.filter(m => m.type === 'feedback')
      const staleMemories = feedbackMemories.filter(m => m.score !== undefined && m.score < 20)

      if (staleMemories.length === 0) {
        return {
          type: 'text',
          value: chalk.green('[Feedback System] Nenhuma memória de feedback obsoleta (score < 20) encontrada. Todas as regras estão com boa relevância!'),
        }
      }

      const list = staleMemories.map(m => `- ${m.filename} (Score: ${m.score})`).join('\n')
      return {
        type: 'text',
        value: chalk.yellow(`[Feedback System] Encontradas memórias obsoletas recomendadas para remoção/limpeza:\n\n${list}\n\nUse "/feedback reset" para limpar todas ou reescreva regras específicas.`),
      }
    }

    case 'clear': {
      await clearFeedbackLog(0)
      return {
        type: 'text',
        value: chalk.green('[Feedback System] Log de eventos de feedback brutos limpo com sucesso!'),
      }
    }

    case 'reset': {
      await resetFeedbackLog()
      const memories = await scanMemoryFiles(getAutoMemPath(), context.abortController.signal)
      const feedbackMemories = memories.filter(m => m.type === 'feedback')
      
      for (const m of feedbackMemories) {
        try {
          await fs.unlink(m.filePath)
        } catch {}
      }

      return {
        type: 'text',
        value: chalk.red('[Feedback System] Redefinição concluída. Todas as memórias e logs de feedback deste projeto foram removidos permanentemente!'),
      }
    }

    case 'ignore': {
      const theme = subArgs
      if (!theme) {
        return {
          type: 'text',
          value: chalk.yellow('[Feedback System] Por favor, informe o tema/arquivo a ser ignorado. Exemplo: "/feedback ignore feedback-auth-patterns"'),
        }
      }

      const memories = await scanMemoryFiles(getAutoMemPath(), context.abortController.signal)
      const target = memories.find(m => m.filename.toLowerCase() === theme.toLowerCase() || m.filename.toLowerCase() === `feedback-${theme.toLowerCase()}-patterns.md`)

      if (!target) {
        return {
          type: 'text',
          value: chalk.red(`[Feedback System] Memória de feedback "${theme}" não encontrada neste projeto.`),
        }
      }

      // Read file, parse frontmatter, inject ignored: true
      try {
        const fullContent = await fs.readFile(target.filePath, { encoding: 'utf8' })
        const { frontmatter, content } = parseFrontmatter(fullContent, target.filePath)
        frontmatter.ignored = true
        
        const newFrontmatterStr = stringifyFrontmatter(frontmatter)
        const finalContent = `${newFrontmatterStr}\n${content}`
        
        await fs.unlink(target.filePath)
        fs.appendFileSync(target.filePath, finalContent, { encoding: 'utf8' } as any)
        
        return {
          type: 'text',
          value: chalk.green(`[Feedback System] O tema de feedback "${target.filename}" foi marcado como ignorado e não será mais carregado nas sessões.`),
        }
      } catch (error) {
        return {
          type: 'text',
          value: chalk.red(`[Feedback System] Erro ao ignorar o tema: ${error}`),
        }
      }
    }

    case 'synthesize': {
      // Lazy load the synthesizer
      const { runFeedbackSynthesis } = await import('../../memdir/feedbackSynthesizer.js')
      const result = await runFeedbackSynthesis(context)
      return {
        type: 'text',
        value: result,
      }
    }

    case 'help':
    default: {
      const helpText = [
        chalk.bold.cyan('========================================================================'),
        chalk.bold.cyan('             SISTEMA DE APRENDIZADO DE FEEDBACK (OPENCLAUDE)             '),
        chalk.bold.cyan('========================================================================'),
        'O OpenClaude aprende com suas correções para se adaptar ao seu projeto.',
        'Sempre que você corrige ou desfaz uma alteração, um evento é registrado.',
        'Este comando permite gerenciar, aprovar e consolidar essas regras.',
        '',
        chalk.bold('Comandos Disponíveis:'),
        '',
        `  ${chalk.cyan('/feedback confirm')}`,
        `    Confirma o último padrão de correção detectado automaticamente pela IA.`,
        `    Se não houver nenhum padrão detectado, ele lista as interações multiturnos`,
        `    recentes do histórico para que você possa aprovar ou rejeitar manualmente.`,
        `    ${chalk.green('Bônus:')} Concede ${chalk.bold('+2 XP')} ao seu companion Buddy.`,
        '',
        `  ${chalk.cyan('/feedback approve <número | regra_personalizada>')}`,
        `    Aprova e confirma uma instrução de aprendizado:`,
        `      - Se usado com um número de ${chalk.yellow('1')} a ${chalk.yellow('5')} (ex: ${chalk.cyan('/feedback approve 2')}), aprova o`,
        `        turno correspondente do histórico recente de mensagens.`,
        `      - Se usado com qualquer outro texto, cria uma regra personalizada direta.`,
        `    ${chalk.green('Bônus:')} Concede ${chalk.bold('+2 XP')} ao seu companion Buddy.`,
        '',
        `  ${chalk.cyan('/feedback reject <número>')}`,
        `    Rejeita a resposta dada pela IA em um turno específico do histórico.`,
        `    Sinaliza que o comportamento gerado foi indesejado (${chalk.red('success = false')}).`,
        `    Isso ensina o sintetizador a evitar repetir esse tipo de resposta.`,
        '',
        `  ${chalk.cyan('/feedback list')}`,
        `    Exibe uma tabela contendo todas as memórias de feedback consolidadas no`,
        `    projeto com seus respectivos scores de confiança, quantidade de confirmações`,
        `    e status (ex: Ativa, Crítica, Ignorada).`,
        '',
        `  ${chalk.cyan('/feedback synthesize')}`,
        `    Executa a consolidação inteligente (via IA) dos eventos brutos salvos nos logs`,
        `    e os organiza em arquivos markdown estruturados contendo regras acionáveis.`,
        '',
        `  ${chalk.cyan('/feedback review')}`,
        `    Varre e lista memórias de feedback obsoletas ou muito fracas (score < 20),`,
        `    sugerindo temas que podem ser limpos ou redefinidos.`,
        '',
        `  ${chalk.cyan('/feedback ignore <tema>')}`,
        `    Desativa temporariamente um tema de feedback específico (ex: "feedback-auth-patterns")`,
        `    adicionando a tag "ignored: true" para que ele não influencie mais a sessão.`,
        '',
        `  ${chalk.cyan('/feedback clear')}`,
        `    Limpa os logs de eventos brutos que ainda não foram sintetizados.`,
        '',
        `  ${chalk.cyan('/feedback reset')}`,
        `    Apaga permanentemente todas as memórias consolidadas e logs de feedback`,
        `    deste projeto, redefinindo o aprendizado ao estado inicial.`,
        chalk.bold.cyan('========================================================================'),
      ].join('\n')

      return {
        type: 'text',
        value: helpText,
      }
    }
  }
}
