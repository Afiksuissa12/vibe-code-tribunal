/**
 * The HTTP contract between the browser and the local Anthropic proxy.
 *
 * This module is the shared vocabulary of two things that cannot import each
 * other: the browser-side `LlmClient` adapter, and the standalone Node server
 * at `src/server/anthropicProxy.mjs`. Stating the contract once, as values and
 * types, keeps the two from drifting; `./proxyContract.test.ts` then checks
 * that the server really enforces what is declared here.
 *
 * It is browser-safe by construction and must stay that way: no secret, no
 * `process`, no Node import, no network call, nothing but constants and types.
 * `./secretBoundary.test.ts` enforces that.
 */

/** The proxy's single endpoint. */
export const PROXY_COMPLETE_PATH = '/api/llm/complete'

/**
 * Where the proxy listens by default. The browser adapter is expected to allow
 * this to be overridden (the proxy's own port is configurable), but this is the
 * value that works with no configuration at all.
 */
export const DEFAULT_PROXY_ORIGIN = 'http://localhost:8787'

/** Upper bound on `messages`, enforced by the proxy. */
export const MAX_MESSAGES = 32

/** Upper bound on `systemPrompt` length in characters, enforced by the proxy. */
export const MAX_SYSTEM_PROMPT_LENGTH = 200_000

/**
 * Every failure the proxy can report, and nothing else.
 *
 * - `invalid_request` (400) — the body broke one of the rules below.
 * - `method_not_allowed` (405) — the endpoint was reached with something other
 *   than POST.
 * - `not_found` (404) — some other path.
 * - `missing_credential` (503) — the proxy process was started without a
 *   provider credential in its own environment.
 * - `provider_error` (502) — Anthropic answered with a non-2xx status.
 * - `provider_unreachable` (502) — the outbound call failed outright.
 * - `malformed_provider_response` (502) — Anthropic answered 2xx with no
 *   usable text.
 *
 * There is no code for "gave up and made something up", because the proxy
 * never does.
 */
export const PROXY_ERROR_CODES = [
  'invalid_request',
  'method_not_allowed',
  'not_found',
  'missing_credential',
  'provider_error',
  'provider_unreachable',
  'malformed_provider_response',
] as const

export type ProxyErrorCode = (typeof PROXY_ERROR_CODES)[number]

export type ProxyChatRole = 'user' | 'assistant'

export interface ProxyChatMessage {
  readonly role: ProxyChatRole
  readonly content: string
}

/**
 * The request body. Mirrors `ChatRequest` in `./client` exactly, which is what
 * lets the browser adapter forward a request without reshaping it.
 *
 * The proxy validates strictly and rejects anything else: `systemPrompt` must
 * be a non-blank string of at most `MAX_SYSTEM_PROMPT_LENGTH` characters,
 * `messages` must hold between one and `MAX_MESSAGES` entries, each a
 * `{ role, content }` pair with a non-blank `content` — and no other keys at
 * either level.
 */
export interface ProxyCompleteRequest {
  readonly systemPrompt: string
  readonly messages: readonly ProxyChatMessage[]
}

/** HTTP 200. The concatenated text the model generated. */
export interface ProxyCompleteSuccess {
  readonly text: string
}

/** Any non-200. */
export interface ProxyCompleteFailure {
  readonly error: {
    readonly code: ProxyErrorCode
    readonly message: string
  }
}

export type ProxyCompleteResponse = ProxyCompleteSuccess | ProxyCompleteFailure

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isProxyErrorCode(value: unknown): value is ProxyErrorCode {
  return typeof value === 'string' && (PROXY_ERROR_CODES as readonly string[]).includes(value)
}

/**
 * Narrows a parsed response to the success shape.
 *
 * Deliberately narrow: a body has to carry an actual string to count as a
 * reply, so a `{}` or a `{ text: null }` from something that is not this proxy
 * is reported as a failure rather than rendered as an empty statement.
 */
export function isProxyCompleteSuccess(value: unknown): value is ProxyCompleteSuccess {
  return isRecord(value) && typeof value.text === 'string'
}

/** Narrows a parsed response to the failure shape, with a code we recognise. */
export function isProxyCompleteFailure(value: unknown): value is ProxyCompleteFailure {
  return (
    isRecord(value) &&
    isRecord(value.error) &&
    isProxyErrorCode(value.error.code) &&
    typeof value.error.message === 'string'
  )
}
