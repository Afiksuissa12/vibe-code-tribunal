# Mission 003 — Final Report (Real LLM Provider Integration)

Produced against `FOUNDER_MISSION_003.md` by `mission-003-AUTO-QA`, the mission's
independent QA and reporting task. The sixteen sections below are the Founder's
required content, in the Founder's order.

> **Report location note.** The canonical home for this report is the repository
> root, and durable evidence belongs in `.agent/evidence/`. Both are outside this
> team's write policy (`src` only), so the report, the operator guide and all
> evidence live under `src/mission-003/` instead. Moving them is an operator
> action. See §15.

**Status:** implementation complete, automated validation green, independent QA
**PASS**. The one remaining gate is the operator's live, paid, seven-call run —
§12.

---

## 1. AutonomousDevTeam task-graph bug — root cause

**What the evidence shows.** Mission 002 never ran its Coordinator. Its driver
log (`/workspace/.agent/missions/mission-002/driver_log.jsonl`) opens with two
events in the same second:

```
04:14:43  mission_started              {mission: "Mission 002: Implement the sequential Tribunal Engine…"}
04:14:43  task_graph_reused_from_disk  {task_count: 4}
```

There is no `phase_start {phase: "coordinator"}` anywhere in that log. The driver
went straight from starting the mission to reusing a decomposition it found on
disk — and the decomposition it found was **Mission 001's**:

```
04:14:43  phase_start  mission-001-AUTO-SCAFFOLD   role: Application scaffolding engineer
04:14:58  child_task_terminal  mission-001-AUTO-SCAFFOLD  COMPLETED
04:14:58  phase_start  mission-001-AUTO-DATA
04:15:13  child_task_terminal  mission-001-AUTO-DATA      COMPLETED
04:15:13  phase_start  mission-001-AUTO-UI
04:15:28  child_task_terminal  mission-001-AUTO-UI        COMPLETED
04:15:28  phase_start  mission-001-AUTO-QA
04:15:43  child_task_terminal  mission-001-AUTO-QA        COMPLETED
```

Mission 002 ran Mission 001's four tasks, under their Mission 001 ids and their
Mission 001 role descriptions, against a requirement about the Tribunal Engine.
Each terminated `COMPLETED` in almost exactly fifteen seconds — the signature of
work that was already merged and had nothing to do.

The file it reused is still on disk:

```
/workspace/.agent/state/task_graph.json
  mtime  2026-09-12 20:45:54   (written during Mission 001)
  tasks  mission-001-AUTO-SCAFFOLD, mission-001-AUTO-DATA,
         mission-001-AUTO-UI, mission-001-AUTO-QA
```

**Root cause, stated at the level the evidence supports.** The driver persisted
the task graph to a single, **mission-agnostic path**, and on a subsequent
mission it found that path already occupied and reused its contents instead of
running the Coordinator for the new requirement. The decomposition was cached
per-repository when it needed to be cached per-mission.

Mission 002 nevertheless shipped because the integrator and QA phases *are*
named per mission — `mission-002-INTEGRATOR`, `mission-002-QA`, `-QA-1`,
`-QA-2`, and two `INTEGRATOR-FIX` tasks — and so were unaffected. All of Mission
002's real work happened in those phases between 04:15:44 and 05:16:27. The bug
cost that mission its parallel decomposition, not its outcome.

**What this does NOT establish, and needs operator input.** The orchestrator's
source code is not in this repository — the driver runs against the repository
from outside it. I therefore cannot point at the line that made the decision,
name the function, or attest that the cause was a missing mission key in a path
rather than, say, a cache lookup that ignored one. Everything above is inferred
from the orchestrator's own structured logs and persisted state, which is strong
behavioural evidence and is not a source-level diagnosis. **A source-level root
cause requires operator confirmation. None has been invented here.**

Full extract: `src/mission-003/evidence/orchestrator-task-graph.txt`.

## 2. Exact fix and validation performed

**The fix, as the state and logs record it.** `/workspace/.agent/state/` now
holds two task-graph files rather than one:

```
task_graph.json                mtime 2026-09-12 20:45:54   4 tasks, all mission-001-*
task_graph-mission-003.json    mtime 2026-09-13 05:43:56   3 tasks, all mission-003-*
```

The new filename is **mission-scoped**: `task_graph-<mission_id>.json`. The old
unscoped file is untouched and still holds Mission 001's decomposition — exactly
what one expects if the change was to *where* the graph is written, so that a
new mission can no longer find a previous mission's graph at its own path.

**Validation, as the Mission 003 driver log records it:**

```
05:36:19  mission_started
05:36:19  phase_start        {phase: "coordinator", task_id: "mission-003-COORD"}
05:43:56  task_graph_received {task_count: 3,
             task_ids: [mission-003-AUTO-PROXY, mission-003-AUTO-CLIENT, mission-003-AUTO-QA]}
```

A Coordinator phase ran, for seven and a half minutes, and produced a graph. The
event is `task_graph_received`, **not** `task_graph_reused_from_disk`, and the
latter appears nowhere in Mission 003's log.

**Validation I performed myself.** I read both driver logs end to end, read both
task-graph files, compared their mtimes and contents, and confirmed the three
Mission 003 tasks then executed in dependency order (`AUTO-PROXY` 05:43–06:04,
`AUTO-CLIENT` 06:04–06:20, `AUTO-QA` from 06:20). Mission 001's graph was not
touched: its mtime is unchanged.

**Again, the honest limit.** This validates the *behaviour*. I did not see a
diff of the orchestrator and cannot describe the code change beyond what the
filenames and events imply. **Confirming the exact fix at source level is an
operator action.**

**One residual item.** `/workspace/.agent/state/task_graph.json` — Mission 001's
four-task graph at the old unscoped path — is still on disk. Under the new
naming it should never be read again, so it is stale state rather than a live
hazard, but deleting it removes any chance of a future code path finding it. It
is orchestrator state outside this repository, so this team could not remove it.

## 3. Confirmation: Mission 003 used a fresh Coordinator decomposition

Confirmed. `/workspace/.agent/state/task_graph-mission-003.json`, created
2026-09-13 05:43:56, whose `requirement` field begins *"Mission 003: connect The
Tribunal … to exactly ONE real LLM provider - Anthropic, via its Messages API"*,
contains exactly three tasks:

| Task id | Depends on | Role |
| --- | --- | --- |
| `mission-003-AUTO-PROXY` | — | Server Proxy & Secret Boundary Engineer |
| `mission-003-AUTO-CLIENT` | `mission-003-AUTO-PROXY` | Real LlmClient Adapter & Application Wiring Engineer |
| `mission-003-AUTO-QA` | both of the above | Independent QA, Security Auditor & Mission Reporter |

An identical copy sits at `/workspace/.worktrees/mission-003-COORD/task_graph.json`
(mtime 05:43:54) — the Coordinator's own worktree, two seconds earlier. The
Coordinator wrote it and the driver received it, rather than the driver finding
it lying around.

**No Mission 002 decomposition was reused.** There is in fact no Mission 002
task graph on disk to reuse: the only two graph files in `.agent/state/` are
Mission 001's and Mission 003's. Mission 002 never wrote one, because it never
ran a Coordinator — which is the bug in §1.

## 4. Provider selected and why

**Anthropic**, via the Messages API — decided by the Founder, not re-litigated.
One provider, wired directly. No multi-provider abstraction and no
provider-selection UI were built.

**Model: `claude-haiku-4-5-20251001`.** Chosen by the team because the work is
bounded: seven short, tightly-instructed turns per run, each asking for a
concise statement or a labelled verdict line plus reasoning. That calls for
reliable instruction-following, not maximum intelligence, and the larger models
would be paid for and wasted. The **dated** id is pinned rather than the alias,
so a run is reproducible. Overridable per-process with `ANTHROPIC_MODEL`.

No provider SDK was added. A single server-side `fetch` to the REST API is the
whole integration, as the Founder preferred.

## 5. Server / proxy architecture

```
Browser                      Local proxy process                 Anthropic
───────                      ───────────────────                 ─────────
runTribunal()
  └ LlmClient.complete()
      POST /api/llm/complete ──▶ validate → attach key ──▶ POST /v1/messages
      { systemPrompt,             (127.0.0.1:8787)            x-api-key
        messages }                                            anthropic-version
      ◀── { text }         ◀── extract text blocks   ◀── { content: [...] }
      ◀── { error:{code,message} } on any failure
```

`src/server/anthropicProxy.mjs` — **643 lines of plain ESM JavaScript with zero
dependencies.** `node:http` plus the global `fetch` is the entire server. Run it
with `node src/server/anthropicProxy.mjs`.

- **One endpoint**, `POST /api/llm/complete`. Everything else is 404; the wrong
  method on that path is 405.
- **Binds `127.0.0.1` only**, never `0.0.0.0` — the process holds a credential
  and has no authentication of its own. Verified: a request to this host's own
  external address is refused with `ECONNREFUSED`.
- **Strict validation.** `systemPrompt` a non-blank string ≤ 200,000 chars;
  `messages` 1–32 entries, each exactly `{role, content}` with a non-blank
  string content; **no unknown keys at either level**; a 1 MB hard ceiling
  enforced while reading the socket, before validation can be reached.
- **CORS is an exact-match allowlist** — the Vite dev and preview origins on
  both hostnames, extendable via `TRIBUNAL_ALLOWED_ORIGINS`. Never `*`, never
  `access-control-allow-credentials`, `vary: origin` on every response.
- **Seven error codes and no eighth**, because there is no code for "gave up and
  made something up": `invalid_request` (400), `method_not_allowed` (405),
  `not_found` (404), `missing_credential` (503), `provider_error` (502),
  `provider_unreachable` (502), `malformed_provider_response` (502).
- **120-second provider timeout**, so a hung call cannot hang the browser
  indefinitely.
- **No tribunal orchestration whatsoever.** The proxy knows nothing of
  representatives, judges, transcripts, verdicts or speaking order. It validates
  a request, forwards it, and returns the text.

**Why a standalone script rather than a Vite middleware plugin.** The Founder
offered the plugin as a reasonable minimal choice and left the decision to the
team; the team chose otherwise, and the reason is sound: a plugin has to be
registered in `vite.config.ts`, which puts credential-handling code inside the
tool that builds the browser bundle. A standalone script under `src/server/` is
*structurally* incapable of reaching the browser — it is never in the Vite module
graph, so no bundling mistake can ship it. It also needs no build step and
behaves identically under `dev` and `preview`. The cost is a second terminal,
which is recorded as a limitation in §15.

## 6. How secrets are protected

**Structurally, then by a standing guard, then by scanning.**

1. **The key is only ever in one process.** `readConfig(process.env)` in
   `src/server/anthropicProxy.mjs` is the single read, at the entry point. It is
   attached to the outbound request as an `x-api-key` header and never travels
   anywhere else.
2. **The browser half cannot reach it.** `src/llm/anthropicClient.ts` holds no
   secret, reads no environment secret, sends no auth header and knows no
   provider hostname. The two halves share only `src/llm/proxyContract.ts`,
   which is constants and types.
3. **`src/llm/secretBoundary.test.ts` polices it on every `npm test`.** It walks
   every file under `src/` outside `src/server/` and `src/mission-003/` and fails
   if any names the credential variable, the dev-team OAuth token, the auth
   header, the provider host, or reaches into `process.env` — and fails if any
   application file imports from `src/server/`. QA proved this guard can fail by
   introducing all six violations one at a time and watching each one fire
   (`evidence/secret-boundary-mutation.txt`).
4. **QA added a second guard for credential *material*.**
   `src/mission-003/qa.keyMaterial.test.ts` scans **all** of `src/` with **no
   exemptions** for key-shaped values and `.env`-style credential assignments —
   closing a gap where a pasted `sk-ant-…` literal passed the first guard, and
   covering the two directories the first guard skips. See §11 and QA-1.
5. **Nothing is logged.** Startup prints `ANTHROPIC_API_KEY present: <boolean>`
   — never the value, never a prefix, never a hash. Per-request logging is
   method, path, status and error code. Bodies are never logged, because they
   carry the prompts and body logging is how secrets leak by accident. Verified
   over a full seven-call run: ten lines of output, no key, no prompt.
6. **Outgoing bodies are redacted as a last line of defence**, in case a
   provider ever echoed a key back.

**⚠️ OPERATOR ACTION — the root `.gitignore` does not cover a plain `.env`.**
It covers `*.local`, so `.env.local` is ignored. `.env` is not. A developer
following the ordinary convention could have a real key staged by `git add .`
with nothing to stop them. This is outside this team's write policy and **could
not be fixed here**. The intended lines are staged verbatim at
`src/mission-003/root-artifacts/gitignore.additions.txt`. **Apply them before
anyone writes a real key to disk.**

Two mitigating facts, both established by experiment rather than asserted:

- The proxy **loads no dotenv file**, so a real `.env` never has to exist at all.
- Even if one did, its value does not reach the browser. In a throwaway copy of
  this app outside the repository, a `.env` containing `ANTHROPIC_API_KEY=<synthetic>`
  *and* `VITE_ANTHROPIC_API_KEY=<synthetic>` was built with `vite build`:
  **neither value appeared in `dist/`**. A production build only inlines the
  `VITE_` variables the code actually reads. The exposure is committing the
  file, not shipping it.

## 7. Files added / changed

**Added — `mission-003-AUTO-PROXY`**

| File | Purpose |
| --- | --- |
| `src/server/anthropicProxy.mjs` | The proxy. Zero dependencies |
| `src/server/anthropicProxy.d.mts` | Types, so a `.ts` test can import the `.mjs` |
| `src/server/anthropicProxy.test.mjs` | 51 tests |
| `src/llm/proxyContract.ts` | The browser-safe shared contract |
| `src/llm/proxyContract.test.ts` | 12 parity tests holding contract and server together |
| `src/llm/secretBoundary.test.ts` | 7 tests — the standing source scan |
| `src/mission-003/root-artifacts/**` | Root-file content the team could not write (6 files) |

**Added — `mission-003-AUTO-CLIENT`**

| File | Purpose |
| --- | --- |
| `src/llm/anthropicClient.ts` | The real `LlmClient`. One HTTP call, nothing else |
| `src/llm/anthropicClient.test.ts` | 27 tests |

**Changed — `mission-003-AUTO-CLIENT`**

| File | Change |
| --- | --- |
| `src/llm/client.ts` | `createLlmClient()` now returns the real proxy-backed client. `notImplementedLlmClient` kept and still exported |
| `src/main.tsx` | Client selection: fake in dev unless `VITE_TRIBUNAL_LLM=real`; always real in a production build |
| `src/App.tsx` | **A doc comment only** |
| `src/llm/client.test.ts` | Two assertions that stopped being true, plus two new tests |
| `src/App.test.tsx` | The "cannot be run" block now stubs the transport instead of relying on a client that always rejects |

**Added — `mission-003-AUTO-QA`**

| File | Purpose |
| --- | --- |
| `src/mission-003/e2e/stubProvider.mjs` (+ `.d.mts`) | A local stand-in for the Messages API |
| `src/mission-003/e2e/proxyHarness.mjs` (+ `.d.mts`) | Spawns the real proxy with every real credential variable stripped |
| `src/mission-003/e2e/tribunal.e2e.test.ts` | 8 tests — the token-free seven-call run and six failure paths |
| `src/mission-003/qa.keyMaterial.test.ts` | 3 tests — credential-material scan, no exemptions |
| `src/mission-003/qa.originGuard.test.ts` | 10 tests — coverage for the QA fix below |
| `src/mission-003/QA_REPORT.md`, `MISSION_003_FINAL_REPORT.md`, `README.md` | This report, the QA audit, the operator guide |
| `src/mission-003/evidence/**` | Seven durable evidence files |

**Changed — `mission-003-AUTO-QA` (a disclosed QA fix, authored by QA and not by the implementing task)**

| File | Change |
| --- | --- |
| `src/server/anthropicProxy.mjs` | An eleven-line Origin check in `handleRequest`, closing finding QA-12. Detailed in §11 |

**Unchanged, and verified byte-identical to the mission base `7809cf4`:**
`src/tribunal/**` (engine, verdict, index and both test files), `src/data/**`,
`src/llm/fakeClient.ts`, `src/llm/fakeClient.test.ts`, every file in
`src/components/`, `src/App.css`, `src/index.css`, `src/setupTests.ts`.
`package.json` and `package-lock.json` are untouched — **no dependency was
added.**

## 8. Confirmation: `runTribunal()`'s architecture remained intact

Confirmed, and proved rather than asserted.
`git diff 7809cf4 HEAD -- src/tribunal/ src/data/ src/llm/fakeClient.ts src/llm/fakeClient.test.ts src/components/ src/App.css`
returns **nothing**. `engine.ts` and `verdict.ts` are byte-identical to the
mission base; so are `engine.test.ts` (18 tests), `verdict.test.ts` (16),
`fakeClient.test.ts` (8) and `data.test.ts` (14), and all of them pass
unmodified.

`runTribunal` still: starts from an empty transcript; runs the four
representatives in `SPEAKING_ORDER`, rebuilding each system prompt inside the
loop so it captures the transcript as it stands; freezes the completed
transcript before the judges; runs the three judges in `JUDGING_ORDER`
independently against that identical frozen record; and returns
`{ transcript, judicialOpinions }` with **no combined verdict**. It has no idea
what is behind the `LlmClient` interface, which is the point — the same function
that ran against the deterministic fake in Mission 002 now runs against
Anthropic with no change at all.

The fake client remains available, still exported, and is still what the
deterministic unit and UI tests use and what `npm run dev` selects by default.

## 9. Real LLM client behavior

`createAnthropicProxyClient()` in `src/llm/anthropicClient.ts` — deliberately
small: request construction, response parsing, error propagation, nothing else.
No retry, no backoff, no queue, no cache, no streaming. Seven sequential calls
per run need none of them, and each would put distance between what the provider
said and what the tribunal shows.

**Request.** `POST {origin}/api/llm/complete`, `content-type: application/json`,
body exactly `{ systemPrompt, messages }` — the `ChatRequest` it was handed,
**taken verbatim**, nothing added. Origin resolution: explicit option, then
`VITE_TRIBUNAL_PROXY_URL`, then the contract default `http://localhost:8787`.

**Success.** Returns the proxy's `text` **exactly as it arrived** — not trimmed,
not repaired, not inspected. `runTribunal` and `parseJudgeResponse` treat real
output precisely as they treat the fake's, so a malformed real judge reply fails
there, as an `InvalidVerdictError`, rather than being quietly tidied up here.

**Failure.** Every branch throws `LlmProxyError` carrying a sentence written for
an operator, quoting the proxy's own message rather than paraphrasing it:

| Condition | What the operator reads |
| --- | --- |
| Proxy unreachable | *"…could not be reached at http://localhost:8787. Start it in a second terminal with `node src/server/anthropicProxy.mjs`, with the provider key set in that terminal's environment, then try again."* |
| `missing_credential` | *"…is running but has no `ANTHROPIC_API_KEY` set in its own server environment, so no model could be called."* |
| `provider_error` | *"The language-model provider rejected the tribunal's request. The proxy reported: …HTTP 401: invalid x-api-key"* |
| `provider_unreachable` | *"…proxy could not reach the provider."* |
| `malformed_provider_response` | *"…replied with nothing the tribunal could use."* |
| 200 with no `text`, or an unrecognised error shape | *"…replied with HTTP 200 and no usable generated text, so the run produced nothing."* |

**It never invents and never falls back.** There is no code path from a failure
to the fake client, and the fake client is not even present in a production
bundle — `import.meta.env.DEV` folds to `false` and Rollup drops
`./llm/fakeClient` entirely. Verified: `dist/` contains none of
`[deterministic test client]`, `Development preview`, `Placeholder statement`,
`Placeholder opinion` or `Context fingerprint`, while it does contain
`/api/llm/complete` and `localhost:8787`.

## 10. Automated validation results

Run by QA on the merged tree:

```
$ npm run lint        -> exit 0
$ npm run typecheck   -> exit 0
$ npm test            -> exit 0
                         Test Files  13 passed (13)
                              Tests  203 passed (203)
$ npm run build       -> exit 0
                         dist/index.html                 0.40 kB │ gzip:  0.27 kB
                         dist/assets/index-*.css         3.32 kB │ gzip:  1.04 kB
                         dist/assets/index-*.js        238.47 kB │ gzip: 75.30 kB
                         ✓ built in 287ms
```

Per file: proxy 51, real client 27, App 24, engine 18, verdict 16, data 14,
contract parity 12, QA origin guard 10, fake client 8, QA end-to-end 8, secret
boundary 7, client factory 5, QA key material 3.

**No automated test can spend a provider token — asserted, not assumed.** The
entire suite was re-run with every non-loopback TCP connection blocked at the
socket layer (a Node preload wrapping `net.connect`,
`net.Socket.prototype.connect`, `tls.connect` and `dns.lookup`), which sits
*below* `fetch`/undici and so cannot be routed around by a test that stubs
`globalThis.fetch`. **13 files, 203 tests, all passing offline.** The blocker was
first proved live inside a vitest worker — a probe test's outbound call to
`api.anthropic.com` was refused under the preload and succeeded without it — and
the probe was then removed.

Verbatim output: `src/mission-003/evidence/validation.txt`.

## 11. Independent QA result

**PASS**, with one QA-authored fix applied and re-validated, and four items that
are outside this team's write policy and require operator action. Ten findings
in total; the full audit is `src/mission-003/QA_REPORT.md`.

QA did not write the implementation and re-derived every claim rather than
trusting either handoff note. Two of QA's own first attempts were wrong and are
recorded in the report: a dev-server probe that unknowingly talked to a leftover
server from another worktree, and a first draft of the key-material scanner that
produced a false positive on a legitimate fixture.

| # | Severity | Finding | Disposition |
| --- | --- | --- | --- |
| QA-12 | minor (security) | **Any page on any origin could spend the operator's tokens.** A CORS *simple* request — `POST` with `content-type: text/plain` — is not preflighted, and the proxy inspected no content type. Proved live: `origin: https://evil.example.com` returned **200** and **made a real provider call**. Not exfiltration (the page cannot read the reply), but an unauthenticated way to burn the operator's credit | **FIXED BY QA.** Routed to `mission-003-AUTO-PROXY` first; that task was terminal and did not reply. See below |
| QA-1 | minor | The secret-boundary guard checks credential *names*, not credential *material*, and skips `src/server/` and `src/mission-003/` — the two places a real key is most likely to be left. Proved: a realistic `sk-ant-…` literal in `src/components/` passed it | **RESOLVED BY QA** with a new QA-owned test, without editing another task's file |
| QA-2 | **blocking for the operator** | The root `.gitignore` does not cover a plain `.env` | **CANNOT FIX** — outside `src/`. §6, §15 |
| QA-3 | major | `.env.example` does not exist at the root | **CANNOT FIX** — staged at `root-artifacts/env.example.txt` |
| QA-4 | major | The root README has no configuration section | **CANNOT FIX** — staged at `root-artifacts/readme-configuration.md` |
| QA-5 | minor | A plain `npm run dev` uses the **fake** client, while the Founder's live-acceptance note says "e.g. `npm run dev` …". Honest (the warning renders) but ambiguous | **DOCUMENTED.** The operator guide makes `npm run build && npm run preview` the primary path |
| QA-7 | observation | `DEFAULT_PROXY_ORIGIN` uses `localhost` while the proxy binds `127.0.0.1` only | Documented, with the `VITE_TRIBUNAL_PROXY_URL` escape hatch |
| QA-8 | observation | The credential variable's name is assembled from fragments in the adapter, to satisfy the guard. Sound, but it is not a security mechanism and should not be read as one | Recorded |
| QA-9 | observation | The proxy rejects unknown keys inside message objects — stricter than spec | Agreed with; no change |
| QA-13 | observation | An oversized body is refused correctly but the client sees `ECONNRESET` rather than the 400, because the socket is destroyed first. Unreachable at the tribunal's ~3 KB prompt sizes | Recorded; no change |

**The QA fix to QA-12, disclosed in full.** Eleven lines added to
`handleRequest` in `src/server/anthropicProxy.mjs`, after the method check and
before the body is parsed:

```js
if (typeof headers.origin === 'string' && !config.allowedOrigins.includes(headers.origin)) {
  return fail('invalid_request',
    `requests from the origin ${headers.origin} are not accepted by this proxy. ` +
    'If that origin is legitimate, add it to TRIBUNAL_ALLOWED_ORIGINS.')
}
```

`invalid_request` is reused deliberately so `PROXY_ERROR_CODES` — and the parity
test that asserts against it — stay exactly as they were. Requests with **no**
`Origin` header are untouched, so curl, the token-free harness and non-browser
callers all keep working. Coverage was added in QA-owned space
(`src/mission-003/qa.originGuard.test.ts`, 10 tests) rather than in the proxy
task's test file.

**Re-validated after the fix:** live probe now returns **400, 0 provider calls**;
`src/server/anthropicProxy.test.mjs` passes **unmodified** (51/51); the seven-call
end-to-end run still passes; lint 0, typecheck 0, 203 tests, build 0.

Also verified and passing without a finding: contract parity is genuine (the
limits are checked by driving the proxy's own validator, not by comparing
constants); engine, verdict, data and fake-client files are byte-identical to the
mission base; the Mission 002 UI components and CSS are byte-identical, so the
Start flow, loading state, re-entry guard and `role="alert"` error state are
literally the Mission 002 ones; no new dependency, no SDK, no auth, no database,
no queue, no websockets, no streaming, no retry framework, no multi-provider
abstraction; and the proxy contains no tribunal orchestration.

## 12. Real end-to-end Tribunal run result

**PENDING — this is the operator's run, and QA did not perform it.**

`FOUNDER_MISSION_003.md` reserves the one live, paid, seven-call run for the
operator, after automated validation and independent QA pass. Both have now
passed. **No token has been spent by any agent on this mission.**

**What was validated in its place.** The closest honest substitute: the complete
seven-call tribunal driven through the **real** engine, the **real** adapter and
the **real** proxy — spawned as an actual child process on an actual loopback
socket — with only Anthropic itself replaced, via the proxy's own
`ANTHROPIC_BASE_URL` override, by a local stub. The credential used was the
obviously synthetic `test-not-a-real-key`, and the child proxy was started with
every real credential variable stripped from its environment. Full transcript:
`src/mission-003/evidence/token-free-e2e-run.txt`.

Verified in that run:

- **Exactly seven calls**, four representatives then three judges, in order —
  Jon Snow, Tyrion Lannister, Daenerys Targaryen, Grey Worm; then Aharon Barak
  model, Menachem Elon model, Meir Shamgar model.
- **Transcript context genuinely accumulates.** Speaker 1's prompt contains
  *"(No statements have been made yet.)"*; each of speakers 2–4 contains every
  earlier speaker's name and text **verbatim**, and does **not** contain the text
  of anyone who has not spoken yet. All three judges received the complete,
  identical transcript.
- **The proxy really called a provider**: every one of the seven forwarded the
  key, `anthropic-version: 2023-06-01`, the pinned model and `max_tokens: 1024`.
- **Three separate opinions**, three distinct judges, each with a valid parsed
  verdict and non-empty reasoning, with the `VERDICT:` line consumed by the
  parser and never left in the rendered opinion.
- **No combined verdict.** The result object's keys are exactly `transcript` and
  `judicialOpinions` — asserted, not eyeballed.
- **No fake-client fingerprint** anywhere in the output, and no credential.
- **Proxy log hygiene**: ten lines, no key, no prompt body.

And these failure paths, each against the real proxy:

| Path | Outcome |
| --- | --- |
| Proxy started with **no** credential | `missing_credential` surfaced naming `ANTHROPIC_API_KEY`; **0 provider calls attempted**; proxy logged `present: false` |
| Stub returns **401** | *"The language-model provider rejected the tribunal's request… HTTP 401: invalid x-api-key"*; aborted at speaker 1 |
| Stub returns **500** | Same honest `provider_error` shape; aborted at speaker 1 |
| **Proxy not running** | *"…could not be reached at … Start it in a second terminal with `node src/server/anthropicProxy.mjs`…"* |
| Judge replies with **no valid verdict line** | **`InvalidVerdictError`**, run aborted after 5 calls, the other two judges never asked, **no verdict invented, no result produced** |
| 200 with no text block | `malformed_provider_response`, surfaced honestly |

**The exact commands the operator runs** (the full checklist is
`src/mission-003/README.md`):

```sh
# 0. Confirm automated validation — expect exit 0 four times, 203 tests
npm run lint && npm run typecheck && npm test && npm run build

# 1. Terminal 1 — the proxy. The key lives here and nowhere else.
ANTHROPIC_API_KEY=sk-ant-... node src/server/anthropicProxy.mjs
#    Confirm it prints:  ANTHROPIC_API_KEY present: true

# 2. Terminal 2 — from a shell with NO ANTHROPIC_API_KEY set
npm run build && npm run preview
#    Then open http://localhost:4173
```

Use `preview`, not `dev`: a production build is always the real client, whereas
a plain `npm run dev` is wired to the deterministic fake (it says so on screen).
If you want the real client in dev, use `VITE_TRIBUNAL_LLM=real npm run dev`.

Then press **Start Tribunal once**, with the devtools Network tab open, and
verify the ten items the Founder listed — all four representatives real and
non-placeholder, transcript order, later speakers carrying prior context, three
judges with three separate opinions, valid verdict parsing, **no combined
verdict**, no `[deterministic test client]` anywhere, every network request going
to `127.0.0.1:8787` and **none** to `api.anthropic.com`, no `x-api-key` header in
the browser, and nothing resembling a key in Terminal 1's output.

## 13. Model calls and runtime for one run

**Seven model calls per run.** Four representatives sequentially, each seeing the
transcript so far, then three judges against the completed transcript. Confirmed
by counting the requests the stub provider actually received: 7.

**Orchestration runtime, measured:** **44 ms** wall-clock for the complete
seven-call run against the local stub. That number measures the engine, the
adapter, the proxy and the HTTP between them, and **nothing else** — it contains
no model latency and must not be read as a run time.

**Real-run estimate — an estimate, not a measurement.** Seven sequential
`claude-haiku-4-5` calls, each producing a concise statement or a verdict line
plus reasoning within a 1024-token cap, would plausibly take **roughly 20–60
seconds** end to end, dominated entirely by provider latency. Nobody has run it.
The operator's live run in §12 is what will produce a real figure, and this
report should be updated with it.

## 14. Confirmation: no secrets exposed or committed

Confirmed, by scanning rather than by assurance. Details and commands:
`src/mission-003/evidence/secret-scan.txt`.

- **Production bundle.** All seven tokens the Founder names are **absent** from
  `dist/`: `ANTHROPIC_API_KEY`, `CLAUDE_CODE_OAUTH_TOKEN`, `x-api-key`,
  `api.anthropic.com`, `anthropic-version`, `sk-ant`, `process.env`.
- **Source tree.** `process.env` appears in **no** browser-facing application
  code — every occurrence under `src/` is in the proxy (2, one a comment) or in
  QA's own non-bundled harness and evidence.
- **`CLAUDE_CODE_OAUTH_TOKEN` is read by nothing.** The name occurs three times
  in the repository and not one is a read: a comment saying it is never read, a
  test asserting it is ignored, and the Founder's own instruction in
  `FOUNDER_MISSION_003.md`.
- **Git history.** Over this mission's commits, three `sk-ant` hits, all
  deliberately non-credentials: two documentation ellipses (`sk-ant-...`) and one
  test fixture whose own value says it is fake. Across **all** refs, no
  key-shaped value. **No `.env` file has ever been added, on any branch, in any
  commit.** `git fsck` reports no dangling commits, so nothing was amended away
  either. The working tree is clean and no `.env*` file exists on disk.
- **No credential appears in any report, evidence file or log excerpt** produced
  by this mission. The only key-like strings anywhere are `test-not-a-real-key`,
  `sk-ant-fake-key-for-tests-…` and `sk-ant-...`, each of which says in its own
  value that it is not a credential.

The one open exposure is the `.gitignore` gap in §6 — a *future* risk of
committing a key, not a key that was committed. It is an operator action.

## 15. Remaining limitations

1. **⚠️ The root `.gitignore` does not cover a plain `.env`.** The single most
   important item in this report. Outside this team's write policy; staged at
   `src/mission-003/root-artifacts/gitignore.additions.txt`. Apply it before
   anyone writes a real key to disk. Mitigated but not removed by the facts that
   the proxy loads no dotenv file and that a `.env` value provably does not reach
   the bundle.
2. **The root-file artifacts are staged, not applied.** `.env.example` does not
   exist at the root, and the root `README.md` still has no configuration
   section — both required by the Definition of Done. Their content is written
   and correct, at `root-artifacts/env.example.txt` and
   `root-artifacts/readme-configuration.md`. The optional `npm run proxy` script
   (`root-artifacts/package.json.scripts.txt`) and the optional Vite `server.proxy`
   entry (`root-artifacts/vite.config.ts.snippet.txt`) are likewise unapplied;
   the implementation is correct without either. All four are consequences of the
   team's `src`-only write policy.
3. **This report, the QA report, the operator guide and all evidence live under
   `src/mission-003/`** rather than at the repository root and in
   `.agent/evidence/`, for the same reason. Moving them is an operator action.
4. **Two processes.** Running the app locally means a proxy terminal and an app
   terminal. A deliberate trade for a structurally unbundleable credential
   boundary (§5), but a real cost, and one the optional Vite snippet only
   partially softens — `vite preview` does not read `server.proxy`, so it helps
   in dev only.
5. **The live run has not happened.** §12. Everything the automated team could
   validate without spending a token has been validated; the paid run is the
   operator's.
6. **Sections 1 and 2 are established from orchestrator logs and state, not from
   orchestrator source**, which is outside this repository. The behaviour is
   confirmed; the source-level fix needs operator confirmation.
7. **A plain `npm run dev` uses the fake client.** Honest and visible, but it
   differs from the Founder's live-acceptance phrasing; the operator guide
   resolves it (QA-5).
8. **`/workspace/.agent/state/task_graph.json` — Mission 001's stale graph at the
   old unscoped path — is still on disk.** Harmless under mission-scoped naming,
   but worth deleting.
9. **No retry on a transient provider failure.** Deliberate: a 429 aborts the run
   and says so, and the operator presses the button again. Adding retry was
   explicitly out of scope.

## 16. Smallest recommended Mission 004

**Mission 004: apply the root files, run the live acceptance test, record the
result. Nothing else.**

The product is finished. What remains is finishing the paperwork the write
policy prevented, and turning §12 from *pending* into *done*. The smallest
mission that closes the Founder's Definition of Done is:

1. **Apply the four staged root artifacts** — the `.gitignore` lines **first**,
   then `.env.example`, then the README configuration section, then optionally
   the `npm run proxy` script. Verbatim from `src/mission-003/root-artifacts/`.
   No judgement required; the content is written and QA has read it.
2. **Move this report and the QA report to the repository root**, and the
   evidence to `.agent/evidence/`.
3. **Perform the live acceptance run** per `src/mission-003/README.md`, verify
   the ten Founder items, and **record the real call count and wall-clock**,
   replacing the estimate in §13 with a measurement.
4. **Delete the stale `/workspace/.agent/state/task_graph.json`.**
5. **Confirm the orchestrator fix at source level**, so §1 and §2 can state a
   root cause rather than an evidenced behaviour.

Give it a write policy that includes the repository root, or it will hit exactly
the wall this mission did.

**Explicitly not recommended for Mission 004:** streaming, retry, a second
provider, provider-selection UI, persistence, deployment, or any redesign of the
engine, the verdict contract or the UI. The Founder ruled all of them out and
nothing found in this audit argues for revisiting that.
