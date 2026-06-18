import { describe, expect, test, beforeEach } from 'bun:test'
import { saveGlobalConfig } from '../../utils/config.js'
import {
  adsEarningEnabled,
  shouldShowEarningTip,
  resetEarningCadenceForTesting,
  buildEarningTip,
} from './gitlawbEarn.js'

function setAds(ads: { enabled: boolean; earnCode?: string } | undefined): void {
  saveGlobalConfig(c => ({ ...c, ads }))
}

beforeEach(() => {
  resetEarningCadenceForTesting()
  // Unreachable host → fetchNextTip fails fast and content() degrades to the
  // static fallback, so these tests never hit the network.
  process.env.ADS_BASE_URL = 'http://127.0.0.1:0'
  delete process.env.OPENCLAUDE_ADS_TIP_EVERY
})

describe('gitlawb earning tips', () => {
  test('disabled by default (no ads config)', () => {
    setAds(undefined)
    expect(adsEarningEnabled()).toBe(false)
    expect(shouldShowEarningTip()).toBe(false)
  })

  test('enabled once /ads on set enabled + earnCode', () => {
    setAds({ enabled: true, earnCode: 'earn_abc' })
    expect(adsEarningEnabled()).toBe(true)
  })

  test('cadence: every 2nd eligible slot by default', () => {
    setAds({ enabled: true, earnCode: 'earn_abc' })
    resetEarningCadenceForTesting()
    expect(shouldShowEarningTip()).toBe(false) // turn 1
    expect(shouldShowEarningTip()).toBe(true) //  turn 2
    expect(shouldShowEarningTip()).toBe(false) // turn 3
    expect(shouldShowEarningTip()).toBe(true) //  turn 4
  })

  test('OPENCLAUDE_ADS_TIP_EVERY=1 shows every turn', () => {
    setAds({ enabled: true, earnCode: 'earn_abc' })
    process.env.OPENCLAUDE_ADS_TIP_EVERY = '1'
    resetEarningCadenceForTesting()
    expect(shouldShowEarningTip()).toBe(true)
    expect(shouldShowEarningTip()).toBe(true)
  })

  test('disabled → never shows and never increments the counter', () => {
    setAds(undefined)
    for (let i = 0; i < 5; i++) expect(shouldShowEarningTip()).toBe(false)
  })

  test('content falls back to a static line when the ads service is unreachable', async () => {
    setAds({ enabled: true, earnCode: 'earn_abc' })
    const text = await buildEarningTip().content({ theme: 'dark' })
    expect(text.toLowerCase()).toContain('gitlawb.com')
  })
})
