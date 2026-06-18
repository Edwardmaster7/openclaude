import { join } from 'path'
import { sideQuery } from '../utils/sideQuery.js'
import { getDefaultSonnetModel } from '../utils/model/model.js'
import { readFeedbackEvents, clearFeedbackLog } from './feedbackLog.js'
import { scanMemoryFiles } from './memoryScan.js'
import { getAutoMemPath } from './paths.js'
import { getFsImplementation } from '../utils/fsOperations.js'
import { jsonParse } from '../utils/slowOperations.js'
import chalk from 'chalk'

const SYNTHESIZE_SYSTEM_PROMPT = `You are a machine-learning feedback synthesizer for Claude Code. Your job is to take a raw log of user feedback events (undos, corrections, and tool execution outcomes) along with existing feedback memories, and consolidate them into clean, action-oriented, project-specific "feedback" memories.

Rules for synthesis:
1. Group events by high-level theme (e.g. auth, databases, frontend-layout, tool-paths).
2. For each theme, produce a set of explicit rules. Each rule MUST have:
   - "title": A short title for the rule category (e.g., "Auth Library", "Password Hashing").
   - "rule": The action-oriented rule to follow (e.g. "Use argon2 for password hashing in this project (not bcrypt).").
   - "why": The rationale derived from the feedback events (e.g. "User corrected on 2026-05-25 — project uses argon2 by security policy.").
3. Make sure to consolidate multiple events on the same topic into a single cohesive file, rather than creating separate files.
4. Output your analysis in the specified JSON format containing a list of memory file proposals.
`

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

export async function runFeedbackSynthesis(context: any): Promise<string> {
  const fs = getFsImplementation()
  const events = await readFeedbackEvents()
  
  if (events.length === 0) {
    return chalk.yellow('[Feedback System] Nenhum evento bruto encontrado no log para consolidar.')
  }

  // Scan existing feedback memories
  const autoMemPath = getAutoMemPath()
  const memories = await scanMemoryFiles(autoMemPath, context.abortController.signal)
  const feedbackMemories = memories.filter(m => m.type === 'feedback')

  // Read existing content
  const existingMemoriesData: Array<{ filename: string; content: string; score?: number; confirmations?: number }> = []
  for (const m of feedbackMemories) {
    try {
      const content = await fs.readFile(m.filePath, { encoding: 'utf8' })
      existingMemoriesData.push({
        filename: m.filename,
        content,
        score: m.score,
        confirmations: m.confirmations,
      })
    } catch {}
  }

  const payload = {
    events,
    existingMemories: existingMemoriesData,
  }

  try {
    const result = await sideQuery({
      model: getDefaultSonnetModel(),
      system: SYNTHESIZE_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Execute a consolidação inteligente com base nos seguintes dados:\n\n${JSON.stringify(payload, null, 2)}`,
        },
      ],
      max_tokens: 4096,
      output_format: {
        type: 'json_schema',
        schema: {
          type: 'object',
          properties: {
            proposals: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  filename: { type: 'string', description: 'E.g., feedback-auth-patterns.md' },
                  description: { type: 'string', description: 'Brief description' },
                  rules: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        title: { type: 'string' },
                        rule: { type: 'string' },
                        why: { type: 'string' }
                      },
                      required: ['title', 'rule', 'why']
                    }
                  }
                },
                required: ['filename', 'description', 'rules']
              }
            }
          },
          required: ['proposals'],
          additionalProperties: false
        }
      },
      signal: context.abortController.signal,
      querySource: 'feedback_synthesis',
    })

    const textBlock = result.content.find(block => block.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      return chalk.red('[Feedback System] Falha ao sintetizar: A IA não retornou um formato válido.')
    }

    const parsed: { proposals: Array<{ filename: string; description: string; rules: Array<{ title: string; rule: string; why: string }> }> } = jsonParse(textBlock.text)
    
    if (parsed.proposals.length === 0) {
      return chalk.yellow('[Feedback System] O sintetizador analisou os eventos, mas nenhum padrão consolidado foi identificado.')
    }

    const savedFiles: string[] = []
    
    for (const proposal of parsed.proposals) {
      const fileName = proposal.filename.endsWith('.md') ? proposal.filename : `${proposal.filename}.md`
      const filePath = join(autoMemPath, fileName)

      // Check if it already exists
      const existing = feedbackMemories.find(m => m.filename === fileName)
      
      let score = 50
      let confirmations = 0
      
      if (existing) {
        // Increment confirmations and adjust score (+3 for fresh consolidation)
        confirmations = (existing.confirmations || 0) + 1
        score = Math.min(100, (existing.score || 50) + 3)
      } else {
        score = 50
        confirmations = 1
      }

      // Check for user-confirmed flags in log corresponding to this theme
      const matchWord = fileName.replace('feedback-', '').replace('-patterns.md', '')
      const matchConfirmed = events.some(e => e.confirmed && e.file && e.file.toLowerCase().includes(matchWord))
      if (matchConfirmed) {
        score = Math.min(100, score + 10)
        confirmations += 2
      }

      const frontmatter = {
        name: fileName.replace('.md', ''),
        description: proposal.description,
        type: 'feedback',
        score,
        lastSuccess: new Date().toISOString().split('T')[0],
        confirmations,
      }

      const frontmatterStr = stringifyFrontmatter(frontmatter)
      
      const bodyLines = proposal.rules.map(r => {
        return `## Pattern: ${r.title}\n\n**Rule:** ${r.rule}\n**Why:** ${r.why}\n`
      }).join('\n')

      const finalMarkdown = `${frontmatterStr}\n\n# Learned Patterns\n\n${bodyLines}`

      try {
        try {
          await fs.unlink(filePath)
        } catch {}
        fs.appendFileSync(filePath, finalMarkdown, { encoding: 'utf8' } as any)
        savedFiles.push(`${fileName} (Score: ${score}, Confirmações: ${confirmations})`)
      } catch (writeErr) {
        // Silent catch
      }
    }

    // Clear consolidated events from the raw log
    await clearFeedbackLog(5) // keep last 5 as history/safeguard

    return [
      chalk.bold.green('[Feedback System] Síntese e consolidação concluídas com sucesso!'),
      '',
      chalk.bold('Padrões de Memória Atualizados:'),
      ...savedFiles.map(f => `- ${f}`),
    ].join('\n')

  } catch (error) {
    return chalk.red(`[Feedback System] Erro durante a síntese de feedback: ${error}`)
  }
}
