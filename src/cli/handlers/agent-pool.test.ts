import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AGENT_POOL_UNKNOWN, type AgentPoolSnapshot } from '../../shared/agent-pool-snapshot'
import { AGENT_POOL_RUNTIME_CAPABILITY } from '../../shared/protocol-version'
import type { RateLimitState } from '../../shared/rate-limit-types'
import type { RuntimeClient } from '../runtime-client'
import { AGENT_POOL_HANDLERS } from './agent-pool'

const callMock = vi.fn()

const rateLimits: RateLimitState = {
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
  minimaxCookieConfigured: false,
  grokAuthConfigured: false,
  claudeTarget: { runtime: 'host', wslDistro: null },
  codexTarget: { runtime: 'host', wslDistro: null },
  inactiveClaudeAccounts: [],
  inactiveCodexAccounts: []
}

function context(json = true) {
  return {
    client: { call: callMock } as unknown as RuntimeClient,
    json
  } as Parameters<(typeof AGENT_POOL_HANDLERS)['agent pool']>[0]
}

describe('agent pool CLI handler', () => {
  const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

  beforeEach(() => {
    callMock.mockReset()
    vi.spyOn(Date, 'now').mockReturnValue(777)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('uses host capabilities, host preflight, and cached accounts without a usage refresh', async () => {
    const agentPool: AgentPoolSnapshot = {
      observedAt: 123,
      agents: [
        {
          id: 'codex',
          supported: true,
          detection: { state: 'detected', source: 'host-path', observedAt: 123 },
          authentication: { state: AGENT_POOL_UNKNOWN, source: 'not-probed' },
          modelAccess: { state: AGENT_POOL_UNKNOWN, source: 'not-probed' },
          catalog: null,
          workerLaunchPreferences: false
        }
      ]
    }
    callMock
      .mockResolvedValueOnce({
        id: 'status',
        ok: true,
        result: {
          runtimeId: 'remote-runtime',
          hostPlatform: 'linux',
          capabilities: [AGENT_POOL_RUNTIME_CAPABILITY]
        },
        _meta: { runtimeId: 'remote-runtime' }
      })
      .mockResolvedValueOnce({
        id: 'pool',
        ok: true,
        result: agentPool,
        _meta: { runtimeId: 'remote-runtime' }
      })
      .mockResolvedValueOnce({
        id: 'accounts',
        ok: true,
        result: { rateLimits },
        _meta: { runtimeId: 'remote-runtime' }
      })

    await AGENT_POOL_HANDLERS['agent pool'](context())

    expect(callMock).toHaveBeenNthCalledWith(1, 'status.get')
    expect(callMock).toHaveBeenCalledWith('preflight.getAgentPool')
    expect(callMock).toHaveBeenCalledWith('accounts.list', { refreshUsage: false })
    const output = JSON.parse(String(logSpy.mock.calls.at(-1)?.[0]))
    expect(output.result).toMatchObject({
      host: { runtimeId: 'remote-runtime', platform: 'linux' },
      observedAt: 777,
      agents: [
        {
          authentication: { state: AGENT_POOL_UNKNOWN },
          modelAccess: { state: AGENT_POOL_UNKNOWN }
        }
      ],
      rateLimits: {
        origin: 'accounts.list-cache',
        observedAt: 777,
        providers: { codex: { updatedAt: 456 } }
      }
    })
    expect(JSON.stringify(output)).not.toContain('person@example.com')
    expect(JSON.stringify(output)).not.toContain('credentialSource')
  })

  it('fails closed as UNVERIFIABLE before reading any local-looking pool data', async () => {
    callMock.mockResolvedValueOnce({
      id: 'status',
      ok: true,
      result: { runtimeId: 'old-runtime', capabilities: [] },
      _meta: { runtimeId: 'old-runtime' }
    })

    await expect(AGENT_POOL_HANDLERS['agent pool'](context())).rejects.toMatchObject({
      code: 'incompatible_runtime',
      message: expect.stringContaining('UNVERIFIABLE')
    })
    expect(callMock).toHaveBeenCalledTimes(1)
  })
})
