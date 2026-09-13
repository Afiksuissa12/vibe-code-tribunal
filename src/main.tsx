import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { createLlmClient } from './llm/client'
import { FAKE_CLIENT_DEV_NOTICE, createFakeLlmClient } from './llm/fakeClient'
import './index.css'

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Root element #root was not found in index.html')
}

/*
 * Which client the tribunal runs through.
 *
 * Both `import.meta.env.DEV` and every `VITE_`-prefixed value are replaced at
 * build time, so this is a compile-time constant expression. In a production
 * bundle it folds to `false`, and Rollup then drops `./llm/fakeClient` — its
 * placeholder statements and its hash-derived verdicts — out of the output
 * entirely. That is the point rather than a side effect: FOUNDER_MISSION_002.md
 * forbids presenting that content as a tribunal outcome, and the surest way to
 * honour it is for the built app not to contain it. So a production build
 * always uses the real client.
 *
 * In dev the fake is the default, because a deterministic preview should not
 * cost provider tokens. `VITE_TRIBUNAL_LLM=real npm run dev` opts into the real
 * one; `npm run preview` is a production build and is real already. Either way
 * the proxy must be running with the provider key in its own environment —
 * see the README. Nothing here reads that key.
 */
const isDevPreview = import.meta.env.DEV && import.meta.env.VITE_TRIBUNAL_LLM !== 'real'
const llmClient = isDevPreview ? createFakeLlmClient() : createLlmClient()
const devPreviewNotice = isDevPreview ? FAKE_CLIENT_DEV_NOTICE : undefined

createRoot(rootElement).render(
  <StrictMode>
    <App
      llmClient={llmClient}
      isDevPreview={isDevPreview}
      devPreviewNotice={devPreviewNotice}
    />
  </StrictMode>,
)
