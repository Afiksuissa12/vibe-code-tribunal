# The Tribunal

A small academic web application that stages a fictional legal tribunal over
**The Realm v. Jon Snow**. Four representatives argue the case in turn, then
three judges — each reasoning by a different judicial methodology — deliver
three separate opinions.

The central question the tribunal exists to answer, exactly as it is stored in
`src/data/case.ts`:

> Was Jon Snow's intentional killing of Daenerys Targaryen justified as the
> necessary defense of others and of the realm?

considering *what Jon knew at the time*, *the scale of the threatened harm*,
*whether safer alternatives existed*, and *Jon's lack of formal authority*.

Nothing in this repository stores an answer to that question. The eleven
canonical case facts are fixed data; every argument, every piece of legal
reasoning and every verdict is produced by a language model at run time.

---

## What this demonstrates

This is a **multi-agent reasoning workflow**. Seven agents take part in one run:
four representatives and three judges. An "agent" here is not a process, a
server or a framework — it is one LLM call made with a system prompt built from
a fixed profile, the canonical case facts, and the transcript so far.

Three properties are the academic point of the exercise:

- **A representative's procedural side does not predetermine their arguments.**
  Every representative prompt carries an explicit rule that the assigned side
  determines the *role only*; factual conclusions, specific arguments, agreement,
  disagreement and final positions are left to the model, which is told it may
  acknowledge difficult facts and revise its view
  (`SIDE_IS_ROLE_ONLY_RULE`, `src/data/representatives.ts`).
- **The three judges reason by different methodologies.** Barak is systematic,
  rights-centred and proportionality-driven; Elon is tradition-minded,
  historical and cautious about judicial power; Shamgar is institutional,
  restrained and fact-focused (`src/data/judges.ts`). Each profile describes
  *how* that judge reasons and ends with an explicit instruction not to
  predefine what they conclude.
- **Judge outcomes are not hard-coded.** No verdict is stored anywhere in the
  repository. The application constrains the *vocabulary* to two tokens —
  `JUSTIFIED` and `NOT_JUSTIFIED` — and validates that what came back is one of
  them. It has no influence on which one.

There is deliberately **no combined or majority verdict**. The three opinions
are displayed side by side and left un-aggregated; summing them would be the
application deciding the case rather than the judges.

---

## Architecture at a glance

```
                              Case Facts
                                  │
                                  ▼
  Representative 1 ─▶ Representative 2 ─▶ Representative 3 ─▶ Representative 4
     Jon Snow            Tyrion              Daenerys             Grey Worm
     (defense)          Lannister            Targaryen          (prosecution)
                        (defense)          (prosecution)
                                  │
                                  ▼
                        Completed Transcript
                                  │
              ┌───────────────────┼───────────────────┐
              ▼                   ▼                   ▼
       Aharon Barak         Menachem Elon        Meir Shamgar
           model                model                model
              │                   │                   │
              ▼                   ▼                   ▼
                      Three Independent Opinions
```

Each representative is given the transcript as it stands when their turn
begins, so speaker *n* genuinely sees speakers *1…n-1*. The transcript is
frozen once the fourth representative has spoken, and all three judges reason
over that identical final record.

Two things the diagram does **not** mean:

- The judges do not run in parallel or in separate processes. They are three
  calls in a sequential loop. *Independent* means **isolated context** — no
  judge is shown another judge's opinion.
- The representatives do not talk to each other. There is no agent-to-agent
  messaging; a later speaker simply receives the earlier text as prompt context.

One run is exactly **seven sequential LLM calls** (4 + 3), in one process, with
no streaming, no retry and no cache.

Module-level detail lives in [`ARCHITECTURE.md`](ARCHITECTURE.md).

---

## Code orchestrates. The LLM decides.

That principle is the design rule for the whole codebase, and it is stated in
the engine itself (`src/tribunal/engine.ts`). Deterministic code controls *who
speaks, in what order, with what context, and what shape of answer is
acceptable*. The LLM controls *what is actually said and concluded*.

| Deterministic application code | Where |
| --- | --- |
| Participant identity and profiles (fixed literal data, never generated) | `src/data/representatives.ts`, `src/data/judges.ts` |
| Canonical facts and the central question (identical text sent to all seven agents) | `src/data/case.ts` |
| Speaking order — Jon Snow → Tyrion Lannister → Daenerys Targaryen → Grey Worm | `SPEAKING_ORDER`, `src/tribunal/engine.ts` |
| Judging order — Barak → Elon → Shamgar | `JUDGING_ORDER`, `src/tribunal/engine.ts` |
| Prompt assembly (pure string composition; contains no argument, stance or conclusion) | `src/data/prompts.ts` |
| Context delivery — each prompt rebuilt inside the loop, after the previous reply was appended | `src/tribunal/engine.ts` |
| Transcript accumulation — append-only; the app supplies speaker name and side, the LLM supplies only the text | `src/tribunal/engine.ts` |
| Transcript freezing before any judge runs | `src/tribunal/engine.ts` |
| Judge isolation — each judge prompt is the frozen transcript plus that judge's own profile, and nothing else | `src/tribunal/engine.ts` |
| Output validation — exact match on `JUSTIFIED` / `NOT_JUSTIFIED`; no default, no closest match, no fallback | `src/tribunal/verdict.ts` |
| Empty-reply and failure handling — a failed run yields no partial result | `src/tribunal/engine.ts`, `src/components/StartTribunalSection.tsx` |
| Request validation, origin guard, body cap, credential handling, redaction | `src/server/anthropicProxy.mjs` |
| UI state — `idle` / `running` / `complete` / `failed`, plus a re-entry guard against a double click | `src/components/StartTribunalSection.tsx` |
| Rendering — displays returned text as-is, adding only speaker name, side and verdict label | `src/components/TranscriptSection.tsx`, `JudicialOpinionsSection.tsx` |

| Produced by the LLM | Nature |
| --- | --- |
| Each representative's statement | The entire argument: what position is taken, which facts are emphasised, whether difficult facts are conceded, whether an earlier speaker is answered |
| Each judge's verdict token | Which of the two allowed verdicts. Not hard-coded anywhere |
| Each judge's reasoned opinion | The whole legal reasoning: principle selection, tests applied, how facts are weighed, how counterarguments are handled, the conclusion |

The single point where model output crosses into the typed domain is
`parseJudgeResponse`, and it refuses rather than guesses.

---

## Stack

| Choice | Why |
| --- | --- |
| React 19 + TypeScript | One well-understood way to render a screen from typed data. |
| Vite | Dev server and production build with no extra configuration. |
| Plain CSS with custom properties | No framework or component library to explain. |
| Vitest + Testing Library on jsdom | Shares Vite's config; tests the rendered screen, not implementation details. |
| ESLint (flat config) | The project's lint gate. |
| A dependency-free Node HTTP proxy | `node:http` plus the global `fetch` — the only process that ever holds the API key. |

Runtime dependencies are **`react` and `react-dom` only**. There is no backend
framework, no database and no state-management library. The one server-side
component is `src/server/anthropicProxy.mjs`, a standalone Node script with zero
third-party dependencies.

---

## Running it locally

Requires **Node.js 22.12 or newer** (developed and validated on Node 22.14.0,
npm 10.9.2). Vite needs 20.19+, but Vitest needs 22.12+, so 22.12 is the real
floor for a repository you intend to test.

### 1. Install

```sh
npm install
```

### 2. Validate

All four gates should pass on a clean checkout:

```sh
npm run lint        # eslint .
npm run typecheck   # tsc -b --noEmit
npm test            # vitest run
npm run build       # tsc -b && vite build  -> dist/
```

### 3. Dev / test mode — no provider, no tokens

```sh
npm run dev         # serves http://localhost:5173/
```

A plain `npm run dev` wires up the **deterministic fake client**, so a preview
costs nothing. Pressing *Start Tribunal* exercises the real engine end to end,
but every statement and verdict is mechanically generated filler, every line is
prefixed `[deterministic test client]`, and the screen carries a visible
dev-preview warning saying so. It is not an argument and not a finding about
the case.

### 4. Real-provider mode — two terminals

The app talks to Anthropic only through the local proxy, which holds the key in
its own process environment. That means two processes.

**Terminal 1 — the proxy.** The key lives in this shell and nowhere else:

```sh
export ANTHROPIC_API_KEY="<your Anthropic API key>"
node src/server/anthropicProxy.mjs
```

> There is **no `npm run proxy` script** — `package.json` defines exactly
> `dev`, `build`, `preview`, `lint`, `test` and `typecheck`. Run the node
> command above. There is also **no Vite `server.proxy` entry**;
> `vite.config.ts` has no `server` key at all, so the browser talks to the
> proxy on its own origin.

On startup the proxy prints where it bound and whether a credential is present,
as a boolean — never the value:

```
The Tribunal LLM proxy is listening on http://127.0.0.1:8787/api/llm/complete
ANTHROPIC_API_KEY present: true
Model: claude-haiku-4-5-20251001; provider: https://api.anthropic.com
```

**Terminal 2 — the app.** Start it from a shell that does **not** have
`ANTHROPIC_API_KEY` set at all. Either of these reaches the real provider:

```sh
VITE_TRIBUNAL_LLM=real npm run dev     # dev server, real client — http://localhost:5173/
```

```sh
npm run build && npm run preview       # production build — http://localhost:4173/
```

| Command | Client used |
| --- | --- |
| `npm run dev` | the **fake** — placeholder text, with a dev-preview warning on screen |
| `VITE_TRIBUNAL_LLM=real npm run dev` | the real one, via the proxy |
| `npm run build && npm run preview` | the real one — a production build never contains the fake at all |

Both `http://localhost:5173` and `http://localhost:4173` (and their `127.0.0.1`
forms) are allowed origins by default, so no extra configuration is needed.

**No `.env` file is required.** The proxy loads no dotenv file; it reads its own
process environment. Export the key in the proxy's shell, as above, and nothing
sensitive ever lands on disk. If you do keep a local env file anyway, `.env` and
`.env.*` are already gitignored (`!.env.example` is the one exception).

### If a run fails

The proxy never invents a reply. If the key is missing, the provider rejects the
call, the network fails, or the provider returns something unusable, it answers
with a specific error code and the UI surfaces that failure verbatim through its
error state. It never falls back to the fake client during a real run, and a
failed run produces no partial transcript and no verdict.

---

## Environment variables

**Names only below. This repository contains no credential value, and no value
of any kind should be committed.** `.env.example` lists the same names, also
with no values.

### Read by the proxy process (`src/server/anthropicProxy.mjs`)

These must be in the environment of the terminal you start the proxy in. They
are **never** prefixed with `VITE_`.

| Variable | Required | Default |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | yes | none — the proxy answers `missing_credential` (HTTP 503) to every request without it |
| `ANTHROPIC_MODEL` | no | `claude-haiku-4-5-20251001` |
| `ANTHROPIC_MAX_TOKENS` | no | `1024` |
| `ANTHROPIC_BASE_URL` | no | `https://api.anthropic.com` — overridable so a token-free end-to-end run can be pointed at a local stub provider |
| `TRIBUNAL_PROXY_PORT` | no | `8787` |
| `TRIBUNAL_ALLOWED_ORIGINS` | no | the Vite dev and preview origins |

That list is exhaustive: `readConfig()` reads those six and nothing else.

### Read by the browser build (Vite)

| Variable | Purpose |
| --- | --- |
| `VITE_TRIBUNAL_LLM` | set to `real` to opt a dev server into the real client |
| `VITE_TRIBUNAL_PROXY_URL` | origin of the running proxy; defaults to `http://localhost:8787` |

### Why a secret must never carry a `VITE_` prefix

Vite **inlines every `VITE_`-prefixed variable into the browser bundle at build
time**. It is not read at run time and it is not hidden — it is substituted into
the JavaScript that ships to every visitor, where anyone can read it with View
Source. A `VITE_`-prefixed variable is therefore public by definition. The two
above are a mode flag and a URL, which is fine. A credential in a `VITE_`
variable would be published, not configured.

### `ANTHROPIC_API_KEY` is not `CLAUDE_CODE_OAUTH_TOKEN`

These two are unrelated and must not be confused:

- **`ANTHROPIC_API_KEY`** is *this product's* provider credential. The proxy
  process reads it and sends it to Anthropic as an `x-api-key` header. It is the
  only credential The Tribunal has.
- **`CLAUDE_CODE_OAUTH_TOKEN`** belongs to the **AutonomousDevTeam development
  runtime that built this project**. It authenticates that tooling, has nothing
  to do with The Tribunal, and is **never read by this application** — not by the
  browser code, not by the proxy, not by the tests. It is not a product variable,
  it is not listed in `.env.example`, and it must never be presented as one. If
  you are setting up The Tribunal, you do not need it.

`src/llm/secretBoundary.test.ts` fails the build if either name appears anywhere
in the browser-facing source tree.

---

## Security — why the key stays server-side

The requirement is that the provider credential never reaches the browser, and
the design makes that **structurally** true rather than a matter of discipline:

- The credential lives in one file's process: `src/server/anthropicProxy.mjs`.
  It is a standalone Node script that **nothing in the Vite module graph
  imports**, so there is no bundling mistake that could ship it.
- The browser client (`src/llm/anthropicClient.ts`) holds no secret, reads no
  environment secret, sends no auth header and knows no provider hostname. It
  posts to `/api/llm/complete` on the local proxy and reads back text. Verified
  on the built bundle: `dist/` contains `/api/llm/complete` and does **not**
  contain the credential variable name, `api.anthropic.com`, or `x-api-key`.
- `src/llm/secretBoundary.test.ts` is a standing guard, not a one-off audit. On
  every `npm test` it walks every file under `src/` outside `src/server/` and
  `src/mission-003/` and fails if any of them names the credential variable, the
  provider host, the provider auth header, or reaches into the process
  environment — and it names the offending file when it fires.
- The proxy binds **127.0.0.1 only**, never `0.0.0.0`: it holds a credential and
  has no authentication of its own, so it must not be reachable from the network.
- It refuses requests carrying a browser `Origin` that is not on its allow-list.
  Withholding CORS headers would stop a page *reading* the reply but not stop the
  request being *sent* and the operator's tokens being spent; refusing at the
  server closes that.
- It logs one line per request — method, path, status, error code. Never request
  or response bodies, because those carry the prompts, and never any part of the
  key. Startup reports credential presence as a boolean.
- Every outgoing response body is scanned and the key redacted before it is
  written, as a last line of defence.

---

## Testing

`npm test` runs **203 tests across 13 files** on Vitest with jsdom, and all of
it is free — no test makes a paid provider call.

| Area | Files |
| --- | --- |
| Canonical data integrity — names, sides, the eleven facts, the central question | `src/data/data.test.ts` |
| The engine — speaking and judging order, context propagation, transcript freezing, `TribunalRunError` | `src/tribunal/engine.test.ts` |
| Verdict parsing — strict `JUSTIFIED` / `NOT_JUSTIFIED`, and every way a reply is refused | `src/tribunal/verdict.test.ts` |
| Component/UI behaviour — the rendered screen, run lifecycle, error and dev-preview states | `src/App.test.tsx` |
| The `LlmClient` seam and the deterministic fake | `src/llm/client.test.ts`, `src/llm/fakeClient.test.ts` |
| The real browser client — request shape, every proxy error code, failure messages | `src/llm/anthropicClient.test.ts` |
| Browser/server contract parity — the `.ts` contract and the `.mjs` server held to each other | `src/llm/proxyContract.test.ts` |
| **The secret boundary** — the standing scan described above | `src/llm/secretBoundary.test.ts` |
| **The proxy** — config, strict request validation, provider-response reading, CORS, redaction, body cap, the whole handler | `src/server/anthropicProxy.test.mjs` (the largest single file, 51 tests) |
| Mission 003 QA regressions — the origin guard, and key material never appearing in output | `src/mission-003/qa.originGuard.test.ts`, `qa.keyMaterial.test.ts` |
| **Token-free end-to-end run** | `src/mission-003/e2e/tribunal.e2e.test.ts` |

**The deterministic fake client** (`src/llm/fakeClient.ts`) is what makes the
engine testable without a provider: identical inputs always produce identical
outputs, it records every request it received, and a test can override its reply
to drive a specific scenario — a malformed verdict, a blank reply, a thrown
error. It is used by the engine and component tests and by `npm run dev`. It is
excluded from the production bundle by a compile-time `import.meta.env.DEV`
branch, so its placeholder text cannot appear in a built app.

**The token-free end-to-end harness** under `src/mission-003/e2e/` drives the
whole seven-call run through the *real* engine, the *real* browser client and
the *real* proxy — spawned as an actual child process on an actual loopback
socket, over actual HTTP. The only substitution is Anthropic itself, replaced
via the proxy's own `ANTHROPIC_BASE_URL` override with a local stub
(`stubProvider.mjs`). There is no code path from it to a paid endpoint. It is
hermetic and runs as part of the ordinary `npm test`.

**Mission 003 additionally validated a real live run** against the actual
Anthropic API: exactly 7/7 real calls, in the correct order, with real context
propagation, all three judges reasoning separately, no fake-client output, and
no secret exposed. That evidence is preserved under
`src/mission-003/evidence/` — including the operator's run log, the
client-selection proof, the proxy security probes and the secret scans. The
repository has not materially changed provider, security or orchestration
behaviour since, so that evidence stands and no further tokens have been spent.

---

## Limitations

Stated plainly, because they are design decisions rather than oversights — but
they are real limits:

- **One hard-coded case.** *The Realm v. Jon Snow* and its eleven canonical facts
  are fixed data. There is no way to enter or load another case.
- **Fixed cast.** Four representatives and three judges, in a fixed order. Not
  configurable.
- **No persistence.** A run exists only in React state. Reload the page and the
  transcript and opinions are gone; nothing is saved, exported or logged.
- **No combined verdict — by design.** The three opinions are never aggregated,
  so the application never tells you "what the tribunal decided". That is
  deliberate, but it does mean there is no single answer on screen.
- **Two local processes.** A real run needs the proxy in one terminal and the app
  in another. A Vite middleware plugin would be one process, but it would put
  credential-handling code inside the tool that builds the browser bundle; the
  standalone script is structurally incapable of reaching the browser, and that
  trade was made deliberately.
- **Single provider, single model.** Anthropic only, pinned to
  `claude-haiku-4-5-20251001` unless overridden. No provider abstraction beyond
  the one-method `LlmClient` seam.
- **Local-only; no deployment story.** The proxy binds to loopback and has no
  authentication of its own. There is no hosting configuration, no container, no
  CI pipeline and no published build. It is meant to be run on a laptop.
- **No retry, no streaming, no cache.** Seven sequential calls; a single failure
  anywhere aborts the run and shows an error rather than a partial result. A run
  takes as long as seven model turns take.
- **Verdict parsing is strict.** If a judge replies without a readable
  `VERDICT:` line, the run fails rather than guessing. That is the honest
  behaviour, but it makes the run dependent on the model following the reply
  format.

---

## Repository map

```
src/
  data/         canonical case, the 7 agent profiles, prompt builders  <- source of truth
  llm/          LlmClient seam: real proxy client, deterministic fake, wire contract
  tribunal/     runTribunal (the 4-then-3 loop) and the verdict parser  <- code orchestrates
  components/   the screen, section by section
  server/       anthropicProxy.mjs — the only code that sees the key
  mission-003/  preserved validation evidence, QA reports and the e2e harness
  App.tsx       composes the screen; receives its LlmClient by injection
  main.tsx      mounts it and picks the client for the build
```

The mission briefs (`FOUNDER_MISSION_001–004.md`) are the authoritative
specification and are preserved unchanged as project history.
