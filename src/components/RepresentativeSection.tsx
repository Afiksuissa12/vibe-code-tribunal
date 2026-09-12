import { useId } from 'react'
import type { RepresentativeProfile } from '../data'
import ParticipantCard from './ParticipantCard'

interface RepresentativeSectionProps {
  heading: string
  representatives: readonly RepresentativeProfile[]
}

/**
 * One side's representatives. The side determines the role only — nothing
 * here states what a representative will argue.
 */
export default function RepresentativeSection({
  heading,
  representatives,
}: RepresentativeSectionProps) {
  const headingId = useId()

  return (
    <section className="section" aria-labelledby={headingId}>
      <h2 id={headingId}>{heading}</h2>
      <ul className="participant-list">
        {representatives.map((representative) => (
          <ParticipantCard
            key={representative.id}
            name={representative.displayName}
            descriptor={representative.descriptor}
          />
        ))}
      </ul>
    </section>
  )
}
