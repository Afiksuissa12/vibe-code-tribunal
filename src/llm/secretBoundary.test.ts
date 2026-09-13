/**
 * The boundary proof.
 *
 * FOUNDER_MISSION_003.md's one non-negotiable requirement is that the provider
 * key never reaches the browser. The architecture makes that structurally true
 * — the credential lives in a standalone Node process under `src/server/`,
 * which nothing in the Vite module graph imports — but "structurally true" is
 * only worth anything if something keeps checking. That is this file's job.
 *
 * It scans every file under `src/` outside the two directories that are
 * allowed to mention a credential at all, and fails if any of them names the
 * credential environment variable, the provider host, the provider auth
 * header, or reaches into the Node process environment. It is a standing
 * guard, not a one-off audit: it runs on every `npm test`, and it names the
 * offending file when it fires.
 */

/// <reference types="node" />
// The reference above is needed because `tsconfig.app.json` lists only
// `vite/client` and `vitest/globals` under `types`, so Node's own module
// declarations are not otherwise in the program. This is the one file in the
// browser-facing tree that legitimately touches the filesystem: it has to read
// the source to police it.

import { readFileSync, readdirSync } from 'node:fs'
import { relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * `src/`, resolved from this file's own location rather than the process cwd,
 * so the scan covers the same tree however the suite is invoked.
 */
const SRC_ROOT = resolve(fileURLToPath(import.meta.url), '..', '..')

/**
 * The two directories exempt from the scan.
 *
 * `src/server/` is the proxy: it is *supposed* to hold the credential, and it
 * is never part of the browser bundle. `src/mission-003/` holds staged copies
 * of root-file content (an `.env.example` with variable names in it, README
 * text) that the team could not write at the repository root; it is documentation,
 * not code, and is likewise never imported.
 */
const EXEMPT_DIRECTORIES = ['server', 'mission-003']

/**
 * Assembled from fragments so that this scanner does not match itself — it
 * scans its own directory, and a literal here would be a false positive that
 * could only be silenced by exempting the one file whose job is to not need an
 * exemption.
 */
const FORBIDDEN_TOKENS = [
  ['ANTHROPIC', 'API_KEY'].join('_'),
  ['CLAUDE_CODE', 'OAUTH_TOKEN'].join('_'),
  ['x', 'api', 'key'].join('-'),
  ['api', 'anthropic', 'com'].join('.'),
  ['process', 'env'].join('.'),
]

/** Matches a module specifier that reaches into `src/server/`. */
const SERVER_IMPORT = /(?:from|import|require)\s*\(?\s*['"][^'"]*\/server\/[^'"]*['"]/

interface SourceFile {
  readonly path: string
  readonly contents: string
}

function collectSourceFiles(directory: string, files: SourceFile[] = []): SourceFile[] {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name)

    if (entry.isDirectory()) {
      if (directory === SRC_ROOT && EXEMPT_DIRECTORIES.includes(entry.name)) {
        continue
      }

      collectSourceFiles(path, files)
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

const SOURCE_FILES = collectSourceFiles(SRC_ROOT)

function isTestFile(path: string): boolean {
  return /\.test\.[cm]?[jt]sx?$/.test(path)
}

describe('the secret boundary', () => {
  it('scans the browser-facing source, so a passing run means something', () => {
    // A walk that silently found nothing would pass every assertion below.
    expect(SOURCE_FILES.length).toBeGreaterThan(10)
    expect(SOURCE_FILES.map((file) => file.path)).toContain('llm/proxyContract.ts')
    expect(SOURCE_FILES.map((file) => file.path)).toContain('App.tsx')
    expect(SOURCE_FILES.map((file) => file.path).filter((path) => path.startsWith('server'))).toEqual([])
  })

  for (const token of FORBIDDEN_TOKENS) {
    it(`finds no "${token}" outside ${EXEMPT_DIRECTORIES.map((name) => `src/${name}/`).join(' and ')}`, () => {
      const offenders = SOURCE_FILES.filter((file) => file.contents.includes(token)).map(
        (file) => `src/${file.path}`,
      )

      expect(
        offenders,
        `"${token}" must not appear in browser-facing source. Offending file(s): ${offenders.join(', ')}`,
      ).toEqual([])
    })
  }

  it('has no browser-facing file importing from src/server/', () => {
    // Tests are excluded because they are never part of the browser bundle and
    // one of them exists precisely to import the proxy:
    // `src/llm/proxyContract.test.ts` holds the contract and the server to each
    // other. Application code has no such licence.
    const offenders = SOURCE_FILES.filter(
      (file) => !isTestFile(file.path) && SERVER_IMPORT.test(file.contents),
    ).map((file) => `src/${file.path}`)

    expect(
      offenders,
      `Application code must not import from src/server/ — that module holds the credential and must stay out of the browser bundle. Offending file(s): ${offenders.join(', ')}`,
    ).toEqual([])
  })
})
