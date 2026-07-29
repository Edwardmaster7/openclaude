import * as React from 'react'
import { Box, Text, useInput } from '../ink.js'
import TextInput from '../components/TextInput.js'
import { useTerminalSize } from '../hooks/useTerminalSize.js'
import type { Command } from '../commands.js'
import type { LocalJSXCommandCall } from '../types/command.js'
import { getGlobalConfig, saveGlobalConfig } from '../utils/config.js'
import { confirmTip, fetchNextTip, validateEarnCode } from '../services/ads.js'

function statusText(): string {
  const ads = getGlobalConfig().ads
  if (!ads?.enabled) {
    return [
      'Sponsored tips: off',
      'Enable with "/ads on" to earn opengateway credits while you code.',
      'Get your code from the Earn tab at gitlawb.com/opengateway.',
    ].join('\n')
  }
  const masked = ads.earnCode ? `${ads.earnCode.slice(0, 6)}…` : '(none)'
  const balanceText = ads.lastBalanceMicro !== undefined
    ? `\nLast known balance: $${(ads.lastBalanceMicro / 1_000_000).toFixed(6)} USD`
    : ''
  return [
    `Sponsored tips: on  (earn code ${masked})${balanceText}`,
    'You earn opengateway credits when a tip is shown during loading.',
    'Dynamic tip rotation and project technology context targeting are active.',
    'Turn off any time with "/ads off".',
  ].join('\n')
}

/** Persist the code + warm one impression in the background, return a message. */
function enableWithCode(code: string): string {
  saveGlobalConfig(c => ({
    ...c,
    ads: { ...(c.ads ?? {}), enabled: true, earnCode: code },
  }))
  void warmOneEarn(code)
  return [
    "Sponsored tips enabled — you'll see them during loading and earn",
    'opengateway credits each time. Your recent prompt (with best-effort secret',
    'redaction) is shared with our ad partner to match a relevant tip.',
    'Run /ads to check or change sponsored tips.',
  ].join('\n')
}

/** Fire-and-forget first earn so a credit lands shortly after enabling. */
function warmOneEarn(code: string): Promise<void> {
  return (async () => {
    try {
      const tip = await fetchNextTip(code)
      if (!tip) return
      await new Promise(resolve => setTimeout(resolve, Math.min(tip.dwellMs, 8000)))
      await confirmTip(code, tip.token)
    } catch {
      /* ads must never break the CLI */
    }
  })()
}
/**
 * Masked paste dialog for the earn code — same UX as entering a provider API
 * key (TextInput mask="*"), so the credential never appears in plaintext.
 */
function AdsCodeDialog({
  onSubmit,
  onCancel,
  warnExposed = false,
}: {
  onSubmit: (code: string) => void
  onCancel: () => void
  warnExposed?: boolean
}): React.ReactNode {
  const [value, setValue] = React.useState('')
  const [cursorOffset, setCursorOffset] = React.useState(0)
  const [isValidating, setIsValidating] = React.useState(false)
  const [errorMsg, setErrorMsg] = React.useState('')
  const { columns } = useTerminalSize()

  useInput((_input, key) => {
    if (key.escape && !isValidating) onCancel()
  })

  return (
    <Box flexDirection="column" gap={1} paddingX={1}>
      <Text bold>Enable sponsored tips · earn opengateway credits</Text>
      {warnExposed ? (
        <Text color="warning">
          You typed a code on the command line — it&apos;s now visible in your terminal.
          Rotate it in the Earn tab and paste the new one here.
        </Text>
      ) : null}
      <Text dimColor>
        Paste your earn code (gitlawb.com/opengateway → Earn). It stays hidden as you type.
      </Text>
      <Text dimColor>
        Tips are contextual: your most recent prompt (with best-effort secret redaction)
        is shared with our ad partner to match a relevant tip. Disable any time with /ads off.
      </Text>
      {errorMsg ? <Text color="error">{errorMsg}</Text> : null}
      <Box flexDirection="row" gap={1}>
        <Text>{isValidating ? '⟳' : '›'}</Text>
        {isValidating ? (
          <Text dimColor>Validating earn code...</Text>
        ) : (
          <TextInput
            value={value}
            onChange={setValue}
            cursorOffset={cursorOffset}
            onChangeCursorOffset={setCursorOffset}
            columns={Math.max(20, columns - 8)}
            mask="*"
            placeholder="earn_…"
            onSubmit={async v => {
              const code = v.trim()
              if (!code) {
                onCancel()
                return
              }
              setIsValidating(true)
              setErrorMsg('')
              const res = await validateEarnCode(code)
              setIsValidating(false)
              if (res.valid) {
                onSubmit(code)
              } else {
                setErrorMsg(res.error ?? 'Validation failed.')
              }
            }}
          />
        )}
      </Box>
      <Text dimColor>
        {isValidating ? 'validating...' : 'enter to enable · esc to cancel'}
      </Text>
    </Box>
  )
}

/**
 * `/ads on` always opens a masked paste dialog and never accepts an inline code
 * (a code typed inline is already exposed in the terminal scrollback). `/ads off`
 * disables and clears the stored code. `/ads` shows status. Inline-code args are
 * also redacted from history via `isSensitive` below.
 */
export const call: LocalJSXCommandCall = async (onDone, _context, args) => {
  const parts = (args ?? '').trim().split(/\s+/).filter(Boolean)
  const sub = (parts[0] ?? '').toLowerCase()

  if (sub === 'off') {
    const wasOn = getGlobalConfig().ads?.enabled
    // Drop the stored earn code on opt-out — it's a credential, and keeping it at
    // rest after the user disabled earning has no benefit.
    saveGlobalConfig(c => {
      const { earnCode: _earnCode, ...restAds } = c.ads ?? {}
      return { ...c, ads: { ...restAds, enabled: false } }
    })
    onDone(wasOn ? 'Sponsored tips disabled.' : 'Sponsored tips are already off.', {
      display: 'system',
    })
    return null
  }

  if (sub === 'on') {
    // Never accept the code inline — the terminal echoes keystrokes as you type,
    // so an inline `/ads on <code>` leaks the credential into your scrollback no
    // matter what we do afterward. Always collect it through the masked dialog.
    // If a code WAS typed inline, it's already exposed → warn to rotate it.
    const typedInline = parts.length > 1
    return (
      <AdsCodeDialog
        warnExposed={typedInline}
        onSubmit={code => onDone(enableWithCode(code), { display: 'system' })}
        onCancel={() =>
          onDone('Cancelled — sponsored tips not enabled.', { display: 'system' })
        }
      />
    )
  }

  onDone(statusText(), { display: 'system' })
  return null
}

const ads = {
  type: 'local-jsx',
  name: 'ads',
  description: 'Earn opengateway credits from sponsored tips (ads.gitlawb.com)',
  argumentHint: 'on | off',
  // The earn code is a credential — redact inline `/ads on <code>` args from history.
  isSensitive: true,
  load: () => Promise.resolve({ call }),
} satisfies Command

export default ads
