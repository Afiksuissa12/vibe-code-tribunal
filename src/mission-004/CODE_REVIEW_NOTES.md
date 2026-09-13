# Mission 004 — Repository & Code Review Notes

Factual input for `mission-004-AUTO-DOCS-CORE` (README.md, ARCHITECTURE.md) and
`mission-004-AUTO-SUBMISSION-KIT` (DEMO_WALKTHROUGH.md, SUBMISSION_CHECKLIST.md).
Not prose — every claim below was checked against the code at the commit this
file lands in.

Reviewer scope: review, verification, minimal safe cleanup. No feature work, no
redesign, no refactor. No live provider call was made and the Anthropic
credential variable was never set to a real value.

> **Notation.** This file lives under `src/`, so it is scanned by
> `src/llm/secretBoundary.test.ts`, which fails any non-exempt file containing
> the literal credential-variable name. This file therefore calls it "the
> Anthropic credential variable" rather than spelling it out. Its exact name is
> in `.env.example` at the repo root, and the proxy prints it at startup. The
> documentation tasks write `README.md` at the repo **root**, which is outside
> that scan, so they can and should use the literal name.

---

## (a) Canonical content verification

**Result: VERIFIED CORRECT. No mismatch found. No data file was corrected.**

Every item below was compared line-by-line against `FOUNDER_MISSION_001.md`.

### Case identity

| Field | Value | Source |
| --- | --- | --- |
| `APP_TITLE` | `The Tribunal` | `src/data/case.ts:11` |
| `CASE_NAME` | `The Realm v. Jon Snow` | `src/data/case.ts:12` |

### Central question

`src/data/case.ts:36-45`. Stored as a question plus four considerations, which
is a structural split of the brief's single sentence; no wording was changed.

Exact question text:

> Was Jon Snow's intentional killing of Daenerys Targaryen justified as the necessary defense of others and of the realm?

Exact considerations, in this order:

1. `what Jon knew at the time`
2. `the scale of the threatened harm`
3. `whether safer alternatives existed`
4. `and Jon's lack of formal authority`

### Canonical facts

**Exact count: 11.** `src/data/case.ts:18-30`. All eleven match the dossier
verbatim, in the dossier's order. None added, removed, softened or reworded.

### Representatives — exact names and side grouping

`src/data/representatives.ts:22-82`. Array order matches the brief's numbering.

| # | `id` | `displayName` | `side` |
| --- | --- | --- | --- |
| 1 | `jon-snow` | Jon Snow | `defense` |
| 2 | `tyrion-lannister` | Tyrion Lannister | `defense` |
| 3 | `daenerys-targaryen` | Daenerys Targaryen | `prosecution` |
| 4 | `grey-worm` | Grey Worm | `prosecution` |

`DEFENSE_REPRESENTATIVES` and `PROSECUTION_REPRESENTATIVES`
(`src/data/representatives.ts:84-90`) are derived by filtering on `side`, so the
grouping cannot drift from the table above.

### Judges — exact names

`src/data/judges.ts:21-63`. **The word "model" is part of each display name** —
documentation should not shorten these to "Aharon Barak".

| `id` | `displayName` |
| --- | --- |
| `barak` | Aharon Barak model |
| `elon` | Menachem Elon model |
| `shamgar` | Meir Shamgar model |

### Verdict tokens

Wire tokens are `JUSTIFIED` and `NOT_JUSTIFIED` — **underscore, not a space**
(`src/data/types.ts:16-19`). The brief's prose writes "NOT JUSTIFIED";
`FOUNDER_MISSION_002.md` fixed the underscored form as the wire token and
`FOUNDER_MISSION_004.md` restates it. The parser normalises spaced/hyphenated
variants onto the underscored token (`src/tribunal/verdict.ts:54-61`). The UI
displays `Justified` / `Not justified`
(`src/components/JudicialOpinionsSection.tsx:9-12`).

### No combined verdict

`TribunalResult` has exactly two fields, `transcript` and `judicialOpinions`
(`src/data/types.ts:100-103`). There is no tally, majority or aggregate anywhere
in engine or UI.

---

## (b) Repository cleanliness review

The whole repository was walked: 80 tracked files, 0 untracked files, 0
generated files tracked. `dist/` and `node_modules/` are correctly gitignored
and are not tracked.

### Removed

**Nothing was deleted.** No file in this repository was found to be clearly
disposable. Every candidate was either load-bearing, test-covered, or protected
historical evidence.

### Changed — two misleading comments corrected (comment text only)

Both were factually false statements about the product's current state. No code,
no behaviour, no test, and no rendered output changed; no test asserted on
either comment, so no test was updated.

1. **`src/components/JudgesSection.tsx:9-10`** — said no verdict exists "until a
   later mission runs the tribunal". The tribunal has run since Mission 002 and
   verdicts do exist. Rewritten to say this section is the pre-run panel roster
   and that verdicts appear after a run in `JudicialOpinionsSection`.
2. **`src/llm/fakeClient.ts:13-14`** — said "a real provider arrives behind this
   same `LlmClient` interface in a later mission". The real provider arrived in
   Mission 003. Rewritten to point at `./anthropicClient`.

### Deliberately kept

| Item | Why kept |
| --- | --- |
| `src/mission-003/**` (all 23 files) | Protected audit/evidence trail. Hard prohibition — not modified, moved or deleted. |
| `FOUNDER_MISSION_001–004.md`, `MISSION_002_FINAL_REPORT.md` | Historical evidence. Not edited. |
| `src/server/anthropicProxy.d.mts`, `src/mission-003/e2e/*.d.mts` | Hand-written, documented, and load-bearing: `tsc -b` needs them so `.ts` tests can import the `.mjs` modules. Not generated output. |
| `notImplementedLlmClient` (`src/llm/client.ts:56-60`) | Unused by production code, but exported, documented as deliberate, and covered by `src/llm/client.test.ts`. Not "clearly disposable" — removing it is a judgment call outside a cleanliness pass. |
| `src/llm/fakeClient.ts` | Test infrastructure and the dev preview. Excluded from the production bundle by a compile-time branch (verified below), and clearly labelled as not product truth. |
| `FOUNDER_MISSION_*` citations in source comments | Accurate provenance pointers, not stale narration. Left alone. |

### Old fake/demo artifacts presented as real product output

**None found.** Every string the fake client emits is prefixed
`[deterministic test client]` (`src/llm/fakeClient.ts:22`), the screen shows a
dev-preview warning whenever the fake is wired up, and the fake is absent from
the production bundle (verified in section (d) validation). No committed file
presents fake output as a real tribunal result.

### Recommendations — could not act (outside write policy or protected)

| Item | Reason I could not act | Recommended change |
| --- | --- | --- |
| `src/mission-003/root-artifacts/README.md` | Protected — `src/mission-003/` is hard-prohibited | Written entirely in future tense ("staged for the operator", "ready to be applied", "Apply that file before anyone puts a real key on disk"). All of it **was already applied** in commit `c006665`. It now reads as if root work is outstanding when it is not. Because the directory is protected evidence, the correct fix is **not** to edit it but for `README.md` to stop pointing readers at it as pending (see (f) item 3). |
| `src/mission-003/root-artifacts/gitignore.additions.txt:5-7` | Protected | States a plain `.env` "is NOT covered by anything currently in it today". No longer true — root `.gitignore:32-35` covers it. Same handling: leave the evidence, fix the README. |

---

## (c) UI polish decision

**Decision: no obvious presentation defect found. No UI change was made.**

Reviewed `src/App.tsx`, all eight files in `src/components/`, `src/App.css` and
`src/index.css` against the defects the brief names.

| Defect the brief names | Finding |
| --- | --- |
| Broken spacing / hierarchy | None. Single `h1`, one `h2` per section, `h3` per card. Spacing is a consistent `--space-1..6` scale (`src/index.css:9-14`). |
| Unclear loading state | Adequate. Button is `disabled` + `aria-busy` during a run; a `role="status"` notice names who is speaking (`src/components/StartTribunalSection.tsx:100-107`). `.start-tribunal__notice:empty` keeps the button from jumping (`src/App.css:86-88`). |
| Unclear error state | Adequate and honest. `role="alert"`, and the message leads with "The tribunal could not be completed, so no transcript or verdict is shown" before the underlying cause (`src/components/StartTribunalSection.tsx:32-33, 108-112`). No partial result is retained. |
| Unreadable transcript | No defect. `white-space: pre-wrap` on `.transcript__text` (`src/App.css:149-153`) preserves the paragraph breaks real model output contains. Entries are separated cards with speaker name and side. |
| Unreadable judge opinions | No defect. Same `pre-wrap` on `.opinion__reasoning`; verdict is bolded above the reasoning. |
| Broken responsive behaviour | No defect on a normal laptop. Page is capped at `--content-width: 56rem` and centred; participant lists are `repeat(auto-fit, minmax(15rem, 1fr))`; a `max-width: 30rem` breakpoint reduces padding and makes the button full-width. |

Non-blocking observation, **deliberately not acted on**: body text in transcript
and opinion cards runs the full 56rem measure (~95–105 characters per line),
while the run notice is capped at 44rem. Tightening it is a typographic
preference, not a defect, and `--content-width` is a global layout decision —
changing it would alter the whole page's appearance, which is the redesign this
mission forbids. Recorded here so a later reader knows it was considered and
declined, not overlooked.

---

## (d) Complexity review — `src/server/anthropicProxy.mjs`

**Decision: KEEP AS IS. Not simplified, not refactored.**

### Size in context

| Measure | Lines |
| --- | --- |
| Total | 666 |
| Comment lines | 179 |
| Blank lines | 106 |
| **Actual code** | **381** |

43% of the file is comment and whitespace. The length is documentation density,
not logic density — and the documentation is load-bearing, because it is where
each security decision records *why* it exists.

### Structural map (responsibilities in order) — for ARCHITECTURE.md

| Lines | Section | Responsibility |
| --- | --- | --- |
| 1–25 | Module header | States the one invariant: this is the only file that sees the credential, and it is outside the Vite module graph by construction. |
| 27–28 | Imports | `node:http` and `node:url`. Zero third-party dependencies. |
| 30–117 | Contract constants | Endpoint path, the 7 error codes, HTTP status per code, request limits, pinned model (`claude-haiku-4-5-20251001`), default port/base URL, API version, default allowed CORS origins, provider timeout. |
| 119–197 | Configuration | `readConfig(env)` — reads the six env vars from an injected environment object (never the global process environment internally, so it stays testable). Rejects malformed numeric overrides instead of silently defaulting. |
| 199–298 | Request validation | `validateCompleteRequest(value)` — strict allow-list shape check. Unknown keys rejected at both levels. Returns `{ok, request}` or `{ok:false, message}`. |
| 300–319 | Provider response reading | `extractText(payload)` — concatenates `text` blocks in order; ignores everything else rather than guessing. |
| 321–394 | Response construction | CORS headers (`vary: origin` always), **secret redaction of every outgoing body**, JSON/failure/success builders, provider-error excerpting. |
| 396–552 | **The handler** | `handleRequest(request, config)` — the whole proxy as one pure-ish async function: OPTIONS preflight → path check → method check → **origin guard** → JSON parse → validate → credential presence → outbound `fetch` with timeout → read body → status check → parse → extract text → non-empty check → success. |
| 554–636 | Node plumbing | `readBody` (enforces the 1 MiB cap **while reading the socket**), header lower-casing, `createRequestListener` (logs method/path/status/code only — never bodies, never the key). |
| 638–666 | Startup | `startProxy` binds **127.0.0.1 only**; logs credential presence as a boolean. Starts a server only when invoked directly, so importing it in a test has no side effect. |

### Why it is not simplified — justification (deliverable, not a fallback)

The brief permits simplification only if *all five* conditions hold. They do not:

1. **Complexity is not materially reducible.** The file is already decomposed
   into four independently testable pure functions (`readConfig`,
   `validateCompleteRequest`, `extractText`, `handleRequest`) with the socket
   plumbing isolated below them. `handleRequest` is a flat, linear sequence of
   guard clauses with no nesting beyond one level — the shape that is easiest to
   audit. Splitting it across files would add import indirection and make the
   request lifecycle harder to read end-to-end, not easier.
2. **Behaviour could not be *proven* identical.** The tests cover the exported
   surface thoroughly (51 tests in `anthropicProxy.test.mjs`, plus 10 origin-guard,
   3 key-material, 12 contract-parity and 8 e2e tests). That is strong evidence
   but it is not a proof of equivalence for a rewrite, and equivalence is what
   the condition demands.
3. **Every line is a security protection.** The origin guard (`:458-464`), the
   1 MiB socket-read cap (`:564-568`), outgoing-body redaction (`:340-346`),
   loopback-only bind (`:646`), the no-body logging rule (`:600-616`), the
   provider timeout (`:505`) and strict unknown-key rejection are each the
   product of a specific, documented finding — the origin guard is recorded as
   QA-12 in `src/mission-003/QA_REPORT.md`. Condensing them risks dropping one
   silently.
4. **It is already easy to explain.** Six labelled sections, one linear handler.
   The structural map above took one pass to write.
5. **Decisive: changing it would force a real-provider revalidation.** This is
   provider, security and orchestration code. Mission 003 validated it with a
   real 7/7-call live run whose evidence is preserved in
   `src/mission-003/evidence/live-acceptance-run-operator.txt`. Any material
   change invalidates that evidence and would require spending real tokens to
   re-earn it — the exact cost this mission is built to avoid.

**A long, heavily-commented, well-sectioned, fully-tested security boundary is
the correct outcome here. Length alone is not a defect.**

---

## (e) Deterministic code vs LLM-generated content

Precise as implemented. The system is credited with nothing it does not do.

### Deterministic application code

| Concern | Where | What is guaranteed |
| --- | --- | --- |
| Participant identity & profiles | `src/data/representatives.ts`, `judges.ts` | Fixed literal data. Never generated. |
| Canonical facts & central question | `src/data/case.ts` | Fixed literal data. Identical text sent to all 7 agents. |
| Speaking order | `src/tribunal/engine.ts:44-49` | `SPEAKING_ORDER` — Jon Snow → Tyrion Lannister → Daenerys Targaryen → Grey Worm. Hard-coded, and deliberately declared separately from `REPRESENTATIVES` so reordering the data file cannot silently reorder the tribunal. |
| Judging order | `src/tribunal/engine.ts:52` | `JUDGING_ORDER` — barak → elon → shamgar. Hard-coded. |
| Prompt assembly | `src/data/prompts.ts:85-133` | Pure string composition: role line + side + profile + case + transcript + turn cue. Contains no argument, stance or conclusion. |
| Context delivery | `src/tribunal/engine.ts:151-168` | Each representative's prompt is rebuilt *inside* the loop, after the previous reply was appended — so speaker N genuinely receives speakers 1..N-1. |
| Transcript accumulation | `src/tribunal/engine.ts:149, 162-167` | Append-only array of `{speakerId, speakerName, side, text}`. The application supplies the speaker metadata; the LLM supplies only `text`. |
| Transcript freezing | `src/tribunal/engine.ts:172` | `Object.freeze([...transcript])` before any judge runs — all three judges reason over the identical final record. |
| Judge isolation | `src/tribunal/engine.ts:175-187` | Each judge prompt is built from the frozen transcript + that judge's own profile only. **No judge is shown another judge's opinion.** (Note: the three calls run *sequentially* in a `for` loop — "independent" means isolated context, not parallel execution.) |
| Verdict parsing & validation | `src/tribunal/verdict.ts:97-133` | Finds the labelled `VERDICT:` line, normalises the token, and accepts *exactly* `JUSTIFIED` or `NOT_JUSTIFIED`. Exact match after normalisation, because a substring test would read `NOT_JUSTIFIED` as `JUSTIFIED`. No default, no closest-match, no fallback. Throws `InvalidVerdictError` on: empty reply, missing verdict line, unrecognised token, or a verdict with no reasoning. |
| Empty-reply rejection | `src/tribunal/engine.ts:114-120` | A blank reply is a failure, not an empty statement. |
| Failure handling | `src/tribunal/engine.ts:55-60, 107-112`; `StartTribunalSection.tsx:74-85` | A failed run yields no partial result. Errors propagate and are surfaced verbatim. |
| Request/response transport | `src/llm/anthropicClient.ts:177-234` | Forwards the `ChatRequest` unchanged; returns the proxy's text unchanged — not trimmed, repaired or inspected. |
| Proxy validation & security | `src/server/anthropicProxy.mjs` | Shape validation, origin guard, body cap, credential handling, redaction. |
| UI state | `src/components/StartTribunalSection.tsx:52-62` | `idle` / `running` / `complete` / `failed`; a `useRef` re-entry guard prevents two concurrent runs from a double click. |
| Rendering | `src/components/TranscriptSection.tsx`, `JudicialOpinionsSection.tsx` | Displays returned text as-is. Adds only speaker name, side label and verdict label — all structural facts the engine recorded. |
| Absence of aggregation | `src/data/types.ts:100-103` | No combined verdict field exists to populate. |

### LLM-generated content

| Output | Where it enters | Nature |
| --- | --- | --- |
| Each representative's statement | `engine.ts:155-160` → `transcript[n].text` | The entire argument: what position is taken, which facts are emphasised, whether difficult facts are conceded, whether an earlier speaker is answered. Not predetermined by the assigned side. |
| Each judge's verdict token | `engine.ts:179` via `parseJudgeResponse` | Which of the two allowed verdicts. **Not hard-coded anywhere.** The application constrains the *vocabulary* to two tokens and validates membership; it does not influence the choice. |
| Each judge's reasoned opinion | `engine.ts:179` → `JudgeOpinion.opinion` | The whole legal reasoning: principle selection, tests applied, how facts are weighed, how counterarguments are handled, the conclusion. |

### The boundary, stated exactly

**Code orchestrates. The LLM decides.** Deterministic code controls *who speaks,
in what order, with what context, and what shape of answer is acceptable*. The
LLM controls *what is actually said and concluded*. The single point where model
output crosses into the typed domain is `parseJudgeResponse`, and it refuses
rather than guesses.

Two capability claims that would be **false** and must not appear in
documentation:

- The judges do **not** run in parallel or in separate processes. Seven
  sequential HTTP calls, one process.
- Representatives do **not** talk to each other. There is no agent-to-agent
  messaging; later speakers simply receive earlier text as prompt context.

---

## (f) Stale or now-false claims in existing documentation

I did not edit `README.md`. Reported for `mission-004-AUTO-DOCS-CORE`. All nine
verified against the actual files.

| # | Location | Claim | Verified status |
| --- | --- | --- | --- |
| 1 | `README.md:221-223` | "the current `.gitignore` covers `.env.local` but not a plain `.env`" | **FALSE.** Root `.gitignore:32-35` contains `.env`, `.env.*`, `!.env.example`. Closed in commit `c006665`. |
| 2 | `README.md:211-214` | offers "an `npm run proxy` script, and a Vite `server.proxy` entry" as available conveniences | **FALSE — neither exists.** `package.json:6-13` scripts are exactly `dev`, `build`, `preview`, `lint`, `test`, `typecheck`. `vite.config.ts` has no `server` key at all. |
| 3 | `README.md:221-223` | points readers to `src/mission-003/root-artifacts/` as staged and pending | **STALE.** Already applied: root `.env.example` exists, `.gitignore` additions are in. |
| 4 | `README.md:24-26` | "There is no backend, no database and no state-management library" | **FALSE as written.** `src/server/anthropicProxy.mjs` is a Node server process. README's own Configuration section (`:126-232`) contradicts it. The no-database / no-state-library parts are correct. |
| 5 | `README.md:33-36` and file tree `:40-60` | lists `src/llm/` as "LlmClient interface, not-implemented stub, deterministic fake" | **INCOMPLETE.** Omits `src/llm/anthropicClient.ts`, `src/llm/proxyContract.ts`, and the whole of `src/server/` and `src/mission-003/`. |
| 6 | `README.md:49` | `client.ts` is "LlmClient interface, ChatRequest, and a stub that always rejects" | **STALE.** `client.ts:70-72` now exports `createLlmClient()`, which returns the real proxy-backed client. |
| 7 | `README.md:82` | judges return "`JUSTIFIED` or `NOT JUSTIFIED`" | **WRONG TOKEN.** The wire token is `NOT_JUSTIFIED` (underscore) — `src/data/types.ts:16-19`. |
| 8 | `README.md:78` | "The intended V1 flow is sequential" | **STALE framing.** It is implemented and validated, not intended. |
| 9 | `README.md:95, 122` | "Mission 002 adds…", "Mission 003 added…" | **STALE framing** for a final submission document. A reader cloning the repo sees one product, not a mission history. |

Also worth noting for whoever rewrites the README: the setup instructions are
split across **"Configuration"** (`README.md:126`) and **"Running it locally"**
(`README.md:234`), with the real-provider commands in the first and the
install/validation commands in the second. A reader following top to bottom
meets the proxy before `npm install`.

---

## (g) Root-level files needing a change, outside my write policy

| File | Needed change | Why it matters |
| --- | --- | --- |
| `package.json` | Either add `"proxy": "node src/server/anthropicProxy.mjs"` to `scripts`, **or** the README must stop offering `npm run proxy`. Exact snippet is staged at `src/mission-003/root-artifacts/package.json.scripts.txt`. | Today `README.md:211-214` documents a command that does not exist. A lecturer following the README hits `npm error Missing script: "proxy"`. Pick one — my recommendation is to **add the script**, since it is one line, has no dependency cost, and makes the documented command true. |
| `vite.config.ts` | Optional: add the `server.proxy` entry staged at `src/mission-003/root-artifacts/vite.config.ts.snippet.txt`. | Same false-claim problem as above, but this one is genuinely optional and the staged snippet itself warns it requires a matching `VITE_TRIBUNAL_PROXY_URL` change. **My recommendation is NOT to add it** — instead remove the claim from the README. Adding it touches the build config for a dev-only convenience. |

No other root file needs a change. `tsconfig*.json`, `eslint.config.js`,
`index.html` and `package-lock.json` were reviewed and are correct as they
stand.

---

## Validation results

Run in this worktree on Node v22.14.0 / npm 10.9.2, **after** the two comment
edits in section (b). Real output, pasted verbatim.

```
=== npm run lint ===
> the-tribunal@0.1.0 lint
> eslint .
exit=0

=== npm run typecheck ===
> the-tribunal@0.1.0 typecheck
> tsc -b --noEmit
exit=0

=== npm test ===
 RUN  v5.0.0 /workspace/.worktrees/mission-004-AUTO-CODE-REVIEW
 Test Files  13 passed (13)
      Tests  203 passed (203)
   Duration  50.08s
exit=0

=== npm run build ===
> the-tribunal@0.1.0 build
> tsc -b && vite build
vite v8.3.0 building client environment for production...
✓ 39 modules transformed.
dist/index.html                   0.40 kB │ gzip:  0.27 kB
dist/assets/index-BRDnka0L.css    3.32 kB │ gzip:  1.04 kB
dist/assets/index-CbEEZ_qV.js   238.47 kB │ gzip: 75.30 kB
✓ built in 296ms
exit=0
```

**All four gates green. 203 tests, 13 files, 0 failures.** No test was modified.

Per-file test counts, for the documentation tasks' testing summary:

| Tests | File |
| --- | --- |
| 51 | `src/server/anthropicProxy.test.mjs` |
| 27 | `src/llm/anthropicClient.test.ts` |
| 24 | `src/App.test.tsx` |
| 18 | `src/tribunal/engine.test.ts` |
| 16 | `src/tribunal/verdict.test.ts` |
| 14 | `src/data/data.test.ts` |
| 12 | `src/llm/proxyContract.test.ts` |
| 10 | `src/mission-003/qa.originGuard.test.ts` |
| 8 | `src/llm/fakeClient.test.ts` |
| 8 | `src/mission-003/e2e/tribunal.e2e.test.ts` |
| 7 | `src/llm/secretBoundary.test.ts` |
| 5 | `src/llm/client.test.ts` |
| 3 | `src/mission-003/qa.keyMaterial.test.ts` |
| **203** | **13 files** |

### Security check (no tokens spent)

| Check | Result |
| --- | --- |
| Real API key in tracked files | **None.** The only `sk-ant-` literals are self-declared fakes: `src/server/anthropicProxy.test.mjs:29` (`sk-ant-fake-key-for-tests-…`) and mission-003 evidence quoting it. |
| `.env` / `.env.local` on disk | **Neither exists.** |
| `.env` gitignored | **Yes** — `.gitignore:32-35` (`.env`, `.env.*`, `!.env.example`). |
| Root `.env.example` | Exists; variable **names only**, no values. |
| Credential name in production bundle | **Absent** from `dist/`. |
| Fake client in production bundle | **Absent** from `dist/` — the compile-time `import.meta.env.DEV` branch drops it, as `src/main.tsx:17-30` claims. |
| Provider hostname in production bundle | **Absent.** The bundle contains only `/api/llm/complete`, so the browser cannot reach Anthropic directly. |
| Anthropic credential variable in my environment | Not set. **No live provider call was made during this review.** |
| Mission 003 live-run evidence | Preserved, untouched. |

### Environment note (not a repository defect)

This worktree's git pointer files (`.git` and
`.git/worktrees/<name>/gitdir`) contain absolute Windows paths
(`C:/Users/...`), so bare `git` commands fail here with *"not a repository"*.
Git commands in this worktree need explicit `GIT_DIR`/`GIT_WORK_TREE`. Separately,
the working-tree files are CRLF while the committed blobs are LF, so `git status`
reports the entire tree as modified unless `-c core.autocrlf=true` is used — with
it, the tree is clean. Both are local checkout artifacts of a
Windows-created repository, **not** committed defects, and neither affects the
application, the tests or the build.
