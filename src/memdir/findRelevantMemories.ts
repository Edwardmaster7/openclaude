import { feature } from 'bun:bundle'
import { logForDebugging } from '../utils/debug.js'
import { errorMessage } from '../utils/errors.js'
import { getDefaultSonnetModel } from '../utils/model/model.js'
import { sideQuery } from '../utils/sideQuery.js'
import { jsonParse } from '../utils/slowOperations.js'
import {
  formatMemoryManifest,
  type MemoryHeader,
  scanMemoryFiles,
} from './memoryScan.js'

export type RelevantMemory = {
  path: string
  mtimeMs: number
}

const SELECT_MEMORIES_SYSTEM_PROMPT = `You are selecting memories that will be useful to Claude Code as it processes a user's query. You will be given the user's query and a list of available memory files with their filenames and descriptions.

Return a list of filenames for the memories that will clearly be useful to Claude Code as it processes the user's query (up to 5). Only include memories that you are certain will be helpful based on their name and description.
- If you are unsure if a memory will be useful in processing the user's query, then do not include it in your list. Be selective and discerning.
- If there are no memories in the list that would clearly be useful, feel free to return an empty list.
- If a list of recently-used tools is provided, do not select memories that are usage reference or API documentation for those tools (Claude Code is already exercising them). DO still select memories containing warnings, gotchas, or known issues about those tools — active use is exactly when those matter.
`

/**
 * Find memory files relevant to a query by scanning memory file headers
 * and asking Sonnet to select the most relevant ones.
 *
 * Returns absolute file paths + mtime of the most relevant memories
 * (up to 5). Excludes MEMORY.md (already loaded in system prompt).
 * mtime is threaded through so callers can surface freshness to the
 * main model without a second stat.
 *
 * `alreadySurfaced` filters paths shown in prior turns before the
 * Sonnet call, so the selector spends its 5-slot budget on fresh
 * candidates instead of re-picking files the caller will discard.
 */
export async function findRelevantMemories(
  query: string,
  memoryDir: string,
  signal: AbortSignal,
  recentTools: readonly string[] = [],
  alreadySurfaced: ReadonlySet<string> = new Set(),
  activeFiles: readonly string[] = [],
): Promise<RelevantMemory[]> {
  const memories = (await scanMemoryFiles(memoryDir, signal)).filter(
    m => !alreadySurfaced.has(m.filePath) && (m.score === undefined || m.score >= 20) && !m.ignored && !m.isExpired,
  )
  if (memories.length === 0) {
    return []
  }

  // Proactive File Triggering: Boost memories matching currently active files
  const proactiveMemories = memories.filter(m => {
    if (!m.appliesTo || m.appliesTo.length === 0) return false
    return m.appliesTo.some(path => activeFiles.some(af => af.includes(path) || path.includes(af)))
  })

  // Fast Local BM25 Keyword Scoring
  const highConfidenceLocalMemories = memories.filter(m => computeLocalBM25Score(query, m) >= 30)

  const selectedFilenames = await selectRelevantMemories(
    query,
    memories,
    signal,
    recentTools,
  )
  const byFilename = new Map(memories.map(m => [m.filename, m]))
  let selected = selectedFilenames
    .map(filename => byFilename.get(filename))
    .filter((m): m is MemoryHeader => m !== undefined)

  // Boost critical memories (score >= 80), proactive memories and high-confidence local matches
  const bonusMemories = memories.filter(
    m =>
      !selectedFilenames.includes(m.filename) &&
      ((m.score !== undefined && m.score >= 80) ||
        proactiveMemories.includes(m) ||
        highConfidenceLocalMemories.includes(m)),
  )
  selected.push(...bonusMemories)

  // Memory Graph Traversal: expand 1-Hop depends_on/see_also and prune supersedes
  selected = expandMemoryGraph(selected, memories)

  // Fires even on empty selection: selection-rate needs the denominator,
  // and -1 ages distinguish "ran, picked nothing" from "never ran".
  if (feature('MEMORY_SHAPE_TELEMETRY')) {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const { logMemoryRecallShape } =
      require('./memoryShapeTelemetry.js') as typeof import('./memoryShapeTelemetry.js')
    /* eslint-enable @typescript-eslint/no-require-imports */
    logMemoryRecallShape(memories, selected)
  }

  return selected.map(m => ({ path: m.filePath, mtimeMs: m.mtimeMs }))
}

function computeLocalBM25Score(query: string, memory: MemoryHeader): number {
  const terms = query.toLowerCase().split(/\W+/).filter(t => t.length > 2)
  if (terms.length === 0) return 0
  let score = 0
  const text = `${memory.filename} ${memory.description ?? ''} ${(memory.tags ?? []).join(' ')}`.toLowerCase()
  for (const term of terms) {
    if (text.includes(term)) {
      score += 15
    }
  }
  return score
}

function expandMemoryGraph(
  selected: MemoryHeader[],
  allMemories: MemoryHeader[],
): MemoryHeader[] {
  const byFilename = new Map(allMemories.map(m => [m.filename, m]))
  const finalMap = new Map<string, MemoryHeader>()
  const supersededTargets = new Set<string>()

  // Collect selected memories and identify superseded targets
  for (const item of selected) {
    finalMap.set(item.filename, item)
    if (item.relations) {
      for (const rel of item.relations) {
        if (rel.type === 'supersedes') {
          supersededTargets.add(rel.target)
        }
      }
    }
  }

  // 1-Hop graph traversal for depends_on and see_also
  for (const item of Array.from(finalMap.values())) {
    if (item.relations) {
      for (const rel of item.relations) {
        if (rel.type === 'depends_on' || rel.type === 'see_also') {
          const targetMem = byFilename.get(rel.target)
          if (targetMem && !targetMem.isExpired && !targetMem.ignored) {
            finalMap.set(targetMem.filename, targetMem)
          }
        }
      }
    }
  }

  // Prune superseded targets
  for (const target of supersededTargets) {
    finalMap.delete(target)
  }

  return Array.from(finalMap.values())
}

async function selectRelevantMemories(
  query: string,
  memories: MemoryHeader[],
  signal: AbortSignal,
  recentTools: readonly string[],
): Promise<string[]> {
  const validFilenames = new Set(memories.map(m => m.filename))

  const manifest = formatMemoryManifest(memories)

  // When Claude Code is actively using a tool (e.g. mcp__X__spawn),
  // surfacing that tool's reference docs is noise — the conversation
  // already contains working usage.  The selector otherwise matches
  // on keyword overlap ("spawn" in query + "spawn" in a memory
  // description → false positive).
  const toolsSection =
    recentTools.length > 0
      ? `\n\nRecently used tools: ${recentTools.join(', ')}`
      : ''

  try {
    const result = await sideQuery({
      model: getDefaultSonnetModel(),
      system: SELECT_MEMORIES_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Query: ${query}\n\nAvailable memories:\n${manifest}${toolsSection}`,
        },
      ],
      max_tokens: 256,
      output_format: {
        type: 'json_schema',
        schema: {
          type: 'object',
          properties: {
            selected_memories: { type: 'array', items: { type: 'string' } },
          },
          required: ['selected_memories'],
          additionalProperties: false,
        },
      },
      signal,
      querySource: 'memdir_relevance',
    })

    const textBlock = result.content.find(block => block.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      return []
    }

    const parsed: { selected_memories: string[] } = jsonParse(textBlock.text)
    return parsed.selected_memories.filter(f => validFilenames.has(f))
  } catch (e) {
    if (signal.aborted) {
      return []
    }
    logForDebugging(
      `[memdir] selectRelevantMemories failed: ${errorMessage(e)}`,
      { level: 'warn' },
    )
    return []
  }
}
