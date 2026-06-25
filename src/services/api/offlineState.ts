import { lookup } from 'dns/promises'

let isOfflineModeActive = false

export function setOfflineMode(active: boolean): void {
  isOfflineModeActive = active
}

export function isOfflineMode(): boolean {
  return isOfflineModeActive
}

/**
 * Checks internet connection by looking up a reliable public DNS address.
 */
export async function checkInternetConnection(): Promise<boolean> {
  if (isOfflineModeActive) {
    return false
  }

  if (process.env.CLAUDE_CODE_OFFLINE === '1') {
    isOfflineModeActive = true
    return false
  }

  try {
    // Probe a reliable hostname with a 2-second timeout
    const probePromise = lookup('google.com')
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), 2000),
    )
    await Promise.race([probePromise, timeoutPromise])
    isOfflineModeActive = false
    return true
  } catch {
    isOfflineModeActive = true
    return false
  }
}
