/**
 * The boundary between free-form model text and the typed domain.
 *
 * A judge's reply is the only place where the LLM hands the application a
 * value the application must understand rather than merely display. This
 * module is deliberately the smallest thing that can do that safely: find the
 * labelled verdict line, normalize the token onto `Verdict`, and refuse
 * everything else.
 *
 * The refusal matters more than the parsing. FOUNDER_MISSION_002.md is
 * explicit that malformed output must fail clearly rather than have a verdict
 * invented for it, so there is no default, no "closest match", and no fallback
 * to the first verdict word found loose in the prose.
 */

import { VERDICTS, VERDICT_LABEL } from '../data'
import type { Verdict } from '../data'

/** Thrown when a judge reply cannot be read as exactly one valid verdict. */
export class InvalidVerdictError extends Error {
  /** The raw model output, kept so an operator can see what actually arrived. */
  readonly rawResponse: string

  constructor(reason: string, rawResponse: string) {
    super(
      [
        `Could not read a judge verdict: ${reason}`,
        `Expected a line of the form "${VERDICT_LABEL}: ${VERDICTS.join(' or ')}".`,
        `Received: ${describeForError(rawResponse)}`,
      ].join(' '),
    )
    this.name = 'InvalidVerdictError'
    this.rawResponse = rawResponse
  }
}

/** A judge reply, once it has been read as a verdict plus its reasoning. */
export interface ParsedJudgeResponse {
  readonly verdict: Verdict
  readonly opinion: string
}

const MAX_ERROR_EXCERPT = 200

/** Matches the labelled verdict line and captures whatever follows the colon. */
const VERDICT_LINE = new RegExp(`^[\\s>*_#-]*${VERDICT_LABEL}\\s*[:\\-]\\s*(.*)$`, 'im')

/**
 * Strips the decoration a model tends to wrap a token in — bold markers,
 * backticks, quotes, brackets, trailing punctuation — then folds spaces and
 * hyphens to underscores so `NOT JUSTIFIED`, `not-justified` and
 * `**NOT_JUSTIFIED.**` all land on the same canonical token.
 */
function normalizeToken(rawToken: string): string {
  return rawToken
    .trim()
    .replace(/^[\s"'`*_[({]+/, '')
    .replace(/[\s"'`*_\])}.,;:!]+$/, '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_')
}

function describeForError(rawResponse: string): string {
  const collapsed = rawResponse.replace(/\s+/g, ' ').trim()

  if (collapsed === '') {
    return '(empty response)'
  }

  return collapsed.length > MAX_ERROR_EXCERPT
    ? `"${collapsed.slice(0, MAX_ERROR_EXCERPT)}…"`
    : `"${collapsed}"`
}

/**
 * Normalizes a verdict token, or returns `null` if it is not one of the two
 * allowed values.
 *
 * The match is exact after normalization on purpose: `NOT_JUSTIFIED` contains
 * `JUSTIFIED`, so a substring test would silently read a "not justified"
 * verdict as "justified".
 */
export function normalizeVerdict(rawToken: string): Verdict | null {
  const token = normalizeToken(rawToken)

  return VERDICTS.find((verdict) => verdict === token) ?? null
}

/**
 * Reads a judge's raw reply into a verdict and its reasoning.
 *
 * @throws {InvalidVerdictError} if there is no labelled verdict line, if the
 * token is not exactly one of the two allowed verdicts, or if the reply
 * carries a verdict with no reasoning behind it.
 */
export function parseJudgeResponse(rawResponse: string): ParsedJudgeResponse {
  if (rawResponse.trim() === '') {
    throw new InvalidVerdictError('the model returned no text at all', rawResponse)
  }

  const match = VERDICT_LINE.exec(rawResponse)

  if (!match) {
    throw new InvalidVerdictError(
      `no "${VERDICT_LABEL}:" line was present`,
      rawResponse,
    )
  }

  const verdict = normalizeVerdict(match[1])

  if (verdict === null) {
    throw new InvalidVerdictError(
      `"${match[1].trim()}" is not one of the allowed verdicts`,
      rawResponse,
    )
  }

  // Everything after the verdict line is the opinion. Taking the remainder
  // rather than searching for a second label keeps the contract with the model
  // to a single line it has to get right.
  const opinion = rawResponse.slice(match.index + match[0].length).trim()

  if (opinion === '') {
    throw new InvalidVerdictError(
      'the verdict came with no reasoned opinion',
      rawResponse,
    )
  }

  return { verdict, opinion }
}
