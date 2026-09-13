/**
 * The Anthropic proxy: the only code in this repository that ever sees the
 * provider credential.
 *
 * FOUNDER_MISSION_003.md requires that the key never reaches the browser, so
 * the browser talks to this process and this process talks to Anthropic. The
 * separation is structural rather than a matter of discipline: this file is a
 * standalone Node script under `src/server/`, it is never imported by anything
 * in the Vite module graph, and so there is no path by which the key can end
 * up in a bundle. `src/llm/secretBoundary.test.ts` stands guard over that
 * claim.
 *
 * It is deliberately plain ESM JavaScript with zero dependencies: `node:http`
 * plus the global `fetch` is the whole server. Run it with
 * `node src/server/anthropicProxy.mjs`.
 *
 * It is also a transport and nothing more. It knows nothing about
 * representatives, judges, transcripts or verdicts — `runTribunal` stays in
 * the browser and orchestrates through the same `LlmClient` seam it always
 * has. The proxy validates a request, forwards it, and returns the text.
 *
 * The pure pieces (`readConfig`, `validateCompleteRequest`, `extractText`,
 * `handleRequest`) are exported so they can be tested directly; the Node
 * plumbing around them is kept as thin as it can be.
 */

import { createServer } from 'node:http'
import { pathToFileURL } from 'node:url'

/** The single endpoint. Mirrored in `src/llm/proxyContract.ts`. */
export const PROXY_COMPLETE_PATH = '/api/llm/complete'

/**
 * Every error this proxy can return. Kept as a frozen tuple because
 * `src/llm/proxyContract.test.ts` asserts the browser-side copy is identical —
 * a `.ts` module and a `.mjs` server cannot share a value, so they are instead
 * held to each other by a test.
 */
export const PROXY_ERROR_CODES = Object.freeze([
  'invalid_request',
  'method_not_allowed',
  'not_found',
  'missing_credential',
  'provider_error',
  'provider_unreachable',
  'malformed_provider_response',
])

/** The status each code is reported with. */
const STATUS_BY_CODE = Object.freeze({
  invalid_request: 400,
  method_not_allowed: 405,
  not_found: 404,
  missing_credential: 503,
  provider_error: 502,
  provider_unreachable: 502,
  malformed_provider_response: 502,
})

/** A tribunal turn sends one cue, so 32 is already far more than any run needs. */
export const MAX_MESSAGES = 32

/** Generous next to the real prompts, which are a few thousand characters. */
export const MAX_SYSTEM_PROMPT_LENGTH = 200_000

/**
 * Hard ceiling on the request body, enforced while reading the socket. A
 * `node:http` server will otherwise buffer whatever it is sent, and the
 * validation limits above are useless if the process runs out of memory before
 * validation is reached.
 */
export const MAX_REQUEST_BODY_BYTES = 1_048_576

/**
 * Haiku 4.5 — a current small/fast model, confirmed against the `claude-api`
 * reference skill (active; alias `claude-haiku-4-5`, dated id
 * `claude-haiku-4-5-20251001`).
 *
 * Chosen because the work is bounded: seven short, tightly instructed turns per
 * run, each asking for a concise statement or a labelled verdict line. That is
 * a job for reliable instruction-following, not for maximum intelligence, and
 * the largest models would be paid for and wasted. The dated id is pinned
 * rather than the alias so a run is reproducible.
 */
export const DEFAULT_MODEL = 'claude-haiku-4-5-20251001'

/** Enough for a concise statement, or a verdict line plus its reasoning. */
export const DEFAULT_MAX_TOKENS = 1024

export const DEFAULT_BASE_URL = 'https://api.anthropic.com'

export const DEFAULT_PORT = 8787

/** The Messages API version header. Fixed by Anthropic, not configurable. */
export const ANTHROPIC_VERSION = '2023-06-01'

/**
 * The Vite dev server and the preview server, on both hostnames they answer to.
 * Nothing else is allowed by default, and `*` is never used: the proxy holds a
 * credential, so any page that can reach it can spend it.
 */
export const DEFAULT_ALLOWED_ORIGINS = Object.freeze([
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
])

/**
 * A hung provider call would otherwise hang the browser for as long as the
 * socket stays open, and the UI has no way to tell that apart from a slow
 * model. Two minutes is well past any real Haiku turn.
 */
const PROVIDER_TIMEOUT_MS = 120_000

/** How much of a provider error message is quoted back. */
const MAX_PROVIDER_EXCERPT = 200

// --- configuration -------------------------------------------------------

function readTrimmed(value) {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()

  return trimmed === '' ? null : trimmed
}

/**
 * Refuses a malformed numeric override rather than quietly substituting the
 * default: a typo in `ANTHROPIC_MAX_TOKENS` should stop the operator at
 * startup, not truncate every reply for the rest of the run.
 */
function readPositiveInteger(value, name) {
  const raw = readTrimmed(value)

  if (raw === null) {
    return null
  }

  const parsed = Number(raw)

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer, but "${raw}" was given.`)
  }

  return parsed
}

function parseOriginList(value) {
  const raw = readTrimmed(value)

  if (raw === null) {
    return []
  }

  return raw
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin !== '')
}

/**
 * Reads the proxy's configuration out of an environment object.
 *
 * The environment is passed in rather than read from `process.env` inside so
 * the function stays testable — and so the complete list of variables this
 * process reads is visible in one place:
 *
 * - `ANTHROPIC_API_KEY`     the secret. Required at request time, no default.
 * - `ANTHROPIC_MODEL`       optional model override.
 * - `ANTHROPIC_MAX_TOKENS`  optional output cap.
 * - `ANTHROPIC_BASE_URL`    optional provider origin, so a token-free run can
 *                           be made against a local stub provider.
 * - `TRIBUNAL_PROXY_PORT`   optional port.
 * - `TRIBUNAL_ALLOWED_ORIGINS` optional extra CORS origins.
 *
 * Nothing else is read. In particular `CLAUDE_CODE_OAUTH_TOKEN` is never read:
 * it belongs to the development-team runtime and is not this application's
 * credential.
 */
export function readConfig(env = {}) {
  return Object.freeze({
    apiKey: readTrimmed(env.ANTHROPIC_API_KEY),
    model: readTrimmed(env.ANTHROPIC_MODEL) ?? DEFAULT_MODEL,
    maxTokens: readPositiveInteger(env.ANTHROPIC_MAX_TOKENS, 'ANTHROPIC_MAX_TOKENS') ?? DEFAULT_MAX_TOKENS,
    // Trailing slashes are stripped so `${baseUrl}/v1/messages` is well-formed
    // whichever way the operator writes the value.
    baseUrl: (readTrimmed(env.ANTHROPIC_BASE_URL) ?? DEFAULT_BASE_URL).replace(/\/+$/, ''),
    port: readPositiveInteger(env.TRIBUNAL_PROXY_PORT, 'TRIBUNAL_PROXY_PORT') ?? DEFAULT_PORT,
    allowedOrigins: Object.freeze([
      ...new Set([...DEFAULT_ALLOWED_ORIGINS, ...parseOriginList(env.TRIBUNAL_ALLOWED_ORIGINS)]),
    ]),
  })
}

// --- request validation --------------------------------------------------

const ALLOWED_ROLES = Object.freeze(['user', 'assistant'])
const ALLOWED_BODY_KEYS = Object.freeze(['systemPrompt', 'messages'])
const ALLOWED_MESSAGE_KEYS = Object.freeze(['role', 'content'])

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function unexpectedKeys(value, allowed) {
  return Object.keys(value).filter((key) => !allowed.includes(key))
}

function invalid(message) {
  return { ok: false, message }
}

/**
 * Checks a decoded request body against the contract, exactly.
 *
 * The shape mirrors `ChatRequest` in `src/llm/client.ts`. Unknown keys are
 * rejected rather than ignored, at both levels: this endpoint stands in front
 * of a credential, so the smallest accepted surface is the right one, and an
 * unexpected field is far more likely to be a client bug than an intention.
 *
 * @returns `{ ok: true, request }` or `{ ok: false, message }`, where the
 * message names the rule that failed.
 */
export function validateCompleteRequest(value) {
  if (!isPlainObject(value)) {
    return invalid('the request body must be a JSON object.')
  }

  const extras = unexpectedKeys(value, ALLOWED_BODY_KEYS)

  if (extras.length > 0) {
    return invalid(
      `the request body may only contain ${ALLOWED_BODY_KEYS.join(' and ')}, but also had ${extras.join(', ')}.`,
    )
  }

  const { systemPrompt, messages } = value

  if (typeof systemPrompt !== 'string') {
    return invalid('systemPrompt is required and must be a string.')
  }

  if (systemPrompt.trim() === '') {
    return invalid('systemPrompt must not be empty.')
  }

  if (systemPrompt.length > MAX_SYSTEM_PROMPT_LENGTH) {
    return invalid(
      `systemPrompt must be at most ${MAX_SYSTEM_PROMPT_LENGTH} characters, but was ${systemPrompt.length}.`,
    )
  }

  if (!Array.isArray(messages)) {
    return invalid('messages is required and must be an array.')
  }

  if (messages.length === 0) {
    return invalid('messages must contain at least one message.')
  }

  if (messages.length > MAX_MESSAGES) {
    return invalid(`messages must contain at most ${MAX_MESSAGES} messages, but had ${messages.length}.`)
  }

  for (const [index, message] of messages.entries()) {
    if (!isPlainObject(message)) {
      return invalid(`messages[${index}] must be an object.`)
    }

    const messageExtras = unexpectedKeys(message, ALLOWED_MESSAGE_KEYS)

    if (messageExtras.length > 0) {
      return invalid(
        `messages[${index}] may only contain ${ALLOWED_MESSAGE_KEYS.join(' and ')}, but also had ${messageExtras.join(', ')}.`,
      )
    }

    if (!ALLOWED_ROLES.includes(message.role)) {
      return invalid(`messages[${index}].role must be one of ${ALLOWED_ROLES.join(' or ')}.`)
    }

    if (typeof message.content !== 'string' || message.content.trim() === '') {
      return invalid(`messages[${index}].content must be a non-empty string.`)
    }
  }

  return {
    ok: true,
    request: {
      systemPrompt,
      messages: messages.map((message) => ({ role: message.role, content: message.content })),
    },
  }
}

// --- provider response reading -------------------------------------------

/**
 * Concatenates the text of every `text` block, in order.
 *
 * Anything else in `content[]` is ignored rather than guessed at: this proxy
 * has no business inventing text the model did not produce, and an empty
 * result is reported as `malformed_provider_response` rather than passed on as
 * an answer.
 */
export function extractText(payload) {
  if (!isPlainObject(payload) || !Array.isArray(payload.content)) {
    return ''
  }

  return payload.content
    .filter((block) => isPlainObject(block) && block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text)
    .join('')
}

// --- responses -----------------------------------------------------------

function corsHeaders(origin, allowedOrigins) {
  // `vary` is sent whether or not the origin matched, so a shared cache can
  // never serve one origin's allowed response to another origin.
  if (typeof origin !== 'string' || !allowedOrigins.includes(origin)) {
    return { vary: 'origin' }
  }

  return { 'access-control-allow-origin': origin, vary: 'origin' }
}

/**
 * Last line of defence for the credential.
 *
 * Nothing here is expected to contain the key — it is only ever sent in a
 * request header, never echoed into a message — but an outgoing body is the
 * one place a leak would actually reach the browser, so it is checked anyway.
 */
function redactSecret(text, apiKey) {
  if (typeof apiKey !== 'string' || apiKey.length < 8) {
    return text
  }

  return text.split(apiKey).join('[redacted]')
}

function jsonResponse(status, payload, headers, apiKey) {
  return {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
    body: redactSecret(JSON.stringify(payload), apiKey),
  }
}

function failure(code, message, headers, apiKey) {
  return jsonResponse(STATUS_BY_CODE[code], { error: { code, message } }, headers, apiKey)
}

function success(text, headers, apiKey) {
  return jsonResponse(200, { text }, headers, apiKey)
}

/** Collapses whitespace and caps length, so a provider error stays one line. */
function excerpt(text) {
  const collapsed = String(text).replace(/\s+/g, ' ').trim()

  if (collapsed === '') {
    return '(no message)'
  }

  return collapsed.length > MAX_PROVIDER_EXCERPT
    ? `${collapsed.slice(0, MAX_PROVIDER_EXCERPT)}…`
    : collapsed
}

/** Pulls Anthropic's own error message out of an error body, if there is one. */
function describeProviderError(rawBody) {
  try {
    const parsed = JSON.parse(rawBody)

    if (isPlainObject(parsed) && isPlainObject(parsed.error) && typeof parsed.error.message === 'string') {
      return excerpt(parsed.error.message)
    }
  } catch {
    // Not JSON. The raw text is still the most honest thing to quote.
  }

  return excerpt(rawBody)
}

function describeCause(cause) {
  return cause instanceof Error ? cause.message : String(cause)
}

// --- the handler ---------------------------------------------------------

/**
 * The whole proxy, as one function from a decoded request to a response.
 *
 * Deliberately free of `node:http` types so it can be called directly by a
 * test; `createRequestListener` below is the only part that touches sockets.
 *
 * @param request `{ method, path, headers, body }` — `path` without its query
 * string, `headers` with lower-cased names, `body` as decoded text or `null`.
 * @param config as returned by `readConfig`.
 */
export async function handleRequest(request, config) {
  const { method, path, headers = {}, body = null } = request
  const cors = corsHeaders(headers.origin, config.allowedOrigins)
  const fail = (code, message) => failure(code, message, cors, config.apiKey)

  if (method === 'OPTIONS') {
    if (path !== PROXY_COMPLETE_PATH) {
      return fail('not_found', `Nothing is served at ${path}.`)
    }

    // No `access-control-allow-credentials`: the browser sends no cookies and
    // no auth header here, and allowing credentials would widen the endpoint
    // for no gain.
    return {
      status: 204,
      headers: cors['access-control-allow-origin']
        ? {
            ...cors,
            'access-control-allow-methods': 'POST, OPTIONS',
            'access-control-allow-headers': 'content-type',
            'access-control-max-age': '600',
          }
        : cors,
      body: '',
    }
  }

  if (path !== PROXY_COMPLETE_PATH) {
    return fail('not_found', `Nothing is served at ${path}. The only endpoint is ${PROXY_COMPLETE_PATH}.`)
  }

  if (method !== 'POST') {
    return fail('method_not_allowed', `${PROXY_COMPLETE_PATH} accepts POST, but the request used ${method}.`)
  }

  // Withholding `access-control-allow-origin` stops a page READING the reply.
  // It does not stop the request being SENT: a CORS "simple" request — POST
  // with `content-type: text/plain` — is not preflighted, and nothing here
  // inspects content-type, so such a request would reach Anthropic and spend
  // the operator's tokens on behalf of a page that is not the tribunal.
  // Refusing a present-but-disallowed Origin closes that at the server, which
  // is the only side that can. Non-browser callers — curl, the token-free
  // harness, this module's own tests — send no Origin header at all and are
  // unaffected, and a legitimate extra origin is what TRIBUNAL_ALLOWED_ORIGINS
  // is for.
  //
  // Added by mission-003-AUTO-QA as a disclosed QA fix (finding QA-12); see
  // src/mission-003/QA_REPORT.md. `invalid_request` is reused deliberately so
  // that PROXY_ERROR_CODES — and the parity `src/llm/proxyContract.test.ts`
  // asserts against it — stay exactly as they were.
  if (typeof headers.origin === 'string' && !config.allowedOrigins.includes(headers.origin)) {
    return fail(
      'invalid_request',
      `requests from the origin ${headers.origin} are not accepted by this proxy. ` +
        'If that origin is legitimate, add it to TRIBUNAL_ALLOWED_ORIGINS.',
    )
  }

  let parsedBody

  try {
    parsedBody = JSON.parse(body ?? '')
  } catch {
    return fail('invalid_request', 'the request body must be valid JSON.')
  }

  const validation = validateCompleteRequest(parsedBody)

  if (!validation.ok) {
    return fail('invalid_request', validation.message)
  }

  // Checked after validation so a client bug is reported as a client bug, but
  // before any outbound call: with no credential there is nothing to call.
  if (config.apiKey === null) {
    return fail(
      'missing_credential',
      'ANTHROPIC_API_KEY is not set in the proxy process. Start the proxy with the key in its own environment, for example: ANTHROPIC_API_KEY=... node src/server/anthropicProxy.mjs',
    )
  }

  let response

  try {
    response = await globalThis.fetch(`${config.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'x-api-key': config.apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: config.maxTokens,
        system: validation.request.systemPrompt,
        messages: validation.request.messages,
      }),
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
    })
  } catch (cause) {
    return fail(
      'provider_unreachable',
      `the language model provider could not be reached: ${excerpt(describeCause(cause))}`,
    )
  }

  let rawBody

  try {
    rawBody = await response.text()
  } catch (cause) {
    return fail(
      'provider_unreachable',
      `the provider response could not be read: ${excerpt(describeCause(cause))}`,
    )
  }

  if (!response.ok) {
    return fail(
      'provider_error',
      `the language model provider returned HTTP ${response.status}: ${describeProviderError(rawBody)}`,
    )
  }

  let payload

  try {
    payload = JSON.parse(rawBody)
  } catch {
    return fail('malformed_provider_response', 'the provider returned a success status but not valid JSON.')
  }

  const text = extractText(payload)

  // Whitespace-only counts as nothing said. The engine would reject it a
  // moment later anyway, and failing here names the real cause.
  if (text.trim() === '') {
    return fail(
      'malformed_provider_response',
      'the provider returned a success status but no usable text content.',
    )
  }

  return success(text, cors, config.apiKey)
}

// --- Node plumbing -------------------------------------------------------

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0

    req.on('data', (chunk) => {
      size += chunk.length

      if (size > MAX_REQUEST_BODY_BYTES) {
        reject(new Error(`the request body must be at most ${MAX_REQUEST_BODY_BYTES} bytes.`))
        req.destroy()
        return
      }

      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function lowerCaseHeaders(headers) {
  // `node:http` already lower-cases incoming header names; this keeps the
  // contract with `handleRequest` explicit rather than assumed.
  return Object.fromEntries(
    Object.entries(headers).map(([name, value]) => [
      name.toLowerCase(),
      Array.isArray(value) ? value.join(', ') : value,
    ]),
  )
}

/**
 * Wraps `handleRequest` as a `node:http` listener.
 *
 * Logs one line per request: method, path, status and error code. Never bodies
 * — they carry the prompts, and body logging is how secrets leak by accident —
 * and never any part of the key.
 */
export function createRequestListener(config, log = console.log) {
  return (req, res) => {
    const path = new URL(req.url ?? '/', 'http://127.0.0.1').pathname
    const method = req.method ?? 'GET'

    const send = ({ status, headers, body }) => {
      res.writeHead(status, headers)
      res.end(body)
    }

    const finish = (response) => {
      let code = ''

      try {
        code = JSON.parse(response.body || '{}').error?.code ?? ''
      } catch {
        code = ''
      }

      log(`${method} ${path} -> ${response.status}${code ? ` ${code}` : ''}`)
      send(response)
    }

    readBody(req)
      .then((body) =>
        handleRequest({ method, path, headers: lowerCaseHeaders(req.headers), body }, config),
      )
      .then(finish)
      .catch((cause) =>
        // Reaching here means the request itself could not be read; the body is
        // the only untrusted input, so this is reported as a client error.
        finish(
          failure(
            'invalid_request',
            `the request could not be read: ${excerpt(describeCause(cause))}`,
            corsHeaders(req.headers.origin, config.allowedOrigins),
            config.apiKey,
          ),
        ),
      )
  }
}

/**
 * Starts the proxy on 127.0.0.1 — loopback only, never `0.0.0.0`: this process
 * holds a credential and has no authentication of its own, so it must not be
 * reachable from the network.
 */
export function startProxy(config, log = console.log) {
  const server = createServer(createRequestListener(config, log))

  server.listen(config.port, '127.0.0.1', () => {
    log(`The Tribunal LLM proxy is listening on http://127.0.0.1:${config.port}${PROXY_COMPLETE_PATH}`)
    // A boolean, never the value, never a prefix, never a hash of it.
    log(`ANTHROPIC_API_KEY present: ${config.apiKey !== null}`)
    log(`Model: ${config.model}; provider: ${config.baseUrl}`)
  })

  return server
}

// Only starts a server when run directly, so importing this module from a test
// is free of side effects.
const invokedDirectly =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  typeof process.argv[1] === 'string' &&
  import.meta.url === pathToFileURL(process.argv[1]).href

if (invokedDirectly) {
  startProxy(readConfig(process.env))
}
