import { describe, expect, it } from 'vitest'
import {
  AGENT_POOL_UNKNOWN,
  createAgentPoolRateLimits,
  createAgentPoolSnapshot
} from './agent-pool-snapshot'
import type { ProviderRateLimits, RateLimitState } from './rate-limit-types'

describe('createAgentPoolSnapshot', () => {
  it('reports an instantaneous host detection without probing credentials or models', () => {
    const snapshot = createAgentPoolSnapshot(['codex'], 123)
    const codex = snapshot.agents.find((agent) => agent.id === 'codex')
    const claude = snapshot.agents.find((agent) => agent.id === 'claude')

    expect(snapshot.observedAt).toBe(123)
    expect(codex).toMatchObject({
      detection: { state: 'detected', source: 'host-path', observedAt: 123 },
      authentication: { state: AGENT_POOL_UNKNOWN, source: 'not-probed' },
      modelAccess: { state: AGENT_POOL_UNKNOWN, source: 'not-probed' }
    })
    expect(claude?.detection).toEqual({
      state: 'not_detected',
      source: 'host-path',
      observedAt: 123
    })
  })

  it('projects static catalogs without executable apply functions or discovery commands', () => {
    const snapshot = createAgentPoolSnapshot([], 123)
    const codex = snapshot.agents.find((agent) => agent.id === 'codex')
    const json = JSON.stringify(snapshot)

    expect(codex?.catalog?.origin).toBe('host-static')
    expect(codex?.workerLaunchPreferences).toBe(true)
    expect(json).not.toContain('"apply"')
    expect(json).not.toContain('"listModels"')
    expect(json).not.toContain('"command"')
  })

  it('keeps provider timestamps while excluding credential-adjacent quota metadata', () => {
    const rateLimits = {
      claude: null,
      codex: {
        provider: 'codex',
        session: null,
        weekly: null,
        rateLimitResetCredits: null,
        updatedAt: 456,
        error: 'token for person@example.com failed',
        status: 'error',
        usageMetadata: { credentialSource: 'keychain' }
      },
      gemini: null,
      opencodeGo: null,
      kimi: null,
      antigravity: null,
      minimax: null,
      grok: null,
      minimaxCookieConfigured: true,
      grokAuthConfigured: true,
      claudeTarget: { runtime: 'host', wslDistro: null },
      codexTarget: { runtime: 'host', wslDistro: null },
      inactiveClaudeAccounts: [],
      inactiveCodexAccounts: []
    } satisfies RateLimitState

    const quota = createAgentPoolRateLimits({
      ...rateLimits,
      codex: {
        ...rateLimits.codex,
        unexpectedFutureField: 'person@example.com'
      } as ProviderRateLimits
    })
    const json = JSON.stringify(quota)

    expect(quota.codex?.updatedAt).toBe(456)
    expect(json).not.toContain('credentialSource')
    expect(json).not.toContain('person@example.com')
    expect(json).not.toContain('CookieConfigured')
    expect(json).not.toContain('unexpectedFutureField')
  })
})
