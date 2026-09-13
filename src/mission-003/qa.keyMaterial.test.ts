// @vitest-environment node

/**
 * A QA-authored addition to the secret boundary: no credential *material*
 * anywhere under `src/`.
 *
 * `src/llm/secretBoundary.test.ts` (owned by mission-003-AUTO-PROXY) is a real,
 * working guard — QA proved it by introducing each violation it declares and
 * watching it fail; the evidence is in
 * `src/mission-003/evidence/secret-boundary-mutation.txt`. But its five tokens
 * describe the *shape* of credential handling — the variable's name, the auth
 * header, the provider host, `process.env` — and two things fall outside that:
 *
 * 1. A pasted key literal. During the mutation proof, a scratch file containing
 *    a realistic `sk-ant-…` string in `src/components/` passed the existing
 *    guard untouched. Naming a variable is harmless; pasting its value is the
 *    actual accident this mission has to prevent.
 * 2. Its two exempt directories. `src/server/` legitimately *handles* the
 *    credential and `src/mission-003/` legitimately *documents* it, so neither
 *    is scanned at all — which means neither is checked for a hard-coded value
 *    either. Those are exactly the two places a real key would plausibly be
 *    left behind: in the proxy while debugging, or in a report or an evidence
 *    file while writing one up.
 *
 * This file therefore scans **everything** under `src/` with no exemptions, and
 * looks for values rather than names. It complements the existing guard and
 * replaces none of it.
 *
 * It is deliberately in a QA-owned file rather than an edit to another task's
 * test, and it proves it can fail before it claims anything: see the
 * self-check at the bottom.
 */

/// <reference types="node" />

import { readFileSync, readdirSync } from 'node:fs'
import { relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

/** `src/`, resolved from this file rather than the cwd. */
const SRC_ROOT = resolve(fileURLToPath(import.meta.url), '..', '..')

/**
 * Assembled from fragments so the scanner does not match its own source — it
 * scans the directory it lives in.
 */
const KEY_PREFIX = ['sk', 'ant'].join('-')
const CREDENTIAL_NAMES = [
  ['ANTHROPIC', 'API_KEY'].join('_'),
  ['CLAUDE_CODE', 'OAUTH_TOKEN'].join('_'),
]

/**
 * A key-shaped string: the provider's key prefix followed by enough characters
 * to be a credential rather than an ellipsis in a command example.
 *
 * A real Anthropic key runs to about a hundred characters, so 24 is a wide
 * margin below anything real and comfortably above `sk-ant-...` as written in
 * documentation.
 */
const KEY_MATERIAL = new RegExp(`${KEY_PREFIX}-[A-Za-z0-9_-]{24,}`, 'g')

/**
 * A credential variable assigned a literal value, as in a committed `.env`
 * line or a shell command with the key typed into it.
 *
 * Only the `=` form, not an object property `NAME: value`. The `=` form is how
 * a credential is actually written down — in a dotenv file, or in front of a
 * command — and it is the form that carries a value rather than a reference. A
 * JavaScript object property whose value is a real key is caught by
 * `KEY_MATERIAL` above instead, and matching that form here would only flag
 * the test fixtures that legitimately pass a named constant around.
 */
const CREDENTIAL_ASSIGNMENT = new RegExp(
  `(?:${CREDENTIAL_NAMES.join('|')})\\s*=\\s*['"\`]?([A-Za-z0-9_-]{16,})`,
  'g',
)

/**
 * Markers that make a string self-evidently not a credential.
 *
 * A test fixture has to contain *something* key-shaped, and demanding it look
 * nothing like a key would make the fixtures useless. The rule is instead that
 * a key-shaped string must say, in itself, that it is not one — which is a
 * property a real pasted key never has.
 */
const SYNTHETIC_MARKERS = [
  'fake',
  'example',
  'placeholder',
  'not-a-real',
  'not_a_real',
  'notareal',
  'synthetic',
  'dummy',
  'redacted',
  'for-tests',
  'test-not',
]

function isObviouslySynthetic(candidate: string): boolean {
  const lowered = candidate.toLowerCase()

  return SYNTHETIC_MARKERS.some((marker) => lowered.includes(marker))
}

interface Hit {
  readonly file: string
  readonly candidate: string
}

/** The detector, kept as a plain function so the self-check can exercise it. */
export function findCredentialMaterial(contents: string): string[] {
  const hits: string[] = []

  for (const pattern of [KEY_MATERIAL, CREDENTIAL_ASSIGNMENT]) {
    // Fresh lastIndex per file: these are global regexes.
    pattern.lastIndex = 0

    for (const match of contents.matchAll(pattern)) {
      const candidate = match[1] ?? match[0]

      if (!isObviouslySynthetic(candidate)) {
        hits.push(candidate)
      }
    }
  }

  return hits
}

interface SourceFile {
  readonly path: string
  readonly contents: string
}

/** Walks every file under `src/`. No exemptions — that is the whole point. */
function collectAllFiles(directory: string, files: SourceFile[] = []): SourceFile[] {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name)

    if (entry.isDirectory()) {
      collectAllFiles(path, files)
      continue
    }

    if (entry.isFile()) {
      // Normalized to forward slashes: `path.relative` returns backslash
      // separators on Windows, which would otherwise make every '/'-joined
      // path assertion below fail on that platform despite the scan itself
      // being correct.
      files.push({
        path: relative(SRC_ROOT, path).split(sep).join('/'),
        contents: readFileSync(path, 'utf8'),
      })
    }
  }

  return files
}

const ALL_FILES = collectAllFiles(SRC_ROOT)

describe('no credential material anywhere under src/', () => {
  it('scans the whole tree, including the directories the other guard exempts', () => {
    const paths = ALL_FILES.map((file) => file.path)

    expect(paths.length).toBeGreaterThan(20)
    // The two directories `secretBoundary.test.ts` skips are covered here.
    expect(paths.some((path) => path.startsWith('server'))).toBe(true)
    expect(paths.some((path) => path.startsWith('mission-003'))).toBe(true)
    expect(paths).toContain('llm/anthropicClient.ts')
  })

  it('finds no key-shaped string and no credential assigned a literal value', () => {
    const hits: Hit[] = ALL_FILES.flatMap((file) =>
      findCredentialMaterial(file.contents).map((candidate) => ({
        file: `src/${file.path}`,
        candidate,
      })),
    )

    expect(
      hits.map((hit) => hit.file),
      `Credential material must never be committed. Offending file(s): ${hits
        .map((hit) => hit.file)
        .join(', ')}. (If this is a deliberate test fixture, say so in the value itself — ` +
        `for example "${KEY_PREFIX}-fake-...".)`,
    ).toEqual([])
  })

  /**
   * The reason the assertion above is worth anything.
   *
   * A scanner that matched nothing would pass every run and prove nothing, so
   * the detector is shown to fire on a realistic key and on a filled-in `.env`
   * line, and to stay quiet on the documentation and fixtures this repository
   * legitimately contains.
   */
  it('detects credential material, and tolerates declared fixtures', () => {
    const realistic = `${KEY_PREFIX}-api03-${'A1b2C3d4E5f6G7h8'.repeat(5)}`

    expect(findCredentialMaterial(`const key = '${realistic}'`)).toEqual([realistic])
    expect(findCredentialMaterial(`${CREDENTIAL_NAMES[0]}=${realistic}`)).not.toEqual([])
    expect(findCredentialMaterial(`${CREDENTIAL_NAMES[1]}=someRealLookingTokenValue`)).not.toEqual([])

    // What the repository actually contains, and must keep being allowed to.
    expect(findCredentialMaterial(`${CREDENTIAL_NAMES[0]}=${KEY_PREFIX}-... node proxy.mjs`)).toEqual([])
    expect(findCredentialMaterial(`${CREDENTIAL_NAMES[0]}=`)).toEqual([])
    expect(findCredentialMaterial(`${CREDENTIAL_NAMES[0]}=... node`)).toEqual([])
    expect(findCredentialMaterial(`const FAKE_KEY = '${KEY_PREFIX}-fake-key-for-tests-0123456789'`)).toEqual([])
    expect(findCredentialMaterial("const STUB_API_KEY = 'test-not-a-real-key'")).toEqual([])
  })
})
