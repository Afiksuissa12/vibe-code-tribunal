# Mission 003 — root-file changes staged for the operator

FOUNDER_MISSION_003.md requires three things that live at the repository root:
an `.env.example`, `.gitignore` coverage for real secret files, and README
documentation of local configuration. The team that built the proxy was given a
write policy of `src/` only, so it could not create or edit any of them.

Rather than skip them, the intended content is staged here, ready to be applied
verbatim. **Nothing in this directory is code.** It is never imported, never
part of the browser bundle, and never executed. It is also the only place under
`src/` outside `src/server/` that is allowed to name the credential variable —
`src/llm/secretBoundary.test.ts` exempts exactly these two directories and
scans everything else.

## What to apply

| File here | Where it goes | Action |
| --- | --- | --- |
| `env.example.txt` | `.env.example` (repo root) | Create the file with this content. **Names only — never fill in a value and commit it.** |
| `gitignore.additions.txt` | `.gitignore` (repo root) | Append these lines. See the security note below — this one matters. |
| `readme-configuration.md` | `README.md` (repo root) | Add as a configuration section **and** apply the two corrections at the end of that file — Mission 003 falsified two existing README claims. |
| `package.json.scripts.txt` | `package.json` `scripts` | Optional convenience only. |
| `vite.config.ts.snippet.txt` | `vite.config.ts` | Optional convenience only. The implementation works correctly without it. |

## The one that is security-relevant

`gitignore.additions.txt` is not housekeeping. The root `.gitignore` currently
covers `*.local`, so `.env.local` is already ignored — but a plain `.env` is
**not** covered by anything in it today. A developer who follows the ordinary
convention and writes their real key into `.env` would have that file staged by
`git add .` with nothing to stop them. Apply that file before anyone puts a real
key on disk.

The proxy mitigates this as far as it can from inside `src/`: it reads the key
from its own process environment only and loads no dotenv file, so a real `.env`
is never required for the live run in the first place. See
`readme-configuration.md`.
