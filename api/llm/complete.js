/**
 * Vercel serverless-function adapter for the Anthropic proxy.
 *
 * This is deployment plumbing only. Every actual decision — request
 * validation, the CORS/origin guard, the outbound call to Anthropic, error
 * shaping, secret redaction — lives in `src/server/anthropicProxy.mjs` and is
 * imported unchanged from here. Nothing in this file is duplicated logic, and
 * nothing in this file is new security policy: it exists solely to translate
 * a Vercel request/response pair into the plain `{method, path, headers,
 * body}` shape `handleRequest` already expects, exactly as
 * `createRequestListener` does for a local `node:http` server.
 *
 * Route: file-based, so this file at `api/llm/complete.js` is served at
 * `/api/llm/complete` — the same path `PROXY_COMPLETE_PATH` names.
 *
 * Config (`ANTHROPIC_API_KEY` etc.) comes from `process.env`, which Vercel
 * populates from the project's own configured Environment Variables. It is
 * read fresh per invocation via the same `readConfig` used locally; nothing
 * here reads or forwards the key anywhere except into that existing function.
 */

import { handleRequest, readConfig, MAX_REQUEST_BODY_BYTES } from '../../src/server/anthropicProxy.mjs'

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0

    req.on('data', (chunk) => {
      size += chunk.length

      if (size > MAX_REQUEST_BODY_BYTES) {
        reject(new Error(`the request body must be at most ${MAX_REQUEST_BODY_BYTES} bytes.`))
        req.destroy()
        return
      }

      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function lowerCaseHeaders(headers) {
  return Object.fromEntries(
    Object.entries(headers ?? {}).map(([name, value]) => [
      name.toLowerCase(),
      Array.isArray(value) ? value.join(', ') : value,
    ]),
  )
}

export default async function handler(req, res) {
  const config = readConfig(process.env)
  const path = new URL(req.url ?? '/', 'http://localhost').pathname

  let body
  try {
    body = await readRawBody(req)
  } catch (cause) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ error: { code: 'invalid_request', message: cause.message } }))
    return
  }

  const response = await handleRequest(
    { method: req.method ?? 'GET', path, headers: lowerCaseHeaders(req.headers), body },
    config,
  )

  res.writeHead(response.status, response.headers)
  res.end(response.body)
}
