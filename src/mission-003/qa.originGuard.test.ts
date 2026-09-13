// @vitest-environment node

/**
 * Coverage for the QA fix to finding QA-12.
 *
 * The proxy's CORS allowlist decides which browser origins may *read* a reply.
 * It did not decide which origins may *cause a provider call*, and those are
 * not the same question: a CORS "simple" request — `POST` with
 * `content-type: text/plain` — is never preflighted, and the proxy did not
 * inspect content-type, so a page on any origin at all could reach the
 * endpoint. It could not read the answer, but the call was made and the
 * operator's tokens were spent.
 *
 * QA added an Origin check to `handleRequest` in `src/server/anthropicProxy.mjs`
 * and this file covers it. It lives here, in QA-owned space, rather than in
 * `src/server/anthropicProxy.test.mjs`, which belongs to mission-003-AUTO-PROXY.
 *
 * Every case below drives the real `handleRequest` with a stubbed outbound
 * `fetch` that fails if it is called at all, so "no provider call was
 * attempted" is enforced rather than assumed. Nothing here can spend a token.
 */

import { afterEach, beforeEach, vi } from 'vitest'
import {
  PROXY_COMPLETE_PATH,
  DEFAULT_ALLOWED_ORIGINS,
  handleRequest,
  readConfig,
} from '../server/anthropicProxy.mjs'

/** Obviously fake, and asserted absent from every response below. */
const FAKE_KEY = 'not-a-real-key-for-qa-tests'

const ALLOWED_ORIGIN = 'http://localhost:5173'
const HOSTILE_ORIGIN = 'https://evil.example.com'

let outbound: ReturnType<typeof vi.fn>

beforeEach(() => {
  outbound = vi.fn(() => {
    throw new Error('the provider must not be called: this request should have been refused')
  })
  vi.stubGlobal('fetch', outbound)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function config(env: Record<string, string> = {}) {
  return readConfig({ ANTHROPIC_API_KEY: FAKE_KEY, ...env })
}

/** The body a hostile page would send: perfectly valid, which is the point. */
function validBody() {
  return JSON.stringify({
    systemPrompt: 'You are Jon Snow, addressing the tribunal.',
    messages: [{ role: 'user', content: 'It is your turn.' }],
  })
}

function post(headers: Record<string, string>, env?: Record<string, string>) {
  return handleRequest(
    { method: 'POST', path: PROXY_COMPLETE_PATH, headers, body: validBody() },
    config(env),
  )
}

function errorOf(response: { body: string }) {
  return JSON.parse(response.body).error
}

describe('the proxy refuses to spend a token for a page it does not serve', () => {
  it('rejects a cross-origin simple request before any provider call', async () => {
    // text/plain is the giveaway: that content type makes the request "simple",
    // so the browser sends it without asking the proxy's permission first.
    const response = await post({ origin: HOSTILE_ORIGIN, 'content-type': 'text/plain' })

    expect(response.status).toBe(400)
    expect(errorOf(response).code).toBe('invalid_request')
    expect(errorOf(response).message).toContain(HOSTILE_ORIGIN)
    expect(errorOf(response).message).toContain('TRIBUNAL_ALLOWED_ORIGINS')
    expect(outbound).not.toHaveBeenCalled()
  })

  it('rejects a disallowed origin whatever the content type claims to be', async () => {
    for (const contentType of ['application/json', 'text/plain', 'multipart/form-data']) {
      const response = await post({ origin: HOSTILE_ORIGIN, 'content-type': contentType })

      expect(response.status).toBe(400)
      expect(outbound).not.toHaveBeenCalled()
    }
  })

  it('still withholds the CORS header from the refusal, so nothing is echoed', async () => {
    const response = await post({ origin: HOSTILE_ORIGIN })

    expect(response.headers['access-control-allow-origin']).toBeUndefined()
    expect(response.headers.vary).toBe('origin')
    expect(JSON.stringify(response)).not.toContain(FAKE_KEY)
  })
})

describe('and still serves everything it is supposed to', () => {
  it.each([...DEFAULT_ALLOWED_ORIGINS])('accepts the allowed origin %s', async (origin) => {
    outbound.mockImplementation(async () => ({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({ content: [{ type: 'text', text: 'a statement from the model' }] }),
    }))

    const response = await post({ origin, 'content-type': 'application/json' })

    expect(response.status).toBe(200)
    expect(JSON.parse(response.body)).toEqual({ text: 'a statement from the model' })
    expect(response.headers['access-control-allow-origin']).toBe(origin)
    expect(outbound).toHaveBeenCalledTimes(1)
  })

  it('accepts a request with no Origin header at all', async () => {
    // curl, the token-free e2e harness, and anything that is not a browser.
    // The guard must not turn the proxy into something only a browser can use.
    outbound.mockImplementation(async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ content: [{ type: 'text', text: 'a statement' }] }),
    }))

    const response = await post({ 'content-type': 'application/json' })

    expect(response.status).toBe(200)
    expect(outbound).toHaveBeenCalledTimes(1)
  })

  it('accepts an extra origin the operator has allowed', async () => {
    outbound.mockImplementation(async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ content: [{ type: 'text', text: 'a statement' }] }),
    }))

    const response = await post(
      { origin: 'http://localhost:5174' },
      { TRIBUNAL_ALLOWED_ORIGINS: 'http://localhost:5174' },
    )

    expect(response.status).toBe(200)
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5174')
  })

  it('leaves the allowed-origin path completely unchanged', async () => {
    outbound.mockImplementation(async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ content: [{ type: 'text', text: 'unchanged' }] }),
    }))

    const response = await post({ origin: ALLOWED_ORIGIN })

    expect(response.status).toBe(200)
    // The credential still went to the provider and still did not come back.
    const [, init] = outbound.mock.calls[0] as [string, { headers: Record<string, string> }]
    expect(init.headers['x-api-key']).toBe(FAKE_KEY)
    expect(JSON.stringify(response)).not.toContain(FAKE_KEY)
  })
})
