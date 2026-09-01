import { homedir } from 'os'
import { join } from 'path'
import { getFsImplementation } from './fsOperations.js'
import { CLAUDE_CONFIG_DIRECTORIES } from './markdownConfigLoader.js'

export type MigrationSurface = {
  name: string
  fileCount: number
  skippedCount: number
}

export type MigrationPlan = {
  sourceDir: string
  destDir: string
  surfaces: MigrationSurface[]
  collidingSessionIds: string[]
  conflictingSettingsKeys: string[]
  totalFilesToCopy: number
}

/**
 * Directory surfaces copied on top of CLAUDE_CONFIG_DIRECTORIES. The
 * markdown-loader directories (commands/agents/skills/...) are derived from
 * that shared constant rather than repeated here, so a subdirectory added by
 * an upstream sync is migrated automatically instead of silently orphaned.
 */
const EXTRA_DIRECTORY_SURFACES = [
  'projects',
  'file-history',
  'sessions',
  'plugins',
] as const

function listFilesRecursive(dir: string): string[] {
  const fs = getFsImplementation()
  const out: string[] = []
  let entries: string[]
  try {
    entries = fs.readdirStringSync(dir)
  } catch {
    return out
  }
  for (const entry of entries) {
    const full = join(dir, entry)
    try {
      if (fs.statSync(full).isDirectory()) {
        out.push(...listFilesRecursive(full))
      } else {
        out.push(full)
      }
    } catch {
      // Entry vanished between readdir and stat — skip it.
    }
  }
  return out
}

function readJsonObject(path: string): Record<string, unknown> | undefined {
  try {
    const raw = getFsImplementation().readFileSync(path, { encoding: 'utf8' })
    const parsed: unknown = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
  } catch {
    // Missing or malformed — treated as absent.
  }
  return undefined
}

function planDirectorySurface(
  name: string,
  sourceDir: string,
  destDir: string,
): MigrationSurface {
  const fs = getFsImplementation()
  const sourceRoot = join(sourceDir, name)
  let fileCount = 0
  let skippedCount = 0

  for (const sourceFile of listFilesRecursive(sourceRoot)) {
    const relative = sourceFile.slice(sourceRoot.length + 1)
    const destFile = join(destDir, name, relative)
    if (fs.existsSync(destFile)) {
      skippedCount++
    } else {
      fileCount++
    }
  }

  return { name, fileCount, skippedCount }
}

export function planConfigHomeMigration(options?: {
  homeDir?: string
}): MigrationPlan {
  const homeDir = options?.homeDir ?? homedir()
  const sourceDir = join(homeDir, '.openclaude')
  const destDir = join(homeDir, '.claude')
  const fs = getFsImplementation()

  const directoryNames = [
    ...EXTRA_DIRECTORY_SURFACES,
    ...CLAUDE_CONFIG_DIRECTORIES,
  ]
  const surfaces = directoryNames.map(name =>
    planDirectorySurface(name, sourceDir, destDir),
  )

  // history.jsonl is a flat append-only log, counted as one surface.
  const historySource = join(sourceDir, 'history.jsonl')
  surfaces.push({
    name: 'history.jsonl',
    fileCount: fs.existsSync(historySource) ? 1 : 0,
    skippedCount: 0,
  })

  // Session UUIDs present on both sides, reported so the UI can say what
  // will be left alone. Derived from the projects surface.
  const collidingSessionIds: string[] = []
  const projectsSource = join(sourceDir, 'projects')
  for (const sourceFile of listFilesRecursive(projectsSource)) {
    if (!sourceFile.endsWith('.jsonl')) continue
    const relative = sourceFile.slice(projectsSource.length + 1)
    if (fs.existsSync(join(destDir, 'projects', relative))) {
      const base = relative.split('/').pop() ?? relative
      collidingSessionIds.push(base.replace(/\.jsonl$/, ''))
    }
  }

  const sourceSettings = readJsonObject(join(sourceDir, 'settings.json'))
  const destSettings = readJsonObject(join(destDir, 'settings.json'))
  const conflictingSettingsKeys =
    sourceSettings && destSettings
      ? Object.keys(sourceSettings).filter(key => key in destSettings)
      : []
  surfaces.push({
    name: 'settings.json',
    fileCount: sourceSettings ? 1 : 0,
    skippedCount: 0,
  })

  const totalFilesToCopy = surfaces.reduce((sum, s) => sum + s.fileCount, 0)

  return {
    sourceDir,
    destDir,
    surfaces,
    collidingSessionIds,
    conflictingSettingsKeys,
    totalFilesToCopy,
  }
}
