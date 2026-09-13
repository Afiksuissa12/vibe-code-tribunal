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

**A production build** (`npm run build`) has no model connected.
`createLlmClient()` returns a stub that rejects with `LlmNotImplementedError`,
so `Start Tribunal` fails honestly — it says that no language model is
connected to this build — rather than fabricating a result. The fake client
below sits behind a compile-time `import.meta.env.DEV` branch and is not in the
production bundle at all.

**A dev run** (`npm run dev`) injects `createFakeLlmClient()` so the engine can
actually be exercised. `Start Tribunal` runs `runTribunal`: the four
representatives speak in order — Jon Snow, Tyrion Lannister, Daenerys
Targaryen, Grey Worm — each given the transcript so far, then the three judges
are asked independently, and the screen renders the transcript and three
separate opinions. Every line of that content is mechanically generated
placeholder text: it is not an argument and not a finding about the case, and
the screen carries a visible dev-preview warning saying so.

Still not built: any real LLM provider. When one arrives it must sit behind a
server-side proxy — a provider API key must never be shipped to or read from
the browser. There is still no combined or majority verdict; the three opinions
stand separately by design.

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
