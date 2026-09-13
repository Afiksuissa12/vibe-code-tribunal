/**
 * The single source of truth for The Tribunal's canonical data.
 *
 * Import everything from here: `import { CANONICAL_CASE } from './data'`.
 */

export type {
  CanonicalCase,
  CentralQuestion,
  JudgeId,
  JudgeOpinion,
  JudicialProfile,
  RepresentativeId,
  RepresentativeProfile,
  Side,
  Transcript,
  TranscriptEntry,
  TribunalResult,
  Verdict,
} from './types'
export { VERDICTS } from './types'

export {
  APP_TITLE,
  CANONICAL_CASE,
  CANONICAL_FACTS,
  CASE_NAME,
  CASE_SUMMARY,
  CENTRAL_QUESTION,
  NO_NEW_FACTS_RULE,
} from './case'

export {
  DEFENSE_REPRESENTATIVES,
  PROSECUTION_REPRESENTATIVES,
  REPRESENTATIVES,
  SIDE_IS_ROLE_ONLY_RULE,
} from './representatives'

export { INDEPENDENT_JUDGMENT_RULE, JUDICIAL_PROFILES } from './judges'

export {
  JUDGE_RESPONSE_FORMAT,
  JUDGE_TURN_CUE,
  REPRESENTATIVE_TURN_CUE,
  VERDICT_LABEL,
  buildJudgePrompt,
  buildRepresentativePrompt,
  formatTranscript,
} from './prompts'
