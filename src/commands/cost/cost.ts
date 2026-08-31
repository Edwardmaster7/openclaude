import { formatTotalCost } from '../../cost-tracker.js'
import { currentLimits } from '../../services/claudeAiLimits.js'
import type { LocalCommandCall } from '../../types/command.js'
import { isClaudeAISubscriber } from '../../utils/auth.js'
import { getCacheStatsHistory } from '../../services/api/cacheStatsTracker.js'
import { createSystemMessage } from '../../utils/messages.js'

/** Stable UUID so the loading placeholder can be removed after work completes. */
const LOADING_MSG_UUID = 'cost-loading-placeholder'

export const call: LocalCommandCall = async (args, context) => {
  const isHeavy = getCacheStatsHistory().length > 50

  if (isHeavy && context?.setMessages) {
    const loadingMsg = createSystemMessage('⏳ Calculating session costs…', 'info')
    // Override uuid so we can reliably remove it after the work is done.
    ;(loadingMsg as any).uuid = LOADING_MSG_UUID
    context.setMessages((prev) => [...prev, loadingMsg])
    await new Promise((resolve) => setTimeout(resolve, 600))
  }

  let resultValue: string

  if (isClaudeAISubscriber()) {
    let value: string

    if (currentLimits.isUsingOverage) {
      value =
        'You are currently using your overages to power your Claude Code usage. We will automatically switch you back to your subscription rate limits when they reset'
    } else {
      value =
        'You are currently using your subscription to power your Claude Code usage'
    }

    if (process.env.USER_TYPE === 'ant') {
      value += `\n\n[internal-only] Showing cost anyway:\n ${formatTotalCost()}`
    }
    resultValue = value
  } else {
    resultValue = formatTotalCost()
  }

  if (isHeavy && context?.setMessages) {
    context.setMessages((prev) => prev.filter((m) => m.uuid !== LOADING_MSG_UUID))
  }

  return { type: 'text', value: resultValue }
}
