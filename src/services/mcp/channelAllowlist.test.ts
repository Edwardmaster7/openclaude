import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import * as originalSettings from '../../utils/settings/settings.js'
import * as originalAuth from '../../utils/auth.js'

let _mockSettings: Record<string, { channelsEnabled?: boolean } | null> = {}
let _mockSub: string | null = null

mock.module('../../utils/settings/settings.js', () => ({
  ...originalSettings,
  getSettingsForSource: (source: string) => _mockSettings[source] ?? null,
}))
mock.module('../../utils/auth.js', () => ({
  ...originalAuth,
  getSubscriptionType: () => _mockSub,
}))

const { isChannelsEnabledLocally } = await import('./channelAllowlist.js')

beforeEach(() => {
  _mockSettings = {}
  _mockSub = null
})

afterEach(() => {
  mock.restore()
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
