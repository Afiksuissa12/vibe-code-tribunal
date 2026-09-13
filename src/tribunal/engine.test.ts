import { describe, expect, it } from 'vitest'

import {
  CANONICAL_FACTS,
  JUDGE_TURN_CUE,
  JUDICIAL_PROFILES,
  REPRESENTATIVES,
  REPRESENTATIVE_TURN_CUE,
  VERDICTS,
  formatTranscript,
} from '../data'
import type { TribunalResult } from '../data'
import type { ChatRequest } from '../llm/client'
import { createFakeLlmClient } from '../llm/fakeClient'
import type { FakeLlmClient } from '../llm/fakeClient'
import { InvalidVerdictError, TribunalRunError, runTribunal } from './index'

const SPEAKER_NAMES = ['Jon Snow', 'Tyrion Lannister', 'Daenerys Targaryen', 'Grey Worm']
const JUDGE_NAMES = ['Aharon Barak model', 'Menachem Elon model', 'Meir Shamgar model']

function representativeCalls(client: FakeLlmClient): readonly ChatRequest[] {
  return client.calls.filter((call) =>
    call.messages.some((message) => message.content === REPRESENTATIVE_TURN_CUE),
  )
}

function judgeCalls(client: FakeLlmClient): readonly ChatRequest[] {
  return client.calls.filter((call) =>
    call.messages.some((message) => message.content === JUDGE_TURN_CUE),
  )
}

/** The prompt a participant was sent identifies them by display name. */
function addressee(call: ChatRequest, names: readonly string[]): string | undefined {
  return names.find((name) => call.systemPrompt.includes(name))
}

async function runWithFake(): Promise<{ client: FakeLlmClient; result: TribunalResult }> {
  const client = createFakeLlmClient()
  const result = await runTribunal(client)

  return { client, result }
}

describe('the Tribunal Engine', () => {
  /** Acceptance criterion 1: representatives run in the required order. */
  it('runs the four representatives in the order the brief fixes', async () => {
    const { client } = await runWithFake()

    const spoke = representativeCalls(client).map((call) =>
      SPEAKER_NAMES.find((name) => call.systemPrompt.startsWith(`You are ${name},`)),
    )

    expect(spoke).toEqual(SPEAKER_NAMES)
  })

  /** Acceptance criterion 3: four representative messages are produced. */
  it('produces exactly four transcript entries, one per representative', async () => {
    const { client, result } = await runWithFake()

    expect(representativeCalls(client)).toHaveLength(4)
    expect(result.transcript).toHaveLength(4)
    expect(result.transcript.map((entry) => entry.speakerName)).toEqual(SPEAKER_NAMES)
    expect(result.transcript.map((entry) => entry.speakerId)).toEqual([
      'jon-snow',
      'tyrion-lannister',
      'daenerys-targaryen',
      'grey-worm',
    ])
    expect(result.transcript.map((entry) => entry.side)).toEqual([
      'defense',
      'defense',
      'prosecution',
      'prosecution',
    ])
  })

  /**
   * Acceptance criterion 2: each later representative receives the transcript
   * generated before their turn — and only that.
   */
  it('gives each representative every earlier statement and no later one', async () => {
    const { client, result } = await runWithFake()
    const calls = representativeCalls(client)
    const statements = result.transcript.map((entry) => entry.text)

    // Distinct statements, or "contains an earlier one" would prove nothing.
    expect(new Set(statements).size).toBe(statements.length)

    calls.forEach((call, turn) => {
      statements.forEach((statement, spoken) => {
        expect(call.systemPrompt.includes(statement)).toBe(spoken < turn)
      })
    })
  })

  it('opens with an empty transcript for the first speaker', async () => {
    const { client } = await runWithFake()

    expect(representativeCalls(client)[0].systemPrompt).toContain(
      'No statements have been made yet',
    )
  })

  it('gives every representative their own profile and the canonical facts', async () => {
    const { client } = await runWithFake()
    const calls = representativeCalls(client)

    calls.forEach((call, index) => {
      const profile = REPRESENTATIVES.find(
        (representative) => representative.displayName === SPEAKER_NAMES[index],
      )

      expect(profile).toBeDefined()
      expect(call.systemPrompt).toContain(profile?.profile ?? 'missing profile')
      for (const fact of CANONICAL_FACTS) {
        expect(call.systemPrompt).toContain(fact)
      }
    })
  })

  /** Acceptance criterion 4: judges run only after the transcript is complete. */
  it('asks no judge anything until all four representatives have spoken', async () => {
    const { client } = await runWithFake()

    const firstJudgeIndex = client.calls.findIndex((call) =>
      call.messages.some((message) => message.content === JUDGE_TURN_CUE),
    )

    expect(client.calls).toHaveLength(7)
    expect(firstJudgeIndex).toBe(4)
    expect(client.calls.slice(0, 4).every((call) => addressee(call, JUDGE_NAMES) === undefined))
      .toBe(true)
  })

  it('runs the three judges in the order the brief fixes', async () => {
    const { client } = await runWithFake()

    expect(judgeCalls(client).map((call) => addressee(call, JUDGE_NAMES))).toEqual(JUDGE_NAMES)
  })

  /** Acceptance criterion 5: all three judges receive the same transcript. */
  it('shows all three judges the identical completed transcript', async () => {
    const { client, result } = await runWithFake()
    const rendered = formatTranscript(result.transcript)

    for (const call of judgeCalls(client)) {
      expect(call.systemPrompt).toContain(rendered)
      for (const entry of result.transcript) {
        expect(call.systemPrompt).toContain(entry.text)
      }
    }
  })

  it('gives every judge their own reasoning profile and the canonical facts', async () => {
    const { client } = await runWithFake()
    const calls = judgeCalls(client)

    calls.forEach((call, index) => {
      expect(call.systemPrompt).toContain(JUDICIAL_PROFILES[index].profile)
      for (const fact of CANONICAL_FACTS) {
        expect(call.systemPrompt).toContain(fact)
      }
    })
  })

  /** Acceptance criterion 6: judge outputs remain separate. */
  it('keeps the three opinions separate and lets no judge see another', async () => {
    const { client, result } = await runWithFake()

    expect(result.judicialOpinions).toHaveLength(3)
    expect(result.judicialOpinions.map((opinion) => opinion.judgeId)).toEqual([
      'barak',
      'elon',
      'shamgar',
    ])
    expect(result.judicialOpinions.map((opinion) => opinion.judgeName)).toEqual(JUDGE_NAMES)

    const reasonings = result.judicialOpinions.map((opinion) => opinion.opinion)
    expect(new Set(reasonings).size).toBe(3)

    // No judge's prompt carries another judge's reasoning or verdict line.
    judgeCalls(client).forEach((call, index) => {
      reasonings.forEach((reasoning, author) => {
        if (author !== index) {
          expect(call.systemPrompt).not.toContain(reasoning)
        }
      })
    })
  })

  it('returns a verdict from the allowed set for each judge', async () => {
    const { result } = await runWithFake()

    for (const opinion of result.judicialOpinions) {
      expect(VERDICTS).toContain(opinion.verdict)
      expect(opinion.opinion.trim()).not.toHaveLength(0)
    }
  })

  /** Acceptance criterion 7: there is no combined verdict. */
  it('exposes no combined, majority or overall verdict', async () => {
    const { result } = await runWithFake()

    expect(Object.keys(result).sort()).toEqual(['judicialOpinions', 'transcript'])

    const forbidden = ['verdict', 'majority', 'combined', 'overall', 'outcome', 'finalVerdict']
    const record = result as unknown as Record<string, unknown>
    for (const key of forbidden) {
      expect(record[key]).toBeUndefined()
    }
  })

  it('hands back a transcript that cannot be appended to after the fact', async () => {
    const { result } = await runWithFake()

    expect(Object.isFrozen(result.transcript)).toBe(true)
  })

  it('is reproducible: the same fake client yields the same result twice', async () => {
    const first = await runTribunal(createFakeLlmClient())
    const second = await runTribunal(createFakeLlmClient())

    expect(first).toEqual(second)
  })
})

describe('when a run cannot be completed', () => {
  it('stops at the failing participant, names them, and returns no partial result', async () => {
    const client = createFakeLlmClient({
      respond: (_request, callIndex) => {
        if (callIndex === 2) {
          throw new Error('connection lost')
        }
        return `Placeholder statement ${callIndex}.`
      },
    })

    const run = runTribunal(client)

    await expect(run).rejects.toBeInstanceOf(TribunalRunError)
    // The third speaker is Daenerys Targaryen; the fourth is never asked.
    await expect(run).rejects.toThrow(/Daenerys Targaryen/)
    await expect(run).rejects.toThrow(/connection lost/)
    expect(client.calls).toHaveLength(3)
  })

  it('treats an empty reply as a failure rather than an empty statement', async () => {
    const run = runTribunal(createFakeLlmClient({ respond: () => '   ' }))

    await expect(run).rejects.toBeInstanceOf(TribunalRunError)
    await expect(run).rejects.toThrow(/empty response/i)
  })

  /** Acceptance criterion 9, at engine level: a bad verdict aborts the run. */
  it('aborts rather than inventing a verdict when a judge replies malformed', async () => {
    const makeClient = () =>
      createFakeLlmClient({
        respond: (request, callIndex) =>
          request.messages.some((message) => message.content === JUDGE_TURN_CUE)
            ? 'I would rather not say.'
            : `Placeholder statement ${callIndex}.`,
      })

    await expect(runTribunal(makeClient())).rejects.toThrow(InvalidVerdictError)
  })

  it('stops at the first failing judge instead of asking the rest', async () => {
    const client = createFakeLlmClient({
      respond: (request, callIndex) =>
        request.messages.some((message) => message.content === JUDGE_TURN_CUE)
          ? 'VERDICT: PERHAPS\nReasoning.'
          : `Placeholder statement ${callIndex}.`,
    })

    await expect(runTribunal(client)).rejects.toThrow(InvalidVerdictError)
    // Four representatives plus the one judge that failed — the other two are
    // never asked, because the run is already over.
    expect(client.calls).toHaveLength(5)
  })
})
