import { afterAll, beforeEach, describe, expect, mock, test } from 'bun:test'

const _realSettings = await import(
  `../../utils/settings/settings.js?real=${Date.now()}-${Math.random()}`
)
const _realAuth = await import(
  `../../utils/auth.js?real=${Date.now()}-${Math.random()}`
)
const _realGrowthbook = await import(
  `../analytics/growthbook.js?real=${Date.now()}-${Math.random()}`
)

let _mockSettings: Record<string, { channelsEnabled?: boolean } | null> = {}
let _mockSub: string | null = null
let _mockTenguHarbor = false

mock.module('../../utils/settings/settings.js', () => ({
  getSettingsForSource: (source: string) => _mockSettings[source] ?? null,
}))
mock.module('../../utils/auth.js', () => ({
  getSubscriptionType: () => _mockSub,
}))
mock.module('../analytics/growthbook.js', () => ({
  getFeatureValue_CACHED_MAY_BE_STALE: (key: string, fallback: unknown) =>
    key === 'tengu_harbor' ? _mockTenguHarbor : fallback,
}))

const { isChannelsEnabledLocally, isChannelsEnabled } = await import('./channelAllowlist.js')

beforeEach(() => {
  _mockSettings = {}
  _mockSub = null
  _mockTenguHarbor = false
})

afterAll(() => {
  mock.restore()
  mock.module('../../utils/settings/settings.js', () => _realSettings)
  mock.module('../../utils/auth.js', () => _realAuth)
  mock.module('../analytics/growthbook.js', () => _realGrowthbook)
})

describe('isChannelsEnabledLocally', () => {
  test('false when no settings source has channelsEnabled', () => {
    expect(isChannelsEnabledLocally()).toBe(false)
  })

  test('true when userSettings has channelsEnabled: true', () => {
    _mockSettings.userSettings = { channelsEnabled: true }
    expect(isChannelsEnabledLocally()).toBe(true)
  })

  test('true when projectSettings has channelsEnabled: true', () => {
    _mockSettings.projectSettings = { channelsEnabled: true }
    expect(isChannelsEnabledLocally()).toBe(true)
  })

  test('true when localSettings has channelsEnabled: true', () => {
    _mockSettings.localSettings = { channelsEnabled: true }
    expect(isChannelsEnabledLocally()).toBe(true)
  })

  test('false when channelsEnabled is present but false', () => {
    _mockSettings.userSettings = { channelsEnabled: false }
    expect(isChannelsEnabledLocally()).toBe(false)
  })

  test('false for team subscription even with channelsEnabled: true locally', () => {
    _mockSub = 'team'
    _mockSettings.userSettings = { channelsEnabled: true }
    expect(isChannelsEnabledLocally()).toBe(false)
  })

  test('false for enterprise subscription even with channelsEnabled: true locally', () => {
    _mockSub = 'enterprise'
    _mockSettings.userSettings = { channelsEnabled: true }
    expect(isChannelsEnabledLocally()).toBe(false)
  })
})

describe('isChannelsEnabled', () => {
  test('false when neither tengu_harbor nor local settings are on', () => {
    expect(isChannelsEnabled()).toBe(false)
  })

  test('true when tengu_harbor is on', () => {
    _mockTenguHarbor = true
    expect(isChannelsEnabled()).toBe(true)
  })

  test('true when local settings toggle is on, independent of tengu_harbor', () => {
    _mockSettings.userSettings = { channelsEnabled: true }
    expect(isChannelsEnabled()).toBe(true)
  })
})
