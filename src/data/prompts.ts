/**
 * Prompt composition.
 *
 * These helpers assemble text only: case identity, canonical facts, the
 * requested profile and the transcript so far. They contain no arguments, no
 * stances, no conclusions and no verdicts, and they must never push any
 * participant toward a predetermined outcome.
 */

import { CANONICAL_CASE, NO_NEW_FACTS_RULE } from './case'
import { INDEPENDENT_JUDGMENT_RULE } from './judges'
import { SIDE_IS_ROLE_ONLY_RULE } from './representatives'
import type {
  CanonicalCase,
  JudicialProfile,
  RepresentativeProfile,
  Transcript,
} from './types'
import { VERDICTS } from './types'

const EMPTY_TRANSCRIPT_NOTE = '(No statements have been made yet.)'

/**
 * The label a judge must put its verdict behind. The verdict parser keys off
 * this exact word, so prompt and parser share one constant rather than two
 * copies that can drift apart.
 */
export const VERDICT_LABEL = 'VERDICT'

/**
 * The reply shape asked of every judge. Deliberately the simplest thing that
 * can be parsed without a schema library: one labelled line, then prose.
 */
export const JUDGE_RESPONSE_FORMAT = [
  'REPLY FORMAT (exactly this shape, nothing before it)',
  `${VERDICT_LABEL}: <${VERDICTS.join(' or ')}>`,
  '<your concise reasoned opinion, in plain prose>',
].join('\n')

/**
 * The turn cue sent as the single user message on a representative call.
 *
 * It is procedural only — it says that it is their turn, never what to say.
 */
export const REPRESENTATIVE_TURN_CUE =
  'It is your turn to address the tribunal. Give one concise statement now.'

/** The turn cue sent as the single user message on a judge call. */
export const JUDGE_TURN_CUE =
  'The representatives have finished. Deliver your verdict and opinion now, in the reply format above.'

function formatCase(caseData: CanonicalCase): string {
  const facts = caseData.facts.map((fact) => `- ${fact}`).join('\n')
  const considerations = caseData.centralQuestion.considerations
    .map((consideration) => `- ${consideration}`)
    .join('\n')

  return [
    `CASE: ${caseData.caseName} (${caseData.title})`,
    '',
    'CENTRAL QUESTION',
    caseData.centralQuestion.question,
    'Considering:',
    considerations,
    '',
    'CANONICAL CASE FACTS (fixed — the single source of truth)',
    facts,
    '',
    NO_NEW_FACTS_RULE,
  ].join('\n')
}

/** Renders the discussion so far; an empty transcript is explicitly marked. */
export function formatTranscript(transcript: Transcript): string {
  if (transcript.length === 0) {
    return EMPTY_TRANSCRIPT_NOTE
  }

  return transcript
    .map((entry) => `${entry.speakerName} (${entry.side}): ${entry.text}`)
    .join('\n\n')
}

/** System prompt for one representative: profile + canonical facts + transcript. */
export function buildRepresentativePrompt(
  profile: RepresentativeProfile,
  transcript: Transcript,
  caseData: CanonicalCase = CANONICAL_CASE,
): string {
  return [
    `You are ${profile.displayName}, speaking for your own account before ${caseData.title}.`,
    `You appear on the ${profile.side} side.`,
    SIDE_IS_ROLE_ONLY_RULE,
    '',
    'YOUR PROFILE',
    profile.profile,
    '',
    formatCase(caseData),
    '',
    'TRIBUNAL DISCUSSION SO FAR',
    formatTranscript(transcript),
    '',
    'YOUR TURN',
    'Speak in your own voice and stay within the canonical facts and the discussion above.',
    'Reach your own position; it is not decided for you.',
  ].join('\n')
}

/** Prompt for one judge: judicial profile + canonical facts + transcript. */
export function buildJudgePrompt(
  profile: JudicialProfile,
  transcript: Transcript,
  caseData: CanonicalCase = CANONICAL_CASE,
): string {
  return [
    `You are sitting as an independent judge of ${caseData.title}, reasoning in the ${profile.displayName}.`,
    INDEPENDENT_JUDGMENT_RULE,
    '',
    'YOUR REASONING PROFILE',
    profile.profile,
    '',
    formatCase(caseData),
    '',
    'TRIBUNAL TRANSCRIPT',
    formatTranscript(transcript),
    '',
    'YOUR DECISION',
    'Decide the central question yourself, on the canonical facts and the transcript above.',
    `State exactly one verdict — ${VERDICTS.join(' or ')} — and give a concise reasoned opinion for it.`,
    '',
    JUDGE_RESPONSE_FORMAT,
  ].join('\n')
}
