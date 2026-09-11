import {
  getAgentSessionOptionCatalog,
  type CatalogModel,
  type CatalogOption
} from './agent-session-option-catalog'
import type { AgentType } from './agent-status-types'
import type { ProviderRateLimits, RateLimitState } from './rate-limit-types'
import { TUI_AGENT_CONFIG } from './tui-agent-config'
import type { TuiAgent } from './tui-agent'

export const AGENT_POOL_UNKNOWN = 'UNKNOWN' as const

type AgentPoolOption = {
  id: string
  label: string
  description?: string
  category?: string
  kind:
    | {
        type: 'select'
        choices: { value: string; label: string; description?: string }[]
        defaultValue: string
      }
    | { type: 'boolean'; defaultValue: boolean }
}

type AgentPoolCatalog = {
  origin: 'host-static'
  models: AgentPoolModel[]
}

type AgentPoolModel = {
  id: string
  label: string
  description?: string
  isDefault?: boolean
  options: AgentPoolOption[]
}

export type AgentPoolSnapshot = {
  observedAt: number
  agents: {
    id: TuiAgent
    supported: true
    detection: {
      state: 'detected' | 'not_detected'
      source: 'host-path'
      observedAt: number
    }
    authentication: { state: typeof AGENT_POOL_UNKNOWN; source: 'not-probed' }
    modelAccess: { state: typeof AGENT_POOL_UNKNOWN; source: 'not-probed' }
    catalog: AgentPoolCatalog | null
    workerLaunchPreferences: boolean
  }[]
}

type AgentPoolRateLimitProvider = Omit<ProviderRateLimits, 'error' | 'usageMetadata'>

type AgentPoolRateLimitProviderName =
  | 'claude'
  | 'codex'
  | 'gemini'
  | 'opencodeGo'
  | 'kimi'
  | 'antigravity'
  | 'minimax'
  | 'grok'

export type AgentPoolRateLimits = Record<
  AgentPoolRateLimitProviderName,
  AgentPoolRateLimitProvider | null
>

function projectOption(option: CatalogOption): AgentPoolOption {
  return {
    id: option.id,
    label: option.label,
    ...(option.description ? { description: option.description } : {}),
    ...(option.category ? { category: option.category } : {}),
    kind:
      option.kind.type === 'select'
        ? {
            type: 'select',
            choices: option.kind.choices.map((choice) => ({
              value: choice.value,
              label: choice.label,
              ...(choice.description ? { description: choice.description } : {})
            })),
            defaultValue: option.kind.defaultValue
          }
        : { type: 'boolean', defaultValue: option.kind.defaultValue }
  }
}

function projectModel(model: CatalogModel): AgentPoolModel {
  return {
    id: model.id,
    label: model.label,
    ...(model.description ? { description: model.description } : {}),
    ...(model.isDefault ? { isDefault: true } : {}),
    options: model.options.map(projectOption)
  }
}

function projectRateLimit(provider: ProviderRateLimits | null): AgentPoolRateLimitProvider | null {
  if (!provider) {
    return null
  }
  return {
    provider: provider.provider,
    session: provider.session,
    weekly: provider.weekly,
    ...(provider.fableWeekly === undefined ? {} : { fableWeekly: provider.fableWeekly }),
    ...(provider.monthly === undefined ? {} : { monthly: provider.monthly }),
    ...(provider.buckets === undefined ? {} : { buckets: provider.buckets }),
    rateLimitResetCredits: provider.rateLimitResetCredits,
    ...(provider.planType === undefined ? {} : { planType: provider.planType }),
    updatedAt: provider.updatedAt,
    status: provider.status
  }
}

/** Excludes credential-adjacent metadata, account identities, and provider error text. */
export function createAgentPoolRateLimits(rateLimits: RateLimitState): AgentPoolRateLimits {
  return {
    claude: projectRateLimit(rateLimits.claude),
    codex: projectRateLimit(rateLimits.codex),
    gemini: projectRateLimit(rateLimits.gemini),
    opencodeGo: projectRateLimit(rateLimits.opencodeGo),
    kimi: projectRateLimit(rateLimits.kimi),
    antigravity: projectRateLimit(rateLimits.antigravity),
    minimax: projectRateLimit(rateLimits.minimax),
    grok: projectRateLimit(rateLimits.grok)
  }
}

/** Projects only static launch metadata; it never runs an agent CLI or model discovery command. */
export function createAgentPoolSnapshot(
  detectedAgentIds: readonly string[],
  observedAt = Date.now()
): AgentPoolSnapshot {
  const detected = new Set(detectedAgentIds)
  return {
    observedAt,
    agents: (Object.keys(TUI_AGENT_CONFIG) as TuiAgent[]).map((id) => {
      const catalog = getAgentSessionOptionCatalog(id as AgentType)
      return {
        id,
        supported: true,
        detection: {
          state: detected.has(id) ? 'detected' : 'not_detected',
          source: 'host-path',
          observedAt
        },
        authentication: { state: AGENT_POOL_UNKNOWN, source: 'not-probed' },
        modelAccess: { state: AGENT_POOL_UNKNOWN, source: 'not-probed' },
        catalog: catalog
          ? { origin: 'host-static', models: catalog.models.map(projectModel) }
          : null,
        workerLaunchPreferences: catalog?.supportsWorkerLaunchPreferences === true
      }
    })
  }
}
