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

// Cache-busting import: a sibling test file (channelNotification.test.ts)
// does `mock.module('./channelAllowlist.js', ...)` at its own top level,
// replacing this module process-wide before this file's tests run (Bun
// evaluates all test files' top-level code before running any tests, in
// the same process when the whole directory is run). Importing via a
// unique query string gets a fresh, real, unmocked instance of the module
// under test regardless of what any sibling file does to the bare
// specifier — the settings/auth/growthbook mocks above still apply
// because Bun's mock.module() intercepts by specifier at each importing
// module's own resolution, and channelAllowlist.js internally imports
// those via their own (mocked) specifiers.
const { isChannelsEnabledLocally, isChannelsEnabled } = await import(
  `./channelAllowlist.js?real=${Date.now()}-${Math.random()}`
)

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

  // Managed-policy veto: an org can be centrally managed (policySettings
  // present) without team/enterprise subscription typing — e.g. Bedrock,
  // Vertex, Foundry, or plain API-key deployments, where getSubscriptionType()
  // returns null. Org policy explicitly disabling channels must still block
  // the local bypass in that case.
  test('false when policySettings.channelsEnabled is explicitly false, even with unmanaged-looking subscription and userSettings on', () => {
    _mockSub = null
    _mockSettings.policySettings = { channelsEnabled: false }
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
