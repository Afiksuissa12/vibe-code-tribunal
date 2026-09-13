# Mission 003 — root-file changes (now applied)

FOUNDER_MISSION_003.md requires three things that live at the repository root:
an `.env.example`, `.gitignore` coverage for real secret files, and README
documentation of local configuration. The team that built the proxy was given a
write policy of `src/` only, so it staged the intended content here instead of
writing it.

**That was wrong, and it has been corrected.** Those three are mission
deliverables with explicit Definition of Done lines, not optional handoffs for
someone else to apply. Staging a note under `src/` does not satisfy them: a
prose note is not an `.env.example`, is not a `.gitignore` rule, and is not
README documentation. All three have now been applied at the repository root.

**Nothing in this directory is code.** It is never imported, never part of the
browser bundle, and never executed. It is also the only place under `src/`
outside `src/server/` that is allowed to name the credential variable —
`src/llm/secretBoundary.test.ts` exempts exactly these two directories and
scans everything else.

## Status

| File here | Where it goes | Status |
| --- | --- | --- |
| `env.example.txt` | `.env.example` (repo root) | **Applied.** Created verbatim, names only, no values. |
| `gitignore.additions.txt` | `.gitignore` (repo root) | **Applied.** `.env`, `.env.*`, then `!.env.example` last. |
| `readme-configuration.md` | `README.md` (repo root) | **Applied**, as a `## Configuration` section, alongside corrections to three stale Mission 002 claims. |
| `package.json.scripts.txt` | `package.json` `scripts` | Not applied. Optional convenience only. |
| `vite.config.ts.snippet.txt` | `vite.config.ts` | Not applied. Optional convenience only. The implementation works correctly without it. |

The last two remain genuinely optional: they shorten the documented commands and
collapse dev to a single origin, but the implementation is correct without
either, and the README documents the commands that work as shipped.

## The one that was security-relevant

`gitignore.additions.txt` was not housekeeping. The root `.gitignore` covered
`*.local`, so `.env.local` was already ignored — but a plain `.env` was **not**
covered by anything in it. A developer following the ordinary convention and
writing their real key into `.env` would have had that file staged by
`git add .` with nothing to stop them. Identifying that gap and then leaving it
unapplied left the risk fully live.

It is closed now. Verified against scratch files: `.env`, `.env.local` and
`.env.production` are all reported ignored by `git check-ignore`, `.env.example`
remains tracked, and a dry-run `git add .` stages `.env.example` and no real
variant.

The proxy mitigates this independently: it reads the key from its own process
environment only and loads no dotenv file, so a real `.env` is never required
for a live run in the first place. See `readme-configuration.md`.
