#!/usr/bin/env node
/**
 * Applies the three required root-file changes from FOUNDER_MISSION_003.md.
 *
 * WHY THIS SCRIPT EXISTS
 *
 * The mission requires an `.env.example`, `.gitignore` coverage for real secret
 * files, and README documentation of local configuration — all at the repository
 * root. The team that built the proxy was given a write policy of `src/` only,
 * so it staged the content here instead (see `./README.md`). Staged content does
 * not satisfy a Definition of Done, and transcribing it by hand invites exactly
 * the kind of error that matters most in the `.gitignore` case. So: one command,
 * applying the staged text verbatim.
 *
 * Run it from anywhere:
 *
 *     node src/mission-003/root-artifacts/apply-root-artifacts.mjs
 *     node src/mission-003/root-artifacts/apply-root-artifacts.mjs --check
 *
 * `--check` writes nothing and exits non-zero if any change is still outstanding,
 * so it doubles as a verification gate.
 *
 * This file is not part of the application. It is never imported, never bundled
 * and never executed by the app or by any test.
 *
 * It is idempotent: a second run reports "already applied" and changes nothing.
 * It never overwrites a file wholesale — it creates `.env.example` only if it is
 * absent, and edits `.gitignore` and `README.md` only by appending or by
 * replacing an exact known passage.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '..', '..', '..')

const checkOnly = process.argv.includes('--check')

/** The line in gitignore.additions.txt where the explanatory preamble ends. */
const GITIGNORE_ANCHOR = '# Local environment files'

const read = (p) => readFileSync(p, 'utf8')
const readArtifact = (name) => read(join(here, name))

/**
 * These files are checked in with CRLF endings. Text this script inserts must
 * match its target, or the edit shows up in `git diff` as whole-file line-ending
 * churn that buries the actual change — which is how the first attempt at these
 * root files was lost.
 */
const usesCrlf = (text) => text.includes('\r\n')
const toLineEndingOf = (text, target) => {
  const lf = text.replace(/\r\n/g, '\n')
  return usesCrlf(target) ? lf.replace(/\n/g, '\r\n') : lf
}

/** Pull a marked block out of readme-configuration.md. */
function markedBlock(source, marker) {
  const begin = `<!-- apply:${marker}:begin -->`
  const end = `<!-- apply:${marker}:end -->`
  const from = source.indexOf(begin)
  const to = source.indexOf(end)
  if (from === -1 || to === -1) {
    throw new Error(`readme-configuration.md is missing the ${marker} markers`)
  }
  return source.slice(from + begin.length, to).trim()
}

/** Marked correction text is written as a blockquote; strip the `> ` prefixes. */
const unquote = (block) =>
  block
    .split('\n')
    .map((line) => line.replace(/^> ?/, ''))
    .join('\n')

const results = []
const record = (target, status, detail) => results.push({ target, status, detail })

// --- 1. .env.example ---------------------------------------------------------
// Names only. Created only if absent, so an operator who has already written one
// never has it clobbered.

const envExamplePath = join(repoRoot, '.env.example')
const envExampleBody = readArtifact('env.example.txt')

if (existsSync(envExamplePath)) {
  record('.env.example', 'ok', 'already exists — left untouched')
} else if (checkOnly) {
  record('.env.example', 'missing', 'would be created')
} else {
  writeFileSync(envExamplePath, envExampleBody, 'utf8')
  record('.env.example', 'applied', 'created')
}

// --- 2. .gitignore -----------------------------------------------------------
// The security-relevant one. `*.local` already covers `.env.local`; a plain
// `.env` is covered by nothing today. The negation goes last so the committed
// example stays tracked.

const gitignorePath = join(repoRoot, '.gitignore')
const additionsFile = readArtifact('gitignore.additions.txt')
const anchorAt = additionsFile.indexOf(GITIGNORE_ANCHOR)
if (anchorAt === -1) {
  throw new Error(`gitignore.additions.txt is missing its "${GITIGNORE_ANCHOR}" anchor line`)
}
const gitignoreAdditions = additionsFile.slice(anchorAt).trimEnd()

const gitignoreBody = read(gitignorePath)
const gitignoreLines = gitignoreBody.split(/\r?\n/).map((line) => line.trim())
const coversPlainEnv = gitignoreLines.includes('.env')

if (coversPlainEnv) {
  record('.gitignore', 'ok', 'already covers a plain .env')
} else if (checkOnly) {
  record('.gitignore', 'missing', 'a plain .env is NOT ignored — would append 3 rules')
} else {
  const eol = usesCrlf(gitignoreBody) ? '\r\n' : '\n'
  const separator = /\r?\n$/.test(gitignoreBody) ? eol : eol + eol
  const additions = toLineEndingOf(gitignoreAdditions, gitignoreBody)
  writeFileSync(gitignorePath, `${gitignoreBody}${separator}${additions}${eol}`, 'utf8')
  record('.gitignore', 'applied', 'appended .env, .env.*, !.env.example')
}

// --- 3. README.md ------------------------------------------------------------
// Add the configuration section, and correct the two claims that Mission 003
// falsified. All three texts come from readme-configuration.md.

const readmePath = join(repoRoot, 'README.md')
const configSource = readArtifact('readme-configuration.md')

let readme = read(readmePath)
const originalReadme = readme

/** Every text pulled from the artifact is matched and inserted in README's own endings. */
const forReadme = (text) => toLineEndingOf(text, readme)

const configSection = forReadme(markedBlock(configSource, 'section'))
const corrections = [
  {
    label: 'stale claim: createLlmClient() returns a stub',
    old: forReadme(unquote(markedBlock(configSource, 'replace1:old'))),
    new: forReadme(unquote(markedBlock(configSource, 'replace1:new'))),
  },
  {
    label: 'stale claim: "Still not built: any real LLM provider"',
    old: forReadme(unquote(markedBlock(configSource, 'replace2:old'))),
    new: forReadme(unquote(markedBlock(configSource, 'replace2:new'))),
  },
]

// The section goes immediately before "Running it locally", where a reader
// looking for how to start the app will meet it.
const INSERT_BEFORE = '## Running it locally'

// Compared against an LF-normalised copy: the real README is CRLF, and a
// literal '\n## Configuration\n' would never match it — which would make this
// script re-insert the whole section on every run.
if (readme.replace(/\r\n/g, '\n').includes('\n## Configuration\n')) {
  record('README.md (section)', 'ok', 'configuration section already present')
} else if (!readme.includes(INSERT_BEFORE)) {
  record('README.md (section)', 'failed', `could not find "${INSERT_BEFORE}" to insert before`)
} else if (checkOnly) {
  record('README.md (section)', 'missing', 'would insert the configuration section')
} else {
  const blank = forReadme('\n\n')
  readme = readme.replace(INSERT_BEFORE, `${configSection}${blank}${INSERT_BEFORE}`)
  record('README.md (section)', 'applied', 'configuration section inserted')
}

for (const correction of corrections) {
  if (readme.includes(correction.new)) {
    record(`README.md (${correction.label})`, 'ok', 'already corrected')
  } else if (!readme.includes(correction.old)) {
    record(`README.md (${correction.label})`, 'failed', 'neither the old nor the corrected text was found — correct it by hand')
  } else if (checkOnly) {
    record(`README.md (${correction.label})`, 'missing', 'would be corrected')
  } else {
    readme = readme.replace(correction.old, correction.new)
    record(`README.md (${correction.label})`, 'applied', 'corrected')
  }
}

if (!checkOnly && readme !== originalReadme) {
  writeFileSync(readmePath, readme, 'utf8')
}

// --- report ------------------------------------------------------------------

const symbols = { ok: '  ok    ', applied: '  applied', missing: '  MISSING', failed: '  FAILED ' }
console.log(checkOnly ? 'Checking root artifacts:\n' : 'Applying root artifacts:\n')
for (const { target, status, detail } of results) {
  console.log(`${symbols[status]}  ${target} — ${detail}`)
}

const outstanding = results.filter((r) => r.status === 'missing' || r.status === 'failed')
if (outstanding.length > 0) {
  console.log(
    checkOnly
      ? `\n${outstanding.length} change(s) outstanding. Re-run without --check to apply.`
      : `\n${outstanding.length} change(s) could not be applied automatically — see above.`,
  )
  process.exit(1)
}
console.log('\nAll three mission-003 root requirements are in place.')
if (!checkOnly) {
  console.log('Remember: .env.example must stay names-only. Never commit a real key.')
}
