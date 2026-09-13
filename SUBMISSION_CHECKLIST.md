# Submission checklist — The Tribunal

Every line below reflects what was actually checked, when it was checked, and
where. A box is ticked only if the check was run and passed. Anything not yet
true is marked **NOT YET** with what remains.

- **Checked on:** 2026-09-13
- **Checked from:** originally the `task/mission-004-AUTO-SUBMISSION-KIT`
  worktree at commit `d4190b5`; **re-checked on the integrated tree at commit
  `6492bf9`** by `mission-004-AUTO-QA-FINAL`
- **Environment:** Node v22.14.0, npm 10.9.2, Linux
- **Tokens spent:** none. No live provider call was made and no real API key
  was ever set during these checks, in either pass.

> **Scope note, read this first.** This checklist was first written while
> Mission 004 was still split across three unmerged task branches, so several
> boxes read **NOT YET** purely for that reason. **All three branches have
> since landed.** Independent QA re-ran the checklist against the integrated
> tree at `6492bf9` and updated every affected item below; each update is
> marked *(re-checked at `6492bf9`)* and is recorded as a finding in
> `MISSION_004_FINAL_REPORT.md`. No item is now blocked on a branch.

---

## 1. Source code ready

- [x] **Application code is complete and behaves as specified.** Four
      representatives, three judges, sequential turns with transcript context,
      strict verdict validation, honest error handling, real provider behind a
      server-side proxy. 84 files tracked *(re-checked at `6492bf9`; was 80
      before the four Mission 004 documents landed)*; no generated output
      tracked (`dist/` and `node_modules/` are gitignored and absent from
      `git ls-files`).
- [x] **Canonical content matches the brief.** Verified against `src/data/`
      directly: `The Tribunal` / `The Realm v. Jon Snow`; Jon Snow and Tyrion
      Lannister (defense); Daenerys Targaryen and Grey Worm (prosecution);
      `Aharon Barak model`, `Menachem Elon model`, `Meir Shamgar model`; 11
      canonical facts; verdict tokens `JUSTIFIED` / `NOT_JUSTIFIED`.
      Independently re-verified line-by-line against `FOUNDER_MISSION_001.md`
      by `AUTO-CODE-REVIEW`, which found no mismatch.
- [x] **No combined or majority verdict anywhere.** `TribunalResult` has
      exactly two fields (`transcript`, `judicialOpinions`) — there is no field
      for an aggregate to live in — and the UI renders a lead-in saying the
      opinions are not combined. Confirmed on screen in the browser smoke test
      below.

## 2. README complete

- [x] **Done** *(re-checked at `6492bf9`)*. The finalized `README.md` landed.
      Independent QA verified it against `FOUNDER_MISSION_004.md`'s list and
      found every required element present: overview and central question,
      the academic multi-agent concept, the simple flow diagram, the verbatim
      principle *Code orchestrates. The LLM decides.*, the
      deterministic-vs-LLM split, the stack actually used, exact setup
      commands, environment variable **names only**, the `ANTHROPIC_API_KEY`
      vs `CLAUDE_CODE_OAUTH_TOKEN` distinction, a testing summary, the
      server-side-key security explanation, and an honest limitations section.
- [x] **All nine stale claims from `CODE_REVIEW_NOTES.md` section (f) are
      closed.** The two that affected a reader following the setup
      instructions were re-verified specifically:
  - the README no longer offers an `npm run proxy` script or a Vite
    `server.proxy` entry — it now states explicitly that neither exists and
    gives the `node src/server/anthropicProxy.mjs` form. Confirmed against
    `package.json` (scripts are exactly `dev`, `build`, `preview`, `lint`,
    `test`, `typecheck`) and `vite.config.ts` (no `server` key).
  - the `.gitignore` claim is gone; `.gitignore` lines 32–35 do cover `.env`,
    `.env.*` and `!.env.example`, as the README now says.

## 3. Architecture document

- [x] **Done** *(re-checked at `6492bf9`)*. `ARCHITECTURE.md` exists at the
      repository root and covers all nine topics
      `FOUNDER_MISSION_004.md` requires: core modules, the Tribunal Engine,
      the `LlmClient` abstraction, the fake client, the real Anthropic client,
      the local proxy, transcript flow, judge execution and the security
      boundary. Its proxy line accounting (666 total / 381 code / 179 comment
      / 106 blank) was reproduced independently and is exact.
- [x] **`DEMO_WALKTHROUGH.md` beat 10 needs no fallback** — it tells the
      presenter to open `ARCHITECTURE.md`, and the file is there.

## 4. Setup instructions verified

- [x] **`npm install` works from a clean tree.** Run here: 237 packages added,
      0 vulnerabilities.
- [x] **Token-free dev mode works.** `npm run dev` starts Vite, serves the app
      and runs a complete tribunal through the deterministic fake client. Done
      end to end in a real browser (see item 9).
- [x] **Production build and validation commands work.** `npm run build`,
      `npm run lint`, `npm run typecheck`, `npm test` all run and pass (item
      6/7).
- [x] **The real-provider commands are correct as written.** The two-terminal
      form — `ANTHROPIC_API_KEY=<key> node src/server/anthropicProxy.mjs`, then
      `VITE_TRIBUNAL_LLM=real npm run dev` (or
      `npm run build && npm run preview`) — matches `package.json`, the proxy
      script's actual entry point, and the client-selection logic in
      `src/main.tsx`.
- [ ] **NOT YET: the real-provider path was not re-executed in this mission.**
      Deliberately. Running it spends real API tokens, and Mission 004
      materially changed no provider, security or orchestration code, so
      Mission 003's validated live run still stands (item 8). The commands are
      verified by inspection, not by a fresh live run.
- **One documented sharp edge, worth fixing or flagging:** the proxy's origin
  guard allows only `:5173` and `:4173` by default. If port 5173 is busy, Vite
  silently falls back to 5174 and a real run then fails with an origin error.
  Observed here — Vite chose 5174 during the smoke test. The escape hatch is
  `TRIBUNAL_ALLOWED_ORIGINS`. Recorded in `DEMO_WALKTHROUGH.md` as a pre-flight
  step.

## 5. `.env.example` safe

- [x] **Verified safe.** Root `.env.example` contains variable **names only** —
      every assignment is empty, and the file says in its own header never to
      put a real value in it. Read in full for this check.
- [x] It correctly separates the proxy-process variables (`ANTHROPIC_API_KEY`,
      `ANTHROPIC_MODEL`, `ANTHROPIC_MAX_TOKENS`, `ANTHROPIC_BASE_URL`,
      `TRIBUNAL_PROXY_PORT`, `TRIBUNAL_ALLOWED_ORIGINS`) from the two
      browser-inlined ones (`VITE_TRIBUNAL_LLM`, `VITE_TRIBUNAL_PROXY_URL`),
      and warns that `VITE_`-prefixed values are inlined into the bundle.
- [x] No variable belonging to the development runtime that built this project
      appears in it.

## 6. Tests passing

- [x] **`npm test` → 203 tests, 13 files, 0 failures, exit 0.** Real run in
      this worktree, 55.78s. No test was modified by this task.
- [x] **`npm run lint` → exit 0.**
- [x] **`npm run typecheck` → exit 0.**

## 7. Build passing

- [x] **`npm run build` → exit 0.** `tsc -b && vite build`, 39 modules
      transformed; `dist/index.html` 0.40 kB, CSS 3.32 kB, JS 238.47 kB
      (gzip 75.30 kB).

## 8. Real Tribunal run previously validated

- [x] **Validated in Mission 003 and preserved.** Evidence is intact and
      untouched under `src/mission-003/evidence/` — eight files, including
      `live-acceptance-run-operator.txt`, which records the operator's real
      paid run: exactly 7 successful `POST /api/llm/complete` calls (four
      representatives + three judges), correct speaking order, real
      non-placeholder arguments, three separate judicial opinions, ~20–30s wall
      clock, and zero browser requests to any host other than the local proxy.
- [x] **Re-earning it is not required.** No provider, security or orchestration
      code was materially changed in Mission 004. The only source edits across
      the mission's branches are two code comments (`AUTO-CODE-REVIEW`), which
      change no behaviour and no rendered output.

## 9. Demo walkthrough ready

- [x] **`DEMO_WALKTHROUGH.md` exists at the repository root.** Eleven beats
      with per-beat time budgets totalling ≈ 4m10s, speaker notes, a
      pre-flight, and a recovery table.
- [x] **Every screen element it points at was confirmed to exist**, in a real
      headless Chromium (151.0.7922.169) driven over the DevTools Protocol
      against `npm run dev` — the deterministic fake-client mode, so **no
      provider call and no tokens**. Confirmed on screen, in order: the `The
      Tribunal` h1 and the `The Realm v. Jon Snow` case line; `Case background`
      with the central question and its four considerations; `Defense
      representatives` (Jon Snow, Tyrion Lannister); `Prosecution
      representatives` (Daenerys Targaryen, Grey Worm); `Independent judicial
      panel` (Aharon Barak model, Menachem Elon model, Meir Shamgar model); the
      `Begin` heading and the single `Start Tribunal` button; the dev-preview
      warning; after the click, the completion status line, a `Transcript`
      section listing the four speakers in the order Jon Snow → Tyrion
      Lannister → Daenerys Targaryen → Grey Worm with `Defense`/`Prosecution`
      labels, and a `Judicial opinions` section with its "not combined into a
      single verdict" lead-in and exactly three `Verdict:` lines in the order
      Barak → Elon → Shamgar.
- [x] **No majority or aggregate text on the page.** Probed the rendered
      document: no "majority", no "the tribunal finds", exactly three verdict
      lines, and the page ends after the third opinion.
- [ ] **NOT YET: the demo has not been rehearsed against the real provider.**
      By design — that costs tokens. The presenter should do one paid rehearsal
      run before the live session, following the pre-flight in
      `DEMO_WALKTHROUGH.md`.

## 10. No secrets committed

- [x] **No real API key in any tracked file.** Scanned all 80 tracked files for
      `sk-ant-`: every hit is either a documentation ellipsis (`sk-ant-...` in
      a command example) or a fixture whose own value declares it fake. No
      key-shaped literal exists.
- [x] **No `.env` on disk.** The only `.env*` file present is `.env.example`.
- [x] **`.env` is gitignored** — `.gitignore` lines 32–35.
- [x] **The production bundle is clean.** Grepped `dist/` after a real build:
      no API key, no `api.anthropic.com`, no `x-api-key` header, and no fake
      client (the compile-time `import.meta.env.DEV` branch drops it).
      *(Re-checked at `6492bf9` with a clean `npm run build`, and this item is
      **stricter** than first written: the counts are `ANTHROPIC_API_KEY` 0,
      `api.anthropic.com` 0, `x-api-key` 0, `sk-ant-` 0,
      `CLAUDE_CODE_OAUTH_TOKEN` 0, `deterministic test client` 0. The **only**
      provider-related string in the bundle is the local path
      `/api/llm/complete`. An earlier version of this line also credited the
      bundle with a human-readable error hint naming the credential variable —
      that was wrong: the hint is emitted by the proxy server-side and travels
      in the HTTP response body at run time, and is not compiled in.)*
- [x] **Browser code cannot reach the provider directly.**
      `src/llm/anthropicClient.ts` holds no key, no provider hostname and no
      auth header; it POSTs only to the local proxy.
      `src/llm/secretBoundary.test.ts` enforces that boundary on every test
      run, and `src/mission-003/qa.keyMaterial.test.ts` scans all of `src/`
      with no exemptions for key-shaped material.
- [x] **No secret was handled during this mission.** `ANTHROPIC_API_KEY` was
      never set in this environment.

## 11. Repository clean

- [x] **Working tree clean.** No untracked or modified files beyond this
      task's own two documents. *(Re-checked at `6492bf9` on the integrated
      tree: `git status --porcelain` is empty.)*
- [x] **No generated or temporary artifacts tracked.** No `dist/`, no
      `node_modules`, no debug output, no `.env`.
- [x] **Mission 003's audit trail is intact.** `src/mission-003/` was not
      modified, moved or deleted.
- [x] **The Mission 004 branches are merged** *(re-checked at `6492bf9`)*.
      `AUTO-CODE-REVIEW`'s notes and two comment fixes, `AUTO-DOCS-CORE`'s
      `README.md` and `ARCHITECTURE.md`, and `AUTO-SUBMISSION-KIT`'s
      `DEMO_WALKTHROUGH.md` and `SUBMISSION_CHECKLIST.md` are all present in
      one integrated tree. That integrated tree is what must be submitted.
- **Local environment artifact, not a repository defect:** this worktree's git
  pointer files hold absolute Windows paths, and the working-tree files are
  CRLF while the committed blobs are LF — so bare `git` commands need an
  explicit git-dir here, and `git status` reports the whole tree as modified
  unless `core.autocrlf=true` is set. With it set, the tree is clean. Nothing
  committed is affected, and neither affects the app, the tests or the build.

## 12. Root files outside this task's write policy

- [x] **Resolved with no root-file change needed** *(re-checked at
      `6492bf9`)*. The open decision was whether `package.json` should gain a
      `"proxy"` script or the README should stop offering `npm run proxy`. The
      finalized README took the second route: it states explicitly that no
      `npm run proxy` script and no Vite `server.proxy` entry exist, and
      documents the `node src/server/anthropicProxy.mjs` form that
      `DEMO_WALKTHROUGH.md` already used. Every documented command now
      matches the repository.
- **No root file outside the documentation write policy needs any change.**
  `package.json`, `vite.config.ts`, `tsconfig*.json`, `eslint.config.js`,
  `index.html` and `package-lock.json` are all correct as they stand, and
  independent QA re-confirmed this at `6492bf9`.

---

# External course requirements still to verify

**None of the following is known, and nothing below has been assumed, inferred
or filled in.** A human must confirm each against the course's own
instructions before submitting. Do not treat any of these as answered.

| # | Unknown | Status |
| --- | --- | --- |
| 1 | **Required submission platform** — where the work is actually handed in | **UNKNOWN — must be confirmed by a human** |
| 2 | **Deadline** — the submission date and time, and the timezone it is stated in | **UNKNOWN — must be confirmed by a human** |
| 3 | **Required video format** — whether a recorded demo is required at all, and if so its length, file format, resolution, narration language and hosting/upload method | **UNKNOWN — must be confirmed by a human** |
| 4 | **Required written report format** — whether a written report is required separately from this repository's documentation, and if so its structure, length, language, file format and citation expectations | **UNKNOWN — must be confirmed by a human** |
| 5 | **Repository / link requirements** — whether a repository link is required, whether it must be public or private, whether specific access must be granted, and whether an archive is wanted instead of or in addition to a link | **UNKNOWN — must be confirmed by a human** |

Once these are confirmed, check them against what this repository actually
contains: items 1–11 above cover the code, documentation and validation, but
they say nothing about packaging, hosting or a recorded video, because none of
those requirements are known.
