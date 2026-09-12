import { fireEvent, render, screen, within } from '@testing-library/react'
import App from './App'
import {
  DEFENSE_HEADING,
  JUDICIAL_PANEL_HEADING,
  PROSECUTION_HEADING,
} from './components/sectionHeadings'
import {
  APP_TITLE,
  CASE_NAME,
  CASE_SUMMARY,
  DEFENSE_REPRESENTATIVES,
  JUDICIAL_PROFILES,
  PROSECUTION_REPRESENTATIVES,
  REPRESENTATIVES,
  VERDICTS,
} from './data'

describe('App', () => {
  it('renders the application shell without crashing', () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: 'The Tribunal' })).toBeInTheDocument()
  })
})

describe('the first screen', () => {
  it('renders the canonical title as the only h1', () => {
    render(<App />)

    const levelOneHeadings = screen.getAllByRole('heading', { level: 1 })

    expect(levelOneHeadings).toHaveLength(1)
    expect(levelOneHeadings[0]).toHaveTextContent(APP_TITLE)
  })

  it('renders the canonical case name', () => {
    render(<App />)

    expect(screen.getByText(CASE_NAME)).toBeInTheDocument()
  })

  it('renders a non-empty case summary from the canonical data', () => {
    render(<App />)

    expect(CASE_SUMMARY.trim()).not.toBe('')
    expect(screen.getByText(CASE_SUMMARY)).toBeInTheDocument()
  })

  it('renders both defense representatives under a defense grouping', () => {
    render(<App />)

    const defense = screen.getByRole('region', { name: DEFENSE_HEADING })

    expect(DEFENSE_REPRESENTATIVES).toHaveLength(2)
    for (const representative of DEFENSE_REPRESENTATIVES) {
      expect(
        within(defense).getByRole('heading', { name: representative.displayName, level: 3 }),
      ).toBeInTheDocument()
      expect(within(defense).getByText(representative.descriptor)).toBeInTheDocument()
    }
  })

  it('renders both prosecution representatives under a prosecution grouping', () => {
    render(<App />)

    const prosecution = screen.getByRole('region', { name: PROSECUTION_HEADING })

    expect(PROSECUTION_REPRESENTATIVES).toHaveLength(2)
    for (const representative of PROSECUTION_REPRESENTATIVES) {
      expect(
        within(prosecution).getByRole('heading', { name: representative.displayName, level: 3 }),
      ).toBeInTheDocument()
      expect(within(prosecution).getByText(representative.descriptor)).toBeInTheDocument()
    }
  })

  it('does not list a representative under the opposing side', () => {
    render(<App />)

    const defense = screen.getByRole('region', { name: DEFENSE_HEADING })
    const prosecution = screen.getByRole('region', { name: PROSECUTION_HEADING })

    for (const representative of PROSECUTION_REPRESENTATIVES) {
      expect(
        within(defense).queryByRole('heading', { name: representative.displayName }),
      ).toBeNull()
    }
    for (const representative of DEFENSE_REPRESENTATIVES) {
      expect(
        within(prosecution).queryByRole('heading', { name: representative.displayName }),
      ).toBeNull()
    }
  })

  it('renders all three judges under the independent judicial panel', () => {
    render(<App />)

    const panel = screen.getByRole('region', { name: JUDICIAL_PANEL_HEADING })

    expect(JUDICIAL_PROFILES).toHaveLength(3)
    for (const judge of JUDICIAL_PROFILES) {
      expect(
        within(panel).getByRole('heading', { name: judge.displayName, level: 3 }),
      ).toBeInTheDocument()
      expect(within(panel).getByText(judge.descriptor)).toBeInTheDocument()
    }
  })

  it('renders a real Start Tribunal button that is enabled', () => {
    render(<App />)

    const button = screen.getByRole('button', { name: 'Start Tribunal' })

    expect(button.tagName).toBe('BUTTON')
    expect(button).toBeEnabled()
  })

  it('explains that starting the tribunal is not implemented instead of doing nothing', () => {
    render(<App />)

    expect(screen.getByRole('status').textContent).toBe('')

    fireEvent.click(screen.getByRole('button', { name: 'Start Tribunal' }))

    const status = screen.getByRole('status')
    expect(status.textContent?.trim()).not.toBe('')
    expect(status).toHaveTextContent(/not implemented yet/i)
  })

  it('fabricates no tribunal content when the button is activated', () => {
    const { container } = render(<App />)

    const headingsBefore = screen.getAllByRole('heading').length

    fireEvent.click(screen.getByRole('button', { name: 'Start Tribunal' }))

    const text = container.textContent ?? ''

    // No verdict is rendered: none exists until a later mission runs the tribunal.
    for (const verdict of VERDICTS) {
      expect(text).not.toContain(verdict)
    }

    // No transcript or opinion: the long profile briefs are prompt material and
    // must never reach the screen, and no new content blocks appear.
    for (const profile of [...REPRESENTATIVES, ...JUDICIAL_PROFILES]) {
      expect(text).not.toContain(profile.profile)
    }
    expect(screen.getAllByRole('heading')).toHaveLength(headingsBefore)
  })
})
