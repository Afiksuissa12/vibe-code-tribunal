import { CASE_SUMMARY, CENTRAL_QUESTION } from '../data'

/**
 * The case background: the neutral summary and the question the tribunal
 * exists to answer, both taken verbatim from the canonical data.
 */
export default function CaseSummarySection() {
  return (
    <section className="section" aria-labelledby="case-summary-heading">
      <h2 id="case-summary-heading">Case background</h2>
      <p>{CASE_SUMMARY}</p>

      <h3>The question before the tribunal</h3>
      <p>{CENTRAL_QUESTION.question}</p>
      <p className="section__lead-in">Considering:</p>
      <ul className="considerations">
        {CENTRAL_QUESTION.considerations.map((consideration) => (
          <li key={consideration}>{consideration}</li>
        ))}
      </ul>
    </section>
  )
}
