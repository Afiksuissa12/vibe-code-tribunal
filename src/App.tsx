import CaseSummarySection from './components/CaseSummarySection'
import JudgesSection from './components/JudgesSection'
import RepresentativeSection from './components/RepresentativeSection'
import StartTribunalSection from './components/StartTribunalSection'
import TribunalHeader from './components/TribunalHeader'
import {
  DEFENSE_HEADING,
  JUDICIAL_PANEL_HEADING,
  PROSECUTION_HEADING,
} from './components/sectionHeadings'
import { DEFENSE_REPRESENTATIVES, PROSECUTION_REPRESENTATIVES } from './data'
import { createLlmClient } from './llm/client'
import type { LlmClient } from './llm/client'
import './App.css'

interface AppProps {
  /**
   * The seam the Tribunal Engine runs through. Defaults to the not-implemented
   * client, so a build with no model connected fails honestly rather than
   * showing invented content; tests and dev verification inject the
   * deterministic fake instead.
   */
  llmClient?: LlmClient
  isDevPreview?: boolean
  devPreviewNotice?: string
}

/**
 * The single screen: who is in the room, what the tribunal must decide, and —
 * once a run finishes — what was said and what each judge concluded. Every
 * name, descriptor, fact and summary comes from `src/data`; every argument,
 * verdict and opinion comes from the LLM client. Nothing on this screen is a
 * finding the application made for itself.
 */
export default function App({
  llmClient = createLlmClient(),
  isDevPreview = false,
  devPreviewNotice,
}: AppProps = {}) {
  return (
    <div className="page">
      <TribunalHeader />
      <main className="page__main tribunal">
        <CaseSummarySection />
        <RepresentativeSection
          heading={DEFENSE_HEADING}
          representatives={DEFENSE_REPRESENTATIVES}
        />
        <RepresentativeSection
          heading={PROSECUTION_HEADING}
          representatives={PROSECUTION_REPRESENTATIVES}
        />
        <JudgesSection heading={JUDICIAL_PANEL_HEADING} />
        <StartTribunalSection
          llmClient={llmClient}
          isDevPreview={isDevPreview}
          devPreviewNotice={devPreviewNotice}
        />
      </main>
    </div>
  )
}
