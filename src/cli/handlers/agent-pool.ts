import {
  AGENT_POOL_UNKNOWN,
  createAgentPoolRateLimits,
  type AgentPoolRateLimits,
  type AgentPoolSnapshot
} from '../../shared/agent-pool-snapshot'
import { AGENT_POOL_RUNTIME_CAPABILITY } from '../../shared/protocol-version'
import type { RateLimitState } from '../../shared/rate-limit-types'
import type { RuntimeStatus } from '../../shared/runtime-types'
import type { CommandHandler } from '../dispatch'
import { printResult } from '../format'
import { RuntimeClientError } from '../runtime-client'

type AccountsPoolSnapshot = { rateLimits: RateLimitState }

type AgentPoolResult = {
  host: {
    origin: 'status.get'
    runtimeId: string
    platform: NodeJS.Platform | typeof AGENT_POOL_UNKNOWN
    appVersion: string
  }
  observedAt: number
  agents: AgentPoolSnapshot['agents']
  rateLimits: {
    origin: 'accounts.list-cache'
    observedAt: number
    providers: AgentPoolRateLimits
  }
}

function formatAgentPool(result: AgentPoolResult): string {
  const detected = result.agents.filter((agent) => agent.detection.state === 'detected')
  return [
    `Runtime: ${result.host.runtimeId}`,
    `Platform: ${result.host.platform}`,
    `Detected agents: ${detected.map((agent) => agent.id).join(', ') || 'none'}`,
    'Authentication and model access are not probed.'
  ].join('\n')
}

/** CLI handler for a host-owned, read-only agent capability snapshot. */
export const AGENT_POOL_HANDLERS: Record<string, CommandHandler> = {
  'agent pool': async ({ client, json }) => {
    const status = await client.call<RuntimeStatus>('status.get')
    if (!status.result.capabilities?.includes(AGENT_POOL_RUNTIME_CAPABILITY)) {
      throw new RuntimeClientError(
        'incompatible_runtime',
        'UNVERIFIABLE: the selected Orca runtime does not support `agent pool`. Update or restart that runtime and try again.'
      )
    }

    const [agentPool, accounts] = await Promise.all([
      client.call<AgentPoolSnapshot>('preflight.getAgentPool'),
      client.call<AccountsPoolSnapshot>('accounts.list', { refreshUsage: false })
    ])
    const observedAt = Date.now()
    const result: AgentPoolResult = {
      host: {
        origin: 'status.get',
        runtimeId: status.result.runtimeId,
        platform: status.result.hostPlatform ?? AGENT_POOL_UNKNOWN,
        appVersion: status.result.appVersion ?? AGENT_POOL_UNKNOWN
      },
      observedAt,
      agents: agentPool.result.agents,
      rateLimits: {
        origin: 'accounts.list-cache',
        observedAt,
        providers: createAgentPoolRateLimits(accounts.result.rateLimits)
      }
    }
    printResult({ ...agentPool, result }, json, formatAgentPool)
  }
}
