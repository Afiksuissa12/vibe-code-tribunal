/**
 * The Tribunal Engine's public surface.
 *
 * Import from here: `import { runTribunal } from './tribunal'`.
 */

export {
  JUDGING_ORDER,
  SPEAKING_ORDER,
  TribunalRunError,
  runTribunal,
} from './engine'
export type { RunTribunalOptions } from './engine'

export { InvalidVerdictError, normalizeVerdict, parseJudgeResponse } from './verdict'
export type { ParsedJudgeResponse } from './verdict'
