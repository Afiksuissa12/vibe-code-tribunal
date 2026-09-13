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

Runtime dependencies are `react` and `react-dom` only. There is no database and
no state-management library, because nothing in this build needs one. The one
server-side piece is a standalone Node script — `node:http` plus the global
`fetch`, no framework and no provider SDK — that holds the provider credential.

## Architecture

One Vite single-page application, plus a small local proxy. Four layers, in
dependency order:

```
src/data/     canonical case facts, the 7 agent profiles, prompt builders   <- source of truth
src/llm/      LlmClient interface, real proxy adapter, deterministic fake   <- the seam for a real model
src/tribunal/ runTribunal: the 4-then-3 turn loop and the verdict parser    <- code orchestrates
src/          App.tsx + components/ render the screen and a run's results
src/server/   the credential-holding proxy — never in the browser bundle
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
    client.ts           LlmClient interface, ChatRequest, createLlmClient (returns the real one)
    anthropicClient.ts  the real client — HTTP to the local proxy, no key and no SDK
    proxyContract.ts    the request/response shape the browser and the proxy share
    fakeClient.ts       deterministic offline client — tests and dev preview only
    secretBoundary.test.ts  standing guard: no credential, provider host or process.env under src/
  tribunal/
    engine.ts           runTribunal: speaking and judging order, transcript, TribunalRunError
    verdict.ts          parseJudgeResponse / normalizeVerdict, InvalidVerdictError
    index.ts            the public barrel — import from './tribunal'
  components/           TribunalHeader, CaseSummarySection, RepresentativeSection,
                        JudgesSection, ParticipantCard, StartTribunalSection,
                        TranscriptSection, JudicialOpinionsSection
  server/
    anthropicProxy.mjs  the local proxy: holds ANTHROPIC_API_KEY, calls the provider
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
`buildJudgePrompt(profile, transcript)` assemble exactly that text. The flow is
sequential: each representative speaks in turn and their answers accumulate into
a transcript; each judge then independently receives the canonical facts, the
transcript and their own reasoning profile, and returns `JUSTIFIED` or
`NOT JUSTIFIED` plus a concise reasoned opinion. The three opinions are
displayed separately — there is no combined or majority verdict.

Two rules are carried in the prompts themselves and enforced by tests:

- A representative's assigned side determines their **role only**. Arguments,
  agreement, disagreement and final positions are not predetermined.
- A judge's profile describes how they reason, never what they conclude.

**Core principle: code orchestrates, the LLM decides.**

## Configuration

The Tribunal talks to one language-model provider, Anthropic, through a small
local proxy. **`ANTHROPIC_API_KEY` is read by the proxy process only and is
never exposed to the browser.**

The variable must never be given a `VITE_` prefix: Vite inlines every
`VITE_`-prefixed value into the browser bundle, which would publish the key to
anyone who loads the page. The proxy is a standalone script that nothing in the
Vite module graph imports, so the credential is structurally unable to reach the
bundle — and `src/llm/secretBoundary.test.ts` fails the build if any
browser-facing file so much as names it.

[`.env.example`](.env.example) lists every variable, names only. In short:

**Read by the proxy process** (`src/server/anthropicProxy.mjs`) — set these in
the environment of the terminal you start the proxy in:

| Variable | Required | Default |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | yes | none — the proxy refuses every request without it |
| `ANTHROPIC_MODEL` | no | `claude-haiku-4-5-20251001` |
| `ANTHROPIC_MAX_TOKENS` | no | `1024` |
| `ANTHROPIC_BASE_URL` | no | `https://api.anthropic.com` |
| `TRIBUNAL_PROXY_PORT` | no | `8787` |
| `TRIBUNAL_ALLOWED_ORIGINS` | no | the Vite dev (`:5173`) and preview (`:4173`) origins |

**Read by the browser build** — inlined into the bundle, so never a secret:
`VITE_TRIBUNAL_LLM` (which client to wire up) and `VITE_TRIBUNAL_PROXY_URL`
(where the proxy is listening; defaults to `http://localhost:8787`).

No `.env` file is required: the proxy loads no dotenv file and reads the key
from its own process environment, so you can pass it on the command line or
export it in your shell. If you do create one anyway, `.env` and `.env.*` are
gitignored — only the names-only `.env.example` is tracked. Never commit an API
key.

[`src/mission-003/README.md`](src/mission-003/README.md) is the full operator
guide: startup, the live acceptance run, a token-free rehearsal, and what each
failure mode looks like.

## What this build does and does not do

The screen renders the title, the case name, a neutral case summary and the
central question, both sides' representatives, and the three judges. The
canonical data and the prompt builders are complete and covered by tests.

Pressing `Start Tribunal` runs `runTribunal`: the four representatives speak in
order — Jon Snow, Tyrion Lannister, Daenerys Targaryen, Grey Worm — each given
the transcript so far, then the three judges are asked independently, and the
screen renders the transcript and three separate opinions. Seven LLM calls.

Which model answers those seven calls depends on the build:

**A production build** (`npm run build`, `npm run preview`) is always real.
`createLlmClient()` returns the proxy-backed Anthropic client, so the run needs
the proxy up with a valid key. The fake client sits behind a compile-time
`import.meta.env.DEV` branch and is not in the production bundle at all.

**A dev run** (`npm run dev`) uses the deterministic fake by default, so a
preview costs no provider tokens. Its content is mechanically generated
placeholder text — not an argument and not a finding about the case — and the
screen carries a visible dev-preview warning saying so. Pass
`VITE_TRIBUNAL_LLM=real` to use the real provider in dev instead.

Nothing ever falls back to the fake during a real run. If the proxy is down, the
key is missing or the provider rejects the call, the run fails and the UI says
why; a judge reply that cannot be parsed raises `InvalidVerdictError` and aborts
rather than inventing a verdict.

Still not built: there is no combined or majority verdict — the three opinions
stand separately by design — and no persistence, accounts or history.

## Running it locally

Requires Node.js 20.19+ or 22.12+ (developed on Node 22).

```bash
npm install     # install dependencies
```

A real run needs **two processes**. The key lives in the first one and nowhere
else.

```bash
# Terminal 1 — the proxy.
ANTHROPIC_API_KEY=sk-ant-... node src/server/anthropicProxy.mjs
```

```bash
# Terminal 2 — the app. Start it from a shell that does NOT have
# ANTHROPIC_API_KEY set; the browser never needs it.
VITE_TRIBUNAL_LLM=real npm run dev    # or: npm run build && npm run preview
```

`npm run preview` serves a production build, which is real already and needs no
flag. Plain `npm run dev` gives the deterministic fake preview and needs no
proxy.

The proxy prints the URL it bound to and whether a credential is present, as a
boolean — never the key itself:

```
The Tribunal LLM proxy is listening on http://127.0.0.1:8787/api/llm/complete
ANTHROPIC_API_KEY present: true
Model: claude-haiku-4-5-20251001; provider: https://api.anthropic.com
```

Validation:

```bash
npm run lint        # eslint
npm run typecheck   # tsc -b --noEmit
npm test            # vitest run
npm run build       # tsc -b && vite build  -> dist/
npm run preview     # serve the production build from dist/
```
