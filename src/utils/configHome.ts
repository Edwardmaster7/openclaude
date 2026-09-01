import { homedir } from 'os'
import { join } from 'path'
import { getFsImplementation } from './fsOperations.js'

export type ConfigHomeMode = 'claude' | 'openclaude'

/**
 * Basenames scanned for the explicit config-home preference, in priority
 * order. These are LITERAL fixed paths under the home directory — never
 * resolved through getGlobalClaudeFile(), which would be circular.
 */
const PREFERENCE_FILE_BASENAMES = ['.openclaude.json', '.claude.json'] as const

function isConfigHomeMode(value: unknown): value is ConfigHomeMode {
  return value === 'claude' || value === 'openclaude'
}

/**
 * Reads the user's explicit choice of user-level config directory.
 *
 * MUST NOT import config.ts / env.ts / envUtils.ts and MUST NOT be
 * memoized: getGlobalClaudeFile() (env.ts:44) calls
 * getClaudeConfigHomeDir(), so routing this read through the normal
 * global-config accessors would close the cycle
 * preference -> global config -> config home -> preference.
 * configHome.test.ts enforces this.
 *
 * Returns undefined when the user has never made an explicit choice, which
 * is what keeps existing installs on their current directory.
 */
export function readConfigHomePreference(options?: {
  homeDir?: string
}): ConfigHomeMode | undefined {
  const homeDir = options?.homeDir ?? homedir()
  const fs = getFsImplementation()

  for (const basename of PREFERENCE_FILE_BASENAMES) {
    try {
      const raw = fs.readFileSync(join(homeDir, basename), {
        encoding: 'utf8',
      })
      const parsed: unknown = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') {
        const value = (parsed as { configHome?: unknown }).configHome
        if (isConfigHomeMode(value)) {
          return value
        }
      }
    } catch {
      // Missing, unreadable or malformed file — try the next candidate.
    }
  }

  return undefined
}
