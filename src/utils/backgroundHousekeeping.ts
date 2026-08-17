import { feature } from 'bun:bundle'
import { initAutoDream } from '../services/autoDream/autoDream.js'
import { initMagicDocs } from '../services/MagicDocs/magicDocs.js'
import { initSkillImprovement } from './hooks/skillImprovement.js'
import { logForDebugging } from './debug.js'

/* eslint-disable @typescript-eslint/no-require-imports */
const extractMemoriesModule = feature('EXTRACT_MEMORIES')
  ? (require('../services/extractMemories/extractMemories.js') as typeof import('../services/extractMemories/extractMemories.js'))
  : null
const registerProtocolModule = feature('LODESTONE')
  ? (require('./deepLink/registerProtocol.js') as typeof import('./deepLink/registerProtocol.js'))
  : null

/* eslint-enable @typescript-eslint/no-require-imports */

import { getIsInteractive, getLastInteractionTime } from '../bootstrap/state.js'
import {
  cleanupNpmCacheForAnthropicPackages,
  cleanupOldMessageFilesInBackground,
  cleanupOldVersionsThrottled,
} from './cleanup.js'
import { cleanupOldVersions } from './nativeInstaller/index.js'
import { autoUpdateMarketplacesAndPluginsInBackground } from './plugins/pluginAutoupdate.js'

// 24 hours in milliseconds
const RECURRING_CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000

// 10 minutes after start.
const DELAY_VERY_SLOW_OPERATIONS_THAT_HAPPEN_EVERY_SESSION = 10 * 60 * 1000

/**
 * Fire-and-forget helper that captures and logs any errors instead of
 * silently swallowing them (avoids the void-async footgun).
 */
function safeInit(fn: () => Promise<void> | void, name: string): void {
  try {
    const res = fn()
    if (res && typeof res.catch === 'function') {
      res.catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : String(e)
        logForDebugging(`[housekeeping] ${name} init failed: ${msg}`)
      })
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    logForDebugging(`[housekeeping] ${name} init failed: ${msg}`)
  }
}

/**
 * Returns true when an interactive session had user activity in the last
 * minute — used to defer slow background ops until the user is idle.
 */
function isUserRecentlyActive(): boolean {
  return getIsInteractive() && getLastInteractionTime() > Date.now() - 1000 * 60
}

export function startBackgroundHousekeeping(): void {
  safeInit(initMagicDocs, 'MagicDocs')
  safeInit(initSkillImprovement, 'SkillImprovement')
  if (feature('EXTRACT_MEMORIES')) {
    extractMemoriesModule!.initExtractMemories()
  }
  initAutoDream()
  void autoUpdateMarketplacesAndPluginsInBackground()
  if (feature('LODESTONE') && getIsInteractive()) {
    void registerProtocolModule!.ensureDeepLinkProtocolRegistered()
  }

  let needsCleanup = true
  async function runVerySlowOps(): Promise<void> {
    // Defer if the user interacted in the last minute.
    if (isUserRecentlyActive()) {
      setTimeout(
        runVerySlowOps,
        DELAY_VERY_SLOW_OPERATIONS_THAT_HAPPEN_EVERY_SESSION,
      ).unref()
      return
    }

    if (needsCleanup) {
      needsCleanup = false
      await cleanupOldMessageFilesInBackground()
    }

    // Re-check: user may have become active while cleanupOldMessageFiles ran.
    if (isUserRecentlyActive()) {
      setTimeout(
        runVerySlowOps,
        DELAY_VERY_SLOW_OPERATIONS_THAT_HAPPEN_EVERY_SESSION,
      ).unref()
      return
    }

    await cleanupOldVersions()
  }

  setTimeout(
    runVerySlowOps,
    DELAY_VERY_SLOW_OPERATIONS_THAT_HAPPEN_EVERY_SESSION,
  ).unref()

  // For long-running sessions, schedule recurring cleanup every 24 hours.
  // Both cleanup functions use marker files and locks to throttle to once per day
  // and skip immediately if another process holds the lock.
  if (process.env.USER_TYPE === 'ant') {
    const interval = setInterval(() => {
      void cleanupNpmCacheForAnthropicPackages()
      void cleanupOldVersionsThrottled()
    }, RECURRING_CLEANUP_INTERVAL_MS)

    // Don't let this interval keep the process alive
    interval.unref()
  }
}
