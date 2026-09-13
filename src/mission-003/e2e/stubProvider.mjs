/**
 * A local stand-in for Anthropic's Messages API.
 *
 * This exists so the whole seven-call tribunal can be driven through the real
 * adapter and the real proxy without spending a single provider token.
 * FOUNDER_MISSION_003.md reserves the one paid run for the operator; everything
 * the automated team validates has to be free, and "free" has to mean
 * structurally free rather than carefully avoided. This server is how: point
 * the proxy's `ANTHROPIC_BASE_URL` at it and there is no route to a paid
 * endpoint at all.
 *
 * It deliberately mimics only what the proxy actually uses — `POST
 * {base}/v1/messages`, answering `{ content: [{ type: 'text', text }] }` — and
 * records every request it receives so a test can prove what the tribunal
 * really sent, rather than assume it.
 *
 * Zero dependencies, loopback only, no state that outlives the process.
 */

import { createServer } from 'node:http'

/**
 * The credential the stub expects. Obviously synthetic, and checked rather than
 * ignored: a test that asserts "the proxy forwarded the key" is only meaningful
 * if something on the other end would notice its absence.
 *
 * This is not a credential. It authenticates nothing and unlocks nothing.
 */
export const STUB_API_KEY = 'test-not-a-real-key'

/** How the stub answers the next call. */
export const STUB_MODES = Object.freeze({
  /** A normal reply: prose for a representative, a verdict line for a judge. */
  NORMAL: 'normal',
  /** HTTP 401 with an Anthropic-shaped error body. */
  UNAUTHORIZED: 'unauthorized',
  /** HTTP 500 with an Anthropic-shaped error body. */
  SERVER_ERROR: 'server_error',
  /** 200, but a judge reply with no readable `VERDICT:` line. */
  MALFORMED_VERDICT: 'malformed_verdict',
  /** 200 with a body that is valid JSON but carries no text block. */
  NO_TEXT: 'no_text',
})

/** The user cue the engine sends on a judge turn (see src/data/prompts.ts). */
const JUDGE_CUE_MARKER = 'Deliver your verdict'

function isJudgeTurn(body) {
  const messages = Array.isArray(body?.messages) ? body.messages : []

  return messages.some(
    (message) => typeof message?.content === 'string' && message.content.includes(JUDGE_CUE_MARKER),
  )
}

/**
 * The text the stub "generates".
 *
 * Every string is written to be unmistakably stub output and unmistakably NOT
 * fake-client output: nothing here carries `[deterministic test client]`, so a
 * test can assert that fingerprint is absent and have the assertion mean
 * something.
 */
function stubText(body, callNumber) {
  if (!isJudgeTurn(body)) {
    return (
      `Stub statement ${callNumber}: the participant addresses the tribunal in ` +
      'its own words, on the canonical facts and the discussion so far.'
    )
  }

  // Alternated so the three opinions are visibly independent of one another
  // rather than three copies of one answer.
  const verdict = callNumber % 2 === 1 ? 'JUSTIFIED' : 'NOT_JUSTIFIED'

  return (
    `VERDICT: ${verdict}\n\n` +
    `Stub opinion ${callNumber}: the judge reasons from the transcript to this ` +
    'verdict and states the grounds for it concisely.'
  )
}

function errorBody(type, message) {
  return JSON.stringify({ type: 'error', error: { type, message } })
}

/**
 * Starts the stub on an ephemeral loopback port.
 *
 * @returns a handle with `url` (what to give `ANTHROPIC_BASE_URL`), `requests`
 * (every request observed, in order), `setMode`, and `close`.
 */
export async function startStubProvider({ mode = STUB_MODES.NORMAL } = {}) {
  const requests = []
  let currentMode = mode

  const server = createServer((req, res) => {
    const chunks = []

    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8')
      let body = null

      try {
        body = JSON.parse(raw)
      } catch {
        body = null
      }

      const path = new URL(req.url ?? '/', 'http://127.0.0.1').pathname

      requests.push({
        method: req.method,
        path,
        // Recorded so a test can assert the proxy sent the key and the version
        // header. Compared against the synthetic value above and never printed.
        sawApiKeyHeader: typeof req.headers['x-api-key'] === 'string',
        apiKeyMatches: req.headers['x-api-key'] === STUB_API_KEY,
        anthropicVersion: req.headers['anthropic-version'] ?? null,
        model: body?.model ?? null,
        maxTokens: body?.max_tokens ?? null,
        system: typeof body?.system === 'string' ? body.system : null,
        messages: Array.isArray(body?.messages) ? body.messages : [],
        isJudgeTurn: isJudgeTurn(body),
      })

      const callNumber = requests.length
      const send = (status, payload) => {
        res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
        res.end(payload)
      }

      if (path !== '/v1/messages' || req.method !== 'POST') {
        send(404, errorBody('not_found_error', `the stub serves POST /v1/messages, not ${req.method} ${path}`))
        return
      }

      switch (currentMode) {
        case STUB_MODES.UNAUTHORIZED:
          send(401, errorBody('authentication_error', 'invalid x-api-key'))
          return
        case STUB_MODES.SERVER_ERROR:
          send(500, errorBody('api_error', 'the stub provider is pretending to be broken'))
          return
        case STUB_MODES.NO_TEXT:
          send(200, JSON.stringify({ id: 'stub', type: 'message', role: 'assistant', content: [] }))
          return
        case STUB_MODES.MALFORMED_VERDICT:
          send(
            200,
            JSON.stringify({
              id: 'stub',
              type: 'message',
              role: 'assistant',
              content: [
                {
                  type: 'text',
                  text: isJudgeTurn(body)
                    ? 'I find the execution was probably about right, all things considered.'
                    : stubText(body, callNumber),
                },
              ],
            }),
          )
          return
        default:
          send(
            200,
            JSON.stringify({
              id: 'stub',
              type: 'message',
              role: 'assistant',
              model: body?.model ?? null,
              content: [{ type: 'text', text: stubText(body, callNumber) }],
              stop_reason: 'end_turn',
              usage: { input_tokens: 0, output_tokens: 0 },
            }),
          )
      }
    })
  })

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))

  const { port } = server.address()

  return {
    port,
    url: `http://127.0.0.1:${port}`,
    requests,
    setMode(next) {
      currentMode = next
    },
    reset() {
      requests.length = 0
    },
    async close() {
      await new Promise((resolve) => server.close(resolve))
    },
  }
}
