# Submission checklist — The Tribunal

Every line below reflects what was actually checked, when it was checked, and
where. A box is ticked only if the check was run and passed. Anything not yet
true is marked **NOT YET** with what remains.

- **Checked on:** 2026-09-13
- **Checked from:** the `task/mission-004-AUTO-SUBMISSION-KIT` worktree, at
  commit `d4190b5` plus this task's own two documents
- **Environment:** Node v22.14.0, npm 10.9.2, Linux
- **Tokens spent:** none. No live provider call was made and no real API key
  was ever set during these checks.

> **Scope note, read this first.** Mission 004 is split across three task
> branches that have not been merged yet. This task (`AUTO-SUBMISSION-KIT`)
> owns `DEMO_WALKTHROUGH.md` and `SUBMISSION_CHECKLIST.md`. `AUTO-DOCS-CORE`
> owns `README.md` and `ARCHITECTURE.md`; `AUTO-CODE-REVIEW` owns
> `src/mission-004/CODE_REVIEW_NOTES.md`. Several boxes below therefore read
> **NOT YET** purely because the work sits on a branch that has not landed on
> the integration branch. Re-run this checklist after the integration merge.

---

## 1. Source code ready

- [x] **Application code is complete and behaves as specified.** Four
      representatives, three judges, sequential turns with transcript context,
      strict verdict validation, honest error handling, real provider behind a
      server-side proxy. 80 files tracked; no generated output tracked
      (`dist/` and `node_modules/` are gitignored and absent from
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

- [ ] **NOT YET.** `README.md` is owned by `mission-004-AUTO-DOCS-CORE` and its
      final version had not been committed when this was checked — that branch
      was still at `d4190b5`, carrying the Mission-002-era README.
- **What remains:** `AUTO-DOCS-CORE` must land the finalized README, and it
  must correct the claims `AUTO-CODE-REVIEW` verified as false or stale in the
  current text. Two of those directly affect a reader following the setup
  instructions:
  - it offers an `npm run proxy` script and a Vite `server.proxy` entry as
    available conveniences — **neither exists** (`package.json` scripts are
    exactly `dev`, `build`, `preview`, `lint`, `test`, `typecheck`, and
    `vite.config.ts` has no `server` key). Anyone following it hits
    `npm error Missing script: "proxy"`.
  - it says the current `.gitignore` does not cover a plain `.env`. It does —
    `.gitignore` lines 32–35 cover `.env`, `.env.*` and `!.env.example`.
  - The full list of nine is in `src/mission-004/CODE_REVIEW_NOTES.md`,
    section (f). Both points above were re-verified independently for this
    checklist.

## 3. Architecture document

- [ ] **NOT YET.** `ARCHITECTURE.md` does not exist at the repository root on
      any branch yet. It is owned by `mission-004-AUTO-DOCS-CORE`.
- **What remains:** that task must create it. Note that `DEMO_WALKTHROUGH.md`
  beat 10 tells the presenter to open it — if it does not ship, that beat must
  fall back to the README's architecture section.

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
      client (the compile-time `import.meta.env.DEV` branch drops it). The only
      provider-related strings are the local path `/api/llm/complete` and a
      human-readable error hint naming the credential variable and the proxy
      start command — no secret value, by construction.
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
      task's own two documents.
- [x] **No generated or temporary artifacts tracked.** No `dist/`, no
      `node_modules`, no debug output, no `.env`.
- [x] **Mission 003's audit trail is intact.** `src/mission-003/` was not
      modified, moved or deleted.
- [ ] **NOT YET: the Mission 004 branches are not merged.** As checked,
      `task/mission-004-AUTO-CODE-REVIEW` carries its notes and two comment
      fixes, `task/mission-004-AUTO-SUBMISSION-KIT` carries these two
      documents, and `task/mission-004-AUTO-DOCS-CORE` has not committed. The
      submitted repository must be the integrated result, not any single
      branch.
- **Local environment artifact, not a repository defect:** this worktree's git
  pointer files hold absolute Windows paths, and the working-tree files are
  CRLF while the committed blobs are LF — so bare `git` commands need an
  explicit git-dir here, and `git status` reports the whole tree as modified
  unless `core.autocrlf=true` is set. With it set, the tree is clean. Nothing
  committed is affected, and neither affects the app, the tests or the build.

## 12. Root files outside this task's write policy

- [ ] **NOT YET — one decision is open and needs a human or the integrator.**
      `package.json` either needs `"proxy": "node src/server/anthropicProxy.mjs"`
      added to `scripts`, **or** the final README must stop offering
      `npm run proxy`. Right now the committed README documents a command that
      does not exist. `DEMO_WALKTHROUGH.md` avoids it entirely and uses the
      `node` form, which works today. `AUTO-CODE-REVIEW` recommends adding the
      script; either resolution closes the item, but one of them must happen.
- No other root file needs a change. `tsconfig*.json`, `eslint.config.js`,
  `index.html` and `vite.config.ts` are correct as they stand.

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
