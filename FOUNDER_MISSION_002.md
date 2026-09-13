# Founder Mission 002 — Tribunal Engine & Results (authoritative brief)

This file is the complete, verbatim Founder specification for Mission 002.
It is the authoritative source for scope and requirements for this
mission. Do not contradict it. FOUNDER_MISSION_001.md remains the
authoritative source for canonical case facts and the seven profiles —
do not duplicate or restate their substance; import from the existing
`src/data` module.

## Mission

Implement the sequential Tribunal Engine and results experience on top
of the foundation created in Mission 001. Keep the product deliberately
simple. Do NOT add a real external LLM provider yet. The purpose of this
mission is to prove that the complete tribunal workflow works correctly
using the existing LlmClient abstraction and a deterministic/fake client
in tests. Real provider integration will be a separate later mission.

## Current Baseline (Mission 001 — completed and validated)

Vite + React + TypeScript, plain CSS, Vitest + Testing Library, ESLint.
`src/data/` is the single source of truth: canonical case facts, four
representative profiles, three judge profiles, prompt builders. An
`LlmClient` interface exists in `src/llm/` with a not-implemented stub.
Initial Tribunal UI exists with a "Start Tribunal" button that currently
just shows a not-implemented message. Preserve this architecture and
simplicity unless there is a concrete technical reason not to.

## Target User Flow

1. User opens the application; the existing case screen is shown.
2. User presses "Start Tribunal".
3. The application sequentially runs the four representatives, in this
   exact order: (1) Jon Snow, (2) Tyrion Lannister, (3) Daenerys
   Targaryen, (4) Grey Worm. Each representative receives: their own
   profile/system instructions, the canonical case facts, and the
   tribunal transcript so far. Each representative produces one concise
   argument. Each response is appended to the transcript.
4. After all four representatives have spoken, run the three judges
   independently, in this order: (1) Aharon Barak model, (2) Menachem
   Elon model, (3) Meir Shamgar model. Each judge receives: canonical
   case facts, the complete representative transcript, and their own
   judicial reasoning profile. Each judge must return JUSTIFIED or
   NOT_JUSTIFIED plus a concise reasoned opinion.
5. The application displays the full representative transcript and the
   three separate judicial opinions. There must be NO combined majority
   verdict.

## Important Reasoning Rule

Do NOT encode the conclusion into application logic. The code determines
who speaks, speaking order, what context each agent receives, how
responses are collected, and how results are displayed. The LLM
determines arguments, factual interpretation, reasoning, and the final
judicial outcome.

**Core rule: Code orchestrates. The LLM decides.**

Do not hard-code: Jon as justified, Jon as not justified, any
representative's exact argument, or any judge's verdict.

## Engine Design

Implement the smallest clear orchestration layer, conceptually:

```
runTribunal(llmClient)
```
which: (1) creates an empty transcript, (2) sequentially runs the four
representatives, (3) appends each response, (4) runs the three judges
independently using the completed transcript, (5) returns a structured
Tribunal result.

Do not introduce LangChain, LangGraph, CrewAI, agent frameworks, message
queues, event buses, background workers, databases, or complex state
machines unless a requirement absolutely forces one. Normal TypeScript
functions are preferred.

## Structured Result

Simple typed domain models. Conceptually:

- `TribunalResult`: `transcript`, `judicialOpinions`.
- Transcript entry: `participant`, `side/role`, `content`.
- Judicial opinion: `judge`, `verdict`, `reasoning`.

Exact naming is an ordinary engineering decision, left to the team.

## LLM Response Safety

Judge verdicts must be normalized/validated. Only these final verdict
values are valid: `JUSTIFIED`, `NOT_JUSTIFIED`. If the LLM returns
malformed output, the application must fail clearly rather than silently
inventing a verdict. Keep parsing as simple as possible — no complex
schema/agent protocol unless necessary.

## Test Client

Create a deterministic fake/test implementation of `LlmClient`. It must
allow the Tribunal Engine to be exercised without API keys, internet, or
external services. This fake client exists for automated tests, local
development verification, and proving orchestration correctness. Do NOT
use its predetermined fake content as product truth — it is test
infrastructure only, never displayed as if it were a real tribunal
outcome outside of tests/dev-verification.

## UI

Update the existing "Start Tribunal" experience. When pressed: show an
understandable running/loading state; prevent accidental duplicate
execution; run the Tribunal Engine; show the resulting transcript; show
each judge's opinion separately. Keep the UI clean and simple — do not
redesign the whole product. Do not add routing unless genuinely needed;
a single-page experience is preferred. Suggested simple sections: Case →
Start Tribunal → Transcript → Judicial Opinions.

## Error Handling

Minimal, honest error handling. If tribunal execution fails: stop
execution, show a clear error state, do not fabricate missing transcript
entries or verdicts. Avoid complex retry systems in this mission.

## No Real Provider Yet

Do NOT add: OpenAI API integration, Anthropic API integration, API keys,
`.env` secrets, a backend/server proxy, or deployment configuration.
Those belong to a later mission. The architecture should make adding a
real `LlmClient` implementation later straightforward (i.e. do not
paint the engine into a corner that assumes the fake client's shape).

## Testing / Acceptance Criteria

Add focused tests proving at minimum:
1. Representatives run in the required order.
2. Each later representative receives the transcript generated before
   their turn.
3. Four representative messages are produced.
4. Judges run only after the representative transcript is complete.
5. All three judges receive the same completed transcript.
6. Judge outputs remain separate.
7. There is no combined verdict.
8. Valid verdict parsing works.
9. Invalid verdict output fails clearly.
10. Start Tribunal cannot accidentally trigger multiple simultaneous
    runs.
11. The UI renders transcript and three judicial opinions from engine
    output.
12. Existing Mission 001 behavior/data remains intact where applicable.

Keep tests proportional to the size of the project.

## Non-Goals

Do not add: authentication, accounts, database, persistence, routing
(unless required), backend, external APIs, provider credentials,
deployment infrastructure, analytics, streaming, real-time sockets, or
elaborate animations.

## Decision Policy

Routine technical decisions belong to the autonomous team. Prefer, in
order: (1) simpler, (2) fewer dependencies, (3) easier to understand,
(4) easier to test, (5) easier to explain to a lecturer. Do not
interrupt the Founder for normal implementation choices. Escalate only
for genuine Founder-level ambiguity.

## Definition of Done

Mission 002 is DONE only when: sequential Tribunal Engine exists; four
representatives execute in correct order; transcript is accumulated
correctly; all three judges execute independently afterward; typed
result is returned; verdict validation exists; deterministic fake LLM
client exists; UI can run and display the complete flow using the
injected/test client; no real provider/API secret has been introduced;
lint passes; typecheck passes; tests pass; production build passes;
integration is complete; independent QA passes; any QA fix requests are
resolved and revalidated; durable mission evidence is written; final
mission report is produced.

## Final Report (required content)

1. Architecture changes.
2. Tribunal Engine flow.
3. Files added/changed.
4. How transcript/context propagation works.
5. How judge verdicts are validated.
6. What the UI now does.
7. Test/lint/typecheck/build results.
8. Independent QA result.
9. Any findings and fixes.
10. Confirmation that no real provider or secret was added.
11. Smallest recommended Mission 003 for real LLM integration.
