# The Tribunal — running it against the real provider

Operator guide for Mission 003. Written by `mission-003-AUTO-QA`.

This file exists here rather than in the root `README.md` because the team that
built Mission 003 could only write under `src/`. The matching root-README
content is staged at `root-artifacts/readme-configuration.md` and should be
applied there — see [Before you start](#before-you-start).

---

## The shape of it

```
Browser  ──HTTP──▶  local proxy (node, 127.0.0.1:8787)  ──HTTPS──▶  Anthropic
```

Two processes. The browser never holds the key and never talks to Anthropic.
The proxy is the only thing in the repository that ever sees the credential,
and it reads it from its own process environment.

---

## Before you start

Three files at the repository root are required by `FOUNDER_MISSION_003.md` and
could not be created by the build team. **Apply them now.** The first is
security-relevant.

| Apply this | To this | Why |
| --- | --- | --- |
| `root-artifacts/gitignore.additions.txt` | append to `.gitignore` | **A plain `.env` is not ignored today.** `*.local` is covered; `.env` is not. Do this before anyone writes a real key to disk. |
| `root-artifacts/env.example.txt` | create `.env.example` | Required by the Definition of Done. Variable **names** only — never fill in a value and commit it. |
| `root-artifacts/readme-configuration.md` | add to `README.md` | Required: the README must explain local configuration. |

Optional conveniences, neither of which anything depends on:
`root-artifacts/package.json.scripts.txt` (an `npm run proxy` shorthand) and
`root-artifacts/vite.config.ts.snippet.txt` (a dev-only same-origin proxy).

---

## Environment variables

**Read by the proxy process only.** Set these in the terminal you start the
proxy in. **Never prefix any of them with `VITE_`** — Vite inlines every
`VITE_`-prefixed variable into the browser bundle.

| Variable | Required | Default |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | **yes** | none — the proxy refuses every request without it |
| `ANTHROPIC_MODEL` | no | `claude-haiku-4-5-20251001` |
| `ANTHROPIC_MAX_TOKENS` | no | `1024` |
| `ANTHROPIC_BASE_URL` | no | `https://api.anthropic.com` |
| `TRIBUNAL_PROXY_PORT` | no | `8787` (always bound to `127.0.0.1`) |
| `TRIBUNAL_ALLOWED_ORIGINS` | no | the Vite dev (`:5173`) and preview (`:4173`) origins, on both `localhost` and `127.0.0.1` |

**Read by the browser build** — inlined into the bundle, so never a secret:

| Variable | Meaning |
| --- | --- |
| `VITE_TRIBUNAL_LLM` | `real` opts a **dev** server into the real client. Ignored by a production build, which is always real. |
| `VITE_TRIBUNAL_PROXY_URL` | Where the proxy is listening. Defaults to `http://localhost:8787`. |

`CLAUDE_CODE_OAUTH_TOKEN` is **not** this application's credential and is read
by nothing in this repository. Do not set it for the proxy.

No `.env` file is needed. The proxy loads no dotenv file — pass the key on the
command line or export it in the shell.

---

## Starting it

Two terminals.

```sh
# Terminal 1 — the proxy. The key lives here and nowhere else.
ANTHROPIC_API_KEY=sk-ant-... node src/server/anthropicProxy.mjs
```

It prints three lines and then one per request:

```
The Tribunal LLM proxy is listening on http://127.0.0.1:8787/api/llm/complete
ANTHROPIC_API_KEY present: true
Model: claude-haiku-4-5-20251001; provider: https://api.anthropic.com
```

`present: true` is a boolean. The proxy never prints, logs, hashes or echoes
the key itself, and per-request logging is method, path, status and error code
only — never a request or response body.

```sh
# Terminal 2 — the app. Start this from a shell that does NOT have
# ANTHROPIC_API_KEY set at all.
npm run build && npm run preview
```

Then open the URL it prints (`http://localhost:4173`).

> **Use `npm run build && npm run preview` for the live run, not `npm run dev`.**
> A production build is always wired to the real client. A plain `npm run dev`
> is wired to the **deterministic fake** — it says so on screen, but it is not a
> real run. If you want the real client under `npm run dev`, start it as
> `VITE_TRIBUNAL_LLM=real npm run dev`.

---

## The live acceptance run

This is the one paid run. It is yours to perform; the automated team was
explicitly forbidden from spending a token, and did not.

**Before you begin,** confirm automated validation is green:

```sh
npm run lint && npm run typecheck && npm test && npm run build
```

Expect `exit 0` four times and **203 tests in 13 files**.

**Then:**

1. **Terminal 1** — `ANTHROPIC_API_KEY=sk-ant-... node src/server/anthropicProxy.mjs`
   Confirm it prints `ANTHROPIC_API_KEY present: true`.
2. **Terminal 2** — from a shell with **no** `ANTHROPIC_API_KEY` set:
   `npm run build && npm run preview`
3. Open `http://localhost:4173`. Confirm **no** dev-preview warning appears
   above the button — if one does, you are running the fake.
4. Open the browser devtools **Network** tab before you click, and leave it open.
5. Press **Start Tribunal** once. The button disables while the run is in flight.
6. Wait. Seven sequential model calls — expect roughly 20–60 seconds.

**Then verify each of the things the Founder asked for:**

| # | Check | Where to look |
| --- | --- | --- |
| 1 | All four representatives produced real, non-placeholder arguments | The transcript. Jon Snow, Tyrion Lannister, Daenerys Targaryen, Grey Worm, each in their own voice |
| 2 | Transcript order is correct | Those four, in that order |
| 3 | Later representatives received prior context | Read statements 2–4: they should answer what was said before them |
| 4 | All three judges ran, with three **separate** opinions | Aharon Barak model, Menachem Elon model, Meir Shamgar model |
| 5 | Verdict parsing succeeded | Each opinion shows exactly `JUSTIFIED` or `NOT_JUSTIFIED` |
| 6 | **No combined verdict** appeared | There is no overall/majority verdict anywhere on the page. There should not be |
| 7 | No fake-client fingerprint | The text `[deterministic test client]` appears nowhere. Nor "Placeholder statement" or "Placeholder opinion" |
| 8 | The secret was never exposed in the browser | Network tab: every request goes to `127.0.0.1:8787/api/llm/complete`, **none** to `api.anthropic.com`. No request carries an `x-api-key` header. `Ctrl+F` the page source and the JS bundle for `sk-ant` — nothing |
| 9 | The secret was never exposed in logs | Terminal 1 shows seven `POST /api/llm/complete -> 200` lines and no key, no prefix, no prompt body |
| 10 | Seven calls, not more or fewer | Count the Network tab entries, or the log lines in Terminal 1 |

**Screenshots.** If you take any, crop out Terminal 1's command line — it has
the key on it. Never put a real credential into a screenshot, a log excerpt or
an evidence file.

**Afterwards,** close Terminal 1. The proxy holds a credential and has no
authentication of its own; do not leave it running.

---

## Rehearsing it for free

You can exercise the complete seven-call run — the real engine, the real
adapter, the real proxy, real HTTP — without spending anything, by pointing the
proxy's `ANTHROPIC_BASE_URL` at the local stub provider QA wrote:

```sh
npx vitest run src/mission-003/e2e/tribunal.e2e.test.ts
```

That is a hermetic test: ephemeral loopback ports, a real child proxy process
started with every real credential variable stripped from its environment, and
a synthetic key. It runs as part of `npm test` too. To regenerate the readable
transcript of it:

```sh
TRIBUNAL_E2E_EVIDENCE=1 npx vitest run src/mission-003/e2e/tribunal.e2e.test.ts
cat src/mission-003/evidence/token-free-e2e-run.txt
```

---

## When it goes wrong

The app never invents a transcript or a verdict. Every failure below appears in
the existing error state under the button, beginning *"The tribunal could not be
completed, so no transcript or verdict is shown."*

| What you see | What happened | Fix |
| --- | --- | --- |
| *"…proxy could not be reached at http://localhost:8787"* | Terminal 1 is not running, or is on another port | Start the proxy. If it is running, see the `localhost` note below |
| *"…has no `ANTHROPIC_API_KEY` set in its own server environment"* | The proxy started without the key. Terminal 1 will show `present: false` | Restart it with the key |
| *"The language-model provider rejected the tribunal's request… HTTP 401"* | The key is wrong, revoked, or has no credit | Check the key |
| *"…HTTP 429"* | Rate limited | Wait and retry. There is deliberately no automatic retry |
| *"Could not read a judge verdict…"* | A judge replied without a valid `VERDICT:` line. The run aborted and **no verdict was invented** | Press Start Tribunal again |
| *"…requests from the origin … are not accepted by this proxy"* | The browser origin is not on the allowlist — most often because Vite picked a different port when the default was taken | `TRIBUNAL_ALLOWED_ORIGINS=http://localhost:5174 node src/server/anthropicProxy.mjs` |
| The proxy is running but the browser still cannot reach it | `localhost` may be resolving to `::1`, while the proxy binds `127.0.0.1` only — on purpose, so it is not reachable from the network | Rebuild with `VITE_TRIBUNAL_PROXY_URL=http://127.0.0.1:8787 npm run build` |
| A warning above the button about a development preview | You are on the fake client | Use `npm run preview`, or `VITE_TRIBUNAL_LLM=real npm run dev` |

---

## What is in this directory

| Path | What it is |
| --- | --- |
| `QA_REPORT.md` | The independent QA audit: what was verified, how, and every finding |
| `MISSION_003_FINAL_REPORT.md` | The mission report, in the Founder's required sixteen sections |
| `README.md` | This file |
| `e2e/` | The token-free end-to-end harness: a stub Anthropic, a real-proxy launcher, and the test that drives all seven calls plus every failure path |
| `evidence/` | Durable evidence — validation output, the secret-boundary mutation proof, the bundle and history scans, the full stub-driven run, the proxy security probes, client selection, and the orchestrator task-graph record |
| `root-artifacts/` | Root-file content the build team could not write. **Apply these** — see [Before you start](#before-you-start) |
| `qa.keyMaterial.test.ts`, `qa.originGuard.test.ts` | QA-authored tests closing two gaps found during the audit |
