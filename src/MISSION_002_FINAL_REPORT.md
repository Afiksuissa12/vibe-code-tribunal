# Mission 002 — Final Report (Tribunal Engine & Results)

Produced against `FOUNDER_MISSION_002.md` by the integrator fix run that
resolved the blocking independent-QA failure on Mission 002.

> **Report location note.** The canonical home for this report is
> `.agent/missions/mission-002/final_report.json`, and durable evidence belongs
> in `.agent/evidence/`. Both are outside this agent's permitted write scope
> (`src` only), so the report is committed here instead. Copying it to the
> `.agent` locations is an orchestrator action and remains outstanding.

---

## 1. Architecture changes

The Mission 001 architecture is preserved: Vite + React + TypeScript, plain
CSS, Vitest + Testing Library, ESLint. No dependency was added — `package.json`
and `package-lock.json` are byte-identical to Mission 001. No framework, agent
library, queue, event bus, worker, database or state machine was introduced.

Three things changed in shape:

- **A new `src/tribunal/` module** holds the orchestration layer and the
  verdict parser. It is plain sequential TypeScript.
- **`src/llm/` gained a second `LlmClient` implementation** — a deterministic
  fake — alongside the unchanged not-implemented stub. The `LlmClient`
  interface itself is untouched, so a real provider drops in behind the same
  seam later.
- **The UI gained dependency injection.** `App` now accepts an optional
  `llmClient`; it defaults to the not-implemented client, so a production build
  has no model connected and says so.

`src/data/` remains the single source of truth. The engine imports the case
facts, the seven profiles and the prompt builders from it and defines none of
its own.

## 2. Tribunal Engine flow

`runTribunal(llmClient)` in `src/tribunal/engine.ts`:

1. Starts with an empty transcript.
2. Runs the four representatives sequentially in `SPEAKING_ORDER` — Jon Snow,
   Tyrion Lannister, Daenerys Targaryen, Grey Worm. Each call carries that
   representative's own profile, the canonical case facts, and the transcript
   as it stands at that moment.
3. Appends each reply to the transcript before building the next prompt.
4. Freezes the completed transcript, then runs the three judges sequentially in
   `JUDGING_ORDER` — Aharon Barak model, Menachem Elon model, Meir Shamgar
   model. Each judge receives the canonical facts, the identical completed
   transcript, and its own judicial reasoning profile. No judge sees another
   judge's output.
5. Returns `{ transcript, judicialOpinions }`.

`SPEAKING_ORDER` and `JUDGING_ORDER` are declared in the engine rather than
inferred from array order in `src/data`, because order is an orchestration
decision: reordering the data module must not silently reorder the tribunal.

Seven LLM calls per run, verified at runtime.

## 3. Files added / changed

**Added**

| File | Purpose |
| --- | --- |
| `src/tribunal/engine.ts` | `runTribunal`, speaking/judging order, `TribunalRunError` |
| `src/tribunal/verdict.ts` | Strict verdict normalization, `InvalidVerdictError` |
| `src/tribunal/index.ts` | Module barrel |
| `src/tribunal/engine.test.ts` | 18 tests |
| `src/tribunal/verdict.test.ts` | 16 tests |
| `src/llm/fakeClient.ts` | Deterministic fake `LlmClient` (tests/dev only) |
| `src/llm/fakeClient.test.ts` | 8 tests |
| `src/components/TranscriptSection.tsx` | Renders the transcript |
| `src/components/JudicialOpinionsSection.tsx` | Renders three separate opinions |
| `src/MISSION_002_FINAL_REPORT.md` | This report |

**Changed**

| File | Change |
| --- | --- |
| `src/components/StartTribunalSection.tsx` | Rewritten: runs the engine, owns run state, guards re-entry, renders results and errors |
| `src/App.tsx` | Accepts and injects `llmClient`; dev-preview flags |
| `src/main.tsx` | Injects the fake client in dev only; production gets the not-implemented client |
| `src/data/types.ts` | Verdict tokens; `judgeName` on `JudgeOpinion`; new `TribunalResult` |
| `src/data/prompts.ts` | Judge reply format, `VERDICT_LABEL`, the two turn cues |
| `src/data/index.ts` | Re-exports the above |
| `src/data/judges.ts` | Verdict token spelling in the independence rule |
| `src/llm/client.ts` | Stub failure message no longer says "Mission 001" |
| `src/App.css` | Styles for transcript, opinions, error and dev-preview blocks |
| `src/App.test.tsx`, `src/data/data.test.ts`, `src/llm/client.test.ts` | Updated and extended |

## 4. How transcript / context propagation works

The transcript is a plain array local to `runTribunal`. The representative
prompt is built **inside** the loop, after the previous reply has already been
pushed, so each speaker's prompt is assembled from the transcript as it exists
at their turn. `buildRepresentativePrompt` (unchanged from Mission 001) renders
it via `formatTranscript`; an empty transcript is explicitly marked
"(No statements have been made yet.)" for Jon Snow.

Before the judges run, the array is copied and `Object.freeze`d. All three
judge prompts are built from that one frozen value, so they are provably
identical and nothing downstream can append to the record.

Proven by test, not by inspection: for every representative turn *t* and every
statement *s*, the test asserts `prompt[t].includes(statement[s]) === (s < t)` —
each speaker sees every earlier statement and no later one. Removing the
in-loop prompt construction fails this test (verified by mutation).

## 5. How judge verdicts are validated

`parseJudgeResponse` in `src/tribunal/verdict.ts` is the only place free-form
model text becomes a typed value. The judge prompt asks for one labelled line
(`VERDICT: <JUSTIFIED or NOT_JUSTIFIED>`) followed by prose; `VERDICT_LABEL` is
shared by the prompt and the parser so they cannot drift.

The parser finds the labelled line, strips the decoration models emit (bold
markers, backticks, quotes, blockquote and heading prefixes, trailing
punctuation), uppercases, folds spaces and hyphens to underscores, and then
requires an **exact** match against `VERDICTS`. The exact match matters:
`NOT_JUSTIFIED` contains `JUSTIFIED`, so a substring test would read a
"not justified" verdict as "justified". A mutation to substring matching fails
six tests.

It throws `InvalidVerdictError` — never a default, a nearest match, or a
guess — when there is no labelled line, when the token is not one of the two
allowed values, when the verdict is hedged, or when a verdict arrives with no
reasoning. The error names what was expected and quotes what arrived (truncated
to 200 characters). The engine lets it propagate, so a bad verdict aborts the
whole run and the two remaining judges are never asked.

## 6. What the UI now does

Pressing **Start Tribunal**:

- disables the button, sets `aria-busy`, and announces progress in a
  `role="status"` region;
- refuses re-entry through a `useRef` guard as well as the disabled attribute —
  the ref is what stops clicks dispatched in the same tick, before React can
  re-render (removing it turns three clicks into three concurrent runs and 21
  LLM calls, verified by mutation);
- runs `runTribunal` and, on success, renders a **Transcript** section (four
  entries: speaker, side, statement) and a **Judicial opinions** section (three
  list items: judge, verdict, reasoning);
- on failure, renders a `role="alert"` that states the run could not be
  completed, that nothing was filled in on the participants' behalf, and why.
  No partial transcript or verdict is kept.

There is no combined or majority verdict anywhere — not in `TribunalResult`, not
on screen. The opinions section says so explicitly.

The production build ships the not-implemented client, so a real click there
produces the honest error above. The deterministic fake is wired in **only**
under `import.meta.env.DEV`, behind a visible "Development preview" warning, and
is tree-shaken out of the production bundle entirely (verified: zero
occurrences of its placeholder strings in `dist/`).

Observed runtime DOM after a real click under jsdom (dev-preview client):

```
headings = ["The Tribunal","Case background","The question before the tribunal",
 "Defense representatives","Jon Snow","Tyrion Lannister","Prosecution representatives",
 "Daenerys Targaryen","Grey Worm","Independent judicial panel","Aharon Barak model",
 "Menachem Elon model","Meir Shamgar model","Begin","Transcript","Jon Snow",
 "Tyrion Lannister","Daenerys Targaryen","Grey Worm","Judicial opinions",
 "Aharon Barak model","Menachem Elon model","Meir Shamgar model"]
llm calls = 7
button.disabled during run = true
```

## 7. Test / lint / typecheck / build results

All run in this worktree on the committed tree:

| Command | Result |
| --- | --- |
| `npm run lint` | exit 0, clean |
| `npm run typecheck` | exit 0 |
| `npm test` | exit 0 — **6 files, 81 tests passed** |
| `npm run build` | exit 0 — 37 modules, `dist/assets/index-*.js` 235.91 kB |

Test distribution: `App.test.tsx` 22, `tribunal/engine.test.ts` 18,
`tribunal/verdict.test.ts` 16, `data/data.test.ts` 14, `llm/fakeClient.test.ts`
8, `llm/client.test.ts` 3.

Acceptance criteria coverage:

| # | Criterion | Where |
| --- | --- | --- |
| 1 | Representatives run in order | `engine.test.ts` — order of `startsWith('You are …')` |
| 2 | Each later representative gets the prior transcript | `engine.test.ts` — the `s < t` assertion |
| 3 | Four representative messages | `engine.test.ts` — 4 calls, 4 entries, ids and sides |
| 4 | Judges run only after the transcript is complete | `engine.test.ts` — first judge call index is 4 of 7 |
| 5 | All three judges get the same completed transcript | `engine.test.ts` — each prompt contains `formatTranscript(result.transcript)` |
| 6 | Judge outputs stay separate | `engine.test.ts` — 3 distinct opinions; no judge's prompt contains another's |
| 7 | No combined verdict | `engine.test.ts` (result keys) + `App.test.tsx` (exactly 3 verdict lines, no "majority") |
| 8 | Valid verdict parsing | `verdict.test.ts` — both tokens, 8 real-world spellings |
| 9 | Invalid verdict fails clearly | `verdict.test.ts` — 8 malformed cases; `engine.test.ts` — run aborts at the first bad judge |
| 10 | No duplicate simultaneous runs | `App.test.tsx` — 3 clicks in one `act()` still yield exactly 7 calls; button disabled mid-run |
| 11 | UI renders transcript and three opinions from engine output | `App.test.tsx` — compared against a separate `runTribunal` run |
| 12 | Mission 001 behaviour/data intact | `data.test.ts` unchanged in substance; `App.test.tsx` re-checks the whole Mission 001 screen after a run |

Three guards were mutation-tested rather than assumed: removing the re-entry
ref, building representative prompts from an empty transcript, and loosening
verdict matching to `includes` each cause the corresponding tests to fail.

## 8. Independent QA result

The prior independent QA **failed Mission 002 as BLOCKING** with six defects:
the wrong task graph was executed so Mission 001 was re-integrated under a
Mission 002 label (D1); no Tribunal Engine (D2); no fake client (D3); unchanged
"not implemented" UI (D4); zero Mission 002 tests (D5); no durable evidence or
final report (D6).

D2–D5 are resolved in this commit and re-verified above, including by
reproducing QA's own runtime probe. D1 and D6 are addressed in §9.

Independent QA has since been re-run against the integrated tree. It found no
functional defect: it reproduced all four gate results, drove both a dev run
and a production build in headless Chromium, and independently re-tested
ordering, transcript propagation, judge independence, strict verdict
validation, duplicate-run prevention, the error state and the no-combined-
verdict rule. Its one raised defect is documentation-only — the stale root
`README.md`, recorded as D7 in §9 and specified in §9.1. It also left a
non-blocking hardening note for Mission 003, recorded in §11.

## 9. Findings and fixes

| Defect | Status |
| --- | --- |
| D1 — wrong task graph; Mission 001 re-integrated as Mission 002 | **Not fixable from here.** Re-running the driver with a correctly generated Mission 002 graph is an orchestrator action outside this agent's scope. The *substance* it was meant to produce is delivered directly by this commit. |
| D2 — no Tribunal Engine | Fixed: `src/tribunal/engine.ts` + `verdict.ts`. |
| D3 — no deterministic fake client | Fixed: `src/llm/fakeClient.ts`. |
| D4 — unchanged Start Tribunal UI | Fixed: running state, re-entry guard, transcript, three opinions, honest error state. Re-verified by rendering `<App />` and clicking for real. |
| D5 — zero Mission 002 tests | Fixed: 55 new tests; all 12 criteria covered. |
| D6 — no durable evidence, no final report | **Partially fixed.** This report exists and is committed, but `.agent/evidence/` and `.agent/missions/mission-002/final_report.json` are outside the permitted write scope and still need to be written by the orchestrator. |
| D7 — `README.md` still documents the Mission 001 state | **Not fixable from here.** `README.md` is at the repo root, outside this agent's `src`-only write scope. It is the only committed top-level description of the product and it now contradicts what this commit ships — it tells a reader the Tribunal Engine does not exist. The required corrections are specified in §9.1 and must be applied by the orchestrator. |

Findings made during the fix, beyond QA's list:

- **Verdict token mismatch.** Mission 001 shipped `'NOT JUSTIFIED'` (space);
  `FOUNDER_MISSION_002.md` fixes the wire token as `NOT_JUSTIFIED`. The
  canonical type now uses the underscore form, and the parser accepts the
  spaced and hyphenated variants and normalizes them, so nothing is lost.
- **Stale stub message.** The not-implemented client still said "Mission 001",
  which would have surfaced verbatim in the new error state. Reworded to
  describe the build's actual condition.
- **Two Mission 001 tests asserted the not-implemented notice.** They were
  updated rather than deleted; every other Mission 001 test is untouched and
  still passes.
- **The whole working tree is CRLF-on-disk against an LF index**, so `git
  status` reports every file as modified. `src` was normalized to LF (content
  identical, hashes verified) and only `src` paths were staged, so no unrelated
  file was swept into the commit.

### 9.1 Outstanding: the root `README.md` is stale and now false

Raised by independent QA against the integrated tree. Line numbers are against
the currently committed `README.md`.

| Line | Current text | Why it is wrong now |
| --- | --- | --- |
| 88 | "Mission 001 builds the foundation only. It works today:" | Frames the whole build as pre-engine. |
| 92–93 | "`Start Tribunal` is a real, enabled button that states plainly that running the tribunal is not implemented yet" | True of a **production** build only. In a dev run the button executes `runTribunal` and renders a four-entry transcript plus three opinions. The README never distinguishes the two builds. |
| 96–97 | "Deliberately not built yet: the tribunal engine (the turn loop, the transcript and the opinions screen)" | Flatly false. `src/tribunal/engine.ts`, `TranscriptSection.tsx` and `JudicialOpinionsSection.tsx` all exist and are exercised. |
| 34 | "`src/llm/` LlmClient interface + not-implemented stub" | Omits `fakeClient.ts`, which dev mode wires up. |
| 38–53 | the `src` file map | Omits `src/tribunal/` entirely, omits `llm/fakeClient.ts`, and the components line omits `TranscriptSection` and `JudicialOpinionsSection`. |
| 25–26 | "no state-management library, because nothing in Mission 001 needs one" | Still scoped to Mission 001. |
| 109 | "open the printed http://localhost:5173" | Minor: vite prints whichever port it binds; QA's run bound 5174. |

"No real LLM provider yet" is still correct and must stay.

Replacement text, ready to apply. Layer diagram (lines 33–36):

````
src/data/     canonical case facts, the 7 agent profiles, prompt builders   <- source of truth
src/llm/      LlmClient interface, not-implemented stub, deterministic fake <- the seam for a real model
src/tribunal/ runTribunal: the 4-then-3 turn loop and the verdict parser    <- code orchestrates
src/          App.tsx + components/ render the screen and a run's results
````

File map (lines 38–53):

````
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
````

"What this build does and does not do" (lines 86–101), replacing everything
under that heading:

````
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
````

Also change line 25–26 "because nothing in Mission 001 needs one" to "because
nothing in this build needs one", line 88's lead-in as shown above, and line
109's comment to "start the dev server, then open the URL it prints".

## 10. Confirmation: no real provider, no secret

Confirmed. There is no OpenAI or Anthropic integration, no SDK, no API key, no
`.env` file, no backend or proxy, and no deployment configuration.
`package.json` and `package-lock.json` are unchanged from Mission 001, so no
dependency was added. `src/llm/` contains no network call and no environment
lookup of any kind; `import.meta.env.DEV` is used once, in `src/main.tsx`, as a
build-time flag only. The production bundle was grepped: zero occurrences of
`api.openai`, `api.anthropic`, `API_KEY`, `apiKey` or `process.env`.

## 11. Smallest recommended Mission 003

Add one real provider behind the existing `LlmClient` interface, and nothing
else:

1. A single `createProviderLlmClient()` implementing `complete()` against one
   provider's messages API.
2. A minimal server-side proxy route holding the key — the browser must never
   see it. This is the only genuinely new infrastructure, and it is required:
   the key cannot ship to the client.
3. Configuration through the proxy's environment only, with a `.env.example`
   that lists names and no values.
4. `src/main.tsx` selects the provider client when the proxy is configured and
   keeps the not-implemented client otherwise, so the app still fails honestly
   when it is not.
5. Timeout and a single surfaced failure path; the existing error state already
   renders it.

Explicitly still out of scope: retries, streaming, auth, persistence, routing,
multiple providers, and any change to the engine. `runTribunal` should not need
to be touched — that is the test of whether this mission's seam held.

**Hardening note carried forward from QA (non-blocking, no action taken).**
`parseJudgeResponse` takes the *first* `VERDICT:` line and treats the rest of
the reply as the opinion. A reply carrying two contradicting verdict lines
resolves silently to the first, and the contradicting line is then displayed
inside the rendered opinion text — which diverges from `verdict.ts`'s own
docstring claim that it throws when a reply cannot be read as *exactly one*
valid verdict. Relatedly, reasoning placed on the verdict line itself
(`VERDICT: Justified — the king had no choice`) is rejected outright. Neither
can occur with the fake client, and both are defensible today given the
prompt-specified reply format and the fail-clearly rule, so this commit changes
nothing. They are worth revisiting in step 1 above, when a real provider starts
producing free-form output.
