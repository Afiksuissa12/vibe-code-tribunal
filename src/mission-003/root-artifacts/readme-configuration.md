# Configuration — add this section to the root README.md

---

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
npm run dev        # or: npm run build && npm run preview
```

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
shell. If you do keep one anyway, make sure `.env` is gitignored first (see
`src/mission-003/root-artifacts/gitignore.additions.txt`; the current
`.gitignore` covers `.env.local` but not a plain `.env`).

Never commit an API key.

### Failure behaviour

The proxy never invents a reply. If the key is missing, the provider rejects the
call, the network fails, or the provider returns something unusable, it returns
a specific error code and the UI surfaces the failure through its existing error
state. It never falls back to the deterministic fake client during a real run.
