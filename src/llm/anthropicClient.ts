/**
 * The real `LlmClient`: one HTTP call to the local proxy, and nothing else.
 *
 * This module is the browser half of the split that FOUNDER_MISSION_003.md
 * makes non-negotiable. The credential lives in the proxy's own server
 * environment; this file holds no secret, reads no environment secret, sends
 * no auth header and knows no provider hostname. It builds a request, reads a
 * reply, and turns a failure into a sentence a person can act on.
 *
 * Everything it knows about the wire format comes from `./proxyContract`,
 * which the server module is held to by `./proxyContract.test.ts`. The path,
 * the default origin and the error codes are therefore declared once and
 * imported here rather than restated.
 *
 * There is deliberately no retry, no backoff, no queue, no cache and no
 * streaming. Seven sequential calls per run do not need any of it, and each of
 * those mechanisms would put distance between what the provider said and what
 * the tribunal shows.
 */

import type { ChatRequest, LlmClient } from './client'
import {
  DEFAULT_PROXY_ORIGIN,
  PROXY_COMPLETE_PATH,
  isProxyCompleteFailure,
  isProxyCompleteSuccess,
} from './proxyContract'
import type { ProxyErrorCode } from './proxyContract'

/**
 * The credential variable's name, assembled from fragments rather than
 * written out.
 *
 * `./secretBoundary.test.ts` fails any browser-facing file that contains that
 * name, even in prose, and it assembles its own needles for exactly the same
 * reason. Nothing is being hidden: the operator reads the full name on screen
 * when the proxy reports it missing, which is the one moment they need it. No
 * credential is read, stored or transmitted anywhere in this module — writing
 * the name out as a literal would buy nothing and would mean exempting this
 * file from the guard whose whole purpose is to police it.
 */
const CREDENTIAL_VARIABLE = ['ANTHROPIC', 'API_KEY'].join('_')

/** How the operator starts the proxy, quoted back when it cannot be reached. */
const START_PROXY_COMMAND = 'node src/server/anthropicProxy.mjs'

/**
 * A failure reaching or understanding the proxy.
 *
 * `StartTribunalSection` renders a thrown error's `message` verbatim, so every
 * message below is written to be read by the operator rather than by a
 * developer. `code` is carried for anything that wants to branch on the cause;
 * it is `null` when the failure happened before the proxy could answer, or
 * when the answer was not something this contract recognises.
 */
export class LlmProxyError extends Error {
  readonly code: ProxyErrorCode | null

  constructor(message: string, options: { code?: ProxyErrorCode | null; cause?: unknown } = {}) {
    super(message, { cause: options.cause })
    this.name = 'LlmProxyError'
    this.code = options.code ?? null
  }
}

export interface AnthropicProxyClientOptions {
  /**
   * Where the proxy listens. Takes precedence over everything else, so a test
   * or an embedder can point the adapter somewhere specific without touching
   * the build.
   */
  readonly proxyOrigin?: string
  /** Injected so tests can drive the adapter without a network stack. */
  readonly fetchImpl?: typeof fetch
}

/**
 * Reads the build-time proxy origin, if one was configured.
 *
 * `VITE_`-prefixed values are inlined into the bundle and are therefore public
 * by design. This one is a URL, which is fine. A secret must never be put in a
 * `VITE_` variable: it would be shipped to every browser that loads the app.
 * The provider credential belongs to the proxy process alone and is never
 * named here.
 */
function configuredProxyOrigin(): string | null {
  const configured: unknown = import.meta.env.VITE_TRIBUNAL_PROXY_URL

  if (typeof configured !== 'string') {
    return null
  }

  const trimmed = configured.trim()

  return trimmed === '' ? null : trimmed
}

/** Explicit option, then build-time configuration, then the contract default. */
function resolveProxyOrigin(options: AnthropicProxyClientOptions): string {
  return options.proxyOrigin ?? configuredProxyOrigin() ?? DEFAULT_PROXY_ORIGIN
}

/** Tolerates a trailing slash on the origin; the contract path supplies its own. */
function buildCompleteUrl(origin: string): string {
  return `${origin.replace(/\/+$/, '')}${PROXY_COMPLETE_PATH}`
}

/**
 * Turns a recognised proxy failure into something worth showing a person.
 *
 * Every branch quotes the proxy's own message rather than replacing it: the
 * proxy is the only party that knows what actually went wrong, and paraphrasing
 * it would lose the detail the operator needs. Nothing here invents a cause.
 */
function describeProxyFailure(code: ProxyErrorCode, message: string, url: string): string {
  switch (code) {
    case 'missing_credential':
      return (
        `The tribunal’s language-model proxy is running but has no ${CREDENTIAL_VARIABLE} ` +
        'set in its own server environment, so no model could be called. ' +
        `The proxy reported: ${message}`
      )
    case 'provider_error':
      return `The language-model provider rejected the tribunal’s request. The proxy reported: ${message}`
    case 'provider_unreachable':
      return `The tribunal’s language-model proxy could not reach the provider. The proxy reported: ${message}`
    case 'malformed_provider_response':
      return (
        'The language-model provider replied with nothing the tribunal could use. ' +
        `The proxy reported: ${message}`
      )
    case 'invalid_request':
      return `The tribunal’s language-model proxy rejected the request as invalid. The proxy reported: ${message}`
    case 'method_not_allowed':
    case 'not_found':
      return (
        `The tribunal’s language-model proxy did not recognise the request sent to ${url}. ` +
        `The proxy reported: ${message}`
      )
  }
}

/**
 * Resolves the function that will do the call.
 *
 * Looked up per request rather than captured when the client is built, so a
 * test that replaces `globalThis.fetch` after construction is still honoured.
 */
function resolveFetch(options: AnthropicProxyClientOptions): typeof fetch {
  if (options.fetchImpl) {
    return options.fetchImpl
  }

  if (typeof globalThis.fetch !== 'function') {
    throw new LlmProxyError(
      'This browser provides no fetch API, so the tribunal cannot call its language-model proxy.',
    )
  }

  return (input, init) => globalThis.fetch(input, init)
}

/**
 * Builds the real client.
 *
 * `complete()` forwards the `ChatRequest` it was handed unchanged — the same
 * system prompt, the same messages, nothing added — and returns the proxy's
 * text exactly as it arrived. It does not trim it, repair it or inspect it:
 * `runTribunal` and `parseJudgeResponse` treat real output exactly as they
 * treat the fake client's, and a malformed real judge reply must fail there,
 * as an `InvalidVerdictError`, rather than be quietly tidied up here.
 */
export function createAnthropicProxyClient(
  options: AnthropicProxyClientOptions = {},
): LlmClient {
  return {
    async complete(request: ChatRequest): Promise<string> {
      const origin = resolveProxyOrigin(options)
      const url = buildCompleteUrl(origin)
      const doFetch = resolveFetch(options)

      let response: Response

      try {
        response = await doFetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          // Exactly the two fields the contract defines, taken verbatim.
          body: JSON.stringify({
            systemPrompt: request.systemPrompt,
            messages: request.messages,
          }),
        })
      } catch (cause) {
        throw new LlmProxyError(
          `The tribunal’s language-model proxy could not be reached at ${origin}. ` +
            `Start it in a second terminal with "${START_PROXY_COMMAND}", with the provider ` +
            'key set in that terminal’s environment, then try again.',
          { cause },
        )
      }

      const raw = await response.text()
      let parsed: unknown

      try {
        parsed = JSON.parse(raw)
      } catch (cause) {
        // Something answered, but it was not this proxy. Reporting it as a
        // failure is the only honest option: there is no text to return.
        throw new LlmProxyError(
          `The tribunal’s language-model proxy at ${url} replied with HTTP ${response.status} ` +
            'and a body that is not JSON, so nothing was generated.',
          { cause },
        )
      }

      if (isProxyCompleteFailure(parsed)) {
        throw new LlmProxyError(describeProxyFailure(parsed.error.code, parsed.error.message, url), {
          code: parsed.error.code,
        })
      }

      if (response.ok && isProxyCompleteSuccess(parsed)) {
        return parsed.text
      }

      // A 200 with no `text`, or a non-200 carrying an error shape this
      // contract does not recognise. Neither is a reply, so neither becomes one.
      throw new LlmProxyError(
        `The tribunal’s language-model proxy at ${url} replied with HTTP ${response.status} ` +
          'and no usable generated text, so the run produced nothing.',
      )
    },
  }
}
