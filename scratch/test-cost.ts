import { call } from '../src/commands/cost/cost.ts'
import { recordRequest } from '../src/services/api/cacheStatsTracker.ts'

// Add mock cache requests to make it heavy
for (let i = 0; i < 60; i++) {
  recordRequest({
    supported: true,
    inputTokens: 100,
    outputTokens: 100,
    cacheReadInputTokens: 0,
    cacheCreationInputTokens: 0,
    hitRate: 0,
  }, 'gemini')
}

console.log('Calling cost...')
const start = Date.now()
const res = await call('', {
  setMessages: (updater: any) => {
    console.log('setMessages called')
  }
} as any)
console.log('Result:', res)
console.log('Time:', Date.now() - start)
