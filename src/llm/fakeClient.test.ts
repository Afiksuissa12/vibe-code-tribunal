import { describe, expect, it } from 'vitest'

import { JUDGE_TURN_CUE, REPRESENTATIVE_TURN_CUE, VERDICTS } from '../data'
import { parseJudgeResponse } from '../tribunal'
import { PLACEHOLDER_PREFIX, createFakeLlmClient } from './fakeClient'
import type { ChatRequest } from './client'

function representativeRequest(systemPrompt: string): ChatRequest {
  return { systemPrompt, messages: [{ role: 'user', content: REPRESENTATIVE_TURN_CUE }] }
}

function judgeRequest(systemPrompt: string): ChatRequest {
  return { systemPrompt, messages: [{ role: 'user', content: JUDGE_TURN_CUE }] }
}

describe('the deterministic fake client', () => {
  it('returns the same text for the same request every time', async () => {
    const first = await createFakeLlmClient().complete(representativeRequest('a prompt'))
    const second = await createFakeLlmClient().complete(representativeRequest('a prompt'))

    expect(first).toBe(second)
  })

  it('returns different text for different requests', async () => {
    const client = createFakeLlmClient()

    const first = await client.complete(representativeRequest('one prompt'))
    const second = await client.complete(representativeRequest('another prompt'))

    expect(first).not.toBe(second)
  })

  it('marks every reply as test infrastructure', async () => {
    const client = createFakeLlmClient()

    const statement = await client.complete(representativeRequest('a prompt'))
    const opinion = await client.complete(judgeRequest('a prompt'))

    expect(statement).toContain(PLACEHOLDER_PREFIX)
    expect(opinion).toContain(PLACEHOLDER_PREFIX)
  })

  it('answers a judge in the shape the verdict parser requires', async () => {
    const client = createFakeLlmClient()

    for (const prompt of ['barak prompt', 'elon prompt', 'shamgar prompt']) {
      const parsed = parseJudgeResponse(await client.complete(judgeRequest(prompt)))

      expect(VERDICTS).toContain(parsed.verdict)
      expect(parsed.opinion).toContain(PLACEHOLDER_PREFIX)
    }
  })

  it('has no verdict baked into it: both values occur across different prompts', async () => {
    const client = createFakeLlmClient()
    const seen = new Set<string>()

    for (let index = 0; index < 40; index += 1) {
      seen.add(parseJudgeResponse(await client.complete(judgeRequest(`prompt ${index}`))).verdict)
    }

    // Which verdict a given prompt yields is a hash bucket, not a judgement —
    // but the client must be capable of returning either, or a run against it
    // would silently only ever prove one outcome.
    expect([...seen].sort()).toEqual([...VERDICTS].sort())
  })

  it('does not put a verdict line in a representative reply', async () => {
    const statement = await createFakeLlmClient().complete(representativeRequest('a prompt'))

    expect(() => parseJudgeResponse(statement)).toThrow()
  })

  it('records every request it receives, in order', async () => {
    const client = createFakeLlmClient()

    await client.complete(representativeRequest('first'))
    await client.complete(judgeRequest('second'))

    expect(client.calls.map((call) => call.systemPrompt)).toEqual(['first', 'second'])
  })

  it('lets a test take over the reply entirely', async () => {
    const client = createFakeLlmClient({
      respond: (request, callIndex) => `${callIndex}:${request.systemPrompt}`,
    })

    expect(await client.complete(representativeRequest('x'))).toBe('0:x')
    expect(await client.complete(representativeRequest('y'))).toBe('1:y')
  })
})
