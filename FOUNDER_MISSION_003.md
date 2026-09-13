# Founder Mission 003 — Real LLM Provider Integration (authoritative brief)

This file is the complete, verbatim Founder specification for Mission 003.
It is authoritative for this mission's scope. FOUNDER_MISSION_001.md and
FOUNDER_MISSION_002.md remain authoritative for canonical facts, the seven
profiles, and the Tribunal Engine architecture — do not restate their
substance, do not redesign what they already established.

## Mission

Connect The Tribunal to ONE real LLM provider through the existing
`LlmClient` seam and validate a complete real Tribunal run. Keep the
product as simple as possible.

## Provider decision (already made by the Founder — do not re-litigate)

**Provider: Anthropic**, via its Messages API (a single HTTP call per
turn). The operator has arranged for the credential to be available as
the environment variable `ANTHROPIC_API_KEY` on the machine that runs the
live acceptance test — this is a different secret from
`CLAUDE_CODE_OAUTH_TOKEN`, which belongs to the development-team runtime
and must NEVER be reused as this application's LLM credential and must
NEVER be read by any code in this repository.

Do not build a multi-provider framework or a provider-selection UI —
exactly one provider, wired directly.

## Current Baseline (Mission 001 + 002 — completed and validated)

Vite + React + TypeScript, plain CSS, Vitest + Testing Library, ESLint.
`src/data/` is the single source of truth for canonical facts and the
seven profiles. `src/tribunal/engine.ts` (`runTribunal`) already
sequentially runs the four representatives then the three judges
independently, using the `LlmClient` interface in `src/llm/client.ts`.
`src/llm/fakeClient.ts` is a deterministic fake used by tests and a
dev-mode preview. `src/tribunal/verdict.ts` already strictly validates
judge verdicts to exactly `JUSTIFIED` / `NOT_JUSTIFIED`, throwing
`InvalidVerdictError` on anything else. The UI (`StartTribunalSection`,
`TranscriptSection`, `JudicialOpinionsSection`) already renders a full run,
with a running/loading state, a re-entry guard, and an honest error state.

**Do not redesign any of this.** A successful provider integration should
require little or no change to `runTribunal()` itself — that function
should keep working unmodified against any `LlmClient` implementation.

## Target Flow (unchanged from Mission 002, now with a real backend)

User presses Start Tribunal → 4 real representative LLM calls run
sequentially, each appended to the transcript → 3 real judge LLM calls run
independently against the completed transcript, each returning
`JUSTIFIED` or `NOT_JUSTIFIED` plus concise reasoning → the existing UI
renders the real transcript and the three separate judicial opinions. No
combined verdict. Seven LLM calls total per run.

## Security requirement (non-negotiable)

The Anthropic API key must never be shipped to the browser and the browser
must never call Anthropic directly with a secret key. Introduce the
smallest reasonable server-side proxy to protect the credential:

```
Browser -> local server endpoint -> Anthropic Messages API
```

The proxy: reads the key from its own server-side environment only,
accepts the minimum input needed (system prompt + conversation so far, or
equivalent), calls Anthropic, returns the generated text, never echoes or
logs the key, and surfaces provider/network errors honestly (no
fabrication, no silent fallback to the fake client).

Do not put Tribunal orchestration logic in the proxy — `runTribunal` stays
where it is; the proxy is a thin transport, nothing more.

Keep the server as small as the stack allows. A single Vite server
middleware/plugin (so `npm run dev` keeps working as one process, and
`vite preview`/build can still serve it) is a reasonable, minimal choice
if it cleanly satisfies the security requirement — but this is an ordinary
technical decision the team may resolve differently if something simpler
or more robust fits equally well. Do not introduce a database, auth,
queues, microservices, Kubernetes, an agent framework, or an unnecessary
backend framework. A provider SDK is unnecessary — a simple server-side
`fetch` to Anthropic's REST API is sufficient and preferred.

## Configuration

Add `.env.example` at the repo root containing variable NAMES only (at
minimum `ANTHROPIC_API_KEY=`), no real values. Ensure real `.env`/secret
files are covered by `.gitignore`. Never commit an API key, token, or any
local secret value. The README must clearly explain local configuration:
which variable to set, and that it must never be exposed to the browser.

## Real LlmClient adapter

Implement a real `LlmClient` (matching the existing interface in
`src/llm/client.ts`) that calls the server-side proxy endpoint over HTTP
from the browser side. `runTribunal` must consume it exactly like the fake
client, with zero awareness of what's behind the interface. Keep the
adapter small — request construction, response parsing, and error
propagation only.

## Prompt / output contract (preserve exactly)

Code orchestrates, the LLM decides: representatives get no predetermined
arguments, judges get no predetermined verdicts, canonical facts stay
fixed. Judge responses must keep the existing strict contract already
implemented in `src/tribunal/verdict.ts` and `src/data/prompts.ts`
(`VERDICT: JUSTIFIED` or `VERDICT: NOT_JUSTIFIED` followed by concise
reasoning) — do not weaken, bypass, or duplicate this validation; a
malformed real response must fail exactly like a malformed fake one
already does (`InvalidVerdictError`, run aborts, no invented verdict).

## Model choice

Use a small/fast Anthropic model suited to concise reasoning and reliable
instruction-following (the team should pick a specific current model id
appropriate for this — do not default to the most expensive/largest
option, and do not chase maximum intelligence for a task this bounded).
Seven calls happen per run; keep each prompt as concise as the existing
prompt builders already make them (they are not to be shortened at the
cost of losing the character/judicial distinctions already specified in
Missions 001/002).

## UI

Do not redesign anything. Reuse the existing Start Tribunal flow, loading
state, transcript UI, judicial opinion UI, error state, and duplicate-run
protection exactly as Mission 002 built them. At most add small, honest
messaging for provider configuration/error conditions (e.g. "no API key
configured" surfacing through the existing error state, not a new UI
paradigm).

## Failure behavior

Missing key, provider rejection, network failure, malformed response, or
an invalid judge verdict must all fail clearly through the existing error
state. Never fabricate a missing argument or verdict. Never silently fall
back to the fake client during what is meant to be a real run.

## Testing

Keep the fake client as the deterministic implementation used by all
existing unit/UI tests — do not make any existing test spend real provider
tokens. Add focused tests (using mocks, not real network calls) for: real
client request construction, proxy request validation, missing-credential
behavior, provider-error propagation, confirmation the secret never
appears in browser-facing code/bundles, and continued engine compatibility
(the existing `runTribunal` tests must keep passing unmodified against the
fake client). Do not add an integration test that spends real tokens as
part of the normal automated `npm test` run — that is out of scope here;
the one real run happens as a separate, explicit live acceptance step,
performed by the operator after automated validation passes, not by the
implementation/QA agents' own token-free validation loop.

## Live acceptance test (performed by the operator, not the automated agents)

After automated validation and independent QA pass, the operator will run
one real end-to-end Tribunal run locally with the real
`ANTHROPIC_API_KEY` configured, and verify: all four representatives
produced real non-placeholder arguments; transcript order is correct;
later representatives received prior transcript context; all three judges
ran and produced separate opinions; verdict parsing succeeded validly; no
combined verdict appeared; the provider secret was never exposed in the
browser, logs, or evidence; no fake-client fingerprint/placeholder text
appears anywhere in the real run's output. The implementation must make
this straightforward to do (e.g. `npm run dev` or `npm run preview` with
the key set in the server process's own environment, no extra manual
wiring).

## Non-goals

Do not add: user accounts, database, persistent case history, multiple
cases, multiple providers, provider-selection UI, streaming, WebSockets,
analytics, a deployment platform, elaborate retry systems, a prompt
editor, or an admin panel.

## Decision Policy

Routine technical decisions (exact proxy structure, filenames, TypeScript
organization, test structure, HTTP payload shape, ordinary error handling,
styling details) belong to the autonomous team — resolve them, do not
escalate. Escalate only for a genuine Founder-level issue: no usable
credential, a paid-action approval, an unresolvable security-sensitive
choice, or a major product ambiguity.

## Definition of Done

One real provider implemented; secret stays server-side; `.env.example`
has names only; real secret files are gitignored; the real `LlmClient`
works through the existing interface; `runTribunal`'s architecture is
intact; the fake client remains available for deterministic tests;
missing-credential behavior is clear; provider errors are surfaced
honestly; lint/typecheck/automated tests/production build all pass;
independent QA passes with findings resolved/revalidated; one real
seven-call Tribunal run succeeds (performed by the operator) with the
transcript and all three opinions rendering correctly and no combined
verdict; no credential appears anywhere in the repository, the browser
bundle, logs, reports, screenshots, or mission evidence; durable mission
evidence is written; a final mission report is produced.

## Final Report (required content)

1. AutonomousDevTeam task-graph bug root cause.
2. Exact fix and validation performed.
3. Confirmation that Mission 003 used a fresh Coordinator decomposition.
4. Provider selected and why.
5. Server/proxy architecture.
6. How secrets are protected.
7. Files added/changed.
8. Confirmation that `runTribunal()` architecture remained intact.
9. Real LLM client behavior.
10. Automated validation results.
11. Independent QA result.
12. Real end-to-end Tribunal run result.
13. Approximate number of model calls and observed runtime for one run.
14. Confirmation that no secrets were exposed or committed.
15. Any remaining limitations.
16. Smallest recommended Mission 004 for final polish/submission.
