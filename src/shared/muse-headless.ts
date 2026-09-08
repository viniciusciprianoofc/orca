/**
 * Headless execution specifications and helpers for Meta Muse.
 *
 * Orca executes headless agents via the common `AgentExecHandler` (relay RPC
 * `agent.execNonInteractive`), which manages child processes, cwd, environment,
 * timeouts, and cancellation. This module defines Muse-specific CLI argument
 * structure and command recognition without creating a duplicate subprocess runner.
 */

const MUSE_HEADLESS_SUBCOMMAND = 'exec'

const REDACTED_SECRET = '[SANITIZADO]'

/**
 * Sanitizes any potential credential patterns from error messages or logs
 * so no API key or token is leaked into traces or console output.
 */
export function sanitizeLogOutput(text: string): string {
  return text
    .replace(/(?:meta_api_key|api[_-]?key|bearer\s+|token=)["']?[\w-]{16,}["']?/gi, REDACTED_SECRET)
    .replace(/EAAB[\w]+/g, REDACTED_SECRET)
}

/**
 * Builds structured argv array for headless Muse execution (`muse exec [options] [prompt]`).
 * Preserves the exact prompt as a single argv element without shell interpolation hazards.
 */
export function buildMuseExecArgs(prompt: string, extraArgs?: readonly string[]): string[] {
  const args = ['exec']
  if (extraArgs && extraArgs.length > 0) {
    args.push(...extraArgs)
  }
  args.push(prompt)
  return args
}

/**
 * Identifies whether a command line or argument list represents a headless one-shot invocation.
 */
export function isMuseHeadlessCommand(argsOrCommand: string | readonly string[]): boolean {
  if (typeof argsOrCommand !== 'string') {
    return (
      argsOrCommand[0] === MUSE_HEADLESS_SUBCOMMAND ||
      (argsOrCommand[0] === 'muse' && argsOrCommand[1] === MUSE_HEADLESS_SUBCOMMAND)
    )
  }
  const trimmed = argsOrCommand.trim()
  return (
    trimmed === 'muse exec' ||
    trimmed.startsWith('muse exec ') ||
    trimmed === MUSE_HEADLESS_SUBCOMMAND ||
    trimmed.startsWith('exec ')
  )
}

// Why: the shared one-shot table passes full argv with the binary (often an absolute
// path) at index 0, so match the subcommand slot instead of the binary name.
export function isMuseHeadlessOneShotCommand(tokens: readonly string[]): boolean {
  return tokens[1] === MUSE_HEADLESS_SUBCOMMAND
}
