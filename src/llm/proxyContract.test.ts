/**
 * Parity between the browser-safe contract and the server that implements it.
 *
 * `src/llm/proxyContract.ts` and `src/server/anthropicProxy.mjs` state the same
 * contract twice, because a TypeScript module in the browser bundle and a plain
 * Node script that holds a credential cannot share a value. This test is what
 * makes that duplication safe: it imports both and asserts they agree, so a
 * change to one that is not made to the other fails here rather than at
 * runtime, in front of the operator.
 *
 * The limits are checked by driving the proxy's own validator, not by comparing
 * its constants — what matters is the rule it actually enforces.
 */

import {
  MAX_MESSAGES as PROXY_MAX_MESSAGES,
  MAX_SYSTEM_PROMPT_LENGTH as PROXY_MAX_SYSTEM_PROMPT_LENGTH,
  PROXY_COMPLETE_PATH as SERVER_COMPLETE_PATH,
  PROXY_ERROR_CODES as SERVER_ERROR_CODES,
  DEFAULT_PORT,
  validateCompleteRequest,
} from '../server/anthropicProxy.mjs'
import type { ChatRequest } from './client'
import {
  DEFAULT_PROXY_ORIGIN,
  MAX_MESSAGES,
  MAX_SYSTEM_PROMPT_LENGTH,
  PROXY_COMPLETE_PATH,
  PROXY_ERROR_CODES,
  isProxyCompleteFailure,
  isProxyCompleteSuccess,
  isProxyErrorCode,
} from './proxyContract'
import type { ProxyCompleteRequest } from './proxyContract'

/**
 * The other half of the contract: the request body must be exactly what the
 * engine already hands to `LlmClient.complete`, so the browser adapter can
 * forward it unchanged. Checked at compile time, in both directions.
 */
type Assert<T extends true> = T
export type _ContractAcceptsChatRequest = Assert<ChatRequest extends ProxyCompleteRequest ? true : false>
export type _ChatRequestAcceptsContract = Assert<ProxyCompleteRequest extends ChatRequest ? true : false>

function requestWith(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    systemPrompt: 'You are a participant in a tribunal.',
    messages: [{ role: 'user', content: 'It is your turn.' }],
    ...overrides,
  }
}

function message(index: number) {
  return { role: 'user' as const, content: `turn ${index}` }
}

describe('proxy contract parity', () => {
  it('declares the same endpoint path as the proxy serves', () => {
    expect(PROXY_COMPLETE_PATH).toBe(SERVER_COMPLETE_PATH)
  })

  it('declares the same error codes, in the same order, as the proxy can return', () => {
    expect([...PROXY_ERROR_CODES]).toEqual([...SERVER_ERROR_CODES])
  })

  it('recognises every code the proxy can return, and nothing else', () => {
    for (const code of SERVER_ERROR_CODES) {
      expect(isProxyErrorCode(code)).toBe(true)
    }

    expect(isProxyErrorCode('teapot')).toBe(false)
  })

  it('points at the port the proxy listens on by default', () => {
    expect(DEFAULT_PROXY_ORIGIN).toBe(`http://localhost:${DEFAULT_PORT}`)
  })

  it('declares the same numeric limits the proxy holds', () => {
    expect(MAX_MESSAGES).toBe(PROXY_MAX_MESSAGES)
    expect(MAX_SYSTEM_PROMPT_LENGTH).toBe(PROXY_MAX_SYSTEM_PROMPT_LENGTH)
  })

  it('declares the message limit the proxy actually enforces', () => {
    const atLimit = Array.from({ length: MAX_MESSAGES }, (_, index) => message(index))
    const overLimit = [...atLimit, message(MAX_MESSAGES)]

    expect(validateCompleteRequest(requestWith({ messages: atLimit })).ok).toBe(true)
    expect(validateCompleteRequest(requestWith({ messages: overLimit })).ok).toBe(false)
  })

  it('declares the system prompt limit the proxy actually enforces', () => {
    const atLimit = 'x'.repeat(MAX_SYSTEM_PROMPT_LENGTH)

    expect(validateCompleteRequest(requestWith({ systemPrompt: atLimit })).ok).toBe(true)
    expect(validateCompleteRequest(requestWith({ systemPrompt: `${atLimit}x` })).ok).toBe(false)
  })

  it('describes a request shape the proxy accepts', () => {
    const request: ProxyCompleteRequest = {
      systemPrompt: 'You are a judge.',
      messages: [
        { role: 'user', content: 'Deliver your verdict.' },
        { role: 'assistant', content: 'VERDICT: JUSTIFIED' },
      ],
    }

    expect(validateCompleteRequest(request).ok).toBe(true)
  })
})

describe('response type guards', () => {
  it('accepts a success body', () => {
    expect(isProxyCompleteSuccess({ text: 'a statement' })).toBe(true)
    expect(isProxyCompleteFailure({ text: 'a statement' })).toBe(false)
  })

  it('accepts a failure body carrying a known code', () => {
    const failure = { error: { code: 'provider_error', message: 'HTTP 429' } }

    expect(isProxyCompleteFailure(failure)).toBe(true)
    expect(isProxyCompleteSuccess(failure)).toBe(false)
  })

  it('rejects a failure body carrying an unknown code', () => {
    expect(isProxyCompleteFailure({ error: { code: 'kettle_error', message: 'no' } })).toBe(false)
  })

  it('rejects bodies that are neither shape', () => {
    for (const value of [null, undefined, 'text', 42, [], {}, { text: null }, { error: {} }]) {
      expect(isProxyCompleteSuccess(value)).toBe(false)
      expect(isProxyCompleteFailure(value)).toBe(false)
    }
  })
})
