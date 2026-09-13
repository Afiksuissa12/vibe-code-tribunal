// @vitest-environment node

/**
 * The token-free end-to-end run.
 *
 * FOUNDER_MISSION_003.md reserves the one paid, live Tribunal run for the
 * operator. This file is the closest honest substitute the automated team can
 * produce, and it is deliberately built so that "honest" means something:
 *
 * - the engine is the real `runTribunal` from `src/tribunal/engine.ts`;
 * - the client is the real `createAnthropicProxyClient` from
 *   `src/llm/anthropicClient.ts`, not a mock and not the fake;
 * - the proxy is the real `src/server/anthropicProxy.mjs`, spawned as an actual
 *   child process listening on an actual loopback socket;
 * - the HTTP between them is actual HTTP.
 *
 * The only substitution is Anthropic itself, replaced via the proxy's own
 * `ANTHROPIC_BASE_URL` override with the local stub in `./stubProvider.mjs`.
 * Nothing here can reach a paid endpoint: there is no code path to one, and the
 * child proxy is started with every real credential variable stripped from its
 * environment and an obviously synthetic value put back.
 *
 * It is hermetic — loopback only, ephemeral ports, no fixtures on disk, no
 * state outliving the file — so it runs as part of the ordinary `npm test`.
 *
 * Written by mission-003-AUTO-QA. It tests the other two tasks' work and
 * belongs to neither of them.
 */

import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createAnthropicProxyClient } from '../../llm/anthropicClient'
import { PLACEHOLDER_PREFIX } from '../../llm/fakeClient'
import { JUDGING_ORDER, SPEAKING_ORDER, TribunalRunError, runTribunal } from '../../tribunal/engine'
import { InvalidVerdictError } from '../../tribunal/verdict'
import { STUB_API_KEY, STUB_MODES, startStubProvider } from './stubProvider.mjs'
import { findFreePort, startRealProxy } from './proxyHarness.mjs'

type Stub = Awaited<ReturnType<typeof startStubProvider>>
type Proxy = Awaited<ReturnType<typeof startRealProxy>>

/** Generous for a loopback round trip, and needed for spawning a child process. */
const TIMEOUT = 30_000

/**
 * Narration collected for the durable evidence artifact.
 *
 * Written to `src/mission-003/evidence/` only when `TRIBUNAL_E2E_EVIDENCE=1`,
 * so an ordinary `npm test` stays silent and writes nothing.
 */
const narrative: string[] = []

function note(line = '') {
  narrative.push(line)
}

let stub: Stub
let proxy: Proxy

beforeAll(async () => {
  stub = await startStubProvider()
  proxy = await startRealProxy({ apiKey: STUB_API_KEY, baseUrl: stub.url })

  note('TOKEN-FREE END-TO-END RUN — mission-003-AUTO-QA')
  note('='.repeat(70))
  note()
  note(`Real proxy:    ${proxy.origin}  (child process: node src/server/anthropicProxy.mjs)`)
  note(`Stub provider: ${stub.url}      (ANTHROPIC_BASE_URL override; no paid endpoint exists)`)
  note(`Credential:    the synthetic value "${STUB_API_KEY}" — authenticates nothing`)
  note()
}, TIMEOUT)

afterAll(async () => {
  await proxy?.stop()
  await stub?.close()

  if (process.env.TRIBUNAL_E2E_EVIDENCE === '1') {
    const target = resolve(fileURLToPath(import.meta.url), '..', '..', 'evidence', 'token-free-e2e-run.txt')

    writeFileSync(target, `${narrative.join('\n')}\n`, 'utf8')
  }
}, TIMEOUT)

describe('a complete tribunal run through the real adapter and the real proxy', () => {
  it(
    'makes exactly seven calls: four representatives in order, then three judges',
    async () => {
      stub.reset()
      stub.setMode(STUB_MODES.NORMAL)

      // The shipped default origin form — `localhost`, not `127.0.0.1` — so the
      // value a browser would actually use is the value exercised here.
      const client = createAnthropicProxyClient({ proxyOrigin: proxy.localhostOrigin })

      const startedAt = performance.now()
      const result = await runTribunal(client)
      const elapsedMs = performance.now() - startedAt

      // --- call count and order -------------------------------------------
      expect(stub.requests).toHaveLength(7)
      expect(stub.requests.slice(0, 4).map((request) => request.isJudgeTurn)).toEqual([
        false,
        false,
        false,
        false,
      ])
      expect(stub.requests.slice(4).map((request) => request.isJudgeTurn)).toEqual([true, true, true])

      expect(result.transcript.map((entry) => entry.speakerId)).toEqual([...SPEAKING_ORDER])
      expect(result.judicialOpinions.map((opinion) => opinion.judgeId)).toEqual([...JUDGING_ORDER])

      // --- the proxy really forwarded a provider call ----------------------
      for (const request of stub.requests) {
        expect(request.method).toBe('POST')
        expect(request.path).toBe('/v1/messages')
        expect(request.apiKeyMatches).toBe(true)
        expect(request.anthropicVersion).toBe('2023-06-01')
        expect(request.model).toBe('claude-haiku-4-5-20251001')
        expect(request.maxTokens).toBe(1024)
      }

      // --- transcript context genuinely accumulates ------------------------
      // The first speaker must be told the record is empty; each later speaker
      // must be able to see every earlier speaker by name and by words.
      expect(stub.requests[0].system).toContain('(No statements have been made yet.)')

      for (let index = 1; index < 4; index += 1) {
        const system = stub.requests[index].system ?? ''

        for (const earlier of result.transcript.slice(0, index)) {
          expect(system).toContain(earlier.speakerName)
          expect(system).toContain(earlier.text)
        }

        // And must NOT contain anything from a speaker who has not spoken yet.
        expect(system).not.toContain(result.transcript[index].text)
      }

      // Every judge reasons over the complete, identical transcript.
      for (const request of stub.requests.slice(4)) {
        for (const entry of result.transcript) {
          expect(request.system).toContain(entry.text)
        }
      }

      // --- three separate opinions, no combined verdict --------------------
      expect(result.judicialOpinions).toHaveLength(3)
      expect(new Set(result.judicialOpinions.map((opinion) => opinion.judgeName)).size).toBe(3)

      for (const opinion of result.judicialOpinions) {
        expect(['JUSTIFIED', 'NOT_JUSTIFIED']).toContain(opinion.verdict)
        expect(opinion.opinion.trim()).not.toBe('')
        // The verdict line itself is consumed by the parser, never left in the
        // rendered opinion.
        expect(opinion.opinion).not.toContain('VERDICT:')
      }

      // The result carries a transcript and three opinions and nothing else —
      // in particular no aggregate, majority or overall verdict field.
      expect(Object.keys(result).sort()).toEqual(['judicialOpinions', 'transcript'])

      // --- no fake-client fingerprint anywhere in the output ---------------
      const everything = JSON.stringify(result)

      expect(everything).not.toContain(PLACEHOLDER_PREFIX)
      expect(everything).not.toContain('Placeholder statement')
      expect(everything).not.toContain('Placeholder opinion')

      // --- no credential anywhere in the output ----------------------------
      expect(everything).not.toContain(STUB_API_KEY)

      note('CALL SEQUENCE (as observed by the stub provider)')
      note('-'.repeat(70))
      stub.requests.forEach((request, index) => {
        const who =
          index < 4 ? result.transcript[index].speakerName : result.judicialOpinions[index - 4].judgeName
        note(
          `  ${index + 1}. ${request.isJudgeTurn ? 'JUDGE         ' : 'REPRESENTATIVE'}  ${who.padEnd(22)}` +
            ` system prompt ${String(request.system?.length ?? 0).padStart(5)} chars` +
            `  x-api-key forwarded: ${request.apiKeyMatches ? 'yes' : 'NO'}` +
            `  model: ${request.model}`,
        )
      })
      note()
      note('TRANSCRIPT (four representatives, in speaking order)')
      note('-'.repeat(70))
      result.transcript.forEach((entry, index) => {
        note(`  ${index + 1}. ${entry.speakerName} (${entry.side})`)
        note(`     ${entry.text}`)
      })
      note()
      note('JUDICIAL OPINIONS (three, independent, un-aggregated)')
      note('-'.repeat(70))
      result.judicialOpinions.forEach((opinion, index) => {
        note(`  ${index + 1}. ${opinion.judgeName} — VERDICT: ${opinion.verdict}`)
        note(`     ${opinion.opinion}`)
      })
      note()
      note('COMBINED VERDICT: none. Result keys are exactly ' + Object.keys(result).sort().join(', ') + '.')
      note(`FAKE-CLIENT FINGERPRINT "${PLACEHOLDER_PREFIX}": absent from all output.`)
      note(`CONTEXT ACCUMULATION: speaker 1 saw an empty record; speakers 2-4 each saw`)
      note(`  every prior statement verbatim; all three judges saw the complete transcript.`)
      note(`MODEL CALLS: ${stub.requests.length}`)
      note(`ORCHESTRATION WALL-CLOCK: ${elapsedMs.toFixed(0)} ms (against the local stub;`)
      note('  this measures the engine, adapter, proxy and HTTP only — NOT model latency).')
      note()
    },
    TIMEOUT,
  )

  it(
    'never lets the credential reach the proxy logs',
    () => {
      expect(proxy.logs.length).toBeGreaterThan(0)

      for (const line of proxy.logs) {
        expect(line).not.toContain(STUB_API_KEY)
        // Not even a prefix of it.
        expect(line).not.toContain(STUB_API_KEY.slice(0, 8))
      }

      // What it does print: a boolean, and one line per request with no body.
      expect(proxy.logs.some((line) => /present: true$/.test(line))).toBe(true)
      expect(proxy.logs.some((line) => line.includes('POST /api/llm/complete -> 200'))).toBe(true)
      expect(proxy.logs.some((line) => line.includes('You are '))).toBe(false)

      note('PROXY LOG HYGIENE')
      note('-'.repeat(70))
      proxy.logs.slice(0, 12).forEach((line) => note(`  ${line}`))
      note(`  ... ${proxy.logs.length} lines total; none contains the credential or any prompt body.`)
      note()
    },
    TIMEOUT,
  )
})

describe('the failure paths, against the real proxy', () => {
  async function expectRunToFail(client: ReturnType<typeof createAnthropicProxyClient>) {
    let thrown: unknown

    try {
      await runTribunal(client)
    } catch (cause) {
      thrown = cause
    }

    expect(thrown).toBeInstanceOf(Error)

    return thrown as Error
  }

  it(
    'surfaces a missing credential clearly, naming the variable, and runs nothing',
    async () => {
      const bare = await startRealProxy({ apiKey: null, baseUrl: stub.url })

      try {
        stub.reset()

        const error = await expectRunToFail(
          createAnthropicProxyClient({ proxyOrigin: bare.origin }),
        )

        expect(error).toBeInstanceOf(TribunalRunError)
        expect(error.message).toContain('ANTHROPIC_API_KEY')
        expect(error.message).toContain('proxy')
        // The crucial part: no outbound provider call was attempted at all.
        expect(stub.requests).toHaveLength(0)
        expect(bare.logs.some((line) => line.includes('missing_credential'))).toBe(true)
        expect(bare.logs.some((line) => /present: false$/.test(line))).toBe(true)

        note('FAILURE PATH — proxy started with no credential')
        note('-'.repeat(70))
        note(`  proxy log:  ${bare.logs.find((line) => line.includes('present:'))}`)
        note(`  proxy log:  ${bare.logs.find((line) => line.includes('missing_credential'))}`)
        note(`  UI message: ${error.message}`)
        note('  provider calls attempted: 0')
        note()
      } finally {
        await bare.stop()
      }
    },
    TIMEOUT,
  )

  it.each([
    ['a provider 401', STUB_MODES.UNAUTHORIZED, 'HTTP 401'],
    ['a provider 500', STUB_MODES.SERVER_ERROR, 'HTTP 500'],
  ])('reports %s honestly as a provider error', async (_label, mode, statusText) => {
    stub.reset()
    stub.setMode(mode)

    try {
      const error = await expectRunToFail(
        createAnthropicProxyClient({ proxyOrigin: proxy.origin }),
      )

      expect(error).toBeInstanceOf(TribunalRunError)
      expect(error.message).toContain('rejected the tribunal’s request')
      expect(error.message).toContain(statusText)
      // It stopped at the first speaker rather than carrying on.
      expect(stub.requests).toHaveLength(1)
      expect(error.message).not.toContain(STUB_API_KEY)

      note(`FAILURE PATH — provider returned ${statusText}`)
      note('-'.repeat(70))
      note(`  UI message: ${error.message}`)
      note(`  calls before abort: ${stub.requests.length} (the run stopped at the first speaker)`)
      note()
    } finally {
      stub.setMode(STUB_MODES.NORMAL)
    }
  }, TIMEOUT)

  it(
    'reports an unreachable proxy honestly, and says how to start it',
    async () => {
      // A port nothing is listening on: the failure the operator meets when they
      // forget the second terminal.
      const deadPort = await findFreePort()
      const error = await expectRunToFail(
        createAnthropicProxyClient({ proxyOrigin: `http://127.0.0.1:${deadPort}` }),
      )

      expect(error).toBeInstanceOf(TribunalRunError)
      expect(error.message).toContain('could not be reached')
      expect(error.message).toContain('node src/server/anthropicProxy.mjs')
      // Not an invented answer, and not a quiet fall back to the fake.
      expect(error.message).not.toContain(PLACEHOLDER_PREFIX)

      note('FAILURE PATH — proxy not running')
      note('-'.repeat(70))
      note(`  UI message: ${error.message}`)
      note()
    },
    TIMEOUT,
  )

  it(
    'aborts the run on a malformed judge verdict and invents nothing',
    async () => {
      stub.reset()
      stub.setMode(STUB_MODES.MALFORMED_VERDICT)

      try {
        const error = await expectRunToFail(
          createAnthropicProxyClient({ proxyOrigin: proxy.origin }),
        )

        // Not wrapped, not softened, not defaulted: the same failure a malformed
        // fake reply already produces.
        expect(error).toBeInstanceOf(InvalidVerdictError)
        expect(error.message).toContain('Could not read a judge verdict')
        expect(error.message).toContain('VERDICT: JUSTIFIED or NOT_JUSTIFIED')

        // Four representatives spoke, the first judge answered badly, and the run
        // stopped there — the other two judges were never asked.
        expect(stub.requests).toHaveLength(5)

        note('FAILURE PATH — judge replied without a readable verdict line')
        note('-'.repeat(70))
        note(`  error type: ${error.name}`)
        note(`  UI message: ${error.message}`)
        note(`  calls before abort: ${stub.requests.length} (4 representatives + 1 judge)`)
        note('  verdicts invented: none. The run produced no result at all.')
        note()
      } finally {
        stub.setMode(STUB_MODES.NORMAL)
      }
    },
    TIMEOUT,
  )

  it(
    'reports a 2xx with no usable text as a malformed provider response',
    async () => {
      stub.reset()
      stub.setMode(STUB_MODES.NO_TEXT)

      try {
        const error = await expectRunToFail(
          createAnthropicProxyClient({ proxyOrigin: proxy.origin }),
        )

        expect(error).toBeInstanceOf(TribunalRunError)
        expect(error.message).toContain('nothing the tribunal could use')

        note('FAILURE PATH — provider returned 200 with no text block')
        note('-'.repeat(70))
        note(`  UI message: ${error.message}`)
        note()
      } finally {
        stub.setMode(STUB_MODES.NORMAL)
      }
    },
    TIMEOUT,
  )
})
