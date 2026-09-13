/**
 * The narrow seam through which The Tribunal talks to a language model.
 *
 * Mission 001 established the shape, Mission 002 ran the whole tribunal
 * through it against the deterministic fake in `./fakeClient`, and Mission 003
 * put a real provider behind it. There are now three implementations and the
 * engine cannot tell them apart:
 *
 * - `./anthropicClient` — the real one. It calls a local proxy over HTTP; the
 *   proxy holds the credential in its own server environment. This module and
 *   everything it reaches still contain no network call, no SDK, no key and no
 *   environment handling, and `./secretBoundary.test.ts` keeps it that way.
 * - `./fakeClient` — deterministic test infrastructure, dev preview only.
 * - `notImplementedLlmClient`, below — a stub that always fails loudly, kept
 *   for anything that needs a client which is guaranteed not to run.
 *
 * `createLlmClient()` returns the real one: that is what the application uses.
 */

import { createAnthropicProxyClient } from './anthropicClient'

export type ChatRole = 'user' | 'assistant'

export interface ChatMessage {
  readonly role: ChatRole
  readonly content: string
}

export interface ChatRequest {
  readonly systemPrompt: string
  readonly messages: readonly ChatMessage[]
}

/** One method: send a system prompt plus messages, get generated text back. */
export interface LlmClient {
  complete(request: ChatRequest): Promise<string>
}

export class LlmNotImplementedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LlmNotImplementedError'
  }
}

export const LLM_NOT_IMPLEMENTED_MESSAGE =
  'No language model is connected to this build, so the tribunal cannot be run.'

/**
 * A client that ignores the request and always rejects, so a caller that wires
 * it up by mistake fails loudly instead of receiving invented tribunal content.
 *
 * No longer what `createLlmClient()` returns — a real provider is connected —
 * but kept as the explicit way to express "deliberately not runnable".
 */
export const notImplementedLlmClient: LlmClient = {
  async complete() {
    throw new LlmNotImplementedError(LLM_NOT_IMPLEMENTED_MESSAGE)
  },
}

/**
 * The client the application uses: the real one, talking to the local proxy.
 *
 * It is built here rather than imported at every call site so that "what the
 * application talks to" is a single decision recorded in one place. It fails
 * honestly when the proxy is not running or has no credential; it never
 * invents text and never falls back to the fake.
 */
export function createLlmClient(): LlmClient {
  return createAnthropicProxyClient()
}
