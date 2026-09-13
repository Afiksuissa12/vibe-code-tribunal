/**
 * Tests for the real `LlmClient`.
 *
 * Not one of them touches a network or spends a provider token: every call
 * goes through an injected `fetchImpl` or a stubbed `globalThis.fetch`. That
 * is not a convenience — FOUNDER_MISSION_003.md reserves the single real run
 * for the operator, so the automated suite must be able to prove the adapter's
 * behaviour without one.
 *
 * The second half runs the real, unmodified `runTribunal` through this adapter
 * against a stubbed transport, which is the only way to show that the engine
 * cannot tell a real client from the fake one.
 */

/// <reference types="node" />
// Needed for the one test that reads this module's own source to prove what it
// does not contain; `tsconfig.app.json` lists only `vite/client` and
// `vitest/globals` under `types`.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { JUDGE_TURN_CUE, REPRESENTATIVE_TURN_CUE, VERDICT_LABEL } from '../data'
import { InvalidVerdictError, SPEAKING_ORDER, runTribunal } from '../tribunal'
import { LlmProxyError, createAnthropicProxyClient } from './anthropicClient'
import type { ChatRequest } from './client'
import { DEFAULT_PROXY_ORIGIN, PROXY_COMPLETE_PATH } from './proxyContract'

const DEFAULT_URL = `${DEFAULT_PROXY_ORIGIN}${PROXY_COMPLETE_PATH}`

/** The credential variable's name, assembled for the reason the adapter gives. */
const CREDENTIAL_VARIABLE = ['ANTHROPIC', 'API_KEY'].join('_')

/**
 * The only parts of a `Response` the adapter is allowed to depend on.
 *
 * Building the double by hand rather than using a real `Response` keeps that
 * dependency visible: if the adapter starts reading headers or calling
 * `.json()`, these tests break, which is the point.
 */
function fakeResponse(status: number, body: string): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => body,
  } as unknown as Response
}

function jsonResponse(status: number, body: unknown): Response {
  return fakeResponse(status, JSON.stringify(body))
}

interface RecordedCall {
  readonly url: string
  readonly init: RequestInit
}

/** A transport that records what it was asked and replies from a script. */
function recordingFetch(reply: (call: number) => Response | Promise<Response>): {
  calls: RecordedCall[]
  fetchImpl: typeof fetch
} {
  const calls: RecordedCall[] = []

  return {
    calls,
    fetchImpl: (async (url: string, init: RequestInit) => {
      const index = calls.length
      calls.push({ url, init })

      return reply(index)
    }) as unknown as typeof fetch,
  }
}

function parseBody(call: RecordedCall): unknown {
  return JSON.parse(String(call.init.body))
}

const A_REQUEST: ChatRequest = {
  systemPrompt: 'You are a representative before the tribunal.',
  messages: [{ role: 'user', content: REPRESENTATIVE_TURN_CUE }],
}

describe('createAnthropicProxyClient — request construction', () => {
  it('posts JSON to the contract path on the default origin', async () => {
    const transport = recordingFetch(() => jsonResponse(200, { text: 'a reply' }))
    const client = createAnthropicProxyClient({ fetchImpl: transport.fetchImpl })

    await client.complete(A_REQUEST)

    expect(transport.calls).toHaveLength(1)
    expect(transport.calls[0].url).toBe(DEFAULT_URL)
    expect(transport.calls[0].init.method).toBe('POST')
    expect(transport.calls[0].init.headers).toEqual({ 'content-type': 'application/json' })
  })

  it('sends exactly the ChatRequest it was handed, and nothing else', async () => {
    const transport = recordingFetch(() => jsonResponse(200, { text: 'a reply' }))
    const client = createAnthropicProxyClient({ fetchImpl: transport.fetchImpl })

    const request: ChatRequest = {
      systemPrompt: 'A system prompt with  odd   spacing and a trailing newline.\n',
      messages: [
        { role: 'user', content: 'first' },
        { role: 'assistant', content: 'second' },
        { role: 'user', content: 'third' },
      ],
    }

    await client.complete(request)

    const body = parseBody(transport.calls[0])

    // Deep equality, not a subset check: the prompt reaches the provider as the
    // prompt builders wrote it, with nothing injected on the way through.
    expect(body).toEqual({ systemPrompt: request.systemPrompt, messages: request.messages })
    expect(Object.keys(body as object).sort()).toEqual(['messages', 'systemPrompt'])
    for (const message of (body as { messages: object[] }).messages) {
      expect(Object.keys(message).sort()).toEqual(['content', 'role'])
    }
  })

  it('sends no credential header of any kind', async () => {
    const transport = recordingFetch(() => jsonResponse(200, { text: 'a reply' }))
    const client = createAnthropicProxyClient({ fetchImpl: transport.fetchImpl })

    await client.complete(A_REQUEST)

    const headers = transport.calls[0].init.headers as Record<string, string>

    expect(Object.keys(headers)).toEqual(['content-type'])
    expect(transport.calls[0].init).not.toHaveProperty('credentials')
  })
})

describe('createAnthropicProxyClient — origin resolution', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('uses the contract default when nothing is configured', async () => {
    const transport = recordingFetch(() => jsonResponse(200, { text: 'a reply' }))

    await createAnthropicProxyClient({ fetchImpl: transport.fetchImpl }).complete(A_REQUEST)

    expect(transport.calls[0].url).toBe(DEFAULT_URL)
    expect(DEFAULT_PROXY_ORIGIN).toBe('http://localhost:8787')
  })

  it('uses the build-time VITE_TRIBUNAL_PROXY_URL when one is set', async () => {
    vi.stubEnv('VITE_TRIBUNAL_PROXY_URL', 'http://127.0.0.1:9999')
    const transport = recordingFetch(() => jsonResponse(200, { text: 'a reply' }))

    await createAnthropicProxyClient({ fetchImpl: transport.fetchImpl }).complete(A_REQUEST)

    expect(transport.calls[0].url).toBe(`http://127.0.0.1:9999${PROXY_COMPLETE_PATH}`)
  })

  it('lets an explicit proxyOrigin win over the configured one', async () => {
    vi.stubEnv('VITE_TRIBUNAL_PROXY_URL', 'http://127.0.0.1:9999')
    const transport = recordingFetch(() => jsonResponse(200, { text: 'a reply' }))

    await createAnthropicProxyClient({
      proxyOrigin: 'http://localhost:4242',
      fetchImpl: transport.fetchImpl,
    }).complete(A_REQUEST)

    expect(transport.calls[0].url).toBe(`http://localhost:4242${PROXY_COMPLETE_PATH}`)
  })

  it('tolerates a trailing slash rather than producing a doubled path', async () => {
    const transport = recordingFetch(() => jsonResponse(200, { text: 'a reply' }))

    await createAnthropicProxyClient({
      proxyOrigin: 'http://localhost:4242/',
      fetchImpl: transport.fetchImpl,
    }).complete(A_REQUEST)

    expect(transport.calls[0].url).toBe(`http://localhost:4242${PROXY_COMPLETE_PATH}`)
  })
})

describe('createAnthropicProxyClient — a successful reply', () => {
  it('returns the provider text byte for byte, untrimmed and unrepaired', async () => {
    const text = `  ${VERDICT_LABEL}: JUSTIFIED\n\nThe reasoning, with  odd spacing preserved.  \n`
    const client = createAnthropicProxyClient({
      fetchImpl: recordingFetch(() => jsonResponse(200, { text })).fetchImpl,
    })

    await expect(client.complete(A_REQUEST)).resolves.toBe(text)
  })

  it('uses globalThis.fetch when no transport is injected', async () => {
    const stub = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse(200, { text: 'from the global transport' }))

    try {
      const client = createAnthropicProxyClient()

      await expect(client.complete(A_REQUEST)).resolves.toBe('from the global transport')
      expect(stub).toHaveBeenCalledTimes(1)
      expect(stub.mock.calls[0][0]).toBe(DEFAULT_URL)
    } finally {
      stub.mockRestore()
    }
  })
})

describe('createAnthropicProxyClient — configuration and provider failures', () => {
  it('says plainly that the proxy has no credential in its server environment', async () => {
    const client = createAnthropicProxyClient({
      fetchImpl: recordingFetch(() =>
        jsonResponse(503, {
          error: {
            code: 'missing_credential',
            message: `${CREDENTIAL_VARIABLE} is not set in the proxy process.`,
          },
        }),
      ).fetchImpl,
    })

    const result = client.complete(A_REQUEST)

    await expect(result).rejects.toBeInstanceOf(LlmProxyError)
    await expect(result).rejects.toThrow(CREDENTIAL_VARIABLE)
    await expect(result).rejects.toThrow(/server environment/i)
    await expect(result).rejects.toHaveProperty('code', 'missing_credential')
  })

  it('propagates a provider rejection with the proxy’s own message intact', async () => {
    const providerMessage =
      'the provider answered 400: model "claude-nonexistent" does not exist.'
    const client = createAnthropicProxyClient({
      fetchImpl: recordingFetch(() =>
        jsonResponse(502, { error: { code: 'provider_error', message: providerMessage } }),
      ).fetchImpl,
    })

    const result = client.complete(A_REQUEST)

    await expect(result).rejects.toThrow(providerMessage)
    await expect(result).rejects.toThrow(/provider rejected/i)
    await expect(result).rejects.toHaveProperty('code', 'provider_error')
  })

  it('propagates an unreachable provider without inventing a cause', async () => {
    const providerMessage = 'the outbound request failed: getaddrinfo ENOTFOUND.'
    const client = createAnthropicProxyClient({
      fetchImpl: recordingFetch(() =>
        jsonResponse(502, { error: { code: 'provider_unreachable', message: providerMessage } }),
      ).fetchImpl,
    })

    const result = client.complete(A_REQUEST)

    await expect(result).rejects.toThrow(providerMessage)
    await expect(result).rejects.toHaveProperty('code', 'provider_unreachable')
  })

  it('passes malformed_provider_response and invalid_request through honestly', async () => {
    for (const code of ['malformed_provider_response', 'invalid_request'] as const) {
      const client = createAnthropicProxyClient({
        fetchImpl: recordingFetch(() =>
          jsonResponse(code === 'invalid_request' ? 400 : 502, {
            error: { code, message: `the proxy said why: ${code}.` },
          }),
        ).fetchImpl,
      })

      const result = client.complete(A_REQUEST)

      await expect(result).rejects.toThrow(`the proxy said why: ${code}.`)
      await expect(result).rejects.toHaveProperty('code', code)
    }
  })

  it('names the origin and the start command when the proxy is not running', async () => {
    const client = createAnthropicProxyClient({
      proxyOrigin: 'http://localhost:8787',
      fetchImpl: (async () => {
        throw new TypeError('Failed to fetch')
      }) as unknown as typeof fetch,
    })

    const result = client.complete(A_REQUEST)

    await expect(result).rejects.toBeInstanceOf(LlmProxyError)
    await expect(result).rejects.toThrow('http://localhost:8787')
    await expect(result).rejects.toThrow('node src/server/anthropicProxy.mjs')
    await expect(result).rejects.toHaveProperty('code', null)
  })
})

describe('createAnthropicProxyClient — replies it cannot read', () => {
  it('rejects a body that is not JSON rather than returning it as text', async () => {
    const client = createAnthropicProxyClient({
      fetchImpl: recordingFetch(() =>
        fakeResponse(200, '<!doctype html><title>Some other server</title>'),
      ).fetchImpl,
    })

    const result = client.complete(A_REQUEST)

    await expect(result).rejects.toBeInstanceOf(LlmProxyError)
    await expect(result).rejects.toThrow(/not JSON/i)
    await expect(result).rejects.not.toThrow(/doctype/i)
  })

  it('rejects a 200 that carries no text', async () => {
    for (const body of [{}, { text: null }, { text: 7 }, { reply: 'wrong field' }]) {
      const client = createAnthropicProxyClient({
        fetchImpl: recordingFetch(() => jsonResponse(200, body)).fetchImpl,
      })

      await expect(client.complete(A_REQUEST)).rejects.toThrow(/no usable generated text/i)
    }
  })

  it('rejects an error body whose shape the contract does not recognise', async () => {
    for (const body of [
      { error: 'just a string' },
      { error: { code: 'invented_code', message: 'nope' } },
      { error: { code: 'provider_error' } },
    ]) {
      const client = createAnthropicProxyClient({
        fetchImpl: recordingFetch(() => jsonResponse(502, body)).fetchImpl,
      })

      const result = client.complete(A_REQUEST)

      await expect(result).rejects.toBeInstanceOf(LlmProxyError)
      await expect(result).rejects.toThrow(/HTTP 502/)
    }
  })

  it('never returns text that arrived with a failing status', async () => {
    const client = createAnthropicProxyClient({
      fetchImpl: recordingFetch(() =>
        jsonResponse(500, { text: 'text smuggled in on a 500' }),
      ).fetchImpl,
    })

    const result = client.complete(A_REQUEST)

    await expect(result).rejects.toThrow(/HTTP 500/)
    await expect(result).rejects.not.toThrow(/smuggled/)
  })

  it('rejects an empty body rather than resolving with an empty string', async () => {
    const client = createAnthropicProxyClient({
      fetchImpl: recordingFetch(() => fakeResponse(200, '')).fetchImpl,
    })

    await expect(client.complete(A_REQUEST)).rejects.toBeInstanceOf(LlmProxyError)
  })
})

/**
 * The two properties the whole security argument rests on, checked against the
 * module's own source rather than inferred from its behaviour.
 */
describe('the adapter’s standing guarantees', () => {
  const SOURCE = readFileSync(
    resolve(fileURLToPath(import.meta.url), '..', 'anthropicClient.ts'),
    'utf8',
  )

  it('never imports the fake client, so no failure path can fall back to it', () => {
    expect(SOURCE).not.toMatch(/fakeClient/)
    expect(SOURCE).not.toMatch(/PLACEHOLDER/)
  })

  it('reads no environment beyond the public VITE_ build-time values', () => {
    // `import.meta.env` is inlined at build time and is public by design. The
    // credential is read by the proxy process alone; nothing here can reach it.
    const environmentReads = SOURCE.match(/import\.meta\.env\.\w+/g) ?? []

    expect(environmentReads).toEqual(['import.meta.env.VITE_TRIBUNAL_PROXY_URL'])
    expect(SOURCE).not.toMatch(/getenv|Deno\.env|globalThis\.process/)
  })
})

/**
 * Engine compatibility, end to end, without a single real token.
 *
 * `runTribunal` is frozen for this mission. These tests run the real engine
 * through the real adapter over a stubbed transport: if the integration needed
 * the engine to change, they would be the thing that failed.
 */
describe('runTribunal through the real adapter', () => {
  const REPRESENTATIVE_REPLIES = [
    'I took the life of the woman I loved, and I will not pretend otherwise.',
    'The question is not what was done but what it prevented, and at what price.',
    'I came to break a wheel. I am told instead that I became it.',
    'He swore an oath to his queen and he broke it with a blade.',
  ]

  const JUDGE_REPLIES = [
    `${VERDICT_LABEL}: NOT_JUSTIFIED\nNo tribunal had spoken, so no killing could be lawful.`,
    `${VERDICT_LABEL}: JUSTIFIED\nThe threat was imminent and no lesser means remained.`,
    `${VERDICT_LABEL}: NOT_JUSTIFIED\nThe oath he broke was the only order that bound him.`,
  ]

  function scriptedTransport(judgeReplies: readonly string[]) {
    const bodies: ChatRequest[] = []
    const fetchImpl = (async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as ChatRequest
      const index = bodies.length
      bodies.push(body)

      const reply =
        index < REPRESENTATIVE_REPLIES.length
          ? REPRESENTATIVE_REPLIES[index]
          : judgeReplies[index - REPRESENTATIVE_REPLIES.length]

      return jsonResponse(200, { text: reply })
    }) as unknown as typeof fetch

    return { bodies, fetchImpl }
  }

  it('runs seven calls — four representatives, then three judges — in order', async () => {
    const transport = scriptedTransport(JUDGE_REPLIES)
    const result = await runTribunal(
      createAnthropicProxyClient({ fetchImpl: transport.fetchImpl }),
    )

    expect(transport.bodies).toHaveLength(7)

    const cues = transport.bodies.map((body) => body.messages[0].content)
    expect(cues.slice(0, 4)).toEqual(Array(4).fill(REPRESENTATIVE_TURN_CUE))
    expect(cues.slice(4)).toEqual(Array(3).fill(JUDGE_TURN_CUE))

    expect(result.transcript.map((entry) => entry.speakerId)).toEqual([...SPEAKING_ORDER])
  })

  it('gives a later representative the earlier statements, unaltered', async () => {
    const transport = scriptedTransport(JUDGE_REPLIES)

    await runTribunal(createAnthropicProxyClient({ fetchImpl: transport.fetchImpl }))

    // The first speaker cannot have heard anyone; the fourth must have heard
    // all three, in the words they actually used.
    expect(transport.bodies[0].systemPrompt).not.toContain(REPRESENTATIVE_REPLIES[0])
    for (let spoken = 0; spoken < 3; spoken += 1) {
      expect(transport.bodies[3].systemPrompt).toContain(REPRESENTATIVE_REPLIES[spoken])
    }

    // And every judge reasons over the completed record.
    for (const judgeBody of transport.bodies.slice(4)) {
      for (const reply of REPRESENTATIVE_REPLIES) {
        expect(judgeBody.systemPrompt).toContain(reply)
      }
    }
  })

  it('returns three separate opinions and no combined verdict', async () => {
    const transport = scriptedTransport(JUDGE_REPLIES)
    const result = await runTribunal(
      createAnthropicProxyClient({ fetchImpl: transport.fetchImpl }),
    )

    expect(result.judicialOpinions).toHaveLength(3)
    expect(result.judicialOpinions.map((opinion) => opinion.verdict)).toEqual([
      'NOT_JUSTIFIED',
      'JUSTIFIED',
      'NOT_JUSTIFIED',
    ])
    expect(new Set(result.judicialOpinions.map((opinion) => opinion.judgeId)).size).toBe(3)
    expect(Object.keys(result)).toEqual(['transcript', 'judicialOpinions'])
  })

  it('never shows a judge another judge’s opinion', async () => {
    const transport = scriptedTransport(JUDGE_REPLIES)

    await runTribunal(createAnthropicProxyClient({ fetchImpl: transport.fetchImpl }))

    for (const judgeBody of transport.bodies.slice(4)) {
      for (const reply of JUDGE_REPLIES) {
        expect(judgeBody.systemPrompt).not.toContain(reply)
      }
    }
  })

  it('aborts with InvalidVerdictError when a real judge reply is malformed', async () => {
    const malformed = [
      'I find that the killing was, on balance, defensible.',
      ...JUDGE_REPLIES.slice(1),
    ]
    const transport = scriptedTransport(malformed)

    // The strict contract is untouched: a reply with no VERDICT line is a
    // failed run, not a verdict this application picked for itself.
    await expect(
      runTribunal(createAnthropicProxyClient({ fetchImpl: transport.fetchImpl })),
    ).rejects.toBeInstanceOf(InvalidVerdictError)

    // It stopped at the first judge rather than carrying on to the other two.
    expect(transport.bodies).toHaveLength(5)
  })

  it('surfaces a proxy failure as a failed run with no partial result', async () => {
    const client = createAnthropicProxyClient({
      fetchImpl: (async () => jsonResponse(503, {
        error: { code: 'missing_credential', message: `${CREDENTIAL_VARIABLE} is not set.` },
      })) as unknown as typeof fetch,
    })

    await expect(runTribunal(client)).rejects.toThrow(CREDENTIAL_VARIABLE)
    await expect(runTribunal(client)).rejects.toThrow(/tribunal stopped/i)
  })
})
