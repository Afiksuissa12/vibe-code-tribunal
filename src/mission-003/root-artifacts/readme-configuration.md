# Configuration — add this section to the root README.md

The HTML comments below are markers read by `apply-root-artifacts.mjs`, so that
this file stays the single source of truth for the text it applies. They are
invisible in rendered markdown. Leave them in place.

---

<!-- apply:section:begin -->
## Configuration

The Tribunal talks to one language model provider, Anthropic, through a small
local proxy. **The API key is read by the proxy process only and is never
exposed to the browser.**

### The variables

Copy `.env.example` for the full list. In short:

**Read by the proxy process** (`src/server/anthropicProxy.mjs`) — these must be
in the environment of the terminal you start the proxy in, and must never be
prefixed with `VITE_`, because Vite inlines every `VITE_`-prefixed variable
into the browser bundle:

| Variable | Required | Default |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | yes | none — the proxy refuses every request without it |
| `ANTHROPIC_MODEL` | no | a current small/fast Anthropic model |
| `ANTHROPIC_MAX_TOKENS` | no | `1024` |
| `ANTHROPIC_BASE_URL` | no | `https://api.anthropic.com` |
| `TRIBUNAL_PROXY_PORT` | no | `8787` |
| `TRIBUNAL_ALLOWED_ORIGINS` | no | the Vite dev and preview origins |

**Read by the browser build** — inlined into the bundle, so never a secret:
`VITE_TRIBUNAL_LLM` (which client to wire up) and `VITE_TRIBUNAL_PROXY_URL`
(where the proxy is listening; defaults to `http://localhost:8787`).

### Running it

Two terminals.

```sh
# Terminal 1 — the proxy. The key lives here and nowhere else.
ANTHROPIC_API_KEY=sk-ant-... node src/server/anthropicProxy.mjs
```

```sh
# Terminal 2 — the app. Start the key-free process from a shell that does not
# have ANTHROPIC_API_KEY set at all.
VITE_TRIBUNAL_LLM=real npm run dev     # or: npm run build && npm run preview
```

**Read that second command carefully — a plain `npm run dev` will not reach the
provider.** In dev the deterministic fake client is the default, so that a
preview costs no provider tokens. There are exactly two ways to get a real run:

| Command | Client used |
| --- | --- |
| `npm run dev` | the **fake** — mechanically generated placeholder text, with a visible dev-preview warning on screen |
| `VITE_TRIBUNAL_LLM=real npm run dev` | the real one, via the proxy |
| `npm run build && npm run preview` | the real one — a production build never contains the fake at all |

If you are performing the live acceptance run, use one of the bottom two.

The proxy prints the URL it bound to and whether a credential is present, as a
boolean:

```
The Tribunal LLM proxy is listening on http://127.0.0.1:8787/api/llm/complete
ANTHROPIC_API_KEY present: true
Model: claude-haiku-4-5-20251001; provider: https://api.anthropic.com
```

It never prints, logs, hashes or echoes the key itself — not at startup, not in
an error, not in a response. Per-request logging is limited to method, path,
status and error code; request and response bodies are never logged, because
they carry the prompts and body logging is how secrets leak by accident.

### Why two processes

The proxy is a standalone Node script rather than a Vite middleware plugin, so
running the app locally means running two processes instead of one. That is a
real cost and it is a deliberate trade:

- A Vite plugin would have to be registered in `vite.config.ts`, which puts the
  credential-handling code inside the tool that builds the browser bundle. The
  standalone script is *structurally* incapable of reaching the browser: it is
  never in the Vite module graph, so there is no bundling mistake that could
  ship it. `src/llm/secretBoundary.test.ts` enforces that boundary on every
  test run.
- It needs no build step, no transpile and no dependency — `node:http` plus the
  global `fetch` is the whole server — and it behaves identically under
  `npm run dev` and `npm run preview`, rather than only working in dev.

If the extra terminal is annoying, the two optional conveniences staged
alongside this file help: an `npm run proxy` script, and a Vite `server.proxy`
entry that forwards `/api/llm` to the proxy so the browser talks to a single
origin in dev. Both are optional; the implementation is correct without either.

### No `.env` file is needed

The proxy reads the key from its own process environment and **loads no dotenv
file**. There is nothing to create, so a real `.env` never has to exist on disk
for a live run — pass the key on the command line as above, or export it in the
shell. If you do keep one anyway, it is already ignored: the root
`.gitignore` ignores `.env` and `.env.*`, while keeping the committed
`.env.example` (variable names only) tracked.

Never commit an API key.

### Failure behaviour

The proxy never invents a reply. If the key is missing, the provider rejects the
call, the network fails, or the provider returns something unusable, it returns
a specific error code and the UI surfaces the failure through its existing error
state. It never falls back to the deterministic fake client during a real run.
<!-- apply:section:end -->

---

## Also required: two existing README claims are now false

Adding the section above is not sufficient on its own. Mission 003 connected a
real provider, which falsified two statements that were accurate in Mission 002
and are still in the root `README.md`. A reader of the current README would
conclude no provider is wired up at all. Both must be corrected in the same
edit.

**1. In "What this build does and does not do" — replace this paragraph:**

<!-- apply:replace1:old:begin -->
> **A production build** (`npm run build`) has no model connected.
> `createLlmClient()` returns a stub that rejects with `LlmNotImplementedError`,
> so `Start Tribunal` fails honestly — it says that no language model is
> connected to this build — rather than fabricating a result. The fake client
> below sits behind a compile-time `import.meta.env.DEV` branch and is not in the
> production bundle at all.
<!-- apply:replace1:old:end -->

with:

<!-- apply:replace1:new:begin -->
> **A production build** (`npm run build`) is connected to a real provider.
> `createLlmClient()` returns the Anthropic client, which calls the local proxy
> described under [Configuration](#configuration); the proxy holds the API key in
> its own process environment and the browser never sees it. If the proxy is not
> running, or has no credential, `Start Tribunal` fails honestly through the
> existing error state rather than fabricating a result — it never falls back to
> the fake. The fake client sits behind a compile-time `import.meta.env.DEV`
> branch and is not in the production bundle at all.
<!-- apply:replace1:new:end -->

**2. Replace the "Still not built" paragraph:**

<!-- apply:replace2:old:begin -->
> Still not built: any real LLM provider. When one arrives it must sit behind a
> server-side proxy — a provider API key must never be shipped to or read from
> the browser. There is still no combined or majority verdict; the three opinions
> stand separately by design.
<!-- apply:replace2:old:end -->

with:

<!-- apply:replace2:new:begin -->
> Mission 003 added the real provider, behind a server-side proxy so that the API
> key is never shipped to or read from the browser. There is still no combined or
> majority verdict; the three opinions stand separately by design.
<!-- apply:replace2:new:end -->


The `Architecture` section is also mildly stale — `src/llm/client.ts` is
described as "LlmClient interface, not-implemented stub" and `src/llm/` as "the
seam for a real model". The stub does still exist (`notImplementedLlmClient`),
so these are imprecise rather than false, and `src/llm/anthropicClient.ts` and
`src/server/` are simply missing from the file tree. Worth refreshing, but not
blocking the way the two claims above are.
