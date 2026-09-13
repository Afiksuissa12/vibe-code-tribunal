# Architecture

Module-level detail for The Tribunal. [`README.md`](README.md) has the
orientation, the flow diagram and the setup commands; this file describes the
system **as it is built**.

One Vite single-page application, plus one standalone Node script that holds the
provider credential. Nothing else runs.

---

## Core modules

| Module | Responsibility |
| --- | --- |
| `src/data/` | The single source of truth. `case.ts` (identity, central question, eleven canonical facts, neutral summary), `representatives.ts` and `judges.ts` (the seven profiles), `types.ts` (`Verdict`, `Side`, `TranscriptEntry`, `JudgeOpinion`, `TribunalResult`), `prompts.ts` (prompt composition), `index.ts` (the barrel everything imports from). No argument, stance, conclusion or verdict is stored here or anywhere else. |
| `src/llm/` | The seam to a language model. `client.ts` (the `LlmClient` interface and `createLlmClient()`), `anthropicClient.ts` (the real one), `fakeClient.ts` (the deterministic one), `proxyContract.ts` (the wire format shared with the server). |
| `src/tribunal/` | The engine. `engine.ts` (`runTribunal`, the orders, `TribunalRunError`) and `verdict.ts` (`parseJudgeResponse`, `normalizeVerdict`, `InvalidVerdictError`). |
| `src/components/` | Eight presentational sections plus `App.tsx`. They render what they are handed and decide nothing about the case. `StartTribunalSection.tsx` is the only one with state: it owns the run lifecycle. |
| `src/server/` | `anthropicProxy.mjs` — the only code in the repository that ever sees the credential. Outside the Vite module graph by construction. |

Dependency direction is one-way: `components → tribunal → llm → data`. Nothing
in the browser tree imports `src/server/`, and a test enforces that.

---

## The Tribunal Engine

`runTribunal(llmClient, options?)` in `src/tribunal/engine.ts` is the whole
orchestration layer — plain sequential TypeScript, no framework, no queue, no
event bus, no state machine, because four calls followed by three calls does not
need one.

1. Start from an empty transcript.
2. For each id in **`SPEAKING_ORDER`** — `jon-snow`, `tyrion-lannister`,
   `daenerys-targaryen`, `grey-worm` — resolve the profile, build the system
   prompt *inside the loop* so it captures the transcript as it stands, send one
   call, and append `{ speakerId, speakerName, side, text }`.
3. `Object.freeze([...transcript])` — the record is final before any judge runs.
4. For each id in **`JUDGING_ORDER`** — `barak`, `elon`, `shamgar` — build a
   prompt from the frozen transcript plus that judge's own profile, send one
   call, and run the reply through `parseJudgeResponse`.
5. Return `{ transcript, judicialOpinions }`.

Both orders are declared in the engine rather than inferred from the order of
the data arrays: the order is an orchestration decision, so reordering a data
file must not silently reorder the tribunal.

`TribunalRunError` is thrown when a run cannot be completed honestly — a
participant could not be reached, or returned an empty reply. A blank reply is a
failure rather than an empty statement, because an empty transcript entry would
read on screen as "this participant had nothing to say", which is a claim the
application is not entitled to make. `TribunalRunError` and `InvalidVerdictError`
both propagate to the UI: a partial run is reported as a failure, never as a
result.

---

## Transcript flow and context propagation

The transcript is an append-only array. The *application* supplies the speaker
metadata (`speakerId`, `speakerName`, `side`); the *model* supplies only `text`.

Context reaches a later speaker through the prompt and nowhere else.
`buildRepresentativePrompt(profile, transcript, caseData)` in
`src/data/prompts.ts` composes: a role line, the side, the side-is-role-only
rule, the profile, the case block (central question, considerations, the eleven
facts, the no-new-facts rule), the discussion so far rendered as
`Name (side): text`, and a turn cue. The cue is procedural — *"It is your turn to
address the tribunal. Give one concise statement now."* — and never says what to
say. An empty transcript is explicitly rendered as
`(No statements have been made yet.)` rather than silently omitted.

There is no agent-to-agent messaging. Speaker *n* receives speakers *1…n-1* as
text in a system prompt; that is the entire mechanism.

---

## Judge execution

Three separate calls, one per judge, in a sequential `for` loop in the same
process. **Independent means isolated context, not parallel execution**: each
judge prompt contains the frozen transcript and that judge's own reasoning
profile, and no judge is ever shown another judge's opinion.

`buildJudgePrompt` adds the independent-judgment rule and a reply-format block
demanding one labelled line followed by prose:

```
VERDICT: <JUSTIFIED or NOT_JUSTIFIED>
<concise reasoned opinion, in plain prose>
```

`parseJudgeResponse` in `src/tribunal/verdict.ts` is the one place free-form
model text crosses into the typed domain, and it is written to refuse rather
than guess. It finds the labelled line, strips the decoration a model tends to
wrap a token in (bold markers, backticks, quotes, brackets, trailing
punctuation), folds spaces and hyphens to underscores so `NOT JUSTIFIED` and
`not-justified` land on the canonical token, then matches **exactly** against
`JUSTIFIED` or `NOT_JUSTIFIED`. The match is exact on purpose: `NOT_JUSTIFIED`
contains `JUSTIFIED`, so a substring test would silently read a "not justified"
verdict as "justified". There is no default, no closest match and no fallback to
the first verdict word found loose in the prose.

`InvalidVerdictError` is thrown on an empty reply, a missing verdict line, an
unrecognised token, or a verdict with no reasoning behind it. It carries the raw
response so an operator can see what actually arrived.

`TribunalResult` has exactly two fields, `transcript` and `judicialOpinions`.
**There is no combined or majority verdict field to populate** — adding one would
be the application deciding the case rather than the judges. The UI displays the
tokens as *Justified* / *Not justified*, side by side, un-aggregated.

---

## The `LlmClient` abstraction

```ts
interface LlmClient {
  complete(request: ChatRequest): Promise<string>
}
```

One method: a system prompt plus messages in, generated text out. The seam
exists so that the engine cannot tell its implementations apart — and there are
three:

- **`createAnthropicProxyClient()`** (`src/llm/anthropicClient.ts`) — the real
  one, used by the application.
- **`createFakeLlmClient()`** (`src/llm/fakeClient.ts`) — deterministic test
  infrastructure and the dev preview.
- **`notImplementedLlmClient`** (`src/llm/client.ts`) — a stub that always
  rejects loudly, kept as the explicit way to express "deliberately not
  runnable".

That seam is what buys three things at once. The engine is testable without a
provider and without a network. The credential-handling code is kept on the far
side of an HTTP boundary, so the browser tree contains no secret handling at
all. And the switch between real and fake is a single decision recorded in one
place — `createLlmClient()` — rather than scattered across call sites.

`src/main.tsx` makes the selection:

```ts
const isDevPreview = import.meta.env.DEV && import.meta.env.VITE_TRIBUNAL_LLM !== 'real'
const llmClient = isDevPreview ? createFakeLlmClient() : createLlmClient()
```

Both `import.meta.env.DEV` and every `VITE_`-prefixed value are replaced at build
time, so this is a compile-time constant expression. In a production bundle it
folds to `false` and Rollup drops `fakeClient` from the output entirely. That is
the point, not a side effect: placeholder text must never be presented as a
tribunal outcome, and the surest way to honour that is for the built app not to
contain it.

### The deterministic fake client

Identical inputs always produce identical outputs, via a small FNV-1a hash whose
values carry no meaning beyond "different inputs differ". Every string it emits
is prefixed `[deterministic test client]`; a judge reply's verdict is a hash
bucket, explicitly not a finding. It records every `ChatRequest` it received, so
a test can assert that speaker 4's prompt really contained speaker 3's exact
text. A `respond` option lets a test drive a specific scenario — a malformed
verdict, a blank reply, a thrown error — without a second stub. It is used by
the engine tests, the component tests and `npm run dev`, and the UI shows a
dev-preview warning whenever it is wired up.

### The real Anthropic client

`src/llm/anthropicClient.ts` is one HTTP call and nothing else. It holds no
secret, reads no environment secret, sends no auth header and knows no provider
hostname — it POSTs `{ systemPrompt, messages }` verbatim to
`/api/llm/complete` on the proxy origin and returns the proxy's text exactly as
it arrived, untrimmed and uninspected, so a malformed real judge reply fails at
`parseJudgeResponse` rather than being quietly tidied up. Everything it knows
about the wire format comes from `src/llm/proxyContract.ts`, which declares the
path, the default origin (`http://localhost:8787`), the request limits and the
seven error codes once, and which `proxyContract.test.ts` holds the server to.
Failures become `LlmProxyError` with a sentence the operator can act on, always
quoting the proxy's own message rather than replacing it. There is deliberately
no retry, no backoff, no queue, no cache and no streaming.

---

## The local proxy

`src/server/anthropicProxy.mjs` — plain ESM, zero third-party dependencies,
`node:http` plus the global `fetch`. Run with `node src/server/anthropicProxy.mjs`.
It is a transport and nothing more: it knows nothing about representatives,
judges, transcripts or verdicts.

It is 666 lines, of which **381 are code** — 179 lines are comment and 106
blank, because each security decision records *why* it exists next to itself.
It was reviewed in Mission 004 and deliberately kept as is: length here is
documentation density, not logic density.

Six responsibilities, in file order:

| Lines | Section | What it does |
| --- | --- | --- |
| 1–28 | Header and imports | States the invariant — the only file that sees the credential, outside the Vite module graph by construction. Imports `node:http` and `node:url`, nothing else. |
| 30–117 | Contract constants | Endpoint path, the seven error codes and their HTTP statuses, request limits, the pinned model, default port and base URL, API version, default allowed origins, provider timeout. |
| 119–197 | Configuration | `readConfig(env)` reads the six environment variables from an **injected** environment object, so it stays testable and the full list is visible in one place. Rejects a malformed numeric override at startup instead of silently defaulting. |
| 199–298 | Request validation | `validateCompleteRequest(value)` — strict allow-list shape check; unknown keys rejected at both levels. |
| 300–319 | Provider response reading | `extractText(payload)` concatenates `text` blocks in order and ignores everything else rather than guessing. |
| 321–394 | Response construction | CORS headers (`vary: origin` always sent, `*` never used), secret redaction of every outgoing body, JSON/failure/success builders, provider-error excerpting. |
| 396–552 | **The handler** | `handleRequest(request, config)` — the whole proxy as one linear sequence of guard clauses: OPTIONS preflight → path check → method check → **origin guard** → JSON parse → validate → credential presence → outbound `fetch` with a 120s timeout → read body → status check → parse → extract text → non-empty check → success. Free of `node:http` types so a test can call it directly. |
| 554–636 | Node plumbing | `readBody` enforces the 1 MiB cap **while reading the socket**, header lower-casing, and `createRequestListener` — which logs method, path, status and error code only, never bodies and never the key. |
| 638–666 | Startup | `startProxy` binds **127.0.0.1 only** and logs credential presence as a boolean. A server is started only when the module is invoked directly, so importing it in a test has no side effect. |

The pure pieces (`readConfig`, `validateCompleteRequest`, `extractText`,
`handleRequest`) are exported and tested directly — 51 tests in
`anthropicProxy.test.mjs`, plus contract-parity, origin-guard, key-material and
end-to-end coverage elsewhere.

---

## The security boundary

The requirement is that the provider credential never reaches the browser, and
the architecture makes that structurally true rather than a matter of care:

```
Browser (Vite bundle)                    Node process
──────────────────────                   ─────────────────────────────
App.tsx / runTribunal                    anthropicProxy.mjs
  └─ anthropicClient.ts                    ├─ holds ANTHROPIC_API_KEY
       │  no secret, no provider host      ├─ binds 127.0.0.1 only
       │                                   └─ sends x-api-key ──▶ Anthropic
       └── POST /api/llm/complete ────────▶
```

- The credential exists in exactly one process, and the file that reads it is
  never imported by anything in the Vite module graph. There is no bundling
  mistake that could ship it.
- The proxy binds loopback only — it holds a credential and has no
  authentication of its own, so it must not be reachable from the network.
- A request carrying a browser `Origin` outside the allow-list is refused at the
  server. Withholding CORS headers would stop a page *reading* the reply but not
  stop the request being *sent* and the operator's tokens being spent; only the
  server can close that. Non-browser callers send no `Origin` and are unaffected.
- The body cap is enforced while reading the socket, before validation, so the
  process cannot be exhausted before its limits are reached.
- Logging is method, path, status and error code. Never bodies — they carry the
  prompts — and never any part of the key. Startup reports presence as a boolean.
- Every outgoing response body is scanned and the key redacted, as a last line
  of defence.
- `src/llm/secretBoundary.test.ts` is the standing guard: on every `npm test` it
  walks every file under `src/` outside `src/server/` and `src/mission-003/` and
  fails if any names the credential variable, the provider host, the provider
  auth header, or reaches into the process environment — and it fails if no
  browser-facing file imports are found to scan, so a silently empty walk cannot
  pass.

`VITE_`-prefixed variables are inlined into the bundle at build time and are
therefore public by definition; the two the app uses are a mode flag and a URL.
See README.md for why a secret must never carry that prefix, and for the
distinction between `ANTHROPIC_API_KEY` and the unrelated development-runtime
variable `CLAUDE_CODE_OAUTH_TOKEN`, which this application never reads.
