import { describe, expect, test, mock } from 'bun:test'
import { getTheme } from './theme.js'

mock.module('./settings/settings.js', () => ({
  getInitialSettings: () => ({
    themeOverrides: {
      claude: 'rgb(255, 0, 0)',
      promptBorder: 'rgb(0, 255, 0)',
    },
  }),
}))

describe('Theme overrides', () => {
  test('applies theme overrides to resolved theme properties', () => {
    const theme = getTheme('dark')
    expect(theme.claude).toBe('rgb(255, 0, 0)')
    expect(theme.promptBorder).toBe('rgb(0, 255, 0)')
    // Inherits standard settings for other keys
    expect(theme.background).toBe('rgb(0,204,204)')
  })
})

describe('Curated Themes resolution', () => {
  const curatedThemes = [
    'dracula',
    'nord',
    'monokai',
    'solarized-dark',
    'solarized-light',
    'gruvbox',
    'synthwave84',
    'cyberpunk',
  ] as const

  for (const name of curatedThemes) {
    test(`resolves curated theme: ${name}`, () => {
      const theme = getTheme(name)
      expect(theme).toBeDefined()
      expect(theme.claude).toContain('rgb(')
      expect(theme.success).toContain('rgb(')
      expect(theme.error).toContain('rgb(')
    })
  }
})
