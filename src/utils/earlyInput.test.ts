import { describe, expect, test, beforeEach } from 'bun:test'
import { consumeEarlyInput, processEarlyInputChunk } from './earlyInput.js'

function capture(chunk: string): string {
  processEarlyInputChunk(chunk)
  return consumeEarlyInput()
}

describe('processEarlyInputChunk escape filtering', () => {
  beforeEach(() => {
    consumeEarlyInput()
  })

  // Regression: the filter treated the CSI introducer '[' (0x5B) as the
  // sequence's final byte, because 0x5B falls inside the 0x40-0x7E final-byte
  // range. Only ESC and '[' were consumed, so the real final byte leaked into
  // the prompt as text — an alt-tab before the REPL mounted pre-filled it with
  // "OI" (focus-out + focus-in), arrow keys with "A"/"B"/"C"/"D".
  test('drops focus events entirely', () => {
    expect(capture('\x1b[O\x1b[I')).toBe('')
  })

  test('drops arrow keys entirely', () => {
    expect(capture('\x1b[A\x1b[B\x1b[C\x1b[D')).toBe('')
  })

  test('drops home/end entirely', () => {
    expect(capture('\x1b[H\x1b[F')).toBe('')
  })

  test('drops parameterised sequences entirely', () => {
    expect(capture('\x1b[15~')).toBe('')
  })

  test('drops bracketed-paste markers but keeps the pasted text', () => {
    expect(capture('\x1b[200~oi\x1b[201~')).toBe('oi')
  })

  test('drops SS3 sequences entirely', () => {
    expect(capture('\x1bOA')).toBe('')
  })

  test('keeps ordinary typed text', () => {
    expect(capture('/resume')).toBe('/resume')
  })

  test('keeps text typed around a focus event', () => {
    expect(capture('/re\x1b[Osu\x1b[Ime')).toBe('/resume')
  })
})
