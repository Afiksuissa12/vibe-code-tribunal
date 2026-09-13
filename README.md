# The Tribunal

A small academic web application that simulates a fictional legal tribunal
around **The Realm v. Jon Snow**.

The central question the tribunal exists to answer: was Jon Snow's intentional
killing of Daenerys Targaryen justified as the necessary defense of others and
of the realm, considering what Jon knew at the time, the scale of the
threatened harm, whether safer alternatives existed, and Jon's lack of formal
authority?

The authoritative specification is [`FOUNDER_MISSION_001.md`](FOUNDER_MISSION_001.md).

## Stack

| Choice | Why |
| --- | --- |
| React 19 + TypeScript | One well-understood way to render a screen from typed data. |
| Vite | Dev server and production build with no extra configuration. |
| Plain CSS with custom properties | No framework or component library to explain. |
| Vitest + Testing Library (jsdom) | Shares Vite's config; tests the rendered screen, not implementation details. |
| ESLint (flat config) | The project's lint gate. |

Runtime dependencies are `react` and `react-dom` only. There is no backend, no
database and no state-management library, because nothing in this build needs
one.

## Architecture

One Vite single-page application. Three layers, in dependency order:

```
src/data/     canonical case facts, the 7 agent profiles, prompt builders   <- source of truth
src/llm/      LlmClient interface, not-implemented stub, deterministic fake <- the seam for a real model
src/tribunal/ runTribunal: the 4-then-3 turn loop and the verdict parser    <- code orchestrates
src/          App.tsx + components/ render the screen and a run's results
```

```
src/
  data/
    types.ts            Verdict, Side, profiles, transcript, judge opinion, TribunalResult
    case.ts             case identity, central question, 11 canonical facts, neutral summary
    representatives.ts  the 4 representative profiles, split by side
    judges.ts           the 3 judicial reasoning profiles
    prompts.ts          buildRepresentativePrompt / buildJudgePrompt / formatTranscript
    index.ts            the public barrel — import from './data', not from the files above
  llm/
    client.ts           LlmClient interface, ChatRequest, and a stub that always rejects
    fakeClient.ts       deterministic offline client — tests and dev verification only
  tribunal/
    engine.ts           runTribunal: speaking and judging order, transcript, TribunalRunError
    verdict.ts          parseJudgeResponse / normalizeVerdict, InvalidVerdictError
    index.ts            the public barrel — import from './tribunal'
  components/           TribunalHeader, CaseSummarySection, RepresentativeSection,
                        JudgesSection, ParticipantCard, StartTribunalSection,
                        TranscriptSection, JudicialOpinionsSection
  App.tsx               composes the screen; receives its LlmClient by injection
  main.tsx              mounts it and picks the client for the build
```

`src/data` is the single source of truth. Every name, descriptor, fact and
summary on screen is read from it — no tribunal content is written into a
component, and no factual conclusion, argument or verdict is stored anywhere in
the repository.

## How the tribunal agents work, conceptually

There are seven agents: four representatives (Jon Snow and Tyrion Lannister for
the defense; Daenerys Targaryen and Grey Worm for the prosecution) and three
independent judges (the Aharon Barak, Menachem Elon and Meir Shamgar models).

An agent is not a process, a server or a framework. It is:

> **system prompt + canonical facts + current transcript → one LLM call**

`buildRepresentativePrompt(profile, transcript)` and
`buildJudgePrompt(profile, transcript)` assemble exactly that text. The intended
V1 flow is sequential: each representative speaks in turn and their answers
accumulate into a transcript; each judge then independently receives the
canonical facts, the transcript and their own reasoning profile, and returns
`JUSTIFIED` or `NOT JUSTIFIED` plus a concise reasoned opinion. The three
opinions are displayed separately — V1 has no combined or majority verdict.

Two rules are carried in the prompts themselves and enforced by tests:

- A representative's assigned side determines their **role only**. Arguments,
  agreement, disagreement and final positions are not predetermined.
- A judge's profile describes how they reason, never what they conclude.

**Core principle: code orchestrates, the LLM decides.**

## What this build does and does not do

Mission 002 adds the Tribunal Engine on top of the Mission 001 foundation. What
pressing the button does depends on which build you are looking at, so the two
are described separately.

Both builds render the first screen: the title, the case name, a neutral case
summary and the central question, both sides' representatives, and the three
judges. The canonical data and the prompt builders are complete and covered by
tests.

**A production build** (`npm run build`) is connected to a real provider.
`createLlmClient()` returns the Anthropic client, which calls the local proxy
described under [Configuration](#configuration); the proxy holds the API key in
its own process environment and the browser never sees it. If the proxy is not
running, or has no credential, `Start Tribunal` fails honestly through the
existing error state rather than fabricating a result — it never falls back to
the fake. The fake client sits behind a compile-time `import.meta.env.DEV`
branch and is not in the production bundle at all.

**A dev run** (`npm run dev`) injects `createFakeLlmClient()` so the engine can
actually be exercised. `Start Tribunal` runs `runTribunal`: the four
representatives speak in order — Jon Snow, Tyrion Lannister, Daenerys
Targaryen, Grey Worm — each given the transcript so far, then the three judges
are asked independently, and the screen renders the transcript and three
separate opinions. Every line of that content is mechanically generated
placeholder text: it is not an argument and not a finding about the case, and
the screen carries a visible dev-preview warning saying so.

Mission 003 added the real provider, behind a server-side proxy so that the API
key is never shipped to or read from the browser. There is still no combined or
majority verdict; the three opinions stand separately by design.

## Configuration

The Tribunal talks to one language model provider, Anthropic, through a small
local proxy. **The API key is read by the proxy process only and is never
exposed to the browser.**

### The variables

Copy `.env.example` for the full list. In short:

**Read by the proxy process** (`src/server/anthropicProxy.mjs`) — these must be
in the environment of the terminal you start the proxy in, and must never be
prefixed with `VITE_`, because Vite inlines every `VITE_`-prefixed variable
into the browser bundle:

| Variable | Required | Default |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | yes | none — the proxy refuses every request without it |
| `ANTHROPIC_MODEL` | no | a current small/fast Anthropic model |
| `ANTHROPIC_MAX_TOKENS` | no | `1024` |
| `ANTHROPIC_BASE_URL` | no | `https://api.anthropic.com` |
| `TRIBUNAL_PROXY_PORT` | no | `8787` |
| `TRIBUNAL_ALLOWED_ORIGINS` | no | the Vite dev and preview origins |

**Read by the browser build** — inlined into the bundle, so never a secret:
`VITE_TRIBUNAL_LLM` (which client to wire up) and `VITE_TRIBUNAL_PROXY_URL`
(where the proxy is listening; defaults to `http://localhost:8787`).

### Running it

Two terminals.

```sh
# Terminal 1 — the proxy. The key lives here and nowhere else.
ANTHROPIC_API_KEY=sk-ant-... node src/server/anthropicProxy.mjs
```

```sh
# Terminal 2 — the app. Start the key-free process from a shell that does not
# have ANTHROPIC_API_KEY set at all.
VITE_TRIBUNAL_LLM=real npm run dev     # or: npm run build && npm run preview
```

**Read that second command carefully — a plain `npm run dev` will not reach the
provider.** In dev the deterministic fake client is the default, so that a
preview costs no provider tokens. There are exactly two ways to get a real run:

| Command | Client used |
| --- | --- |
| `npm run dev` | the **fake** — mechanically generated placeholder text, with a visible dev-preview warning on screen |
| `VITE_TRIBUNAL_LLM=real npm run dev` | the real one, via the proxy |
| `npm run build && npm run preview` | the real one — a production build never contains the fake at all |

If you are performing the live acceptance run, use one of the bottom two.

The proxy prints the URL it bound to and whether a credential is present, as a
boolean:

```
The Tribunal LLM proxy is listening on http://127.0.0.1:8787/api/llm/complete
ANTHROPIC_API_KEY present: true
Model: claude-haiku-4-5-20251001; provider: https://api.anthropic.com
```

It never prints, logs, hashes or echoes the key itself — not at startup, not in
an error, not in a response. Per-request logging is limited to method, path,
status and error code; request and response bodies are never logged, because
they carry the prompts and body logging is how secrets leak by accident.

### Why two processes

The proxy is a standalone Node script rather than a Vite middleware plugin, so
running the app locally means running two processes instead of one. That is a
real cost and it is a deliberate trade:

- A Vite plugin would have to be registered in `vite.config.ts`, which puts the
  credential-handling code inside the tool that builds the browser bundle. The
  standalone script is *structurally* incapable of reaching the browser: it is
  never in the Vite module graph, so there is no bundling mistake that could
  ship it. `src/llm/secretBoundary.test.ts` enforces that boundary on every
  test run.
- It needs no build step, no transpile and no dependency — `node:http` plus the
  global `fetch` is the whole server — and it behaves identically under
  `npm run dev` and `npm run preview`, rather than only working in dev.

If the extra terminal is annoying, the two optional conveniences staged
alongside this file help: an `npm run proxy` script, and a Vite `server.proxy`
entry that forwards `/api/llm` to the proxy so the browser talks to a single
origin in dev. Both are optional; the implementation is correct without either.

### No `.env` file is needed

The proxy reads the key from its own process environment and **loads no dotenv
file**. There is nothing to create, so a real `.env` never has to exist on disk
for a live run — pass the key on the command line as above, or export it in the
shell. If you do keep one anyway, it is already ignored: the root
`.gitignore` ignores `.env` and `.env.*`, while keeping the committed
`.env.example` (variable names only) tracked.

Never commit an API key.

### Failure behaviour

The proxy never invents a reply. If the key is missing, the provider rejects the
call, the network fails, or the provider returns something unusable, it returns
a specific error code and the UI surfaces the failure through its existing error
state. It never falls back to the deterministic fake client during a real run.

## Running it locally

Requires Node.js 20.19+ or 22.12+ (developed on Node 22).

```bash
npm install     # install dependencies
npm run dev     # start the dev server, then open the URL it prints
```

Validation:

```bash
npm run lint        # eslint
npm run typecheck   # tsc -b --noEmit
npm test            # vitest run
npm run build       # tsc -b && vite build  -> dist/
npm run preview     # serve the production build from dist/
```
