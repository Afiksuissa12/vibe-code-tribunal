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
 * Dev verification only. `import.meta.env.DEV` is a compile-time constant, so
 * the fake client and its content are dropped from the production bundle
 * entirely — a built app has no model connected and says so when the button is
 * pressed, rather than showing placeholder text as a tribunal outcome.
 */
const isDevPreview = import.meta.env.DEV
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
