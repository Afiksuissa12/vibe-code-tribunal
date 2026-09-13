import { describe, expect, it } from 'vitest'

import {
  LLM_NOT_IMPLEMENTED_MESSAGE,
  LlmNotImplementedError,
  createLlmClient,
  notImplementedLlmClient,
} from './client'

describe('notImplementedLlmClient', () => {
  it('fails loudly instead of returning generated text', async () => {
    const result = notImplementedLlmClient.complete({
      systemPrompt: 'any system prompt',
      messages: [{ role: 'user', content: 'any message' }],
    })

    await expect(result).rejects.toBeInstanceOf(LlmNotImplementedError)
  })

  it('says plainly that no model is connected, so the cause is obvious', async () => {
    await expect(
      notImplementedLlmClient.complete({ systemPrompt: 'any system prompt', messages: [] }),
    ).rejects.toThrow(LLM_NOT_IMPLEMENTED_MESSAGE)
    expect(LLM_NOT_IMPLEMENTED_MESSAGE).toMatch(/no language model is connected/i)
  })

  it('is what the default factory hands back', async () => {
    const client = createLlmClient()

    expect(client).toBe(notImplementedLlmClient)
    await expect(
      client.complete({ systemPrompt: 'any system prompt', messages: [] }),
    ).rejects.toThrow(LlmNotImplementedError)
  })
})
