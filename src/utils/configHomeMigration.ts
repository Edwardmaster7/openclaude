import { homedir } from 'os'
import { join } from 'path'
import { getFsImplementation } from './fsOperations.js'
import { writeFileSyncAndFlush_DEPRECATED } from './file.js'
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

export type MigrationResult = {
  copiedFiles: number
  skippedFiles: number
  errors: { path: string; message: string }[]
  settingsBackupPath?: string
}

function copyFileIfAbsent(
  sourceFile: string,
  destFile: string,
  result: MigrationResult,
): void {
  const fs = getFsImplementation()
  if (fs.existsSync(destFile)) {
    result.skippedFiles++
    return
  }
  try {
    fs.mkdirSync(join(destFile, '..'))
    fs.copyFileSync(sourceFile, destFile)
    result.copiedFiles++
  } catch (error) {
    result.errors.push({
      path: sourceFile,
      message: error instanceof Error ? error.message : String(error),
    })
  }
}

function mergeHistory(
  sourceDir: string,
  destDir: string,
  result: MigrationResult,
): void {
  const fs = getFsImplementation()
  const sourceFile = join(sourceDir, 'history.jsonl')
  const destFile = join(destDir, 'history.jsonl')
  if (!fs.existsSync(sourceFile)) {
    return
  }
  if (!fs.existsSync(destFile)) {
    copyFileIfAbsent(sourceFile, destFile, result)
    return
  }
  try {
    const readLines = (path: string): string[] =>
      fs
        .readFileSync(path, { encoding: 'utf8' })
        .split('\n')
        .filter(line => line.length > 0)

    const destLines = readLines(destFile)
    // De-duplicate by exact line content: history entries are self-contained
    // JSON lines, so an identical line is the same event replayed rather than
    // two distinct events.
    const seen = new Set(destLines)
    const added = readLines(sourceFile).filter(line => !seen.has(line))
    if (added.length > 0) {
      fs.appendFileSync(destFile, `${added.join('\n')}\n`)
      result.copiedFiles++
    }
  } catch (error) {
    result.errors.push({
      path: sourceFile,
      message: error instanceof Error ? error.message : String(error),
    })
  }
}

function mergeSettings(
  sourceDir: string,
  destDir: string,
  result: MigrationResult,
): void {
  const fs = getFsImplementation()
  const sourceFile = join(sourceDir, 'settings.json')
  const destFile = join(destDir, 'settings.json')
  const sourceSettings = readJsonObject(sourceFile)
  if (!sourceSettings) {
    return
  }

  const destSettings = readJsonObject(destFile)
  if (!destSettings) {
    copyFileIfAbsent(sourceFile, destFile, result)
    return
  }

  try {
    // Destination wins on conflict; source contributes only new keys.
    const merged = { ...sourceSettings, ...destSettings }

    // Idempotent: only backup and write if the merge actually changes something.
    if (JSON.stringify(merged) === JSON.stringify(destSettings)) {
      return
    }

    // Timestamped backup first, in the same directory config.ts:1728 uses.
    const backupDir = join(destDir, 'backups')
    fs.mkdirSync(backupDir)
    const backupPath = join(backupDir, `settings.json.backup.${Date.now()}`)
    fs.copyFileSync(destFile, backupPath)
    result.settingsBackupPath = backupPath

    fs.mkdirSync(destDir)
    writeFileSyncAndFlush_DEPRECATED(
      destFile,
      `${JSON.stringify(merged, null, 2)}\n`,
      { encoding: 'utf8' },
    )
    result.copiedFiles++
  } catch (error) {
    result.errors.push({
      path: sourceFile,
      message: error instanceof Error ? error.message : String(error),
    })
  }
}

/**
 * Copies user-level content from ~/.openclaude into ~/.claude.
 *
 * Invariants, enforced by configHomeMigration.run.test.ts:
 * - never deletes, moves or modifies anything under the source
 * - never overwrites a file that already exists at the destination
 * - idempotent: a second run copies only what is new
 */
export async function runConfigHomeMigration(
  plan: MigrationPlan,
  onProgress?: (surfaceName: string, done: number, total: number) => void,
): Promise<MigrationResult> {
  const result: MigrationResult = {
    copiedFiles: 0,
    skippedFiles: 0,
    errors: [],
  }

  const directoryNames = [
    ...EXTRA_DIRECTORY_SURFACES,
    ...CLAUDE_CONFIG_DIRECTORIES,
  ]

  for (const name of directoryNames) {
    const sourceRoot = join(plan.sourceDir, name)
    const files = listFilesRecursive(sourceRoot)
    let done = 0
    for (const sourceFile of files) {
      const relative = sourceFile.slice(sourceRoot.length + 1)
      copyFileIfAbsent(sourceFile, join(plan.destDir, name, relative), result)
      done++
      onProgress?.(name, done, files.length)
    }
    if (files.length > 0) {
      onProgress?.(name, files.length, files.length)
    }
  }

  mergeHistory(plan.sourceDir, plan.destDir, result)
  onProgress?.('history.jsonl', 1, 1)

  mergeSettings(plan.sourceDir, plan.destDir, result)
  onProgress?.('settings.json', 1, 1)

  return result
}
