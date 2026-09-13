import type { Transcript } from '../data'
import { TRANSCRIPT_HEADING } from './sectionHeadings'

interface TranscriptSectionProps {
  transcript: Transcript
}

const SIDE_LABELS: Record<string, string> = {
  defense: 'Defense',
  prosecution: 'Prosecution',
}

/**
 * What was actually said, in the order it was said.
 *
 * Every word rendered here came back from the LLM client and is shown as it
 * arrived. The component adds the speaker's name and side — both structural
 * facts the engine recorded — and nothing else.
 */
export default function TranscriptSection({ transcript }: TranscriptSectionProps) {
  return (
    <section className="section" aria-labelledby="transcript-heading">
      <h2 id="transcript-heading">{TRANSCRIPT_HEADING}</h2>
      <ol className="transcript">
        {transcript.map((entry, index) => (
          <li className="transcript__entry" key={`${entry.speakerId}-${index}`}>
            <h3>{entry.speakerName}</h3>
            <p className="transcript__side">{SIDE_LABELS[entry.side] ?? entry.side}</p>
            <p className="transcript__text">{entry.text}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}
