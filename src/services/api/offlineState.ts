import { lookup } from 'dns/promises'

let isOfflineModeActive = false

export function setOfflineMode(active: boolean): void {
  isOfflineModeActive = active
}

export function isOfflineMode(): boolean {
  return isOfflineModeActive
}

let lastCheckTimestamp = 0
const ONLINE_CACHE_TTL_MS = 30_000

/**
 * Checks internet connection by looking up a reliable public DNS address.
 * Caches positive results for 30s to avoid latency on every turn.
 */
export async function checkInternetConnection(forceCheck = false): Promise<boolean> {
  if (isOfflineModeActive) {
    return false
  }

  if (process.env.CLAUDE_CODE_OFFLINE === '1') {
    isOfflineModeActive = true
    return false
  }

  const now = Date.now()
  if (!forceCheck && now - lastCheckTimestamp < ONLINE_CACHE_TTL_MS) {
    return true
  }

  try {
    // Probe a reliable hostname with a 2-second timeout
    const probePromise = lookup('google.com')
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), 2000),
    )
    await Promise.race([probePromise, timeoutPromise])
    isOfflineModeActive = false
    lastCheckTimestamp = now
    return true
  } catch {
    isOfflineModeActive = true
    lastCheckTimestamp = now
    return false
  }
}
