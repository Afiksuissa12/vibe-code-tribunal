import { JUDICIAL_PROFILES } from '../data'
import ParticipantCard from './ParticipantCard'

interface JudgesSectionProps {
  heading: string
}

/**
 * The three judicial agents. Each reasons independently, so no verdict or
 * leaning is shown — none exists until a later mission runs the tribunal.
 */
export default function JudgesSection({ heading }: JudgesSectionProps) {
  return (
    <section className="section" aria-labelledby="judges-heading">
      <h2 id="judges-heading">{heading}</h2>
      <ul className="participant-list">
        {JUDICIAL_PROFILES.map((judge) => (
          <ParticipantCard
            key={judge.id}
            name={judge.displayName}
            descriptor={judge.descriptor}
          />
        ))}
      </ul>
    </section>
  )
}
