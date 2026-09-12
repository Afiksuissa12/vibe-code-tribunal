/**
 * Types for The Tribunal's canonical data.
 *
 * Nothing here encodes a factual conclusion, an argument or an outcome.
 * Code orchestrates; the LLM decides.
 */

/** The only two verdicts a judge may return in V1. */
export type Verdict = 'JUSTIFIED' | 'NOT JUSTIFIED'

/** Runtime list of the allowed verdicts, in the brief's order. */
export const VERDICTS: readonly Verdict[] = ['JUSTIFIED', 'NOT JUSTIFIED']

/**
 * The procedural side a representative argues for.
 * Per the brief, the side determines ONLY the role.
 */
export type Side = 'defense' | 'prosecution'

export type RepresentativeId =
  | 'jon-snow'
  | 'tyrion-lannister'
  | 'daenerys-targaryen'
  | 'grey-worm'

export type JudgeId = 'barak' | 'elon' | 'shamgar'

/** A representative agent: who they are and how they should speak and reason. */
export interface RepresentativeProfile {
  readonly id: RepresentativeId
  readonly displayName: string
  readonly side: Side
  /** One-line descriptor for the UI. */
  readonly descriptor: string
  /** The full character profile text from the Founder brief. */
  readonly profile: string
}

/** A judicial agent: whose reasoning style the judge models. */
export interface JudicialProfile {
  readonly id: JudgeId
  readonly displayName: string
  /** One-line descriptor for the UI. */
  readonly descriptor: string
  /** The full reasoning-profile text from the Founder brief. */
  readonly profile: string
}

/** The question the tribunal exists to answer, exactly as the brief frames it. */
export interface CentralQuestion {
  readonly question: string
  readonly considerations: readonly string[]
}

/** The single source of truth for the case itself. */
export interface CanonicalCase {
  readonly title: string
  readonly caseName: string
  readonly centralQuestion: CentralQuestion
  /** Neutral restatement of the facts and question for the first screen. */
  readonly summary: string
  readonly facts: readonly string[]
}

/** One statement in the tribunal transcript. */
export interface TranscriptEntry {
  readonly speakerId: RepresentativeId
  readonly speakerName: string
  readonly side: Side
  readonly text: string
}

/** The tribunal discussion so far, oldest statement first. */
export type Transcript = readonly TranscriptEntry[]

/** A single judge's independent decision. */
export interface JudgeOpinion {
  readonly judgeId: JudgeId
  readonly verdict: Verdict
  readonly opinion: string
}
