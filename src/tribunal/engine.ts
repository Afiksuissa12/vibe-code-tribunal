/**
 * The Tribunal Engine: the orchestration layer, and nothing more.
 *
 * Core rule from FOUNDER_MISSION_002.md — code orchestrates, the LLM decides.
 * This module owns who speaks, in what order, what context each participant is
 * given, how replies are collected and what the result looks like. It owns no
 * argument, no factual interpretation and no verdict; every one of those comes
 * back from the client.
 *
 * It is plain sequential TypeScript on purpose. There is no framework, no
 * queue, no event bus and no state machine, because four calls followed by
 * three calls does not need one.
 */

import {
  CANONICAL_CASE,
  JUDICIAL_PROFILES,
  REPRESENTATIVES,
  buildJudgePrompt,
  buildRepresentativePrompt,
  JUDGE_TURN_CUE,
  REPRESENTATIVE_TURN_CUE,
} from '../data'
import type {
  CanonicalCase,
  JudgeId,
  JudgeOpinion,
  JudicialProfile,
  RepresentativeId,
  RepresentativeProfile,
  TranscriptEntry,
  TribunalResult,
} from '../data'
import type { LlmClient } from '../llm/client'
import { parseJudgeResponse } from './verdict'

/**
 * Speaking order for the representatives, fixed by the brief's target flow.
 *
 * It is declared here rather than inferred from the order of `REPRESENTATIVES`
 * because the order is an orchestration decision the engine is responsible
 * for: reordering the data module must not silently reorder the tribunal.
 */
export const SPEAKING_ORDER: readonly RepresentativeId[] = [
  'jon-snow',
  'tyrion-lannister',
  'daenerys-targaryen',
  'grey-worm',
]

/** Order in which the three judges are asked, for the same reason. */
export const JUDGING_ORDER: readonly JudgeId[] = ['barak', 'elon', 'shamgar']

/** Thrown when a run cannot be completed honestly and must be abandoned. */
export class TribunalRunError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'TribunalRunError'
  }
}

export interface RunTribunalOptions {
  /** Overridable so tests can run the engine against a fixture case. */
  readonly caseData?: CanonicalCase
}

function resolveRepresentative(id: RepresentativeId): RepresentativeProfile {
  const profile = REPRESENTATIVES.find((representative) => representative.id === id)

  if (!profile) {
    throw new TribunalRunError(`No representative profile is defined for "${id}".`)
  }

  return profile
}

function resolveJudge(id: JudgeId): JudicialProfile {
  const profile = JUDICIAL_PROFILES.find((judge) => judge.id === id)

  if (!profile) {
    throw new TribunalRunError(`No judicial profile is defined for "${id}".`)
  }

  return profile
}

/**
 * Sends one request and insists on usable text.
 *
 * A blank reply is treated as a failure rather than as an empty statement: an
 * empty transcript entry would read on screen as "this participant had nothing
 * to say", which is a claim the application is not entitled to make.
 */
async function requestText(
  llmClient: LlmClient,
  systemPrompt: string,
  cue: string,
  speaker: string,
): Promise<string> {
  let raw: string

  try {
    raw = await llmClient.complete({
      systemPrompt,
      messages: [{ role: 'user', content: cue }],
    })
  } catch (cause) {
    throw new TribunalRunError(
      `The tribunal stopped: ${speaker} could not be reached. ${describeCause(cause)}`,
      { cause },
    )
  }

  const text = raw.trim()

  if (text === '') {
    throw new TribunalRunError(`The tribunal stopped: ${speaker} returned an empty response.`)
  }

  return text
}

function describeCause(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause)
}

/**
 * Runs one complete tribunal.
 *
 * 1. Starts from an empty transcript.
 * 2. Runs the four representatives in `SPEAKING_ORDER`, each given its own
 *    profile, the canonical facts and the transcript accumulated so far.
 * 3. Appends every reply before the next representative is built, so each
 *    later speaker genuinely sees the earlier ones.
 * 4. Runs the three judges in `JUDGING_ORDER` against the completed
 *    transcript, independently: no judge is shown another judge's opinion.
 * 5. Returns the transcript and the three opinions, un-aggregated.
 *
 * @throws {TribunalRunError} if a participant cannot be reached or says
 * nothing.
 * @throws {InvalidVerdictError} if a judge's verdict cannot be read. Both
 * propagate: a partial run is reported as a failure, never as a result.
 */
export async function runTribunal(
  llmClient: LlmClient,
  options: RunTribunalOptions = {},
): Promise<TribunalResult> {
  const caseData = options.caseData ?? CANONICAL_CASE
  const transcript: TranscriptEntry[] = []

  for (const id of SPEAKING_ORDER) {
    const profile = resolveRepresentative(id)
    // Built inside the loop so it captures the transcript as it stands now.
    const systemPrompt = buildRepresentativePrompt(profile, transcript, caseData)
    const text = await requestText(
      llmClient,
      systemPrompt,
      REPRESENTATIVE_TURN_CUE,
      profile.displayName,
    )

    transcript.push({
      speakerId: profile.id,
      speakerName: profile.displayName,
      side: profile.side,
      text,
    })
  }

  // Frozen before the judges run: all three reason over the identical, final
  // record, and nothing downstream can append to it.
  const completedTranscript: readonly TranscriptEntry[] = Object.freeze([...transcript])
  const judicialOpinions: JudgeOpinion[] = []

  for (const id of JUDGING_ORDER) {
    const profile = resolveJudge(id)
    const systemPrompt = buildJudgePrompt(profile, completedTranscript, caseData)
    const raw = await requestText(llmClient, systemPrompt, JUDGE_TURN_CUE, profile.displayName)
    const { verdict, opinion } = parseJudgeResponse(raw)

    judicialOpinions.push({
      judgeId: profile.id,
      judgeName: profile.displayName,
      verdict,
      opinion,
    })
  }

  // No combined or majority verdict, by design — see `TribunalResult`.
  return { transcript: completedTranscript, judicialOpinions }
}
