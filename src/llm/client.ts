/**
 * The narrow seam through which The Tribunal will one day talk to a language
 * model. Mission 001 established the shape; Mission 002 runs the whole
 * tribunal through it, against the deterministic fake in `./fakeClient`.
 *
 * NOTE FOR A LATER MISSION: a real provider-backed implementation of
 * `LlmClient` arrives in a later mission. It is deliberately absent here —
 * there is no network call, no SDK dependency, no API key and no environment
 * handling in this module. When a secret-bearing implementation is added it
 * must sit behind a server-side proxy; provider keys must never be shipped to
 * or read from the browser.
 */

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
  'No language model is connected to this build, so the tribunal cannot be run. Real provider integration arrives in a later mission.'

/**
 * Placeholder client. It ignores the request and always rejects, so a caller
 * that wires it up by mistake fails loudly instead of receiving invented
 * tribunal content.
 */
export const notImplementedLlmClient: LlmClient = {
  async complete() {
    throw new LlmNotImplementedError(LLM_NOT_IMPLEMENTED_MESSAGE)
  },
}

/** The client the application uses until a real provider is wired in. */
export function createLlmClient(): LlmClient {
  return notImplementedLlmClient
}
