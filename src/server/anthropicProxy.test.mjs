/**
 * @vitest-environment node
 *
 * Proxy behaviour, entirely against a stubbed provider.
 *
 * No test here makes a real network call or spends a single provider token: the
 * outbound `fetch` is replaced in every case, and the default stub throws, so a
 * test that expects "no provider call was attempted" fails loudly if one is.
 * The key used throughout is a fake, and every response is checked for it.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  DEFAULT_MAX_TOKENS,
  DEFAULT_MODEL,
  MAX_MESSAGES,
  MAX_SYSTEM_PROMPT_LENGTH,
  PROXY_COMPLETE_PATH,
  ANTHROPIC_VERSION,
  createRequestListener,
  extractText,
  handleRequest,
  readConfig,
} from './anthropicProxy.mjs'
import { createServer } from 'node:http'

/** Obviously fake, and never a real credential. Asserted absent from every response. */
const FAKE_KEY = 'sk-ant-fake-key-for-tests-0123456789'

const ALLOWED_ORIGIN = 'http://localhost:5173'
const DISALLOWED_ORIGIN = 'http://evil.example.com'

/** A `fetch` the tests reach for directly, kept before the global is stubbed. */
const realFetch = globalThis.fetch.bind(globalThis)

let fetchStub

beforeEach(() => {
  fetchStub = vi.fn(() => {
    throw new Error('the provider must not be called in this case')
  })
  vi.stubGlobal('fetch', fetchStub)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function configWith(env = {}) {
  return readConfig({ ANTHROPIC_API_KEY: FAKE_KEY, ...env })
}

function providerReply(text) {
  return {
    ok: true,
    status: 200,
    text: async () =>
      JSON.stringify({
        id: 'msg_test',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text }],
      }),
  }
}

function providerFailure(status, body) {
  return { ok: false, status, text: async () => JSON.stringify(body) }
}

/**
 * Sends a request and, before returning it, asserts the fake key appears
 * nowhere in the response. Every case in this file goes through here, which is
 * what makes "the secret never leaks into a response" a property of the whole
 * suite rather than one more test.
 */
async function send(request, config = configWith()) {
  const response = await handleRequest(request, config)
  const serialized = JSON.stringify({ headers: response.headers, body: response.body })

  expect(serialized).not.toContain(FAKE_KEY)

  return response
}

function post(body, config, headers = {}) {
  return send(
    {
      method: 'POST',
      path: PROXY_COMPLETE_PATH,
      headers: { 'content-type': 'application/json', ...headers },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    },
    config,
  )
}

function validBody(overrides = {}) {
  return {
    systemPrompt: 'You are Jon Snow, addressing the tribunal.',
    messages: [{ role: 'user', content: 'It is your turn.' }],
    ...overrides,
  }
}

function errorOf(response) {
  return JSON.parse(response.body).error
}

describe('request validation', () => {
  const cases = [
    ['a missing systemPrompt', { messages: [{ role: 'user', content: 'hi' }] }],
    ['a blank systemPrompt', validBody({ systemPrompt: '   \n ' })],
    ['a non-string systemPrompt', validBody({ systemPrompt: 42 })],
    ['an oversized systemPrompt', validBody({ systemPrompt: 'x'.repeat(MAX_SYSTEM_PROMPT_LENGTH + 1) })],
    ['missing messages', { systemPrompt: 'You are a judge.' }],
    ['an empty messages array', validBody({ messages: [] })],
    [
      'more than the maximum number of messages',
      validBody({
        messages: Array.from({ length: MAX_MESSAGES + 1 }, (_, index) => ({
          role: 'user',
          content: `turn ${index}`,
        })),
      }),
    ],
    ['a bad role', validBody({ messages: [{ role: 'system', content: 'hi' }] })],
    ['a blank content', validBody({ messages: [{ role: 'user', content: '  ' }] })],
    ['a non-string content', validBody({ messages: [{ role: 'user', content: null }] })],
    ['extra top-level keys', validBody({ model: 'claude-opus-5' })],
    ['extra message keys', validBody({ messages: [{ role: 'user', content: 'hi', name: 'jon' }] })],
    ['a JSON array body', []],
    ['a JSON null body', null],
  ]

  for (const [description, body] of cases) {
    it(`rejects ${description} without calling the provider`, async () => {
      const response = await post(body)

      expect(response.status).toBe(400)
      expect(errorOf(response).code).toBe('invalid_request')
      expect(errorOf(response).message).not.toBe('')
      expect(fetchStub).not.toHaveBeenCalled()
    })
  }

  it('rejects a body that is not JSON at all', async () => {
    const response = await post('not json {')

    expect(response.status).toBe(400)
    expect(errorOf(response).code).toBe('invalid_request')
    expect(errorOf(response).message).toContain('valid JSON')
    expect(fetchStub).not.toHaveBeenCalled()
  })

  it('names the rule that failed', async () => {
    const response = await post(validBody({ messages: [] }))

    expect(errorOf(response).message).toContain('messages')
  })

  it('accepts a request that sits exactly on the limits', async () => {
    fetchStub.mockResolvedValue(providerReply('accepted'))

    const response = await post(
      validBody({
        systemPrompt: 'x'.repeat(MAX_SYSTEM_PROMPT_LENGTH),
        messages: Array.from({ length: MAX_MESSAGES }, (_, index) => ({
          role: index % 2 === 0 ? 'user' : 'assistant',
          content: `turn ${index}`,
        })),
      }),
    )

    expect(response.status).toBe(200)
  })
})

describe('method and path', () => {
  it('rejects a GET on the endpoint', async () => {
    const response = await send({ method: 'GET', path: PROXY_COMPLETE_PATH })

    expect(response.status).toBe(405)
    expect(errorOf(response).code).toBe('method_not_allowed')
    expect(fetchStub).not.toHaveBeenCalled()
  })

  it('rejects a POST to any other path', async () => {
    const response = await send({
      method: 'POST',
      path: '/nope',
      body: JSON.stringify(validBody()),
    })

    expect(response.status).toBe(404)
    expect(errorOf(response).code).toBe('not_found')
    expect(fetchStub).not.toHaveBeenCalled()
  })
})

describe('missing credential', () => {
  it('refuses honestly, and does not call the provider', async () => {
    const response = await post(validBody(), readConfig({}))

    expect(response.status).toBe(503)
    expect(errorOf(response).code).toBe('missing_credential')
    expect(errorOf(response).message).toContain('ANTHROPIC_API_KEY')
    expect(errorOf(response).message).toContain('node src/server/anthropicProxy.mjs')
    expect(fetchStub).not.toHaveBeenCalled()
  })

  it('treats a blank key as no key', async () => {
    const response = await post(validBody(), readConfig({ ANTHROPIC_API_KEY: '   ' }))

    expect(response.status).toBe(503)
    expect(errorOf(response).code).toBe('missing_credential')
    expect(fetchStub).not.toHaveBeenCalled()
  })
})

describe('happy path', () => {
  it('sends exactly the documented call and returns the concatenated text', async () => {
    fetchStub.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          content: [
            { type: 'text', text: 'I did what I judged right. ' },
            { type: 'thinking', thinking: 'ignored' },
            { type: 'text', text: 'That is my statement.' },
          ],
        }),
    })

    const response = await post(validBody())

    expect(response.status).toBe(200)
    expect(JSON.parse(response.body)).toEqual({
      text: 'I did what I judged right. That is my statement.',
    })

    expect(fetchStub).toHaveBeenCalledTimes(1)

    const [url, init] = fetchStub.mock.calls[0]

    expect(url).toBe('https://api.anthropic.com/v1/messages')
    expect(init.method).toBe('POST')
    expect(init.headers).toEqual({
      'x-api-key': FAKE_KEY,
      'anthropic-version': ANTHROPIC_VERSION,
      'content-type': 'application/json',
    })
    expect(JSON.parse(init.body)).toEqual({
      model: DEFAULT_MODEL,
      max_tokens: DEFAULT_MAX_TOKENS,
      system: 'You are Jon Snow, addressing the tribunal.',
      messages: [{ role: 'user', content: 'It is your turn.' }],
    })
  })

  it('forwards the full conversation in order', async () => {
    fetchStub.mockResolvedValue(providerReply('VERDICT: JUSTIFIED\nBecause.'))

    await post(
      validBody({
        messages: [
          { role: 'user', content: 'first' },
          { role: 'assistant', content: 'second' },
          { role: 'user', content: 'third' },
        ],
      }),
    )

    expect(JSON.parse(fetchStub.mock.calls[0][1].body).messages).toEqual([
      { role: 'user', content: 'first' },
      { role: 'assistant', content: 'second' },
      { role: 'user', content: 'third' },
    ])
  })
})

describe('provider errors', () => {
  for (const status of [401, 429, 500]) {
    it(`reports HTTP ${status} as provider_error without fabricating text`, async () => {
      fetchStub.mockResolvedValue(
        providerFailure(status, {
          type: 'error',
          error: { type: 'invalid_request_error', message: `provider said ${status}` },
        }),
      )

      const response = await post(validBody())

      expect(response.status).toBe(502)
      expect(errorOf(response).code).toBe('provider_error')
      expect(errorOf(response).message).toContain(String(status))
      expect(errorOf(response).message).toContain(`provider said ${status}`)
      expect(JSON.parse(response.body).text).toBeUndefined()
    })
  }

  it('quotes a non-JSON provider error body, capped in length', async () => {
    fetchStub.mockResolvedValue({ ok: false, status: 503, text: async () => 'x'.repeat(5000) })

    const response = await post(validBody())

    expect(errorOf(response).code).toBe('provider_error')
    expect(errorOf(response).message).toContain('503')
    expect(errorOf(response).message.length).toBeLessThan(400)
  })

  it('reports a thrown fetch as provider_unreachable', async () => {
    fetchStub.mockRejectedValue(new TypeError('fetch failed: ENOTFOUND'))

    const response = await post(validBody())

    expect(response.status).toBe(502)
    expect(errorOf(response).code).toBe('provider_unreachable')
    expect(errorOf(response).message).toContain('ENOTFOUND')
    expect(JSON.parse(response.body).text).toBeUndefined()
  })
})

describe('malformed provider responses', () => {
  const cases = [
    ['no content array', { id: 'msg_test' }],
    ['an empty content array', { content: [] }],
    ['no text blocks', { content: [{ type: 'thinking', thinking: 'hmm' }] }],
    ['only whitespace text', { content: [{ type: 'text', text: '   \n' }] }],
  ]

  for (const [description, payload] of cases) {
    it(`reports ${description} as malformed_provider_response`, async () => {
      fetchStub.mockResolvedValue({ ok: true, status: 200, text: async () => JSON.stringify(payload) })

      const response = await post(validBody())

      expect(response.status).toBe(502)
      expect(errorOf(response).code).toBe('malformed_provider_response')
      expect(JSON.parse(response.body).text).toBeUndefined()
    })
  }

  it('reports unparseable JSON as malformed_provider_response', async () => {
    fetchStub.mockResolvedValue({ ok: true, status: 200, text: async () => '<html>nope</html>' })

    const response = await post(validBody())

    expect(response.status).toBe(502)
    expect(errorOf(response).code).toBe('malformed_provider_response')
  })

  it('extracts text blocks in order and ignores everything else', () => {
    expect(extractText({ content: [{ type: 'text', text: 'a' }, { type: 'text', text: 'b' }] })).toBe('ab')
    expect(extractText({ content: [{ type: 'text', text: 1 }] })).toBe('')
    expect(extractText(null)).toBe('')
    expect(extractText({})).toBe('')
  })
})

describe('the secret never reaches a response', () => {
  it('is redacted even if a provider echoes it back', async () => {
    fetchStub.mockResolvedValue(
      providerFailure(401, { type: 'error', error: { message: `invalid key ${FAKE_KEY}` } }),
    )

    const response = await post(validBody())

    expect(response.body).not.toContain(FAKE_KEY)
    expect(response.body).toContain('[redacted]')
  })

  it('is never placed in a response header', async () => {
    fetchStub.mockResolvedValue(providerReply('fine'))

    const response = await post(validBody(), configWith(), { origin: ALLOWED_ORIGIN })

    expect(Object.values(response.headers).join(' ')).not.toContain(FAKE_KEY)
  })
})

describe('CORS', () => {
  it('answers a preflight from an allowed origin', async () => {
    const response = await send({
      method: 'OPTIONS',
      path: PROXY_COMPLETE_PATH,
      headers: { origin: ALLOWED_ORIGIN, 'access-control-request-method': 'POST' },
    })

    expect(response.status).toBe(204)
    expect(response.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN)
    expect(response.headers['access-control-allow-methods']).toContain('POST')
    expect(response.headers['access-control-allow-headers']).toContain('content-type')
    expect(response.headers['access-control-allow-credentials']).toBeUndefined()
    expect(response.headers.vary).toBe('origin')
  })

  for (const origin of [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:4173',
    'http://127.0.0.1:4173',
  ]) {
    it(`allows ${origin}`, async () => {
      fetchStub.mockResolvedValue(providerReply('fine'))

      const response = await post(validBody(), configWith(), { origin })

      expect(response.headers['access-control-allow-origin']).toBe(origin)
    })
  }

  it('does not echo a disallowed origin', async () => {
    fetchStub.mockResolvedValue(providerReply('fine'))

    const preflight = await send({
      method: 'OPTIONS',
      path: PROXY_COMPLETE_PATH,
      headers: { origin: DISALLOWED_ORIGIN },
    })
    const posted = await post(validBody(), configWith(), { origin: DISALLOWED_ORIGIN })

    expect(preflight.headers['access-control-allow-origin']).toBeUndefined()
    expect(posted.headers['access-control-allow-origin']).toBeUndefined()
    expect(preflight.headers['access-control-allow-methods']).toBeUndefined()
  })

  it('never answers with a wildcard', async () => {
    fetchStub.mockResolvedValue(providerReply('fine'))

    const response = await post(validBody(), configWith(), { origin: ALLOWED_ORIGIN })

    expect(response.headers['access-control-allow-origin']).not.toBe('*')
  })

  it('allows an extra origin named in TRIBUNAL_ALLOWED_ORIGINS', async () => {
    fetchStub.mockResolvedValue(providerReply('fine'))

    const config = configWith({ TRIBUNAL_ALLOWED_ORIGINS: 'http://localhost:3000, http://localhost:3001' })
    const response = await post(validBody(), config, { origin: 'http://localhost:3001' })

    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3001')
    expect(config.allowedOrigins).toContain('http://localhost:5173')
  })

  it('sends CORS headers on error responses too, so the browser can read them', async () => {
    const response = await post({ systemPrompt: '' }, configWith(), { origin: ALLOWED_ORIGIN })

    expect(response.status).toBe(400)
    expect(response.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN)
  })
})

describe('configuration overrides', () => {
  it('honours ANTHROPIC_MODEL, ANTHROPIC_MAX_TOKENS and ANTHROPIC_BASE_URL', async () => {
    fetchStub.mockResolvedValue(providerReply('stubbed'))

    await post(
      validBody(),
      configWith({
        ANTHROPIC_MODEL: 'claude-haiku-4-5',
        ANTHROPIC_MAX_TOKENS: '256',
        ANTHROPIC_BASE_URL: 'http://127.0.0.1:9999/',
      }),
    )

    const [url, init] = fetchStub.mock.calls[0]
    const body = JSON.parse(init.body)

    expect(url).toBe('http://127.0.0.1:9999/v1/messages')
    expect(body.model).toBe('claude-haiku-4-5')
    expect(body.max_tokens).toBe(256)
  })

  it('defaults to a small, fast model and a modest output cap', () => {
    const config = configWith()

    expect(config.model).toBe('claude-haiku-4-5-20251001')
    expect(config.maxTokens).toBe(1024)
    expect(config.baseUrl).toBe('https://api.anthropic.com')
    expect(config.port).toBe(8787)
  })

  it('refuses a malformed numeric override rather than silently defaulting', () => {
    expect(() => configWith({ ANTHROPIC_MAX_TOKENS: 'lots' })).toThrow(/ANTHROPIC_MAX_TOKENS/)
    expect(() => configWith({ TRIBUNAL_PROXY_PORT: '-1' })).toThrow(/TRIBUNAL_PROXY_PORT/)
  })

  it('never reads the development-team token', () => {
    const config = configWith({ CLAUDE_CODE_OAUTH_TOKEN: 'must-never-be-used' })

    expect(config.apiKey).toBe(FAKE_KEY)
    expect(JSON.stringify(config)).not.toContain('must-never-be-used')
  })
})

describe('over a real socket', () => {
  let server
  let origin

  beforeEach(async () => {
    server = createServer(createRequestListener(configWith(), () => {}))

    await new Promise((resolve) => {
      // Port 0: the OS picks a free one, so the suite never collides with a
      // proxy the operator happens to be running.
      server.listen(0, '127.0.0.1', resolve)
    })

    origin = `http://127.0.0.1:${server.address().port}`
  })

  afterEach(async () => {
    await new Promise((resolve) => server.close(resolve))
  })

  it('serves a complete request end to end', async () => {
    fetchStub.mockResolvedValue(providerReply('a real statement'))

    const response = await realFetch(`${origin}${PROXY_COMPLETE_PATH}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: ALLOWED_ORIGIN },
      body: JSON.stringify(validBody()),
    })
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(JSON.parse(body)).toEqual({ text: 'a real statement' })
    expect(response.headers.get('access-control-allow-origin')).toBe(ALLOWED_ORIGIN)
    expect(body).not.toContain(FAKE_KEY)
  })

  it('answers a preflight and refuses an unknown path', async () => {
    const preflight = await realFetch(`${origin}${PROXY_COMPLETE_PATH}`, {
      method: 'OPTIONS',
      headers: { origin: ALLOWED_ORIGIN, 'access-control-request-method': 'POST' },
    })
    const missing = await realFetch(`${origin}/nope?x=1`, { method: 'POST', body: '{}' })

    expect(preflight.status).toBe(204)
    expect(preflight.headers.get('access-control-allow-origin')).toBe(ALLOWED_ORIGIN)
    expect(missing.status).toBe(404)
    expect((await missing.json()).error.code).toBe('not_found')
    expect(fetchStub).not.toHaveBeenCalled()
  })
})
