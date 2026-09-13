# Mission 003 — Independent QA Report

**Task:** `mission-003-AUTO-QA` — Independent QA, Security Auditor & Mission Reporter
**Audited:** `task/mission-003-AUTO-PROXY` (`6e9f894`) and `task/mission-003-AUTO-CLIENT` (`3056632`), against the mission base `7809cf4`
**Verdict:** **PASS**, with one QA-authored fix applied and re-validated, and four items that are outside this team's write policy and require operator action.

> **Report location note.** These reports belong at the repository root, and durable evidence belongs in `.agent/evidence/`. Both are outside this team's write policy (`src` only), so everything lives under `src/mission-003/` instead. Moving it is an operator action and is listed in §6.

I did not write the implementation. Every claim below is something I ran, not something I was told. Where a claim came from an implementing task's handoff note I re-derived it independently, and in two cases my first attempt was itself wrong — both are recorded, because a QA report that only lists other people's mistakes is not a QA report.

---

## 1. Summary of what was verified

| # | Area | Result |
| --- | --- | --- |
| 1 | `lint` / `typecheck` / `test` / `build` | all pass — 203 tests, 13 files |
| 2 | Secret boundary (the non-negotiable one) | **holds**, and the guard was proved able to fail |
| 3 | Contract integrity (`proxyContract.ts` ↔ `anthropicProxy.mjs`) | genuine parity, not tautological |
| 4 | Engine and verdict integrity | `src/tribunal/**`, `src/data/**`, `fakeClient.ts` byte-identical to base |
| 5 | Token-free seven-call end-to-end run + six failure paths | all pass, 0 tokens spent |
| 6 | UI integrity | Mission 002 components byte-identical; no new paradigm |
| 7 | Scope discipline | no new dependency, no SDK, no orchestration in the proxy |

Evidence files, all under `src/mission-003/evidence/`:

- `validation.txt` — the four gates, verbatim
- `secret-boundary-mutation.txt` — the guard proved able to fail, case by case
- `secret-scan.txt` — bundle, source tree and git history
- `token-free-e2e-run.txt` — the full seven-call run and every failure path
- `proxy-security-probes.txt` — binding, CORS, logs, and QA-12 before/after
- `client-selection.txt` — which client each way of running the app wires up
- `orchestrator-task-graph.txt` — the task-graph bug and its fix, from the driver logs

---

## 2. Validation gates

Run by me, in this worktree, on the merged tree:

```
$ npm run lint        -> exit 0
$ npm run typecheck   -> exit 0
$ npm test            -> exit 0    Test Files 13 passed (13)   Tests 203 passed (203)
$ npm run build       -> exit 0    dist/assets/index-*.js 238.47 kB │ gzip: 75.30 kB
```

| File | Tests | Owner |
| --- | ---: | --- |
| `src/server/anthropicProxy.test.mjs` | 51 | PROXY |
| `src/llm/anthropicClient.test.ts` | 27 | CLIENT |
| `src/App.test.tsx` | 24 | Mission 002, extended by CLIENT |
| `src/tribunal/engine.test.ts` | 18 | Mission 002, **unmodified** |
| `src/tribunal/verdict.test.ts` | 16 | Mission 002, **unmodified** |
| `src/data/data.test.ts` | 14 | Mission 001, **unmodified** |
| `src/llm/proxyContract.test.ts` | 12 | PROXY |
| `src/mission-003/qa.originGuard.test.ts` | 10 | **QA** |
| `src/llm/fakeClient.test.ts` | 8 | Mission 002, **unmodified** |
| `src/mission-003/e2e/tribunal.e2e.test.ts` | 8 | **QA** |
| `src/llm/secretBoundary.test.ts` | 7 | PROXY |
| `src/llm/client.test.ts` | 5 | Mission 001, updated by CLIENT |
| `src/mission-003/qa.keyMaterial.test.ts` | 3 | **QA** |

An environment note rather than a finding: `/workspace/node_modules` held Windows-only native bindings, so `npm ci` had to be run inside this Linux worktree before anything would start. No tracked file changed. The checkout also has CRLF line endings against LF blobs, so plain `git status` reports every file as modified; `git -c core.autocrlf=input status` comes back clean. Both were flagged by `mission-003-AUTO-PROXY` and both are accurate.

---

## 3. The secret boundary

### 3.1 The guard was proved able to fail

A guard that cannot fail is not a guard, so I did not take `src/llm/secretBoundary.test.ts` on trust. I wrote a scratch file into `src/components/` — a scanned, non-exempt directory — containing one forbidden construct at a time, ran the guard alone, recorded the result, and deleted the scratch file. Full transcript in `evidence/secret-boundary-mutation.txt`.

| Case | Result |
| --- | --- |
| control — an inert export | 7 passed |
| names `ANTHROPIC_API_KEY` | **1 failed**, offending file named |
| names `CLAUDE_CODE_OAUTH_TOKEN` | **1 failed**, offending file named |
| contains `x-api-key` | **1 failed**, offending file named |
| contains `api.anthropic.com` | **1 failed**, offending file named |
| reads `process.env` | **1 failed**, offending file named |
| imports from `src/server/` | **1 failed**, offending file named |

Six for six, each with an assertion message that names the file. The guard is real.

### 3.2 The bundle, the tree and the history

After a clean `npm run build`, all seven tokens the Founder names are absent from `dist/`: `ANTHROPIC_API_KEY`, `CLAUDE_CODE_OAUTH_TOKEN`, `x-api-key`, `api.anthropic.com`, `anthropic-version`, `sk-ant`, `process.env`. Every fake-client fingerprint is absent too, and `/api/llm/complete` and `localhost:8787` are present, which is what a real-client production bundle should look like.

`process.env` appears in no browser-facing application code. No application code reads `CLAUDE_CODE_OAUTH_TOKEN` — the name occurs three times in the repository and not one of them is a read: a comment saying it is never read, a test asserting it is ignored, and the Founder's own instruction in `FOUNDER_MISSION_003.md`.

Git history over this mission's commits contains three `sk-ant` hits, all deliberately non-credentials: two documentation ellipses (`sk-ant-...`) and one test fixture whose own value says it is fake. No `.env` file has ever been added on any branch in any commit; `git fsck` shows no dangling commits, so nothing was amended away either. The working tree is clean and no `.env*` file exists on disk.

---

## 4. Findings

Ten findings. One fixed by QA, four are operator actions that cannot be fixed from inside `src/`, five are observations recorded so they are not rediscovered.

---

### QA-1 · minor · **RESOLVED BY QA**

**The secret-boundary guard checks for credential *names*, not credential *material*, and skips the two directories where a real key would most plausibly be left behind.**

*Evidence.* During the mutation proof I added a seventh case: a scratch file in `src/components/` containing a realistic `sk-ant-…` literal. The guard passed, 7 of 7. Its token list covers the variable's name, the auth header, the provider host and `process.env` — the *shape* of credential handling — but nothing that matches an actual key. Separately, `EXEMPT_DIRECTORIES = ['server', 'mission-003']` removes both directories from the scan entirely, and those are exactly where a key gets left: in the proxy while debugging, or in a report while writing one up.

*Resolution.* Fixed by QA, in QA-owned space. I did not touch `src/llm/secretBoundary.test.ts`. I added **`src/mission-003/qa.keyMaterial.test.ts`** (3 tests), which scans **all** of `src/` with **no exemptions** for two things: a key-shaped value (`sk-ant-` plus 24+ characters) and a credential variable assigned a literal value in the `=` form a dotenv file or a shell command uses. It tolerates values that declare themselves fake — PROXY's `sk-ant-fake-key-for-tests-…` and my own `test-not-a-real-key` both pass — because a fixture has to contain something key-shaped and a real pasted key never says it is fake. The detector self-checks that it fires, so it cannot quietly become a no-op.

*Re-verified.* I planted the same realistic literal in `src/components/` **and** in `src/server/` (which the other guard never scans) and the new test failed in both cases, naming the file. Removed. Full suite green afterwards.

---

### QA-12 · minor (security) · **FIXED BY QA — this fix was authored by QA, not by `mission-003-AUTO-PROXY`**

**The CORS allowlist decided who could *read* a reply, not who could *cause a provider call*. Any page on any origin could spend the operator's tokens.**

*Evidence.* `handleRequest` never inspected `content-type`. A CORS **simple** request — `POST` with `content-type: text/plain` — is not preflighted, so the browser sends it without asking permission. I drove the real proxy with a real child process and confirmed it: a request carrying `origin: https://evil.example.com` and `content-type: text/plain` returned **200**, **made a real provider call**, and omitted `access-control-allow-origin`. The page cannot read the answer; it has still spent the money. This is not exfiltration — it is an unauthenticated way for any page the operator happens to have open to burn their credit while the proxy is running on their loopback. The `application/json` path was never vulnerable: that content type is preflighted, and the preflight for a disallowed origin returns 204 with no allow-origin, so the real request is never sent.

*Routing, then resolution.* I sent the defect and the suggested patch to `mission-003-AUTO-PROXY` through the coordination mailbox (`.agent-outbox/qa-to-proxy-findings.json`). That task had already reached a terminal state and no reply arrived. Because the fix is small, inside `src/`, and — I checked before writing a line — compatible with PROXY's existing tests without editing them, I applied it myself rather than leave a known way to spend the operator's money open.

*Exactly what I changed.* Eleven lines in `src/server/anthropicProxy.mjs`, in `handleRequest`, after the method check and before the body is parsed:

```js
if (typeof headers.origin === 'string' && !config.allowedOrigins.includes(headers.origin)) {
  return fail('invalid_request',
    `requests from the origin ${headers.origin} are not accepted by this proxy. ` +
    'If that origin is legitimate, add it to TRIBUNAL_ALLOWED_ORIGINS.')
}
```

plus the comment above it explaining why. `invalid_request` is reused deliberately so `PROXY_ERROR_CODES` — and the parity `src/llm/proxyContract.test.ts` asserts against it — stay exactly as they were. Requests with **no** `Origin` header are untouched, so curl, the token-free harness, PROXY's own socket tests and anything that is not a browser all keep working.

*Coverage added.* **`src/mission-003/qa.originGuard.test.ts`** (10 tests), in QA-owned space rather than in PROXY's test file. Every case stubs the outbound `fetch` with one that throws, so "no provider call was attempted" is enforced rather than assumed.

*Re-verified.* Live probe against the patched proxy: **400 `invalid_request`, 0 provider calls**. PROXY's own 51 tests pass **unmodified**. The seven-call end-to-end run still passes. Full validation re-run: lint 0, typecheck 0, 203 tests passing, build 0.

---

### QA-2 · **blocking for the operator** · CANNOT BE FIXED FROM `src/` — **OPERATOR ACTION REQUIRED**

**The root `.gitignore` does not cover a plain `.env`.**

*Evidence.* I read the file. It covers `*.local`, so `.env.local` is ignored. Nothing in it covers `.env`. A developer who follows the ordinary convention and writes their real key into `.env` would have it staged by `git add .` with nothing to stop them.

*Mitigations, established by experiment rather than by argument.* In a throwaway copy of this app **outside** the repository I created a `.env` containing both `ANTHROPIC_API_KEY=<synthetic>` and `VITE_ANTHROPIC_API_KEY=<synthetic>` and ran `vite build`. **Neither value reached `dist/`** — a production build only inlines the `VITE_` variables the code actually reads, and no code reads either. The sandbox was deleted. Separately, the proxy loads no dotenv file at all, so a real `.env` never has to exist for the live run. The exposure is therefore *committing* the file, not *shipping* it — which is still the exposure that matters.

*Resolution.* Cannot be fixed: `.gitignore` is outside this team's write policy. The intended content is staged verbatim at `src/mission-003/root-artifacts/gitignore.additions.txt`. **Apply it before anyone puts a real key on disk.** Surfaced again in §6 and in the final report's §6 and §15.

---

### QA-3 · major · CANNOT BE FIXED FROM `src/` — **OPERATOR ACTION REQUIRED**

**`.env.example` does not exist at the repository root**, though the Founder's Definition of Done requires it ("`.env.example` has names only").

*Evidence.* `ls` at the root. Not present.

*Resolution.* Staged verbatim at `src/mission-003/root-artifacts/env.example.txt`. I checked its content against the requirement: variable **names only**, no values, and it correctly separates the proxy-process variables from the two `VITE_`-prefixed browser ones with a warning that `VITE_` values are public. Copy it to `.env.example` at the root.

---

### QA-4 · major · CANNOT BE FIXED FROM `src/` — **OPERATOR ACTION REQUIRED**

**The root `README.md` has no configuration section**, though the Founder requires the README to explain which variable to set and that it must never be exposed to the browser.

*Resolution.* Staged at `src/mission-003/root-artifacts/readme-configuration.md`. I read it; it is accurate against the code as built, including the two-terminal arrangement and the "no `.env` file is needed" point. In the meantime `src/mission-003/README.md` (written by me) carries the operator instructions.

---

### QA-5 · minor · **DOCUMENTED, NOT A DEFECT**

**A plain `npm run dev` uses the fake client, and the Founder's live-acceptance paragraph says "e.g. `npm run dev` or `npm run preview` with the key set".**

An operator following that sentence literally could run the deterministic fake and believe they had run the real thing. It is honest — `isDevPreview` is true, so the fake-client warning renders — but the ambiguity is real.

*Verified, and my first attempt at verifying it was wrong.* I started a Vite dev server, curled the transformed `/src/main.tsx`, and read an `isDevPreview` expression that did not match the source. The cause was mine: port 5199 was already held by a leftover dev server from another worktree, and `--strictPort` made my server exit while `curl` happily talked to the other one. Re-run with a fresh ephemeral port per case, and each response checked to confirm it came from *this* worktree:

| How it is started | `VITE_TRIBUNAL_LLM` in the injected env | Client wired up |
| --- | --- | --- |
| `npm run dev` | absent | **fake**, dev-preview notice shown |
| `VITE_TRIBUNAL_LLM=real npm run dev` | `"real"` | **real**, no notice |
| `npm run build && npm run preview` | `DEV` is false at build time | **real**, no notice; `fakeClient` tree-shaken out of `dist/` entirely |

All three correct. *Resolution:* `src/mission-003/README.md` makes `npm run build && npm run preview` the primary live-acceptance path and names `VITE_TRIBUNAL_LLM=real npm run dev` as the alternative, so the ambiguity cannot bite. Sent to `mission-003-AUTO-CLIENT` as a note, with no change requested.

---

### QA-7 · observation

**`DEFAULT_PROXY_ORIGIN` is `http://localhost:8787` while the proxy binds `127.0.0.1` only.** On a host where `localhost` resolves to `::1` first, a client with no IPv4 fallback would fail to connect. I deliberately drove the whole seven-call run through the `localhost` form and it worked; Node and every current browser fall back. The escape hatch is `VITE_TRIBUNAL_PROXY_URL=http://127.0.0.1:8787`, and it is in the operator README's troubleshooting section. No change requested.

---

### QA-8 · observation

**The credential variable's name is assembled from fragments in `src/llm/anthropicClient.ts`** — `['ANTHROPIC', 'API_KEY'].join('_')` — because `secretBoundary.test.ts` fails any browser-facing file containing that literal, even in prose.

I challenged this, as `mission-003-AUTO-CLIENT` invited. I am satisfied it is right, for the reason they gave: the alternative was exempting the adapter from the guard whose job is to police it. Worth recording plainly so a future reader does not mistake it for a security mechanism: both fragments survive minification into the bundle as `` [`ANTHROPIC`,`API_KEY`].join(`_`) ``, and the operator reads the full name on screen when the proxy reports it missing. Nothing is hidden, and nothing needs to be — a variable's **name** is not a secret. The guard treats it as a proxy for "this file handles credentials", which is a reasonable rule with a cosmetic cost. No change requested.

---

### QA-9 · observation

**The proxy rejects unknown keys inside message objects, not just at the top level** — stricter than the contract requires. `mission-003-AUTO-PROXY` flagged it and invited disagreement. I agree with it: the smallest accepted surface in front of a credential is the right one, and an unexpected field is far likelier to be a client bug than an intention. No change.

---

### QA-13 · observation

**An oversized request body is handled correctly server-side but the client sees `ECONNRESET` rather than the 400.** I sent 2 MB against the 1 MB limit: the proxy logged `400 invalid_request` and survived — a normal request immediately afterwards returned 200 with real content — but `readBody` calls `req.destroy()` before the response is written, so the client never receives it. The tribunal's real system prompts are about 3 KB, so nothing in this product can reach the limit. Reported to PROXY; no change requested.

---

### QA-10 · observation

**These reports live under `src/mission-003/` rather than at the repository root**, because the root is outside this team's write policy. Moving them is an operator action.

---

## 5. What else was checked, and passed without a finding

**Contract integrity.** `src/llm/proxyContract.test.ts` imports the browser contract *and* the server module and asserts they agree. It is not tautological: the numeric limits are checked by **driving the proxy's own `validateCompleteRequest`** at the limit and one past it, rather than by comparing two constants — so it tests the rule actually enforced. It also asserts the error-code tuples match in order, that `DEFAULT_PROXY_ORIGIN` matches `DEFAULT_PORT`, and carries compile-time assertions in both directions that `ChatRequest` and `ProxyCompleteRequest` are mutually assignable. The adapter imports the path, the default origin and the error codes from the contract module rather than restating them.

**Engine and verdict integrity.** `git diff 7809cf4 HEAD -- src/tribunal/ src/data/ src/llm/fakeClient.ts src/llm/fakeClient.test.ts src/components/ src/App.css` is **empty**. `engine.ts`, `verdict.ts`, `engine.test.ts`, `verdict.test.ts`, `fakeClient.test.ts` and `data.test.ts` are byte-identical to the mission base and all pass. The only change to `src/App.tsx` is a doc comment. The fake client is still exported, still used by the deterministic tests, and still selected by `npm run dev`.

**UI integrity.** `StartTribunalSection`, `TranscriptSection`, `JudicialOpinionsSection` and `App.css` are byte-identical to Mission 002, so the Start flow, loading state, `aria-busy`, re-entry guard (a ref, not state) and the `role="alert"` error state are literally the Mission 002 ones. All provider messaging is text thrown by the adapter and rendered through that existing alert. No provider-selection UI, no settings panel, no streaming indicator, no new paradigm. The fake-client warning renders when the fake is selected and does not when the real client is (§QA-5 table).

**Scope discipline.** `package.json` and `package-lock.json` are untouched — no new dependency, no provider SDK. No auth, no database, no queue, no websockets, no streaming, no retry framework, no multi-provider abstraction. The proxy contains no tribunal orchestration: it knows nothing of representatives, judges, transcripts, verdicts or speaking order, and `runTribunal` is unchanged in the browser.

**No automated test can spend a token.** Asserted, not assumed. I re-ran the entire suite with every non-loopback TCP connection blocked at the socket layer — a Node preload wrapping `net.connect`, `net.Socket.prototype.connect`, `tls.connect` and `dns.lookup`, which sits *below* `fetch`/undici and so cannot be routed around by a test that stubs `globalThis.fetch`. **13 files, 203 tests, all passing offline.** The blocker was first proved live inside a vitest worker (a probe test's outbound call was refused under the preload and succeeded without it), then the probe was removed.

**Proxy security posture.** Binds `127.0.0.1` only — a request to this host's external address was refused with `ECONNREFUSED`. Never sends `*`, never sends `access-control-allow-credentials`, sends `vary: origin` on every response matched or not. `GET /` → 404, `GET` on the endpoint → 405. The synthetic key appears in no response header or body across every probe, and the proxy's whole stdout for a seven-call run was ten lines: the bound URL, `ANTHROPIC_API_KEY present: true` (a boolean, never the value, never a prefix, never a hash), the model and provider origin, and one method/path/status line per request. No bodies.

**Model choice.** `claude-haiku-4-5-20251001` — a current small/fast model, pinned to the dated id rather than the alias so a run is reproducible. Appropriate for seven short, tightly-instructed turns, and not the most expensive option, as the Founder required.

---

## 6. Operator actions — nothing here can be done from inside `src/`

1. **Apply `src/mission-003/root-artifacts/gitignore.additions.txt` to the root `.gitignore` before anyone writes a real key to disk.** A plain `.env` is not ignored today. *(QA-2 — the security-relevant one.)*
2. **Create `.env.example` at the root** from `src/mission-003/root-artifacts/env.example.txt`. Names only, never a value. *(QA-3)*
3. **Add the configuration section to the root `README.md`** from `src/mission-003/root-artifacts/readme-configuration.md`. *(QA-4)*
4. **Optionally** add `"proxy": "node src/server/anthropicProxy.mjs"` to `package.json` scripts (`root-artifacts/package.json.scripts.txt`) and the Vite `server.proxy` entry (`root-artifacts/vite.config.ts.snippet.txt`). Both are conveniences; the implementation is correct without either.
5. **Move these reports** to the repository root and the evidence to `.agent/evidence/`. *(QA-10)*
6. **Delete the stale `/workspace/.agent/state/task_graph.json`** — Mission 001's four-task graph, still sitting at the old unscoped path. Harmless under the new mission-scoped naming, but it is the file that caused the Mission 002 bug.

---

## 7. Conclusion

The secret boundary holds, and I proved the guard that protects it can fail. The engine, the verdict contract and the Mission 002 UI are untouched. The whole seven-call tribunal runs correctly through the real adapter and the real proxy, and every failure path fails honestly and invents nothing. No credential exists anywhere in the bundle, the source, the logs, this evidence or the git history — including in a commit that was later amended away, because there are none.

One genuine security defect was found (QA-12), routed to its owner, and — when that task proved terminal — fixed by QA with disclosed, re-validated changes and new coverage. One guard gap was found (QA-1) and closed by a QA-authored test rather than by editing another task's file. Four items are outside this team's write policy and are named as operator actions; the `.gitignore` one is the one that matters.

**Independent QA: PASS.** The remaining gate is the operator's one live, paid, seven-call run.
