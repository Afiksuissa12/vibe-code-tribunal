# Mission 004 — Final Mission Report

**The Tribunal — final polish, documentation, evidence and submission readiness.**

| | |
| --- | --- |
| Written by | `mission-004-AUTO-QA-FINAL` — independent QA and final reporter |
| Integration base | commit `6492bf9` (all three Mission 004 task branches landed) |
| Branch | `task/mission-004-AUTO-QA-FINAL` |
| Date | 2026-09-13 |
| Environment | Node v22.14.0, npm 10.9.2, Linux (WSL2), Chromium 151.0.7922.169 |
| **Real Anthropic tokens spent by this task** | **Zero.** `ANTHROPIC_API_KEY` was never set in any shell in this environment, and every check below was designed around that. |

This task ran last and deliberately **verified the other three tasks' claims
rather than trusting their reports**. Where a claim reproduced, it is marked as
independently confirmed. Where it did not, it is a numbered finding in point 9.

---

## 1. Final project status

**Complete, validated and ready for academic submission.**

The Tribunal is a single-page React application that stages a fictional legal
hearing over *The Realm v. Jon Snow*. Four representatives argue the case in
sequence, each receiving the transcript of everyone who spoke before them; the
transcript is then frozen and three judges — each with a different reasoning
methodology — produce three separate opinions. There is no combined verdict, by
design. One run is exactly seven sequential LLM calls.

Missions 001–003 built and validated the product, including a real live
seven-call run against the Anthropic API. Mission 004 added no product scope. It
performed a repository and code review, finalized four root documents, and
closed with this independent QA pass.

State at the end of this mission:

- `npm run lint`, `npm run typecheck`, `npm test` (203 tests, 13 files) and
  `npm run build` all pass — verified twice, once in this worktree and once in a
  **fresh clean checkout** with a fresh `npm install`.
- A token-free browser smoke test passed in dev fake-client mode **and** the
  production build was verified through `npm run preview`.
- The final security check passed on every criterion, evidenced without printing
  any secret value.
- Ten QA findings were raised. **Ten are resolved.** None is left unresolved.
- The git working tree is clean and all work is committed.

The only item that remains genuinely open is external to the repository: the
course's own submission requirements are unknown (point 13). That is not a
product blocker and no further development mission is proposed (point 16).

---

## 2. Final stack

Exactly what is used, nothing aspirational. Runtime dependencies are **two**.

| Layer | Choice | Version |
| --- | --- | --- |
| UI | React + React DOM — the only runtime dependencies | `^19.2.8` |
| Language | TypeScript, strict | `~6.0.2` |
| Build / dev server | Vite | `^8.3.0` |
| Tests | Vitest on jsdom, with Testing Library (`react`, `dom`, `jest-dom`) | Vitest `^5.0.0`, jsdom `^29.1.1` |
| Lint | ESLint flat config + `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh` | ESLint `^10.10.0` |
| Styling | Plain CSS with custom properties | — |
| Server | `src/server/anthropicProxy.mjs` — standalone Node ESM script, `node:http` + `node:url` + global `fetch`, **zero third-party dependencies** | — |
| Runtime floor | Node.js 22.12+ (Vite needs 20.19+, Vitest needs 22.12+) | developed on 22.14.0 |

There is no backend framework, no database, no ORM, no state-management
library, no CSS framework, no component library, no agent framework and no
deployment tooling. `npm install` in a clean checkout adds **237 packages, 0
vulnerabilities**.

---

## 3. Final architecture

One Vite single-page application, plus one standalone Node process that holds
the provider credential. Nothing else runs.

```
src/
  data/         canonical case, the 7 agent profiles, prompt builders  <- source of truth
  llm/          LlmClient seam: real proxy client, deterministic fake, wire contract
  tribunal/     runTribunal (the 4-then-3 loop) and the verdict parser  <- code orchestrates
  components/   the screen, section by section (8 presentational sections)
  server/       anthropicProxy.mjs — the only code that sees the key
  mission-003/  preserved validation evidence, QA reports and the e2e harness
  mission-004/  the final repository/code review notes
  App.tsx       composes the screen; receives its LlmClient by injection
  main.tsx      mounts it and picks the client for the build
```

Dependency direction is one-way — `components → tribunal → llm → data` — and
nothing in the browser tree imports `src/server/`. A test enforces both.

```
Browser (Vite bundle)                    Node process
──────────────────────                   ─────────────────────────────
App.tsx / runTribunal                    anthropicProxy.mjs
  └─ anthropicClient.ts                    ├─ holds ANTHROPIC_API_KEY
       │  no secret, no provider host      ├─ binds 127.0.0.1 only
       │                                   └─ sends x-api-key ──▶ Anthropic
       └── POST /api/llm/complete ────────▶
```

`ARCHITECTURE.md` is the one-page module-level document; it covers all nine
topics the brief requires — core modules, the Tribunal Engine, the `LlmClient`
abstraction, the fake client, the real Anthropic client, the local proxy,
transcript flow, judge execution and the security boundary.

---

## 4. Main user flow

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

1. The first screen renders `The Tribunal` / `The Realm v. Jon Snow`, a neutral
   **Case background** paragraph, the central question with its four
   considerations, **Defense representatives** (Jon Snow, Tyrion Lannister),
   **Prosecution representatives** (Daenerys Targaryen, Grey Worm), the
   **Independent judicial panel** (Aharon Barak model, Menachem Elon model, Meir
   Shamgar model), and a **Begin** section with one `Start Tribunal` button.
2. Pressing the button disables it, sets `aria-busy`, and shows one fixed
   `role="status"` notice. A `useRef` guard prevents a double click starting a
   second concurrent run.
3. Four representative calls run in `SPEAKING_ORDER`. Each prompt is rebuilt
   *inside* the loop after the previous reply was appended, so speaker *n*
   genuinely receives speakers *1…n−1*.
4. `Object.freeze([...transcript])` — the record is final before any judge runs.
5. Three judge calls run in `JUDGING_ORDER`. Each prompt is the frozen
   transcript plus that judge's own profile and nothing else.
6. A **Transcript** section and a **Judicial opinions** section appear. The
   opinions carry a lead-in stating they are *not combined into a single
   verdict*, and the page ends after the third opinion.
7. If anything fails, the run produces **no partial result**: a `role="alert"`
   message leads with *"The tribunal could not be completed, so no transcript or
   verdict is shown."* and then quotes the underlying cause verbatim. It never
   falls back to the fake client.

All seven steps were observed in a real browser during this QA pass (point 9).

---

## 5. Multi-agent design

Seven agents per run. An "agent" here is one LLM call made with a system prompt
built from a fixed profile, the canonical case facts, and the transcript so far
— not a process, a server or a framework. The academic point rests on three
properties, each verified in `src/data/` during this pass:

- **A representative's side fixes their role only.** Every representative prompt
  carries `SIDE_IS_ROLE_ONLY_RULE` (`src/data/representatives.ts`), which tells
  the model its factual conclusions, specific arguments, agreement, disagreement
  and final position are its own, and that it may concede a difficult fact or
  revise its view.
- **The three judges reason by different methodologies.** Their profiles
  (`src/data/judges.ts`) describe *how* each reasons — `Systematic,
  rights-centered and principle-driven.` / `Tradition-minded, historical and
  cautious about excessive judicial power.` / `Institutional, restrained,
  practical and fact-focused.` — and each ends with an explicit instruction not
  to predefine the conclusion.
- **Judge outcomes are not hard-coded.** No verdict is stored anywhere in the
  repository. The application constrains the *vocabulary* to `JUSTIFIED` and
  `NOT_JUSTIFIED` and validates membership; it has no influence on which.

Two things the design deliberately does **not** do, stated so the documentation
never over-claims:

- The judges do **not** run in parallel or in separate processes. They are three
  calls in a sequential `for` loop in one process. *Independent* means **isolated
  context** — no judge is ever shown another judge's opinion.
- The representatives do **not** talk to each other. There is no agent-to-agent
  messaging; a later speaker simply receives the earlier text as prompt context.

### Code orchestrates. The LLM decides.

| Deterministic application code | LLM-generated content |
| --- | --- |
| Participant identity and profiles; canonical facts and the central question; speaking and judging order; prompt assembly; context delivery; transcript accumulation and freezing; judge isolation; verdict validation; empty-reply and failure handling; request validation, origin guard, body cap, redaction; UI state; rendering | Each representative's entire statement; each judge's verdict token; each judge's entire reasoned opinion |

The single point where model output crosses into the typed domain is
`parseJudgeResponse` (`src/tribunal/verdict.ts`), and it refuses rather than
guesses. `TribunalResult` has exactly two fields, `transcript` and
`judicialOpinions` — **there is no field for a combined verdict to live in.**

---

## 6. Real provider integration

Real Anthropic access exists and is validated. It runs entirely server-side.

- **Where:** `src/server/anthropicProxy.mjs`, started with
  `node src/server/anthropicProxy.mjs`. It binds `127.0.0.1` only and exposes
  one endpoint, `POST /api/llm/complete`.
- **What it calls:** `${ANTHROPIC_BASE_URL}/v1/messages` with an `x-api-key`
  header and an `anthropic-version` header, under a 120 s timeout. Default model
  is pinned to `claude-haiku-4-5-20251001`; default output cap 1024 tokens.
- **What the browser knows:** nothing about the provider.
  `src/llm/anthropicClient.ts` POSTs `{ systemPrompt, messages }` to
  `/api/llm/complete` on the proxy origin and returns the text **exactly as it
  arrived, untrimmed and uninspected**, so a malformed real reply fails at
  `parseJudgeResponse` rather than being quietly tidied up.
- **Configuration is exactly six environment variables**, read by `readConfig()`
  from an injected environment object: `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`,
  `ANTHROPIC_MAX_TOKENS`, `ANTHROPIC_BASE_URL`, `TRIBUNAL_PROXY_PORT`,
  `TRIBUNAL_ALLOWED_ORIGINS`. Independently confirmed: those are the only
  `env.*` reads anywhere in the file.
- **Honest failure:** seven error codes, no retry, no backoff, no cache, no
  streaming, and no fallback to the fake client under any circumstance.

**Mission 003's validated real live run is preserved and is the record of
real-provider behaviour**: exactly 7/7 real Anthropic calls, correct order, real
context propagation, all three judges reasoning separately, no fake-client
output, no secret exposed, 20–30 s end to end. The evidence is intact and
untouched in `src/mission-003/evidence/` (eight files).

**No additional real seven-call Tribunal run was consumed by this mission, and
none was required.** The narrow exception in the mission spec did not apply. The
complete source diff for Mission 004 (`git diff 83ecd1e..HEAD`) touches exactly
two source files, and both changes are **comment text only**:

```
 ARCHITECTURE.md                      | 259 ++++++++++++++++
 DEMO_WALKTHROUGH.md                  | 262 +++++++++++++++++
 FOUNDER_MISSION_004.md               | 205 +++++++++++++
 README.md                            | 551 +++++++++++++++++++++++------------
 SUBMISSION_CHECKLIST.md              | 245 ++++++++++++++++
 src/components/JudgesSection.tsx     |   5 +-
 src/llm/fakeClient.ts                |   4 +-
 src/mission-004/CODE_REVIEW_NOTES.md | 419 ++++++++++++++++++++++++++
 8 files changed, 1762 insertions(+), 188 deletions(-)
```

`git diff 83ecd1e..HEAD -- src/server/ src/tribunal/` is **empty**. No provider,
security or orchestration code changed. My own changes in this task are three
documentation files and this report. Mission 003's evidence therefore stands,
and spending tokens to re-earn it would have been waste.

I verified the real-client path anyway, **token-free** — see point 9, finding
method (c).

---

## 7. Security model

The requirement is that the provider credential never reaches the browser, and
the design makes that **structurally** true rather than a matter of discipline.

| Control | Where | Independently re-verified |
| --- | --- | --- |
| The credential exists in exactly one process, and its file is never imported by anything in the Vite module graph | `src/server/anthropicProxy.mjs` | Yes — nothing outside `src/server/` imports it, and the built bundle contains no provider string |
| The browser client holds no secret, reads no environment secret, sends no auth header and knows no provider hostname | `src/llm/anthropicClient.ts` | Yes — grep over the whole browser tree returns zero hits for `ANTHROPIC_API_KEY`, `x-api-key`, `api.anthropic.com`, `process.env`, `CLAUDE_CODE_OAUTH_TOKEN` |
| A standing guard, not a one-off audit — walks every file under `src/` outside `src/server/` and `src/mission-003/`, fails on any of five forbidden tokens, and fails if the walk finds nothing | `src/llm/secretBoundary.test.ts` (7 tests) | Yes — runs on every `npm test`; it also covers the new `src/mission-004/` directory |
| Proxy binds `127.0.0.1` only, never `0.0.0.0` | `anthropicProxy.mjs` startup | Yes — observed on a live start |
| Origin guard refuses a browser `Origin` outside the allow-list **at the server**, so a disallowed page cannot even spend the operator's tokens | `handleRequest` | Yes — a live preview-origin request was accepted; 10 dedicated tests cover the refusal path |
| 1 MiB body cap enforced **while reading the socket**, before validation | `readBody` | Yes — covered by the proxy test suite |
| Logging is method, path, status and error code only — never bodies (they carry the prompts), never any part of the key; startup reports credential presence as a **boolean** | `createRequestListener`, `startProxy` | Yes — observed live (log quoted in point 9) |
| Every outgoing response body is scanned and the key redacted before it is written | `redactSecret` | Yes — covered by tests |
| `VITE_`-prefixed variables are inlined into the bundle at build time and are public by definition; the only two used are a mode flag and a URL | `main.tsx`, `proxyContract.ts` | Yes |

`ANTHROPIC_API_KEY` is this product's only credential.
`CLAUDE_CODE_OAUTH_TOKEN` belongs to the AutonomousDevTeam development runtime
that built the project, is unrelated to The Tribunal, is never read by the
browser code, the proxy or the tests, and is not in `.env.example`. The
distinction is stated explicitly in `README.md` and in the proxy's own
`readConfig()` comment.

---

## 8. Final automated validation results

Real captured output. Two independent runs.

### 8a. Clean checkout — `git archive HEAD` into an empty directory, fresh `npm install`

```
$ npm install
added 237 packages, and audited 238 packages in 3s

56 packages are looking for funding
  run `npm fund` for details

found 0 vulnerabilities
INSTALL_EXIT=0
```

```
######## npm run lint ########

> the-tribunal@0.1.0 lint
> eslint .

EXIT=0

######## npm run typecheck ########

> the-tribunal@0.1.0 typecheck
> tsc -b --noEmit

EXIT=0

######## npm test ########

> the-tribunal@0.1.0 test
> vitest run


 RUN  v5.0.0 /tmp/tribunal-clean


 Test Files  13 passed (13)
      Tests  203 passed (203)
   Start at  14:04:30
   Duration  1.30s (environment 62%, setup 15%, tests 10%, transform 9%, import 3%, worker 1%)

EXIT=0

######## npm run build ########

> the-tribunal@0.1.0 build
> tsc -b && vite build

vite v8.3.0 building client environment for production...
transforming...
✓ 39 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   0.39 kB │ gzip:  0.26 kB
dist/assets/index-BRDnka0L.css    3.32 kB │ gzip:  1.04 kB
dist/assets/index-CbEEZ_qV.js   238.47 kB │ gzip: 75.30 kB

✓ built in 103ms
EXIT=0
```

### 8b. Revalidation in the working tree, **after** this task's documentation fixes

```
######## npm run lint ########

> the-tribunal@0.1.0 lint
> eslint .

EXIT=0

######## npm run typecheck ########

> the-tribunal@0.1.0 typecheck
> tsc -b --noEmit

EXIT=0

######## npm test ########

> the-tribunal@0.1.0 test
> vitest run


 RUN  v5.0.0 /workspace/.worktrees/mission-004-AUTO-QA-FINAL


 Test Files  13 passed (13)
      Tests  203 passed (203)
   Start at  14:08:27
   Duration  44.20s (environment 78%, setup 19%, transform 1%, worker 1%, import 1%)

EXIT=0

######## npm run build ########

> the-tribunal@0.1.0 build
> tsc -b && vite build

vite v8.3.0 building client environment for production...
transforming...
✓ 39 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   0.40 kB │ gzip:  0.27 kB
dist/assets/index-BRDnka0L.css    3.32 kB │ gzip:  1.04 kB
dist/assets/index-CbEEZ_qV.js   238.47 kB │ gzip: 75.30 kB

✓ built in 311ms
EXIT=0
```

> The 1.30 s vs 44.20 s test duration is a filesystem difference, not a
> behavioural one: the worktree sits on a Windows-backed mount and the clean
> checkout on native disk. Identical results — 13 files, 203 tests, 0 failures.
> The 0.39 kB vs 0.40 kB `index.html` is the CRLF line endings in the worktree's
> `index.html`; the JS and CSS assets are byte-identical (same content hashes).

### 8c. Per-file test distribution (real output, `vitest --reporter=json`)

```
51 src/server/anthropicProxy.test.mjs
27 src/llm/anthropicClient.test.ts
24 src/App.test.tsx
18 src/tribunal/engine.test.ts
16 src/tribunal/verdict.test.ts
14 src/data/data.test.ts
12 src/llm/proxyContract.test.ts
10 src/mission-003/qa.originGuard.test.ts
 8 src/llm/fakeClient.test.ts
 8 src/mission-003/e2e/tribunal.e2e.test.ts
 7 src/llm/secretBoundary.test.ts
 5 src/llm/client.test.ts
 3 src/mission-003/qa.keyMaterial.test.ts
TOTAL 203 files 13
```

No test makes a paid provider call. The end-to-end test spawns the real proxy as
a real child process on a real loopback socket and substitutes only Anthropic
itself, via the proxy's own `ANTHROPIC_BASE_URL` override, with a local stub.

---

## 9. Independent QA result

**PASS.** Ten findings raised, ten resolved, none left open.

### (a) Browser smoke test — dev fake-client mode, token-free

Driven in real headless Chromium 151.0.7922.169 over the DevTools Protocol
against `npm run dev` on `http://localhost:5173/`.

First screen, confirmed present and in this order:

```
H1: The Tribunal            (+ case line "The Realm v. Jon Snow")
H2: Case background         (neutral summary, opening verbatim from CASE_SUMMARY)
H3: The question before the tribunal   (+ "Considering:" list of four)
H2: Defense representatives      H3: Jon Snow        H3: Tyrion Lannister
H2: Prosecution representatives  H3: Daenerys Targaryen   H3: Grey Worm
H2: Independent judicial panel   H3: Aharon Barak model
                                 H3: Menachem Elon model
                                 H3: Meir Shamgar model
H2: Begin                   (single button: "Start Tribunal")
```

The neutral case summary and the central question both rendered, and the central
question matched `CENTRAL_QUESTION.question` in `src/data/case.ts`
character-for-character. The dev-preview warning was present, as it must be when
the fake is wired up.

After clicking `Start Tribunal`, the full flow ran to completion:

```
settled:            "complete"
status line:        "The tribunal has finished. The transcript and the three
                     judicial opinions are below."
new sections:       Transcript, Judicial opinions
verdict lines:      ["Verdict: Justified", "Verdict: Justified", "Verdict: Justified"]
verdictCount:       3
opinion order:      Aharon Barak model → Menachem Elon model → Meir Shamgar model
speaker order:      Jon Snow → Tyrion Lannister → Daenerys Targaryen → Grey Worm
notCombinedLeadIn:  true   ("not combined into a single verdict")
hasMajorityWord:    false
hasTribunalFinds:   false
placeholderCount:   7      (4 statements + 3 opinions, all "[deterministic test client]")
page tail:          ends after the third opinion
```

Every network request the page made went to `http://localhost:5173/`. **Zero
external requests, zero tokens.** (The three identical `Justified` verdicts are
the fake client's deterministic hash buckets, explicitly not a finding about the
case — the placeholder text says so on screen.)

### (b) Browser smoke test — production build via `npm run preview`, token-free

`npm run build && npm run preview` served `http://localhost:4173/`. The identical
first screen rendered, with one deliberate difference: **`devPreviewNotice:
false`** — the fake client is compiled out of a production bundle, so the warning
is correctly absent.

To prove the production build really drives the **real** client without spending
anything, I started the proxy with **no `ANTHROPIC_API_KEY`** and clicked
`Start Tribunal`. The credential check in `handleRequest` precedes the outbound
`fetch`, so no provider call is possible in that state. Observed:

```
running:  buttonDisabled=true, aria-busy="true"
          "Running the tribunal. Jon Snow, Tyrion Lannister, Daenerys Targaryen
           and Grey Worm speak in turn, then the three judges reason independently."
settled:  "failed"
error:    "The tribunal could not be completed, so no transcript or verdict is
           shown. Nothing was filled in on the participants' behalf. The tribunal
           stopped: Jon Snow could not be reached. The tribunal's language-model
           proxy is running but has no ANTHROPIC_API_KEY set in its own server
           environment, so no model could be called. The proxy reported: ..."
transcript / opinions: absent — no partial result was kept
placeholderCount: 0 — no fake-client fallback

network requests:
  GET  http://localhost:4173/
  GET  http://localhost:4173/assets/index-CbEEZ_qV.js
  GET  http://localhost:4173/assets/index-BRDnka0L.css
  OPTIONS http://localhost:8787/api/llm/complete
  POST    http://localhost:8787/api/llm/complete
```

Nothing but the local origin and the local proxy. This simultaneously confirms
the real client is wired in production, the origin guard allows `:4173`, the
proxy is reachable, honest failure handling works, and no fallback to the fake
occurs — all for zero tokens.

The live proxy log for that whole session:

```
The Tribunal LLM proxy is listening on http://127.0.0.1:8787/api/llm/complete
ANTHROPIC_API_KEY present: false
Model: claude-haiku-4-5-20251001; provider: https://api.anthropic.com
OPTIONS /api/llm/complete -> 204
POST /api/llm/complete -> 503 missing_credential
```

Method, path, status, error code. No bodies, no key, presence as a boolean —
exactly as documented.

### (c) Client selection — `VITE_TRIBUNAL_LLM=real npm run dev`, token-free

Started and loaded; `devPreviewNotice: false`, confirming the real client is
selected. I did not press `Start Tribunal`, so nothing was sent anywhere.
README's client-selection table is therefore verified on all three rows.

### (d) Responsive / UI review (my own, independent of `CODE_REVIEW_NOTES.md` (c))

Measured the rendered page at three viewports:

| Viewport | Horizontal overflow | Overflowing elements | Start button width |
| --- | --- | --- | --- |
| 1440×900 | none | none | 165 px |
| 1280×800 | none | none | 165 px |
| 420×900 | none | none | 357 px (full width) |

No defect. The narrow breakpoint behaves as documented. I made no UI change.

### (e) Documentation QA — every token-free documented command executed

| Command | Source | Result |
| --- | --- | --- |
| `npm install` | README §1 | 237 packages, 0 vulnerabilities, exit 0 |
| `npm run lint` | README §2 | exit 0 |
| `npm run typecheck` | README §2 | exit 0 |
| `npm test` | README §2 | 203/203, exit 0 |
| `npm run build` | README §2, DEMO | exit 0 |
| `npm run dev` | README §3, DEMO rehearsal | serves `http://localhost:5173/`; fake client; full flow runs |
| `node src/server/anthropicProxy.mjs` | README §4, DEMO pre-flight | starts, binds loopback, prints the documented three lines |
| `VITE_TRIBUNAL_LLM=real npm run dev` | README §4, DEMO | serves `:5173`; real client selected |
| `npm run build && npm run preview` | README §4, DEMO | serves `http://localhost:4173/`; real client; production bundle |

Every one works exactly as written. The only documented command not executed is
the one that requires a real key — deliberately, and it is the only token-spending
command in either document.

### (f) Document requirement checks

- **`README.md`** — all twelve required elements present: overview and central
  question; academic multi-agent concept; the simple flow diagram (no more
  complicated than the implementation); the verbatim **"Code orchestrates. The
  LLM decides."** (present as a section heading; `src/tribunal/engine.ts` states
  the same rule in its module header); the deterministic-vs-LLM statement (two
  explicit tables); the actual stack only; exact setup commands for install,
  dev/test mode, real-provider mode, proxy startup, build/preview and
  validation; environment variable **names only**; the `ANTHROPIC_API_KEY` vs
  `CLAUDE_CODE_OAUTH_TOKEN` distinction under its own heading; a testing
  summary; the server-side-key security explanation; an honest limitations
  section.
- **`ARCHITECTURE.md`** — all nine required topics present. Its proxy line
  accounting was reproduced independently and is **exact**: 666 total / 381 code
  / 179 comment / 106 blank.
- **`DEMO_WALKTHROUGH.md`** — all eleven beats present, in the brief's order,
  each with a time budget; the budgets sum to 250 s = **4 m 10 s**, inside the
  3–5 minute window. Every screen element, heading, status line, error string
  and judge descriptor it points at was confirmed to render or to exist in
  `src/data/`. Its "a real run took 20–30 seconds" claim is supported by
  `src/mission-003/evidence/live-acceptance-run-operator.txt`.
- **`SUBMISSION_CHECKLIST.md`** — all ten required items present, plus a section
  titled **exactly** `External course requirements still to verify` containing
  five genuine unknowns, every one marked `UNKNOWN — must be confirmed by a
  human`, with no invented answers. Seven stale items were corrected (findings
  QA-01…QA-07 below).

### (g) Canonical cross-check against `src/data/`

Every name, side grouping and the central question in all four documents was
checked against the source of truth. **All match exactly.**

| Item | `src/data/` | Documents |
| --- | --- | --- |
| Title / case | `The Tribunal` / `The Realm v. Jon Snow` (`case.ts`) | match |
| Defense | `Jon Snow`, `Tyrion Lannister` (`representatives.ts`, `side: 'defense'`) | match |
| Prosecution | `Daenerys Targaryen`, `Grey Worm` (`side: 'prosecution'`) | match |
| Judges | `Aharon Barak model`, `Menachem Elon model`, `Meir Shamgar model` (`judges.ts`) | match |
| Central question | `CENTRAL_QUESTION.question` (`case.ts`) | character-for-character identical in README |
| Considerations | four, in order (`case.ts`) | match in README and DEMO beat 2 |
| Judge descriptors | `judges.ts` | match verbatim in DEMO beat 4 |
| Verdict tokens | `JUSTIFIED` / `NOT_JUSTIFIED` (`types.ts`) | match; the underscore form is used everywhere |
| Canonical facts | eleven (`CANONICAL_FACTS`) | count and framing match |
| Combined verdict | no field exists in `TribunalResult` | every document says so |

No document claims a capability, script, file or UI element that does not exist.

### (h) Findings register

All ten were fixed by me within my write policy, and lint, typecheck, tests and
build were re-run afterwards (output in 8b). Each was also sent to the owning
task through the coordination mailbox rather than being silently rewritten.

| # | File | Finding | Resolution |
| --- | --- | --- | --- |
| QA-01 | `SUBMISSION_CHECKLIST.md` header + scope note | Said Mission 004's three branches "have not been merged yet" and that the checks were made at `d4190b5`. Both stale — the branches landed at `6492bf9`. | **Fixed.** Header and scope note now record the re-check on the integrated tree. |
| QA-02 | `SUBMISSION_CHECKLIST.md` §1 | "80 files tracked". `git ls-files` at `6492bf9` returns **84** (the four Mission 004 documents landed). | **Fixed.** Corrected to 84, with the reason. |
| QA-03 | `SUBMISSION_CHECKLIST.md` §2 | Marked **NOT YET** because the final README "had not been committed". False — it landed, and it independently closes all nine `CODE_REVIEW_NOTES.md` (f) items, including the `npm run proxy` and `.gitignore` claims. | **Fixed.** Ticked, with the verified element list. |
| QA-04 | `SUBMISSION_CHECKLIST.md` §3 | Marked **NOT YET** because "`ARCHITECTURE.md` does not exist … on any branch yet". False — it exists and covers all nine topics. | **Fixed.** Ticked; DEMO beat 10's fallback is no longer needed. |
| QA-05 | `SUBMISSION_CHECKLIST.md` §10 | Claimed the production bundle contains "a human-readable error hint naming the credential variable and the proxy start command". **Independently false.** After a clean build, `grep -roF` over `dist/` returns `ANTHROPIC_API_KEY` 0, `api.anthropic.com` 0, `x-api-key` 0, `sk-ant-` 0, `CLAUDE_CODE_OAUTH_TOKEN` 0, `deterministic test client` 0; the **only** provider-related string is `/api/llm/complete` (1 hit). That hint is emitted by the proxy server-side and travels in the HTTP response body at run time — it is not compiled in. `README.md`'s stricter wording was the correct one. | **Fixed.** Rewritten with the real counts and the correction noted. |
| QA-06 | `SUBMISSION_CHECKLIST.md` §11 | Marked **NOT YET** because the branches were unmerged. Stale. | **Fixed.** Ticked. |
| QA-07 | `SUBMISSION_CHECKLIST.md` §12 | Carried an open decision: `package.json` needs a `"proxy"` script **or** the README must stop offering `npm run proxy`. | **Resolved with no root-file change.** The finalized README took the second route and states explicitly that neither `npm run proxy` nor a Vite `server.proxy` entry exists. Verified against `package.json` (scripts are exactly `dev`, `build`, `preview`, `lint`, `test`, `typecheck`) and `vite.config.ts` (no `server` key). Checklist updated to record the closure. |
| QA-08 | `README.md` "Repository map" | Omitted `src/mission-004/`, a tracked directory holding `CODE_REVIEW_NOTES.md`. A reader comparing the map to the tree finds an undocumented directory. | **Fixed** with a single added line. Nothing else in the map changed. |
| QA-09 | environment, not the repository | This worktree's `.git` file holds an absolute Windows path and its files are CRLF while the committed blobs are LF, so a bare `git` command fails here and `git status` reports the whole tree as modified. | **Diagnosed, no repository change.** Git works here with an explicit `GIT_DIR`/`GIT_WORK_TREE` plus `-c core.autocrlf=true`, and with that the tree is clean. Nothing committed is affected, and the app, tests and build are unaffected. Already recorded in `SUBMISSION_CHECKLIST.md` §11 by the previous task; independently reproduced. |
| QA-10 | `src/llm/secretBoundary.test.ts` scope | The guard exempts only `server` and `mission-003`, so the new `src/mission-004/` directory **is** inside the scanned tree — undocumented in `CODE_REVIEW_NOTES.md`. | **No change needed, and it is a strength.** `CODE_REVIEW_NOTES.md` passes the scan today. Sent to `mission-004-AUTO-CODE-REVIEW` so future notes under `src/mission-004/` keep it that way. |

**Nothing is left unresolved.**

---

## 10. Documentation / submission artifacts

| Artifact | Owner | State |
| --- | --- | --- |
| `README.md` | `AUTO-DOCS-CORE` | Finalized. Verified against all twelve brief requirements. One QA line added (QA-08). |
| `ARCHITECTURE.md` | `AUTO-DOCS-CORE` | Created. All nine topics; line accounting reproduced exactly. |
| `DEMO_WALKTHROUGH.md` | `AUTO-SUBMISSION-KIT` | Created. Eleven beats, 4 m 10 s, speaker notes, pre-flight, recovery table. No QA change required. |
| `SUBMISSION_CHECKLIST.md` | `AUTO-SUBMISSION-KIT` | Created. Ten items + the exactly-titled unknowns section. Seven targeted QA corrections applied (QA-01…QA-07). |
| `src/mission-004/CODE_REVIEW_NOTES.md` | `AUTO-CODE-REVIEW` | Created. Canonical verification, cleanliness review, UI decision, complexity review, deterministic-vs-LLM map, stale-claim list, out-of-policy root-file list. Claims reproduced; no correction required. |
| `MISSION_004_FINAL_REPORT.md` | this task | This document. |
| `src/mission-003/**` | Mission 003 | **Untouched.** `git diff 83ecd1e..HEAD -- src/mission-003/` is empty. |
| `FOUNDER_MISSION_001–003.md`, `MISSION_002_FINAL_REPORT.md` | history | **Unmodified.** Confirmed by diff. |

---

## 11. Final polish and refactors performed

Mission 004 changed **two source files, comment text only**, and made **no
behavioural change anywhere**:

1. `src/components/JudgesSection.tsx` — a comment said no verdict exists "until a
   later mission runs the tribunal". The tribunal has run since Mission 002.
   Rewritten to say the section is the pre-run panel roster and that verdicts
   appear after a run in `JudicialOpinionsSection`.
2. `src/llm/fakeClient.ts` — a comment said "a real provider arrives … in a
   later mission". It arrived in Mission 003. Rewritten to point at
   `./anthropicClient`.

No file was deleted; no candidate was clearly disposable. No UI change was made:
the review found no defect in spacing, hierarchy, loading state, error clarity,
transcript readability, opinion readability or responsive behaviour, and my own
three-viewport measurement (point 9d) agreed. One typographic observation — body
text runs the full 56 rem measure while the run notice is capped at 44 rem — was
considered and **declined**, because `--content-width` is a global layout
decision and changing it is the redesign this mission forbids.

### The proxy complexity review — decision and justification

**Decision: KEEP `src/server/anthropicProxy.mjs` AS IS. Not simplified, not
refactored.** I independently reproduced the measurement behind it:

| Measure | Lines |
| --- | --- |
| Total | 666 |
| Comment | 179 |
| Blank | 106 |
| **Actual code** | **381** |

43% of the file is comment and whitespace. The length is documentation density,
not logic density, and that documentation is load-bearing — each security
decision records *why* it exists next to itself.

The brief permits simplification only if **all five** conditions hold. They do
not:

1. **Complexity is not materially reducible.** The file is already decomposed
   into four independently testable pure functions — `readConfig`,
   `validateCompleteRequest`, `extractText`, `handleRequest` — with the socket
   plumbing isolated below them. `handleRequest` is a flat, linear sequence of
   guard clauses with no nesting beyond one level, which is the shape easiest to
   audit. Splitting it across files would add import indirection and make the
   request lifecycle *harder* to read end to end.
2. **Behaviour could not be *proven* identical.** The exported surface is
   covered by 51 tests in `anthropicProxy.test.mjs` plus 10 origin-guard, 3
   key-material, 12 contract-parity and 8 end-to-end tests. That is strong
   evidence, but it is not a proof of equivalence for a rewrite — and
   equivalence is what the condition demands.
3. **Every line is a security protection.** The origin guard, the 1 MiB
   socket-read cap, outgoing-body redaction, the loopback-only bind, the
   no-body logging rule, the provider timeout and strict unknown-key rejection
   are each the product of a specific documented finding — the origin guard is
   recorded as QA-12 in `src/mission-003/QA_REPORT.md`. Condensing them risks
   dropping one silently.
4. **It is already easy to explain.** Six labelled sections and one linear
   handler; the structural map in `ARCHITECTURE.md` took one pass to write.
5. **Decisive: changing it would force a real-provider revalidation.** This is
   provider, security and orchestration code. Mission 003 validated it with a
   real 7/7-call live run whose evidence is preserved. Any material change
   invalidates that evidence and would require spending real tokens to re-earn
   it — the exact cost this mission exists to avoid.

A long, heavily-commented, well-sectioned, fully-tested security boundary is the
correct outcome. **Length alone is not a defect.** I endorse the decision as
independent QA.

---

## 12. Known limitations, honestly

These are design decisions rather than oversights, but they are real limits.

- **One hard-coded case.** *The Realm v. Jon Snow* and its eleven canonical facts
  are fixed data. There is no way to enter or load another case.
- **Fixed cast.** Four representatives and three judges, in a fixed order. Not
  configurable.
- **No persistence.** A run exists only in React state. Reload the page and the
  transcript and opinions are gone; nothing is saved, exported or logged.
- **No combined verdict — by design.** The three opinions are never aggregated,
  so the application never tells you "what the tribunal decided". Deliberate,
  but it does mean there is no single answer on screen.
- **Two local processes.** A real run needs the proxy in one terminal and the app
  in another. A Vite middleware plugin would be one process, but it would put
  credential-handling code inside the tool that builds the browser bundle; the
  standalone script is structurally incapable of reaching the browser, and that
  trade was made deliberately.
- **Single provider, single model.** Anthropic only, pinned to
  `claude-haiku-4-5-20251001` unless overridden.
- **Local-only; no deployment story.** The proxy binds loopback and has no
  authentication of its own. There is no hosting configuration, no container, no
  CI pipeline and no published build. It runs on a laptop.
- **No retry, no streaming, no cache.** Seven sequential calls; a single failure
  anywhere aborts the run and shows an error rather than a partial result.
- **Verdict parsing is strict.** A judge reply without a readable `VERDICT:` line
  fails the run rather than being guessed at. That is the honest behaviour, but
  it makes a run dependent on the model following the reply format.
- **The origin guard's default port list is a sharp edge.** Only `:5173` and
  `:4173` (and their `127.0.0.1` forms) are allowed by default. If port 5173 is
  busy, Vite silently falls back to 5174 and a real run then fails with an origin
  error. The escape hatch is `TRIBUNAL_ALLOWED_ORIGINS`, and
  `DEMO_WALKTHROUGH.md` carries it as a pre-flight step.
- **The demo has not been rehearsed against the real provider in this mission.**
  Deliberately — it costs tokens. Mission 003's live run is the validation of
  record. A presenter should do one paid rehearsal before a live session.

---

## 13. External course requirements still unknown

**None of the following is known, and nothing has been assumed, inferred or
filled in.** A human must confirm each against the course's own instructions
before submitting. `SUBMISSION_CHECKLIST.md` carries the same list under the
section titled exactly `External course requirements still to verify`.

| # | Unknown |
| --- | --- |
| 1 | **Required submission platform** — where the work is actually handed in |
| 2 | **Deadline** — the date, time and the timezone it is stated in |
| 3 | **Required video format** — whether a recorded demo is required at all and, if so, its length, file format, resolution, narration language and hosting/upload method |
| 4 | **Required written report format** — whether a written report is required separately from this repository's documentation and, if so, its structure, length, language, file format and citation expectations |
| 5 | **Repository / link requirements** — whether a repository link is required, whether it must be public or private, whether specific access must be granted, and whether an archive is wanted instead of or in addition to a link |

Items 1–11 of the checklist cover the code, documentation and validation. They
say nothing about packaging, hosting or a recorded video, because none of those
requirements are known. **This is not a product blocker.**

---

## 14. Exact commands needed to demonstrate the project

```sh
# 0. Install (Node 22.12+; developed on 22.14.0 / npm 10.9.2)
npm install

# 1. Validate — all four must pass
npm run lint        # eslint .
npm run typecheck   # tsc -b --noEmit
npm test            # vitest run   -> 203 tests, 13 files
npm run build       # tsc -b && vite build  -> dist/

# 2. Token-free preview / rehearsal — deterministic fake client, spends nothing
npm run dev         # http://localhost:5173/  (dev-preview warning is shown on screen)
```

Real-provider demo — **two terminals**, and this is the only path that spends
tokens (seven calls per run):

```sh
# Terminal 1 — the proxy. The key lives in this shell and nowhere else.
export ANTHROPIC_API_KEY="<your Anthropic API key>"
node src/server/anthropicProxy.mjs
# expect: "ANTHROPIC_API_KEY present: true"
```

```sh
# Terminal 2 — the app. Start it from a shell with NO ANTHROPIC_API_KEY set.
VITE_TRIBUNAL_LLM=real npm run dev     # http://localhost:5173/
# or, to demo the production build:
npm run build && npm run preview       # http://localhost:4173/
```

| Command | Client used |
| --- | --- |
| `npm run dev` | the **fake** — placeholder text, dev-preview warning on screen |
| `VITE_TRIBUNAL_LLM=real npm run dev` | the real one, via the proxy |
| `npm run build && npm run preview` | the real one — a production build never contains the fake |

There is **no** `npm run proxy` script and **no** Vite `server.proxy` entry;
`package.json` defines exactly `dev`, `build`, `preview`, `lint`, `test` and
`typecheck`. Check the Vite port before a live demo: if 5173 is busy, Vite falls
back to 5174 and the proxy's origin guard will refuse the run unless that origin
is added to `TRIBUNAL_ALLOWED_ORIGINS`.

---

## 15. Confirmation that no secrets are committed

**Confirmed. No real Anthropic API key exists anywhere in this repository's git
history or working tree.** No secret value is printed anywhere in this report,
and none was printed during the checks.

Method, and what each check returned:

| # | Check | Method | Result |
| --- | --- | --- | --- |
| 1 | No key in git **history** | Enumerated **every blob in the object database** across all 32 refs (`git cat-file --batch-all-objects`; 124 blobs, 32 commits, 66 trees) and scanned each for `sk-ant-[A-Za-z0-9_-]{40,}` — the shape of a real credential | **0 matches** |
| 2 | What `sk-ant-` occurrences do exist | Same sweep, collecting every `sk-ant-…` token and reporting **length and a 16-character masked prefix only** | Longest token anywhere in history is **36 characters**, and it reads `sk-ant-fake-key-…`. Every hit is one of: a documentation ellipsis `sk-ant-...` (10), the bare prefix `sk-ant-` (7), or a self-declared fake test fixture (26 or 36). A real key is ~108 characters. |
| 3 | No `.env` with a real secret tracked | `git log --all --diff-filter=A --name-only` over every ref for any `.env*` path | The **only** `.env*` path ever added to this repository is `.env.example`. No `.env` has ever been tracked. |
| 4 | `.env.example` is safe | Read in full | Variable **names only**; every assignment is empty; its own header says never to put a real value in it. |
| 5 | `.gitignore` covers `.env` while allowing `.env.example` | Read lines 32–35 | `.env`, `.env.*`, `!.env.example` — present and correct. |
| 6 | No `.env` on disk | `ls -a` | The only `.env*` file present is `.env.example`. |
| 7 | No key in the **production bundle** | Clean `rm -rf dist && npm run build`, then `grep -roF` over `dist/` | `sk-ant-` **0**, `ANTHROPIC_API_KEY` **0**, `api.anthropic.com` **0**, `anthropic.com` **0**, `x-api-key` **0**, `CLAUDE_CODE_OAUTH_TOKEN` **0**, `deterministic test client` **0**, `PLACEHOLDER` **0**. `/api/llm/complete` **1** — the local path, which is correct. |
| 8 | No high-entropy token hiding in the bundle | `grep -roE '[A-Za-z0-9_-]{60,}'` over `dist/assets/*.js` | 5 hits, all React internals (`__CLIENT_INTERNALS_DO_NO…`, `__DOM_INTERNALS_DO_NOT_U…`). No credential-shaped string. |
| 9 | No key in the documents | Scanned `README.md`, `ARCHITECTURE.md`, `DEMO_WALKTHROUGH.md`, `SUBMISSION_CHECKLIST.md` for key-shaped strings and for an `x-api-key` with a value | **0 in each** |
| 10 | No key in mission evidence | Same scan over `src/mission-003/evidence/` | **0** |
| 11 | No `ANTHROPIC_API_KEY=<value>` anywhere tracked | `git grep -nE 'ANTHROPIC_API_KEY=[^ "$<>)]+' HEAD`, output truncated to 12 characters after the `=` | 11 hits; every one is a documentation ellipsis (`sk-ant-...` or `...`) or prose. No value. |
| 12 | Browser code never calls Anthropic directly | `grep -rnE "anthropic\.com\|x-api-key\|ANTHROPIC_API_KEY\|process\.env\|CLAUDE_CODE_OAUTH_TOKEN"` over all `.ts`/`.tsx`/`.css` under `src/`, excluding `src/server/` and `src/mission-003/` | **No hits.** The browser tree is clean. |
| 13 | Provider access is server-side only | Read `src/llm/anthropicClient.ts` and `src/llm/proxyContract.ts` | The client's only outbound URL is `${origin}${PROXY_COMPLETE_PATH}` where `PROXY_COMPLETE_PATH = '/api/llm/complete'`. No provider hostname, no auth header, no secret. |
| 14 | Confirmed live in a real browser | Production build clicked through with CDP network recording | The page's only non-local requests were `OPTIONS` and `POST` to `http://localhost:8787/api/llm/complete`. Nothing reached `api.anthropic.com`. |
| 15 | Standing guards, not one-off audits | `src/llm/secretBoundary.test.ts` (7 tests) and `src/mission-003/qa.keyMaterial.test.ts` (3 tests) | Pass on every `npm test`. The boundary test also fails if its own walk finds nothing, so a silently empty scan cannot pass. It covers `src/mission-004/` too. |
| 16 | No secret was handled during this mission | `'ANTHROPIC_API_KEY' in process.env` | **false** in every shell used. No key was ever set, so none could have leaked. |

---

## 16. Readiness for academic submission

**The project is ready for academic submission.**

### Definition of Done — confirmed one by one

| # | Item | Status |
| --- | --- | --- |
| 1 | Final repository review completed | **Done.** `src/mission-004/CODE_REVIEW_NOTES.md` — canonical content, cleanliness, UI, complexity, deterministic-vs-LLM, stale claims, out-of-policy root files. Independently re-derived by this task. |
| 2 | README finalized | **Done.** All twelve required elements verified present (point 9f). |
| 3 | Demo walkthrough prepared | **Done.** Eleven beats, 4 m 10 s, every screen element confirmed to render. |
| 4 | Architecture documentation clear | **Done.** All nine topics; line accounting exact. |
| 5 | Submission checklist prepared | **Done.** Ten items plus the exactly-titled unknowns section; seven stale entries corrected. |
| 6 | UI reviewed, minor polish completed | **Done.** No defect found by either the code review or my independent three-viewport measurement. No change was needed, and none was made. |
| 7 | Canonical content verified | **Done.** Every name, side grouping, judge descriptor, verdict token and the central question cross-checked against `src/data/` (point 9g). All match. |
| 8 | Security review passed | **Done.** Sixteen checks, point 15. |
| 9 | No secrets committed or exposed | **Done.** Zero key-shaped strings in history, working tree, bundle, documents or evidence. |
| 10 | Lint passes | **Done.** exit 0, twice. |
| 11 | Typecheck passes | **Done.** exit 0, twice. |
| 12 | Tests pass | **Done.** 203/203 across 13 files, twice. |
| 13 | Production build passes | **Done.** exit 0, twice, including from a clean checkout. |
| 14 | Browser smoke test passes | **Done.** Dev fake-client mode ran the full flow to three separate opinions with no combined verdict; the production build was verified through `npm run preview`. Token-free. |
| 15 | Independent QA passes | **Done.** This report. |
| 16 | QA findings resolved / revalidated | **Done.** Ten findings, ten resolved; lint, typecheck, tests and build re-run after the fixes (output in 8b). |
| 17 | Git working tree clean | **Done.** `git status --porcelain` is empty and all work is committed. |
| 18 | Final project report produced | **Done.** This document. |

### AutonomousDevTeam write-policy fix — did it work?

**Yes. The write-policy fix worked, for all three categories.** Root-level files
were writable **directly, with no quarantine and no workaround**:

- **Root-level `*.md`** — confirmed by three real edits: `README.md` (QA-08),
  `SUBMISSION_CHECKLIST.md` (QA-01…QA-07), and creating this
  `MISSION_004_FINAL_REPORT.md` at the repository root.
- **`.gitignore`** — confirmed by an explicit non-destructive write test: an edit
  was applied and immediately reverted, leaving the file **byte-identical to
  HEAD**. `git diff -- .gitignore` is empty.
- **`.env.example`** — confirmed the same way, and likewise **byte-identical to
  HEAD**.

No prior-mission root-file quarantine was encountered at any point.

**Root-level files still needing a change and not covered by the policy:
none.** The one open candidate was `package.json`, which `CODE_REVIEW_NOTES.md`
(g) flagged as needing a `"proxy": "node src/server/anthropicProxy.mjs"` script
so the README's `npm run proxy` command would be true. That was closed the other
way and needs no edit: the finalized README no longer offers `npm run proxy` and
states explicitly that neither it nor a Vite `server.proxy` entry exists.
`vite.config.ts` was the second candidate, for the optional `server.proxy`
snippet, and was likewise declined for the same reason. I verified both files
directly — `package.json`'s scripts are exactly `dev`, `build`, `preview`,
`lint`, `test`, `typecheck`, and `vite.config.ts` has no `server` key — so every
documented command now matches the repository. `tsconfig.json`,
`tsconfig.app.json`, `tsconfig.node.json`, `eslint.config.js`, `index.html` and
`package-lock.json` are correct as they stand and need no change.

### Final statement

This is the final development mission for The Tribunal. **No further product
mission is proposed, and no genuine blocker remains.** The application is
complete, validated, documented and secure; the automated gates are green from a
clean checkout; the browser behaviour is confirmed in both dev and production
modes; Mission 003's real seven-call provider validation is preserved and still
applies because nothing material changed under `src/server/`, `src/llm/` or
`src/tribunal/`; and no secret is committed anywhere in the history or the
working tree.

The only outstanding items are the five **external** course requirements in
point 13. Those are administrative facts a human must obtain from the course
itself. They are not development work, and inventing answers for them would be
worse than leaving them marked unknown.
