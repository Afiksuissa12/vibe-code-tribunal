import { APP_TITLE, CASE_NAME } from '../data'

/** The screen's single h1, plus the case it belongs to. */
export default function TribunalHeader() {
  return (
    <header className="page__header">
      <h1>{APP_TITLE}</h1>
      <p className="page__case-name">{CASE_NAME}</p>
    </header>
  )
}
