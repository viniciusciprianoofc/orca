import { GLOBAL_FLAGS, type CommandSpec } from '../args'

export const AGENT_POOL_COMMAND_SPECS: CommandSpec[] = [
  {
    path: ['agent', 'pool'],
    summary: 'Show the selected runtime host agent pool and cached quota state',
    usage: 'orca agent pool [--json]',
    allowedFlags: [...GLOBAL_FLAGS],
    notes: [
      'Reads the selected runtime host only. It does not start agent CLIs, probe authentication or model access, discover models, or refresh quota usage.',
      'Older runtimes that do not advertise this capability return an explicit UNVERIFIABLE result.'
    ],
    examples: ['orca agent pool', 'orca agent pool --environment build-host --json']
  }
]
