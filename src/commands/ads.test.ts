import { describe, expect, test, beforeEach } from 'bun:test'
import adsCmd from './ads.js'
import { getGlobalConfig, saveGlobalConfig } from '../utils/config.js'

// Unreachable host → the background warm-earn fails fast and never hits the
// network. (bun test sets NODE_ENV=test, so saveGlobalConfig writes in-memory.)
beforeEach(() => {
  process.env.ADS_BASE_URL = 'http://127.0.0.1:0'
  saveGlobalConfig(c => ({ ...c, ads: undefined }))
})

type RunResult = { text: string | undefined; node: React.ReactNode }

async function run(args: string): Promise<RunResult> {
  const { call } = await adsCmd.load()
  let text: string | undefined
  const onDone = (result?: string): void => {
    text = result
  }
  const node = await call(onDone, {} as never, args)
  return { text, node }
}

describe('/ads command', () => {
  test('status shows off by default', async () => {
    const { text } = await run('')
    expect(text).toContain('off')
  })

  test('"on" returns the masked dialog and does not enable yet', async () => {
    const { node, text } = await run('on')
    expect(node).toBeTruthy() // renders AdsCodeDialog
    expect(text).toBeUndefined() // resolves only after the user submits
    expect(getGlobalConfig().ads?.enabled).toBeFalsy()
  })

  test('"on <code>" never enables inline — it also opens the masked dialog', async () => {
    const { node, text } = await run('on earn_typed_inline')
    expect(node).toBeTruthy()
    expect(text).toBeUndefined()
    // The inline code is ignored; nothing is persisted from the command line.
    expect(getGlobalConfig().ads?.enabled).toBeFalsy()
  })

  test('"off" disables earning', async () => {
    saveGlobalConfig(c => ({ ...c, ads: { enabled: true, earnCode: 'x' } }))
    const { text } = await run('off')
    expect(text?.toLowerCase()).toContain('disabled')
    expect(getGlobalConfig().ads?.enabled).toBe(false)
  })
})
