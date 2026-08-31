import { afterAll, beforeEach, describe, expect, mock, test } from 'bun:test'

const _realSettings = await import(
  `../../utils/settings/settings.js?real=${Date.now()}-${Math.random()}`
)
const _realAuth = await import(
  `../../utils/auth.js?real=${Date.now()}-${Math.random()}`
)

let _mockSettings: Record<string, { channelsEnabled?: boolean } | null> = {}
let _mockSub: string | null = null

mock.module('../../utils/settings/settings.js', () => ({
  getSettingsForSource: (source: string) => _mockSettings[source] ?? null,
}))
mock.module('../../utils/auth.js', () => ({
  getSubscriptionType: () => _mockSub,
}))

const { isChannelsEnabledLocally } = await import('./channelAllowlist.js')

beforeEach(() => {
  _mockSettings = {}
  _mockSub = null
})

afterAll(() => {
  mock.restore()
  mock.module('../../utils/settings/settings.js', () => _realSettings)
  mock.module('../../utils/auth.js', () => _realAuth)
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
