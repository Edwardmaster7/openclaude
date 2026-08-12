import { afterEach, expect, test } from 'bun:test'
import { mkdtemp, readFile, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { findRelevantMemories } from './findRelevantMemories.js'
import {
  auditMemoryIntegrity,
  explainMemoryNode,
  exportMemoryGraphJson,
  findMemoryPath,
  purgeExpiredAndBrokenMemories,
  queryMemoryGraph,
  renderMemoryGraph,
  renderMemoryGraphMermaid,
  syncTeamMemories,
} from './memoryGraphCli.js'
import { scanMemoryFiles, updateMemoryScore } from './memoryScan.js'
import { MEMORY_TYPES, parseMemoryType } from './memoryTypes.js'

let tempDir: string | undefined

afterEach(async () => {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true })
    tempDir = undefined
  }
})

test('memoryTypes includes new types procedure and architecture_decision', () => {
  expect(MEMORY_TYPES).toContain('procedure')
  expect(MEMORY_TYPES).toContain('architecture_decision')
  expect(parseMemoryType('procedure')).toBe('procedure')
  expect(parseMemoryType('architecture_decision')).toBe('architecture_decision')
})

test('scanMemoryFiles parses Memory Graph relations, applies_to, tags and TTL expiration', async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'openclaude-graph-test-'))

  const activeContent = `---
name: auth-jwt-policy
description: Diretrizes de autenticação JWT
type: feedback
tags: [auth, jwt]
applies_to: [src/utils/auth.ts]
relations:
  - type: depends_on
    target: db-schema.md
ttl: 7d
---
Conteúdo sobre JWT.
`

  const expiredContent = `---
name: temporary-freeze
description: Congelamento de codigo
type: project
ttl: 1s
---
`

  await writeFile(join(tempDir, 'auth-jwt-policy.md'), activeContent, 'utf8')
  await writeFile(join(tempDir, 'db-schema.md'), '---\nname: db-schema\ndescription: DB Schema\ntype: reference\n---\n', 'utf8')
  await writeFile(join(tempDir, 'temporary-freeze.md'), expiredContent, 'utf8')

  await new Promise(r => setTimeout(r, 1100))

  const headers = await scanMemoryFiles(tempDir, new AbortController().signal)
  const byName = new Map(headers.map(h => [h.filename, h]))

  const authHeader = byName.get('auth-jwt-policy.md')
  expect(authHeader).toBeDefined()
  expect(authHeader?.type).toBe('feedback')
  expect(authHeader?.tags).toEqual(['auth', 'jwt'])
  expect(authHeader?.appliesTo).toEqual(['src/utils/auth.ts'])
  expect(authHeader?.relations).toEqual([{ type: 'depends_on', target: 'db-schema.md' }])
  expect(authHeader?.isExpired).toBeUndefined()

  const expiredHeader = byName.get('temporary-freeze.md')
  expect(expiredHeader).toBeDefined()
  expect(expiredHeader?.isExpired).toBe(true)
})

test('renderMemoryGraph, renderMemoryGraphMermaid and purgeExpiredAndBrokenMemories work correctly', async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'openclaude-graph-cli-test-'))

  const mem1 = `---
name: mem1
description: Memoria 1
type: procedure
relations:
  - type: depends_on
    target: missing-target.md
---
`
  const exp = `---
name: exp
description: Expired
type: project
ttl: 1s
---
`

  await writeFile(join(tempDir, 'mem1.md'), mem1, 'utf8')
  await writeFile(join(tempDir, 'exp.md'), exp, 'utf8')

  await new Promise(r => setTimeout(r, 1100))

  const graphOutput = await renderMemoryGraph(tempDir)
  expect(graphOutput).toContain('Memory Graph')
  expect(graphOutput).toContain('mem1.md')

  const mermaidOutput = await renderMemoryGraphMermaid(tempDir)
  expect(mermaidOutput).toContain('```mermaid')
  expect(mermaidOutput).toContain('mem1_md')

  const auditReport = await auditMemoryIntegrity(tempDir)
  expect(auditReport.totalMemories).toBe(2)
  expect(auditReport.expiredMemories).toContain('exp.md')

  const purgeRes = await purgeExpiredAndBrokenMemories(tempDir)
  expect(purgeRes.purgedExpired).toContain('exp.md')
})

test('updateMemoryScore rewrites score and confirmations in YAML frontmatter', async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'openclaude-score-test-'))
  const filePath = join(tempDir, 'score-mem.md')

  await writeFile(filePath, '---\nname: score-mem\nscore: 50\nconfirmations: 2\n---\nBody text\n', 'utf8')

  await updateMemoryScore(filePath, 15, 1)

  const updatedContent = await readFile(filePath, 'utf8')
  expect(updatedContent).toContain('score: 65')
  expect(updatedContent).toContain('confirmations: 3')
})

test('findRelevantMemories performs proactive file triggering and BM25 local scoring', async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'openclaude-proactive-test-'))

  const memAuth = `---
name: auth-handler
description: Handler para rotas de autenticação
type: feedback
applies_to: [src/routes/auth.ts]
---
`
  await writeFile(join(tempDir, 'auth-handler.md'), memAuth, 'utf8')

  const relevant = await findRelevantMemories(
    'qualquer pergunta aleatoria',
    tempDir,
    new AbortController().signal,
    [],
    new Set(),
    ['src/routes/auth.ts'],
  )

  expect(relevant.length).toBeGreaterThan(0)
  expect(relevant[0]?.path).toContain('auth-handler.md')
})

test('syncTeamMemories filters out user type memories and auto-heals after push', async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'openclaude-sync-src-'))
  const targetDir = await mkdtemp(join(tmpdir(), 'openclaude-sync-dst-'))

  const userMem = '---\nname: user-pref\ntype: user\n---\nUser preference\n'
  const teamMem = '---\nname: team-proc\ntype: procedure\n---\nTeam procedure\n'

  await writeFile(join(tempDir, 'user-pref.md'), userMem, 'utf8')
  await writeFile(join(tempDir, 'team-proc.md'), teamMem, 'utf8')

  const res = await syncTeamMemories(tempDir, targetDir, 'push')

  expect(res.ignoredUserMemories).toContain('user-pref.md')
  expect(res.syncedFiles).toContain('team-proc.md')

  const targetFiles = await scanMemoryFiles(targetDir, new AbortController().signal)
  expect(targetFiles.some(f => f.filename === 'team-proc.md')).toBe(true)
  expect(targetFiles.some(f => f.filename === 'user-pref.md')).toBe(false)

  await rm(targetDir, { recursive: true, force: true })
})

test('Graphify-style commands (queryMemoryGraph, findMemoryPath, explainMemoryNode, exportMemoryGraphJson) work correctly', async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'openclaude-graphify-test-'))

  const memA = `---
name: auth-service
description: Serviço de Autenticação JWT
type: procedure
applies_to: [src/auth.ts]
relations:
  - type: depends_on
    target: db-schema.md
---
`
  const memB = `---
name: db-schema
description: Banco de dados PostgreSQL
type: reference
---
`

  await writeFile(join(tempDir, 'auth-service.md'), memA, 'utf8')
  await writeFile(join(tempDir, 'db-schema.md'), memB, 'utf8')

  const queryRes = await queryMemoryGraph(tempDir, 'autenticação')
  expect(queryRes).toContain('auth-service.md')

  const pathRes = await findMemoryPath(tempDir, 'auth-service.md', 'db-schema.md')
  expect(pathRes).toContain('auth-service.md ──> depends_on ──> db-schema.md')

  const explainRes = await explainMemoryNode(tempDir, 'auth-service.md')
  expect(explainRes).toContain('Type: procedure')
  expect(explainRes).toContain('src/auth.ts')

  const jsonStr = await exportMemoryGraphJson(tempDir)
  const json = JSON.parse(jsonStr)
  expect(json.nodes.length).toBe(2)
  expect(json.edges.length).toBe(1)
  expect(json.edges[0].type).toBe('depends_on')
})
