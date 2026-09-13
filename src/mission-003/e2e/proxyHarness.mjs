/**
 * Starts the *real* proxy as a real child process, for the token-free
 * end-to-end run.
 *
 * The point of this harness is that nothing about the proxy is mocked. It is
 * `node src/server/anthropicProxy.mjs`, spawned exactly as the operator will
 * spawn it, listening on a real loopback socket, reading its configuration from
 * a real process environment. Only the far side — Anthropic — is replaced, by
 * `./stubProvider.mjs` via the proxy's own `ANTHROPIC_BASE_URL` override. There
 * is therefore no path from this harness to a paid endpoint.
 *
 * The child's environment is built from scratch rather than inherited wholesale:
 * a real provider key must never reach a process this harness starts, even by
 * accident, so the two credential variable names are stripped and only the
 * synthetic value is put back.
 */

import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const PROXY_SCRIPT = resolve(fileURLToPath(import.meta.url), '..', '..', '..', 'server', 'anthropicProxy.mjs')
const REPO_ROOT = resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..')

/**
 * Names this harness refuses to pass to the child, assembled from fragments for
 * the same reason `src/llm/secretBoundary.test.ts` assembles its own: so that
 * grepping the tree for a credential name does not trip over the code whose job
 * is to keep credentials out.
 */
const STRIPPED_ENV_NAMES = [
  ['ANTHROPIC', 'API_KEY'].join('_'),
  ['CLAUDE_CODE', 'OAUTH_TOKEN'].join('_'),
]

/** Asks the OS for a free port, then gives it up. */
export async function findFreePort() {
  const probe = createServer()

  await new Promise((done) => probe.listen(0, '127.0.0.1', done))

  const { port } = probe.address()

  await new Promise((done) => probe.close(done))

  return port
}

/**
 * A base environment with every credential variable removed.
 *
 * `PATH` and friends are kept because `node` has to be findable; nothing that
 * could be a provider credential survives.
 */
function sanitizedEnv(base) {
  const env = { ...base }

  for (const name of STRIPPED_ENV_NAMES) {
    delete env[name]
  }

  return env
}

/**
 * Spawns the proxy and resolves once it reports that it is listening.
 *
 * @param options.apiKey the synthetic key to give it, or `null` to start it
 * with no credential at all (the missing-credential path).
 * @param options.baseUrl where the stub provider is listening.
 * @returns a handle with `origin`, `logs` (every line the proxy printed), and
 * `stop`.
 */
export async function startRealProxy({ apiKey, baseUrl, env = {}, port } = {}) {
  const chosenPort = port ?? (await findFreePort())
  const childEnv = sanitizedEnv({
    ...process.env,
    ...env,
    ANTHROPIC_BASE_URL: baseUrl,
    TRIBUNAL_PROXY_PORT: String(chosenPort),
  })

  if (apiKey !== null && apiKey !== undefined) {
    childEnv[STRIPPED_ENV_NAMES[0]] = apiKey
  }

  const child = spawn(process.execPath, [PROXY_SCRIPT], {
    cwd: REPO_ROOT,
    env: childEnv,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  const logs = []
  const record = (chunk) => {
    for (const line of String(chunk).split('\n')) {
      if (line.trim() !== '') {
        logs.push(line)
      }
    }
  }

  child.stdout.on('data', record)
  child.stderr.on('data', record)

  await new Promise((ready, fail) => {
    const timer = setTimeout(() => fail(new Error(`the proxy did not start within 10s. Output: ${logs.join(' | ')}`)), 10_000)
    const check = () => {
      if (logs.some((line) => line.includes('is listening on'))) {
        clearTimeout(timer)
        child.stdout.off('data', check)
        ready()
      }
    }

    child.stdout.on('data', check)
    child.on('error', (cause) => {
      clearTimeout(timer)
      fail(cause)
    })
    check()
  })

  return {
    port: chosenPort,
    /** Loopback by IP, matching the interface the proxy actually binds. */
    origin: `http://127.0.0.1:${chosenPort}`,
    /** The default the shipped contract uses, so it can be exercised as shipped. */
    localhostOrigin: `http://localhost:${chosenPort}`,
    logs,
    async stop() {
      if (child.exitCode !== null || child.signalCode !== null) {
        return
      }

      const ended = new Promise((done) => child.once('exit', done))

      child.kill('SIGTERM')

      await Promise.race([ended, new Promise((done) => setTimeout(done, 3_000))])

      if (child.exitCode === null && child.signalCode === null) {
        child.kill('SIGKILL')
      }
    },
  }
}
