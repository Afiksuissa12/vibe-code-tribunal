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
import './App.css'

/**
 * The first and only screen of Mission 001: who is in the room and what the
 * tribunal must decide. Every name, descriptor, fact and summary comes from
 * `src/data`; nothing on this screen is a finding, an argument or a verdict.
 */
export default function App() {
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
        <StartTribunalSection />
      </main>
    </div>
  )
}
