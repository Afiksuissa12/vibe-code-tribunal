/**
 * A deterministic, offline `LlmClient` for tests and local dev verification.
 *
 * TEST INFRASTRUCTURE — NOT PRODUCT TRUTH. Everything this client returns is
 * mechanically generated filler whose only job is to be distinguishable and
 * reproducible so the engine's orchestration can be observed. It is not an
 * argument, not reasoning, and its verdicts are not a finding about the case.
 * FOUNDER_MISSION_002.md forbids presenting this content as a real tribunal
 * outcome anywhere outside tests and dev verification, which is why every
 * string it emits is prefixed with `PLACEHOLDER_PREFIX`.
 *
 * There is no network call, no SDK, no API key and no environment lookup here,
 * and there must never be one: the real provider added in Mission 003 sits
 * behind this same `LlmClient` interface, in `./anthropicClient`.
 */

import { JUDGE_TURN_CUE, VERDICTS, VERDICT_LABEL } from '../data'
import type { Verdict } from '../data'
import type { ChatRequest, LlmClient } from './client'

/** Marks every line of generated filler, so it can never pass for real output. */
export const PLACEHOLDER_PREFIX = '[deterministic test client]'

/** Shown in the UI whenever this client is the one wired up. */
export const FAKE_CLIENT_DEV_NOTICE =
  'Development preview: these statements and verdicts come from a deterministic fake LLM client. They are test infrastructure, not a real tribunal outcome.'

export interface FakeLlmClientOptions {
  /**
   * Replaces the generated reply entirely. Lets a test drive a specific
   * scenario — a malformed verdict, a blank reply, a thrown error — without a
   * second stub client.
   */
  readonly respond?: (request: ChatRequest, callIndex: number) => string
}

export interface FakeLlmClient extends LlmClient {
  /** Every request received, in order. The engine's behaviour, observable. */
  readonly calls: readonly ChatRequest[]
}

/**
 * FNV-1a. Chosen only because it is short, dependency-free and stable across
 * runs; the values carry no meaning beyond "different inputs differ".
 */
function hash(input: string): number {
  let value = 0x811c9dc5

  for (let index = 0; index < input.length; index += 1) {
    value ^= input.charCodeAt(index)
    value = Math.imul(value, 0x01000193) >>> 0
  }

  return value
}

function fingerprint(input: string): string {
  return hash(input).toString(16).padStart(8, '0')
}

/** Deterministic, but not a judgement: the token is a hash bucket, nothing more. */
function arbitraryVerdict(systemPrompt: string): Verdict {
  return VERDICTS[hash(systemPrompt) % VERDICTS.length]
}

function isJudgeRequest(request: ChatRequest): boolean {
  return request.messages.some((message) => message.content === JUDGE_TURN_CUE)
}

function fakeRepresentativeReply(request: ChatRequest, callIndex: number): string {
  return [
    `${PLACEHOLDER_PREFIX} Placeholder statement ${callIndex + 1}.`,
    'This text stands in for a representative turn so the orchestration can be checked;',
    'it is not an argument about the case and takes no position on it.',
    `Context fingerprint: ${fingerprint(request.systemPrompt)}.`,
  ].join(' ')
}

function fakeJudgeReply(request: ChatRequest, callIndex: number): string {
  return [
    `${VERDICT_LABEL}: ${arbitraryVerdict(request.systemPrompt)}`,
    [
      `${PLACEHOLDER_PREFIX} Placeholder opinion ${callIndex + 1}.`,
      'The verdict above is a deterministic hash of this judge’s prompt, not a',
      'finding about the case, and this text stands in for judicial reasoning.',
      `Context fingerprint: ${fingerprint(request.systemPrompt)}.`,
    ].join(' '),
  ].join('\n')
}

/**
 * Builds a fake client.
 *
 * Identical inputs always produce identical outputs, so a run is reproducible
 * and a later representative's prompt can be checked for the exact text an
 * earlier one produced.
 */
export function createFakeLlmClient(options: FakeLlmClientOptions = {}): FakeLlmClient {
  const calls: ChatRequest[] = []

  return {
    calls,
    async complete(request: ChatRequest): Promise<string> {
      const callIndex = calls.length
      calls.push(request)

      if (options.respond) {
        return options.respond(request, callIndex)
      }

      return isJudgeRequest(request)
        ? fakeJudgeReply(request, callIndex)
        : fakeRepresentativeReply(request, callIndex)
    },
  }
}
