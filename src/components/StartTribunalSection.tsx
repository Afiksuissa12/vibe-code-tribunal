import { useState } from 'react'

/**
 * What the button honestly does in Mission 001. This describes the state of
 * the build; it is not tribunal content.
 */
const NOT_IMPLEMENTED_NOTICE =
  'Running the tribunal is not implemented yet. Mission 001 builds this screen only — no arguments, opinions or verdicts exist in this build, and nothing was generated just now. Starting a real tribunal arrives in a future mission.'

/**
 * The screen's primary action. The tribunal engine is out of scope for this
 * mission, so the button says so plainly rather than inventing a result or
 * doing nothing at all.
 */
export default function StartTribunalSection() {
  const [noticeShown, setNoticeShown] = useState(false)

  function handleStartTribunal() {
    setNoticeShown(true)
  }

  return (
    <section className="section section--action" aria-labelledby="start-tribunal-heading">
      <h2 id="start-tribunal-heading">Begin</h2>
      <button type="button" onClick={handleStartTribunal}>
        Start Tribunal
      </button>
      <p className="start-tribunal__notice" role="status">
        {noticeShown ? NOT_IMPLEMENTED_NOTICE : ''}
      </p>
    </section>
  )
}
