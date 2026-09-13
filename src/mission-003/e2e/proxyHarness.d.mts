/**
 * Types for `./proxyHarness.mjs`.
 *
 * Same reason as `./stubProvider.d.mts`: the harness is plain ESM so it can be
 * run directly by `node`, and this declaration exists only so
 * `./tribunal.e2e.test.ts` type-checks under `tsc -b`.
 */

/** Asks the OS for a free loopback port, then releases it. */
export declare function findFreePort(): Promise<number>

export interface RealProxyHandle {
  readonly port: number
  /** `http://127.0.0.1:<port>` — the interface the proxy actually binds. */
  readonly origin: string
  /** `http://localhost:<port>` — the form the shipped contract defaults to. */
  readonly localhostOrigin: string
  /** Every line the proxy printed, so log hygiene can be asserted. */
  readonly logs: string[]
  stop(): Promise<void>
}

export declare function startRealProxy(options: {
  /** The synthetic credential, or `null` to start with none at all. */
  apiKey: string | null
  /** Where the stub provider is listening. */
  baseUrl: string
  /** Extra environment for the child, merged before credentials are stripped. */
  env?: Record<string, string>
  port?: number
}): Promise<RealProxyHandle>
