import { copyFile, mkdir, unlink } from 'fs/promises'
import { join } from 'path'
import { type MemoryHeader, scanMemoryFiles } from './memoryScan.js'

export type GraphAuditReport = {
  totalMemories: number
  expiredMemories: string[]
  brokenRelations: Array<{ source: string; relationType: string; target: string }>
  orphanedMemories: string[]
}

/**
 * Scan memories and build an ASCII tree representation of the Memory Graph.
 */
export async function renderMemoryGraph(
  memoryDir: string,
  signal: AbortSignal = new AbortController().signal,
): Promise<string> {
  const memories = await scanMemoryFiles(memoryDir, signal)
  if (memories.length === 0) {
    return 'No memories found in directory.'
  }

  const byFilename = new Map(memories.map(m => [m.filename, m]))
  const lines: string[] = ['=== Memory Graph ===\n']

  for (const memory of memories) {
    const statusTag = memory.isExpired ? ' [EXPIRED]' : memory.ignored ? ' [IGNORED]' : ''
    const typeTag = memory.type ? ` (${memory.type})` : ''
    lines.push(`┌── ${memory.filename}${typeTag}${statusTag}`)

    if (memory.description) {
      lines.push(`│   Description: ${memory.description}`)
    }

    if (memory.ttl) {
      lines.push(`│   TTL: ${memory.ttl}`)
    }

    if (memory.tags && memory.tags.length > 0) {
      lines.push(`│   Tags: [${memory.tags.join(', ')}]`)
    }

    if (memory.appliesTo && memory.appliesTo.length > 0) {
      lines.push(`│   Applies to: ${memory.appliesTo.join(', ')}`)
    }

    if (memory.relations && memory.relations.length > 0) {
      for (const rel of memory.relations) {
        const exists = byFilename.has(rel.target)
        const targetLabel = exists ? rel.target : `${rel.target} (not found)`
        lines.push(`│   ├── [${rel.type}] ──> ${targetLabel}`)
      }
    } else {
      lines.push(`│   └── (no direct connections)`)
    }

    lines.push('│')
  }

  return lines.join('\n')
}

/**
 * Audit memory graph integrity for broken relations, expired memories, and orphans.
 */
export async function auditMemoryIntegrity(
  memoryDir: string,
  signal: AbortSignal = new AbortController().signal,
): Promise<GraphAuditReport> {
  const memories = await scanMemoryFiles(memoryDir, signal)
  const byFilename = new Map(memories.map(m => [m.filename, m]))

  const report: GraphAuditReport = {
    totalMemories: memories.length,
    expiredMemories: [],
    brokenRelations: [],
    orphanedMemories: [],
  }

  for (const m of memories) {
    if (m.isExpired) {
      report.expiredMemories.push(m.filename)
    }

    let hasEdges = false
    if (m.relations && m.relations.length > 0) {
      hasEdges = true
      for (const rel of m.relations) {
        if (!byFilename.has(rel.target)) {
          report.brokenRelations.push({
            source: m.filename,
            relationType: rel.type,
            target: rel.target,
          })
        }
      }
    }

    if (!hasEdges && (!m.tags || m.tags.length === 0) && (!m.appliesTo || m.appliesTo.length === 0)) {
      report.orphanedMemories.push(m.filename)
    }
  }

  return report
}

/**
 * Format audit report as human-readable string.
 */
export function formatAuditReport(report: GraphAuditReport): string {
  const lines: string[] = ['=== Memory Graph Audit Report ===\n']
  lines.push(`Total memories audited: ${report.totalMemories}`)
  lines.push(`Expired memories (TTL): ${report.expiredMemories.length}`)
  if (report.expiredMemories.length > 0) {
    lines.push(`  - ${report.expiredMemories.join(', ')}`)
  }

  lines.push(`Broken graph links: ${report.brokenRelations.length}`)
  for (const broken of report.brokenRelations) {
    lines.push(`  - ${broken.source} [${broken.relationType}] -> ${broken.target}`)
  }

  lines.push(`Isolated/orphaned memories: ${report.orphanedMemories.length}`)
  if (report.orphanedMemories.length > 0) {
    lines.push(`  - ${report.orphanedMemories.join(', ')}`)
  }

  return lines.join('\n')
}

/**
 * Forget/delete a specified memory file.
 */
export async function forgetMemoryFile(memoryDir: string, filename: string): Promise<boolean> {
  try {
    const targetPath = join(memoryDir, filename)
    await unlink(targetPath)
    return true
  } catch {
    return false
  }
}

/**
 * Render Memory Graph in Mermaid diagram code block.
 */
export async function renderMemoryGraphMermaid(
  memoryDir: string,
  signal: AbortSignal = new AbortController().signal,
): Promise<string> {
  const memories = await scanMemoryFiles(memoryDir, signal)
  if (memories.length === 0) {
    return '```mermaid\ngraph TD\n  Empty["No memories found"]\n```'
  }

  const sanitizeId = (name: string) => name.replace(/[^a-zA-Z0-9]/g, '_')
  const lines: string[] = ['```mermaid', 'graph TD']

  for (const m of memories) {
    const id = sanitizeId(m.filename)
    const label = `${m.filename}${m.type ? ` (${m.type})` : ''}`
    lines.push(`  ${id}["${label}"]`)

    if (m.relations) {
      for (const rel of m.relations) {
        const targetId = sanitizeId(rel.target)
        lines.push(`  ${id} -->|${rel.type}| ${targetId}`)
      }
    }
  }

  lines.push('```')
  return lines.join('\n')
}

/**
 * Purge expired memories and clean broken links (Self-Healing Storage).
 */
export async function purgeExpiredAndBrokenMemories(
  memoryDir: string,
  signal: AbortSignal = new AbortController().signal,
): Promise<{ purgedExpired: string[]; totalCleaned: number }> {
  const report = await auditMemoryIntegrity(memoryDir, signal)
  const purgedExpired: string[] = []

  for (const filename of report.expiredMemories) {
    const success = await forgetMemoryFile(memoryDir, filename)
    if (success) {
      purgedExpired.push(filename)
    }
  }

  return {
    purgedExpired,
    totalCleaned: purgedExpired.length,
  }
}

/**
 * Synchronize team memories between local project repository and global AI memory,
 * automatically filtering out private 'user' type memories and auto-healing after push.
 */
export async function syncTeamMemories(
  sourceDir: string,
  targetDir: string,
  mode: 'pull' | 'push' = 'pull',
  signal: AbortSignal = new AbortController().signal,
): Promise<{ syncedFiles: string[]; ignoredUserMemories: string[] }> {
  const memories = await scanMemoryFiles(sourceDir, signal)
  await mkdir(targetDir, { recursive: true })

  const syncedFiles: string[] = []
  const ignoredUserMemories: string[] = []

  for (const m of memories) {
    if (m.type === 'user') {
      ignoredUserMemories.push(m.filename)
      continue
    }

    try {
      const srcPath = join(sourceDir, m.filename)
      const dstPath = join(targetDir, m.filename)
      await copyFile(srcPath, dstPath)
      syncedFiles.push(m.filename)
    } catch {
      // Ignore copy error
    }
  }

  if (mode === 'push') {
    await purgeExpiredAndBrokenMemories(targetDir, signal)
  }

  return { syncedFiles, ignoredUserMemories }
}

/**
 * Query Memory Graph (Graphify-style subquery report).
 */
export async function queryMemoryGraph(
  memoryDir: string,
  query: string,
  signal: AbortSignal = new AbortController().signal,
): Promise<string> {
  const memories = await scanMemoryFiles(memoryDir, signal)
  if (memories.length === 0) {
    return 'No memories found for query.'
  }

  const terms = query.toLowerCase().split(/\W+/).filter(t => t.length > 2)
  const matching = memories.filter(m => {
    const text = `${m.filename} ${m.description ?? ''} ${(m.tags ?? []).join(' ')}`.toLowerCase()
    return terms.some(t => text.includes(t))
  })

  if (matching.length === 0) {
    return `No matching memories found for query: "${query}"`
  }

  const byFilename = new Map(memories.map(m => [m.filename, m]))
  const lines: string[] = [`=== Graphify-Style Memory Subgraph Query: "${query}" ===\n`]

  for (const seed of matching) {
    lines.push(`Node: ${seed.filename} [type: ${seed.type ?? 'unknown'}]`)
    if (seed.description) lines.push(`  Description: ${seed.description}`)
    if (seed.appliesTo && seed.appliesTo.length > 0) {
      lines.push(`  Applies to Code: ${seed.appliesTo.join(', ')}`)
    }
    if (seed.relations && seed.relations.length > 0) {
      lines.push('  Edges:')
      for (const rel of seed.relations) {
        const targetMem = byFilename.get(rel.target)
        lines.push(`    └── [${rel.type}] ──> ${rel.target} (${targetMem ? targetMem.description ?? 'No description' : 'Not found'})`)
      }
    }
    lines.push('')
  }

  return lines.join('\n')
}

/**
 * Find dependency path between two memory nodes (BFS Path Search).
 */
export async function findMemoryPath(
  memoryDir: string,
  startTarget: string,
  endTarget: string,
  signal: AbortSignal = new AbortController().signal,
): Promise<string> {
  const memories = await scanMemoryFiles(memoryDir, signal)
  const byFilename = new Map(memories.map(m => [m.filename, m]))

  const startNode = memories.find(m => m.filename.includes(startTarget))
  const endNode = memories.find(m => m.filename.includes(endTarget))

  if (!startNode || !endNode) {
    return `Memory node not found: ${!startNode ? startTarget : endTarget}`
  }

  const queue: Array<[string, string[]]> = [[startNode.filename, [startNode.filename]]]
  const visited = new Set<string>([startNode.filename])

  while (queue.length > 0) {
    const [curr, path] = queue.shift()!
    if (curr === endNode.filename) {
      return `=== Memory Graph Path ===\n\n${path.join(' ──> ')}`
    }

    const currHeader = byFilename.get(curr)
    if (currHeader?.relations) {
      for (const rel of currHeader.relations) {
        if (!visited.has(rel.target)) {
          visited.add(rel.target)
          queue.push([rel.target, [...path, `${rel.type} ──> ${rel.target}`]])
        }
      }
    }
  }

  return `No path found between '${startNode.filename}' and '${endNode.filename}'.`
}

/**
 * Explain a memory node (Graphify-style explain).
 */
export async function explainMemoryNode(
  memoryDir: string,
  target: string,
  signal: AbortSignal = new AbortController().signal,
): Promise<string> {
  const memories = await scanMemoryFiles(memoryDir, signal)
  const node = memories.find(m => m.filename.includes(target))

  if (!node) {
    return `Memory '${target}' not found.`
  }

  const lines: string[] = [`=== Memory Node Explanation: ${node.filename} ===\n`]
  lines.push(`File Path: ${node.filePath}`)
  lines.push(`Type: ${node.type ?? 'unknown'}`)
  lines.push(`Score: ${node.score ?? 50} | Confirmations: ${node.confirmations ?? 0}`)
  if (node.ttl) lines.push(`TTL: ${node.ttl} ${node.isExpired ? '(EXPIRED)' : '(Active)'}`)
  if (node.description) lines.push(`Description: ${node.description}`)
  if (node.tags && node.tags.length > 0) lines.push(`Tags: ${node.tags.join(', ')}`)
  if (node.appliesTo && node.appliesTo.length > 0) lines.push(`Applies to Code (Graphify AST Nodes): ${node.appliesTo.join(', ')}`)

  if (node.relations && node.relations.length > 0) {
    lines.push('\n[Graph Relations]')
    for (const rel of node.relations) {
      lines.push(`  - [${rel.type}] -> ${rel.target}`)
    }
  } else {
    lines.push('\n[Graph Relations] No explicit relations in YAML frontmatter.')
  }

  return lines.join('\n')
}

/**
 * Export Memory Graph as Graphify-compatible JSON ({ nodes: [...], edges: [...] }).
 */
export async function exportMemoryGraphJson(
  memoryDir: string,
  signal: AbortSignal = new AbortController().signal,
): Promise<string> {
  const memories = await scanMemoryFiles(memoryDir, signal)

  const nodes = memories.map(m => ({
    id: m.filename,
    label: m.filename,
    type: m.type ?? 'unknown',
    description: m.description,
    score: m.score ?? 50,
    appliesTo: m.appliesTo ?? [],
    tags: m.tags ?? [],
  }))

  const edges: Array<{ source: string; target: string; type: string }> = []
  for (const m of memories) {
    if (m.relations) {
      for (const rel of m.relations) {
        edges.push({
          source: m.filename,
          target: rel.target,
          type: rel.type,
        })
      }
    }
  }

  return JSON.stringify({ nodes, edges }, null, 2)
}

/**
 * Render Memory TTL & Type Distribution Dashboard.
 */
export async function renderMemoryTTLDashboard(
  memoryDir: string,
  signal: AbortSignal = new AbortController().signal,
): Promise<string> {
  const memories = await scanMemoryFiles(memoryDir, signal)
  if (memories.length === 0) {
    return 'No memories found in directory.'
  }

  const now = Date.now()
  const typeCounts: Record<string, number> = {}
  const expiredList: MemoryHeader[] = []
  const ttlActiveList: Array<{ header: MemoryHeader; daysRemaining: number }> = []
  let noTtlCount = 0

  for (const m of memories) {
    const t = m.type ?? 'untyped'
    typeCounts[t] = (typeCounts[t] ?? 0) + 1

    if (m.isExpired) {
      expiredList.push(m)
    } else if (m.expiresAt) {
      const daysRemaining = Math.max(0, Math.ceil((m.expiresAt - now) / (1000 * 60 * 60 * 24)))
      ttlActiveList.push({ header: m, daysRemaining })
    } else {
      noTtlCount++
    }
  }

  const lines: string[] = ['=== Memory TTL & Lifecycle Dashboard ===\n']
  lines.push(`Total memories: ${memories.length}`)
  lines.push(`Permanent (No TTL): ${noTtlCount}`)
  lines.push(`Active with TTL: ${ttlActiveList.length}`)
  lines.push(`Expired (Pending Purge): ${expiredList.length}\n`)

  lines.push('[Memory Type Distribution]')
  for (const [type, count] of Object.entries(typeCounts)) {
    lines.push(`  - ${type}: ${count}`)
  }

  if (ttlActiveList.length > 0) {
    lines.push('\n[Active TTL Memories]')
    ttlActiveList.sort((a, b) => a.daysRemaining - b.daysRemaining)
    for (const { header, daysRemaining } of ttlActiveList) {
      lines.push(`  - ${header.filename} (${header.ttl ?? 'custom'}) -> ${daysRemaining} day(s) remaining`)
    }
  }

  if (expiredList.length > 0) {
    lines.push('\n[Expired Memories (Run `/memory purge` to clean)]')
    for (const m of expiredList) {
      lines.push(`  - ${m.filename} (${m.ttl ?? 'expired'})`)
    }
  }

  return lines.join('\n')
}
