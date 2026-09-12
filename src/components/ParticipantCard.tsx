interface ParticipantCardProps {
  name: string
  descriptor: string
}

/**
 * One participant in a group list: who they are and the one-line descriptor
 * from the canonical data. Never a stance, an argument or an outcome.
 */
export default function ParticipantCard({ name, descriptor }: ParticipantCardProps) {
  return (
    <li className="participant">
      <h3>{name}</h3>
      <p className="participant__descriptor">{descriptor}</p>
    </li>
  )
}
