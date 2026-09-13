# Founder Mission 004 — Final Polish & Submission (authoritative brief)

This is the FINAL development mission for The Tribunal. The application is
functionally complete (Missions 001-003 done and validated). This mission
is about polish, documentation, evidence, reproducibility and submission
readiness — NOT new features. FOUNDER_MISSION_001/002/003.md remain
authoritative for canonical facts, profiles and architecture; do not
restate or alter their substance.

## Core rule

Do NOT introduce new product scope unless a real defect requires it. Do
NOT add: new tribunal participants, additional cases, additional LLM
providers, authentication, database, persistence, streaming, WebSockets,
analytics, admin screens, prompt editors, deployment infrastructure,
elaborate animations, new agent frameworks, or unnecessary abstractions.
The application already works — do not redesign it.

## Current verified product (preserve exactly)

Canonical case facts; four representatives (Jon Snow, Tyrion Lannister —
defense; Daenerys Targaryen, Grey Worm — prosecution); three judicial
models (Aharon Barak, Menachem Elon, Meir Shamgar); sequential
representative discussion with transcript context propagation; three
independent judge executions; strict JUSTIFIED/NOT_JUSTIFIED verdict
validation; no combined verdict; real Anthropic API integration via a
server-side proxy; deterministic fake client for tests; honest error
handling. Mission 003 completed a validated real live run: exactly 7/7
real Anthropic calls, correct order, real context propagation, all three
judges, separate reasoning, no fake-client output, no secret exposed, full
automated validation green. Preserve this behavior exactly.

## Objectives

1. Final repository and product review.
2. Fix only real defects, obvious presentation problems, stale
   documentation, confusing instructions, or submission-readiness issues.
3. Prepare clear academic documentation.
4. Prepare a concise demo/walkthrough.
5. Ensure another person can clone/open the project and understand what it
   does, how it works, how to run it, how the multi-agent design works,
   how secrets are configured safely, and how it was validated.
6. Finish with independent QA and final validation.

## README — final version

Finalize `README.md` at the repo root. It should clearly and concisely
contain: project overview (The Tribunal — The Realm v. Jon Snow, and the
central question); academic concept (this demonstrates a multi-agent
reasoning workflow; the four representatives reason from the case record
and their procedural side does not predetermine their exact arguments; the
judges have different reasoning methodologies; judge outcomes are not
hard-coded); architecture with a simple readable flow diagram (Case Facts
→ Representative 1 → 2 → 3 → 4 → Completed Transcript → Barak / Elon /
Shamgar → Three Independent Opinions) — do not make the diagram more
complicated than the implementation; the explicit code principle "Code
orchestrates. The LLM decides."; the stack actually used (nothing more);
local setup with exact commands for install, dev/test mode, real-provider
mode, proxy startup, production build/preview, and validation; environment
variable NAMES only (never a real secret), clearly distinguishing
`ANTHROPIC_API_KEY` from anything belonging to the AutonomousDevTeam
development runtime (e.g. `CLAUDE_CODE_OAUTH_TOKEN`, which is unrelated to
this product and must never be mentioned as if it were); a testing summary;
a brief security explanation of why the API key stays server-side; and a
short, honest limitations section.

## Submission walkthrough

Create `DEMO_WALKTHROUGH.md` at the repo root: a concise 3-5 minute demo
script with these beats — introduce The Tribunal; state the case in 1-2
sentences; show the four representatives; explain the three judicial
approaches; press Start Tribunal; explain representatives run sequentially
and receive prior transcript context; show the generated transcript; show
the three independent judicial opinions; point out there is no combined
verdict; briefly show the architecture/code organization; mention the API
secret never reaches the browser. Include concise speaker notes. Keep it
short — not a long presentation script.

## Architecture document

Create `ARCHITECTURE.md` at the repo root (unless README's own architecture
section is already sufficient — use judgment, but a dedicated concise
one-pager is preferred for a submission). Include: core modules; the
Tribunal Engine; the LlmClient abstraction; the fake client; the real
Anthropic client; the local proxy; transcript flow; judge execution; the
security boundary. One page of useful explanation, not a large design
document.

## Project structure review

Check for and clean up (where clearly disposable and safe): obsolete
temporary files, accidental duplicate reports, stale documentation,
generated files that should not be tracked, secrets, local `.env` files,
debug output, dead code, misleading comments, old fake/demo artifacts
presented as if they were real product output. Do NOT delete historical
evidence unless clearly disposable and safe to remove. Do NOT destroy the
Mission 003 audit/evidence trail (`src/mission-003/`).

## UI polish

Light polish only, if needed: spacing, hierarchy, loading/error clarity,
transcript readability, judge opinion readability, responsive behavior on
a normal laptop screen. Do NOT redesign the application or introduce a UI
framework.

## Content review

Verify the shipped product still accurately reflects the canonical
dossier: participant names, defense/prosecution grouping, canonical facts,
central question, judge profiles, representative profiles. Do not
materially rewrite the case or invent new canonical facts.

## Complexity review

Brief maintainability review, especially of `src/server/anthropicProxy.mjs`
(~643 lines per Mission 003). Do NOT refactor merely because it is long.
Only simplify if complexity can be materially reduced, behavior stays
identical, security protections stay intact, tests prove equivalence, and
it becomes meaningfully easier to explain. If simplification carries
meaningful regression risk, leave the validated implementation intact and
document why, rather than risk it.

## Academic integrity of the implementation

Make it easy to explain which work is deterministic application code
(participant order, transcript accumulation, context delivery, output
validation, UI state) versus which work is the LLM's (arguments,
interpretation, reasoning, judicial conclusion). Do not claim the system
performs capabilities it does not actually perform.

## Final security check

Before completion, confirm: no real Anthropic API key exists in git; no
`.env` with a real secret is tracked; no key appears in the production
browser bundle; no key appears in README/docs; no key appears in mission
evidence; browser code does not call Anthropic directly; real provider
access stays server-side. Do not output secret values while checking.

## Final validation

Run lint, typecheck, the full automated test suite, and the production
build. Also perform a final browser smoke test. The smoke test does NOT
need to consume another real seven-call Tribunal run unless a code change
in this mission affects real provider/security/orchestration behavior — if
none of that is materially changed, preserve Mission 003's validated
real-run evidence and avoid unnecessary API spend. If such code IS
materially changed, repeat the necessary real integration validation.

## Submission checklist

Create `SUBMISSION_CHECKLIST.md` at the repo root: source code ready,
README complete, setup instructions verified, `.env.example` safe, tests
passing, build passing, real Tribunal run previously validated, demo
walkthrough ready, no secrets committed, repository clean. Do not invent
the lecturer's exact external submission requirements. Include a clearly
labeled section "External course requirements still to verify" listing
only genuine unknowns (required submission platform, deadline, required
video format, required written report format, repository/link
requirements) — do not guess at answers for these.

## AutonomousDevTeam write-policy note

The operator has already applied a small, safe fix to the AutonomousDevTeam
package (before this mission started) so that root-level documentation
(`*.md`) and the two safety-relevant root files (`.gitignore`,
`.env.example`) are now within the standard write policy, regardless of
project type. This should let you create/edit `README.md`,
`ARCHITECTURE.md`, `DEMO_WALKTHROUGH.md`, `SUBMISSION_CHECKLIST.md`,
`.gitignore` and `.env.example` directly, without the root-file
quarantine issue prior missions hit. Verify this works for you; if some
other root-level file still needs a change and is not covered, note it
explicitly rather than silently working around it.

## Definition of Done

Final repository review completed; README finalized; demo walkthrough
prepared; architecture documentation clear; submission checklist
prepared; UI reviewed and any necessary minor polish completed; canonical
content verified; security review passed; no secrets committed/exposed;
lint passes; typecheck passes; tests pass; production build passes;
browser smoke test passes; independent QA passes; QA findings
resolved/revalidated; git working tree clean; final project report
produced.

## Final report (required content)

1. Final project status.
2. Final stack.
3. Final architecture.
4. Main user flow.
5. Multi-agent design.
6. Real provider integration.
7. Security model.
8. Final automated validation results.
9. Independent QA result.
10. Documentation/submission artifacts created.
11. Any final polish/refactors performed.
12. Known limitations.
13. Any external course requirements still unknown.
14. Exact commands needed to demonstrate the project.
15. Confirmation that no secrets are committed.
16. Confirmation that the project is ready for academic submission.

Do NOT propose another product mission unless a genuine blocker remains —
this should be the final development mission for The Tribunal.
