import { describe, expect, it, vi } from 'vitest'

import {
  LLM_NOT_IMPLEMENTED_MESSAGE,
  LlmNotImplementedError,
  createLlmClient,
  notImplementedLlmClient,
} from './client'
import { PLACEHOLDER_PREFIX } from './fakeClient'
import { DEFAULT_PROXY_ORIGIN, PROXY_COMPLETE_PATH } from './proxyContract'

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

  it('is no longer what the default factory hands back', () => {
    // Mission 003 connected a real provider, so this stub stopped being the
    // application's client. It stays exported as the explicit way to say
    // "deliberately not runnable"; the assertion below is what changed.
    expect(createLlmClient()).not.toBe(notImplementedLlmClient)
  })
})

describe('createLlmClient', () => {
  /**
   * The factory is the single place that decides what the application talks
   * to. What matters is that it hands back the real proxy-backed client and
   * not the fake: showing deterministic placeholder text as a tribunal outcome
   * is the one thing FOUNDER_MISSION_002.md rules out.
   */
  it('hands back the real proxy-backed client, which calls the proxy over HTTP', async () => {
    const stub = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ text: 'a reply from the proxy' }),
      } as unknown as Response)

    try {
      const client = createLlmClient()
      const reply = await client.complete({
        systemPrompt: 'any system prompt',
        messages: [{ role: 'user', content: 'any message' }],
      })

      expect(reply).toBe('a reply from the proxy')
      expect(stub).toHaveBeenCalledTimes(1)
      expect(String(stub.mock.calls[0][0])).toBe(
        `${DEFAULT_PROXY_ORIGIN}${PROXY_COMPLETE_PATH}`,
      )
    } finally {
      stub.mockRestore()
    }
  })

  it('never returns the fake client’s placeholder content', async () => {
    const stub = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'))

    try {
      const result = createLlmClient().complete({
        systemPrompt: 'any system prompt',
        messages: [{ role: 'user', content: 'any message' }],
      })

      await expect(result).rejects.toThrow(/could not be reached/i)
      await expect(result).rejects.not.toThrow(PLACEHOLDER_PREFIX)
    } finally {
      stub.mockRestore()
    }
  })
})
