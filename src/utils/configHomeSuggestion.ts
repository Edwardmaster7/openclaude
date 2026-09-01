import { homedir } from 'os'
import { join } from 'path'
import { readConfigHomePreference } from './configHome.js'
import { resolveClaudeConfigHomeDir } from './envUtils.js'
import { getFsImplementation } from './fsOperations.js'

/**
 * Whether to surface the "you can share ~/.claude with Claude Code" tip.
 *
 * True only when the suggestion is actionable AND the user has not already
 * decided, so the tip disappears permanently once they pick either side:
 *   1. no explicit preference recorded yet,
 *   2. the active config home is ~/.openclaude,
 *   3. ~/.claude/projects exists and is non-empty.
 */
export function shouldSuggestSharedClaudeHome(options?: {
  homeDir?: string
}): boolean {
  const homeDir = options?.homeDir ?? homedir()

  if (readConfigHomePreference({ homeDir }) !== undefined) {
    return false
  }

  const activeHome = resolveClaudeConfigHomeDir({ homeDir })
  if (activeHome !== join(homeDir, '.openclaude').normalize('NFC')) {
    return false
  }

  try {
    const fs = getFsImplementation()
    const claudeProjects = join(homeDir, '.claude', 'projects')
    return (
      fs.existsSync(claudeProjects) &&
      fs.readdirStringSync(claudeProjects).length > 0
    )
  } catch {
    return false
  }
}
