import type { JudgeOpinion } from '../data'
import { JUDICIAL_OPINIONS_HEADING } from './sectionHeadings'

interface JudicialOpinionsSectionProps {
  opinions: readonly JudgeOpinion[]
}

/** Human-readable form of the wire tokens; the stored verdict is unchanged. */
const VERDICT_LABELS: Record<string, string> = {
  JUSTIFIED: 'Justified',
  NOT_JUSTIFIED: 'Not justified',
}

/**
 * The three opinions, side by side and deliberately un-summarised.
 *
 * There is no tally, no majority line and no "the tribunal finds…" anywhere in
 * this component. V1 reports what each judge concluded independently and stops
 * there; combining them would be the application deciding the case.
 */
export default function JudicialOpinionsSection({ opinions }: JudicialOpinionsSectionProps) {
  return (
    <section className="section" aria-labelledby="judicial-opinions-heading">
      <h2 id="judicial-opinions-heading">{JUDICIAL_OPINIONS_HEADING}</h2>
      <p className="section__lead-in">
        Each judge reasoned independently. These opinions are reported separately and are
        not combined into a single verdict.
      </p>
      <ol className="opinions">
        {opinions.map((opinion) => (
          <li className="opinion" key={opinion.judgeId}>
            <h3>{opinion.judgeName}</h3>
            <p className="opinion__verdict">
              Verdict: {VERDICT_LABELS[opinion.verdict] ?? opinion.verdict}
            </p>
            <p className="opinion__reasoning">{opinion.opinion}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}
