import { describe, expect, it } from 'vitest'
import {
  buildMuseExecArgs,
  isMuseHeadlessCommand,
  isMuseHeadlessOneShotCommand,
  sanitizeLogOutput
} from './muse-headless'
import { isHeadlessOneShotAgentCommand } from './agent-headless-command'
import { recognizeAgentProcessFromCommandLine } from './agent-process-recognition'
import { isTuiAgent, TUI_AGENT_CONFIG } from './tui-agent-config'
import { TUI_AGENT_DISPLAY_NAMES } from './tui-agent-display-names'
import { buildAgentStartupPlan } from './tui-agent-startup'

describe('muse agent registration and separation of modes', () => {
  it('recognizes muse as a valid TuiAgent', () => {
    expect(isTuiAgent('muse')).toBe(true)
    expect(TUI_AGENT_DISPLAY_NAMES.muse).toBe('Meta Muse')
  })

  it('uses interactive binary "muse" and NEVER "muse exec" as persistent launchCmd', () => {
    const config = TUI_AGENT_CONFIG.muse
    expect(config.launchCmd).toBe('muse')
    expect(config.detectCmd).toBe('muse')
    expect(config.expectedProcess).toBe('muse')
    expect(config.promptInjectionMode).toBe('argv')
    expect(config.argvPromptSeparator).toBe('--')
    expect(config.launchCmd).not.toContain('exec')
  })

  it('builds interactive TUI startup command with prompt and -- separator', () => {
    const plan = buildAgentStartupPlan({
      agent: 'muse',
      prompt: 'Fix the bug in parser',
      cmdOverrides: {},
      platform: 'linux'
    })
    expect(plan).not.toBeNull()
    expect(plan?.launchCommand).toBe("muse -- 'Fix the bug in parser'")
    expect(plan?.expectedProcess).toBe('muse')
  })

  it('distinguishes between interactive TUI and headless one-shot commands', () => {
    expect(isMuseHeadlessCommand('muse')).toBe(false)
    expect(isMuseHeadlessCommand('muse -- "prompt"')).toBe(false)
    expect(isMuseHeadlessCommand(['muse', '--', 'prompt'])).toBe(false)

    expect(isMuseHeadlessCommand('muse exec "prompt"')).toBe(true)
    expect(isMuseHeadlessCommand('muse exec')).toBe(true)
    expect(isMuseHeadlessCommand(['muse', 'exec', 'prompt'])).toBe(true)
    expect(isMuseHeadlessCommand(['exec', 'prompt'])).toBe(true)
  })

  it('matches the shared one-shot table contract, where argv[0] is the binary path', () => {
    expect(isMuseHeadlessOneShotCommand(['muse', 'exec', 'prompt'])).toBe(true)
    expect(isMuseHeadlessOneShotCommand(['/usr/local/bin/muse', 'exec', 'prompt'])).toBe(true)
    expect(isMuseHeadlessOneShotCommand(['muse', '--', 'exec'])).toBe(false)
    expect(isMuseHeadlessOneShotCommand(['muse'])).toBe(false)

    expect(isHeadlessOneShotAgentCommand('muse', ['muse', 'exec', 'prompt'])).toBe(true)
    expect(isHeadlessOneShotAgentCommand('muse', ['muse', '--', 'prompt'])).toBe(false)
  })

  it('keeps interactive muse panes recognized while filtering headless one-shots', () => {
    expect(recognizeAgentProcessFromCommandLine('muse -- "Fix the bug"')?.agent).toBe('muse')
    expect(recognizeAgentProcessFromCommandLine('muse exec "Fix the bug"')).toBeNull()
    expect(
      recognizeAgentProcessFromCommandLine('muse exec "Fix the bug"', {
        includeHeadlessOneShot: true
      })?.agent
    ).toBe('muse')
  })
})

describe('muse headless argument builder and security', () => {
  it('builds structured argv array preserving spaces, quotes, and special characters', () => {
    const trickyPrompt = 'Fix issue #123: "unquoted" & $VAR `cmd` <stdio> \'single\''
    const argv = buildMuseExecArgs(trickyPrompt)
    expect(argv).toEqual(['exec', trickyPrompt])
  })

  it('appends extra flags before the positional prompt', () => {
    const argv = buildMuseExecArgs('run task', ['--provider', 'echo', '--yolo'])
    expect(argv).toEqual(['exec', '--provider', 'echo', '--yolo', 'run task'])
  })

  it('sanitizes credentials and tokens from logs and stderr', () => {
    const rawError =
      'Error: authentication failed for meta_api_key="EAABxyz1234567890abcdef" token=secret_token_1234567'
    const sanitized = sanitizeLogOutput(rawError)
    expect(sanitized).not.toContain('EAABxyz1234567890abcdef')
    expect(sanitized).not.toContain('secret_token_1234567')
    expect(sanitized).toContain('[SANITIZADO]')
  })
})
