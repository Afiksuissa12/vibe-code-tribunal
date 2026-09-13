import { useRef, useState } from 'react'
import type { TribunalResult } from '../data'
import type { LlmClient } from '../llm/client'
import { runTribunal } from '../tribunal'
import JudicialOpinionsSection from './JudicialOpinionsSection'
import TranscriptSection from './TranscriptSection'

interface StartTribunalSectionProps {
  /** The seam the tribunal runs through. Injected so tests and dev can swap it. */
  llmClient: LlmClient
  /**
   * True when `llmClient` is the deterministic fake. Its output must never be
   * presented as a real tribunal outcome, so the screen says so up front.
   */
  isDevPreview?: boolean
  /** The wording of that warning, supplied by whoever wired the fake in. */
  devPreviewNotice?: string
}

type RunStatus = 'idle' | 'running' | 'complete' | 'failed'

const RUNNING_NOTICE =
  'Running the tribunal. Jon Snow, Tyrion Lannister, Daenerys Targaryen and Grey Worm speak in turn, then the three judges reason independently.'

const COMPLETE_NOTICE =
  'The tribunal has finished. The transcript and the three judicial opinions are below.'

/**
 * States plainly that a failed run produced nothing, so an empty screen is
 * never mistaken for a tribunal that heard the case and had nothing to say.
 */
const FAILURE_PREAMBLE =
  'The tribunal could not be completed, so no transcript or verdict is shown. Nothing was filled in on the participants’ behalf.'

function describeError(caught: unknown): string {
  return caught instanceof Error ? caught.message : String(caught)
}

/**
 * The screen's primary action and everything a run produces.
 *
 * This component owns the run's lifecycle — idle, running, complete, failed —
 * and hands the results straight to the two presentational sections below it.
 * It decides nothing about the case: the transcript and the opinions are
 * whatever `runTribunal` returned.
 */
export default function StartTribunalSection({
  llmClient,
  isDevPreview = false,
  devPreviewNotice,
}: StartTribunalSectionProps) {
  const [status, setStatus] = useState<RunStatus>('idle')
  const [result, setResult] = useState<TribunalResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  /*
   * A ref, not the `status` state, guards re-entry. Two clicks dispatched in
   * the same tick both read the state captured when the handler was created,
   * so a state check would let the second one through and start a second
   * concurrent run. The ref is updated synchronously and closes that window.
   */
  const isRunning = useRef(false)

  async function handleStartTribunal() {
    if (isRunning.current) {
      return
    }

    isRunning.current = true
    setStatus('running')
    setError(null)
    setResult(null)

    try {
      const tribunalResult = await runTribunal(llmClient)
      setResult(tribunalResult)
      setStatus('complete')
    } catch (caught) {
      // No partial result is kept: a run that failed produced no findings.
      setError(describeError(caught))
      setStatus('failed')
    } finally {
      isRunning.current = false
    }
  }

  const notice =
    status === 'running' ? RUNNING_NOTICE : status === 'complete' ? COMPLETE_NOTICE : ''

  return (
    <>
      <section className="section section--action" aria-labelledby="start-tribunal-heading">
        <h2 id="start-tribunal-heading">Begin</h2>
        {isDevPreview && devPreviewNotice ? (
          <p className="start-tribunal__dev-notice">{devPreviewNotice}</p>
        ) : null}
        <button
          type="button"
          onClick={handleStartTribunal}
          disabled={status === 'running'}
          aria-busy={status === 'running'}
        >
          Start Tribunal
        </button>
        <p className="start-tribunal__notice" role="status">
          {notice}
        </p>
        {status === 'failed' && error ? (
          <p className="start-tribunal__error" role="alert">
            {FAILURE_PREAMBLE} {error}
          </p>
        ) : null}
      </section>

      {result ? <TranscriptSection transcript={result.transcript} /> : null}
      {result ? <JudicialOpinionsSection opinions={result.judicialOpinions} /> : null}
    </>
  )
}
