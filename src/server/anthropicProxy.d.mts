/**
 * Types for `./anthropicProxy.mjs`.
 *
 * The proxy is plain ESM JavaScript on purpose — it must stay outside the Vite
 * module graph and outside `tsc`'s program, so that it is structurally
 * impossible for it to be pulled into the browser bundle. This declaration
 * file exists only so `src/llm/proxyContract.test.ts` can import the proxy's
 * own constants and hold the browser-safe contract to them.
 *
 * The Node-facing exports are typed structurally rather than against
 * `node:http`, to keep this file free of any dependency the app build does not
 * already have.
 */

export declare const PROXY_COMPLETE_PATH: '/api/llm/complete'

export type ProxyErrorCode =
  | 'invalid_request'
  | 'method_not_allowed'
  | 'not_found'
  | 'missing_credential'
  | 'provider_error'
  | 'provider_unreachable'
  | 'malformed_provider_response'

export declare const PROXY_ERROR_CODES: readonly ProxyErrorCode[]

export declare const MAX_MESSAGES: number
export declare const MAX_SYSTEM_PROMPT_LENGTH: number
export declare const MAX_REQUEST_BODY_BYTES: number
export declare const DEFAULT_MODEL: string
export declare const DEFAULT_MAX_TOKENS: number
export declare const DEFAULT_BASE_URL: string
export declare const DEFAULT_PORT: number
export declare const ANTHROPIC_VERSION: string
export declare const DEFAULT_ALLOWED_ORIGINS: readonly string[]

export interface ProxyConfig {
  readonly apiKey: string | null
  readonly model: string
  readonly maxTokens: number
  readonly baseUrl: string
  readonly port: number
  readonly allowedOrigins: readonly string[]
}

export interface ProxyChatMessage {
  readonly role: 'user' | 'assistant'
  readonly content: string
}

export interface ProxyValidationSuccess {
  readonly ok: true
  readonly request: {
    readonly systemPrompt: string
    readonly messages: readonly ProxyChatMessage[]
  }
}

export interface ProxyValidationFailure {
  readonly ok: false
  readonly message: string
}

export interface ProxyHttpRequest {
  readonly method: string
  readonly path: string
  readonly headers?: Readonly<Record<string, string | undefined>>
  readonly body?: string | null
}

export interface ProxyHttpResponse {
  readonly status: number
  readonly headers: Readonly<Record<string, string>>
  readonly body: string
}

export declare function readConfig(env?: Readonly<Record<string, string | undefined>>): ProxyConfig

export declare function validateCompleteRequest(
  value: unknown,
): ProxyValidationSuccess | ProxyValidationFailure

export declare function extractText(payload: unknown): string

export declare function handleRequest(
  request: ProxyHttpRequest,
  config: ProxyConfig,
): Promise<ProxyHttpResponse>

export declare function createRequestListener(
  config: ProxyConfig,
  log?: (message: string) => void,
): (request: unknown, response: unknown) => void

export declare function startProxy(config: ProxyConfig, log?: (message: string) => void): unknown
