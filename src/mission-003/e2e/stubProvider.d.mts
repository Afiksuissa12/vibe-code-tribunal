/**
 * Types for `./stubProvider.mjs`.
 *
 * The stub is plain ESM JavaScript so it can also be run directly by `node`
 * outside vitest — which is how an operator would use it to rehearse the live
 * run without spending anything. This declaration file exists only so
 * `./tribunal.e2e.test.ts` type-checks under `tsc -b`, following the same
 * convention `src/server/anthropicProxy.d.mts` already established for the
 * proxy.
 *
 * Everything is typed structurally, so this file needs no dependency the app
 * build does not already have.
 */

export declare const STUB_API_KEY: string

export declare const STUB_MODES: {
  readonly NORMAL: 'normal'
  readonly UNAUTHORIZED: 'unauthorized'
  readonly SERVER_ERROR: 'server_error'
  readonly MALFORMED_VERDICT: 'malformed_verdict'
  readonly NO_TEXT: 'no_text'
}

export type StubMode = (typeof STUB_MODES)[keyof typeof STUB_MODES]

/** One call the stub observed, recorded so a test can assert what was sent. */
export interface StubRequest {
  readonly method: string | undefined
  readonly path: string
  readonly sawApiKeyHeader: boolean
  readonly apiKeyMatches: boolean
  readonly anthropicVersion: string | null
  readonly model: string | null
  readonly maxTokens: number | null
  readonly system: string | null
  readonly messages: readonly { readonly role: string; readonly content: string }[]
  readonly isJudgeTurn: boolean
}

export interface StubProvider {
  readonly port: number
  /** What to give the proxy as `ANTHROPIC_BASE_URL`. */
  readonly url: string
  /** Every request observed, in order. */
  readonly requests: StubRequest[]
  setMode(mode: StubMode): void
  reset(): void
  close(): Promise<void>
}

export declare function startStubProvider(options?: { mode?: StubMode }): Promise<StubProvider>
