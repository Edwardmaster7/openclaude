import { describe, expect, test } from 'bun:test'
import { getEmptyToolPermissionContext } from '../../Tool.js'
import { getNextPermissionMode } from './getNextPermissionMode.js'

describe('getNextPermissionMode', () => {
  test('cycles from bypassPermissions to dontAsk when dangerous modes are available', () => {
    expect(
      getNextPermissionMode({
        ...getEmptyToolPermissionContext(),
        mode: 'bypassPermissions',
        isBypassPermissionsModeAvailable: true,
      }),
    ).toBe('dontAsk')
  })

  test('cycles from dontAsk back to default without auto mode', () => {
    expect(
      getNextPermissionMode({
        ...getEmptyToolPermissionContext(),
        mode: 'dontAsk',
        isBypassPermissionsModeAvailable: true,
      }),
    ).toBe('default')
  })
})
