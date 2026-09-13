import { act, fireEvent, render, screen, within } from '@testing-library/react'
import App from './App'
import {
  DEFENSE_HEADING,
  JUDICIAL_OPINIONS_HEADING,
  JUDICIAL_PANEL_HEADING,
  PROSECUTION_HEADING,
  TRANSCRIPT_HEADING,
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
import type { ChatRequest } from './llm/client'
import { createFakeLlmClient } from './llm/fakeClient'
import type { FakeLlmClient } from './llm/fakeClient'
import { runTribunal } from './tribunal'

/**
 * A fake client that holds every reply until it is released, so the running
 * state can be observed mid-flight instead of being raced past.
 */
function createGatedClient(): { client: FakeLlmClient; release: () => void } {
  let release: () => void = () => {}
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  const base = createFakeLlmClient()

  return {
    release: () => release(),
    client: {
      calls: base.calls,
      async complete(request: ChatRequest) {
        await gate
        return base.complete(request)
      },
    },
  }
}

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

  it('says nothing in the status region until the tribunal is started', () => {
    render(<App />)

    expect(screen.getByRole('status').textContent).toBe('')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('shows no transcript or opinions before a run', () => {
    render(<App />)

    expect(screen.queryByRole('region', { name: TRANSCRIPT_HEADING })).toBeNull()
    expect(screen.queryByRole('region', { name: JUDICIAL_OPINIONS_HEADING })).toBeNull()
  })
})

/**
 * Acceptance criterion 11: the UI renders the transcript and the three
 * judicial opinions from engine output.
 *
 * The fake client is deterministic, so the expected result can be produced by
 * running the engine directly and compared against what the screen shows.
 */
describe('a completed tribunal run', () => {
  async function runAndRender() {
    const expected = await runTribunal(createFakeLlmClient())
    const client = createFakeLlmClient()

    render(<App llmClient={client} />)
    fireEvent.click(screen.getByRole('button', { name: 'Start Tribunal' }))

    await screen.findByRole('region', { name: TRANSCRIPT_HEADING })

    return { client, expected }
  }

  it('renders every transcript entry exactly as the engine returned it', async () => {
    const { expected } = await runAndRender()

    const transcript = screen.getByRole('region', { name: TRANSCRIPT_HEADING })

    expect(expected.transcript).toHaveLength(4)
    for (const entry of expected.transcript) {
      expect(
        within(transcript).getByRole('heading', { name: entry.speakerName, level: 3 }),
      ).toBeInTheDocument()
      expect(within(transcript).getByText(entry.text)).toBeInTheDocument()
    }
  })

  it('renders the four statements in the order they were spoken', async () => {
    const { expected } = await runAndRender()

    const transcript = screen.getByRole('region', { name: TRANSCRIPT_HEADING })
    const spoken = within(transcript)
      .getAllByRole('heading', { level: 3 })
      .map((heading) => heading.textContent)

    expect(spoken).toEqual(expected.transcript.map((entry) => entry.speakerName))
  })

  it('renders the three judicial opinions separately', async () => {
    const { expected } = await runAndRender()

    const opinions = screen.getByRole('region', { name: JUDICIAL_OPINIONS_HEADING })

    expect(expected.judicialOpinions).toHaveLength(3)
    for (const opinion of expected.judicialOpinions) {
      expect(
        within(opinions).getByRole('heading', { name: opinion.judgeName, level: 3 }),
      ).toBeInTheDocument()
      expect(within(opinions).getByText(opinion.opinion)).toBeInTheDocument()
    }

    expect(within(opinions).getAllByRole('listitem')).toHaveLength(3)
  })

  /** Acceptance criterion 7, at the UI level: no combined verdict is shown. */
  it('shows exactly three verdicts and never combines them', async () => {
    const { container } = render(<App llmClient={createFakeLlmClient()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Start Tribunal' }))
    await screen.findByRole('region', { name: JUDICIAL_OPINIONS_HEADING })

    const verdictLines = screen.getAllByText(/^Verdict: (Justified|Not justified)$/)
    expect(verdictLines).toHaveLength(3)

    const text = container.textContent ?? ''
    for (const phrase of [
      'majority',
      'Majority',
      'combined verdict',
      'overall verdict',
      'final verdict',
      'The tribunal finds',
    ]) {
      expect(text).not.toContain(phrase)
    }
  })

  /** Acceptance criterion 12: Mission 001's screen survives a run intact. */
  it('leaves the Mission 001 screen in place', async () => {
    await runAndRender()

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByText(CASE_NAME)).toBeInTheDocument()
    expect(screen.getByText(CASE_SUMMARY)).toBeInTheDocument()

    const defense = screen.getByRole('region', { name: DEFENSE_HEADING })
    const prosecution = screen.getByRole('region', { name: PROSECUTION_HEADING })
    const panel = screen.getByRole('region', { name: JUDICIAL_PANEL_HEADING })

    for (const representative of DEFENSE_REPRESENTATIVES) {
      expect(within(defense).getByText(representative.descriptor)).toBeInTheDocument()
    }
    for (const representative of PROSECUTION_REPRESENTATIVES) {
      expect(within(prosecution).getByText(representative.descriptor)).toBeInTheDocument()
    }
    for (const judge of JUDICIAL_PROFILES) {
      expect(within(panel).getByText(judge.descriptor)).toBeInTheDocument()
    }
  })

  it('never puts prompt-only profile text on the screen', async () => {
    const { container } = render(<App llmClient={createFakeLlmClient()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Start Tribunal' }))
    await screen.findByRole('region', { name: TRANSCRIPT_HEADING })

    const text = container.textContent ?? ''
    for (const profile of [...REPRESENTATIVES, ...JUDICIAL_PROFILES]) {
      expect(text).not.toContain(profile.profile)
    }
  })
})

/** Acceptance criterion 10: no accidental simultaneous runs. */
describe('guarding against a duplicate run', () => {
  it('runs the tribunal once however many times the button is pressed', async () => {
    const client = createFakeLlmClient()

    render(<App llmClient={client} />)
    const button = screen.getByRole('button', { name: 'Start Tribunal' })

    // Dispatched inside one act() so the clicks land before React can re-render
    // and disable the button — this exercises the engine-level re-entry guard,
    // not just the disabled attribute.
    await act(async () => {
      button.click()
      button.click()
      button.click()
    })

    await screen.findByRole('region', { name: TRANSCRIPT_HEADING })

    // Four representatives plus three judges. A second run would double this.
    expect(client.calls).toHaveLength(7)
    expect(screen.getByRole('region', { name: TRANSCRIPT_HEADING })).toBeInTheDocument()
    expect(
      within(screen.getByRole('region', { name: TRANSCRIPT_HEADING })).getAllByRole('listitem'),
    ).toHaveLength(4)
  })

  it('disables the button and announces progress while a run is in flight', async () => {
    const gate = createGatedClient()

    render(<App llmClient={gate.client} />)
    const button = screen.getByRole('button', { name: 'Start Tribunal' })

    fireEvent.click(button)

    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('status').textContent).toMatch(/running the tribunal/i)
    expect(screen.queryByRole('region', { name: TRANSCRIPT_HEADING })).toBeNull()

    await act(async () => {
      gate.release()
    })

    await screen.findByRole('region', { name: TRANSCRIPT_HEADING })
    expect(button).toBeEnabled()
    expect(gate.client.calls).toHaveLength(7)
  })
})

/**
 * Honest failure: the production build has no model connected, so pressing the
 * button must say so rather than show an empty or invented tribunal.
 */
describe('when the tribunal cannot be run', () => {
  it('shows a clear error and no fabricated transcript or verdict', async () => {
    const { container } = render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Start Tribunal' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/could not be completed/i)
    expect(alert).toHaveTextContent(/no language model is connected/i)

    expect(screen.queryByRole('region', { name: TRANSCRIPT_HEADING })).toBeNull()
    expect(screen.queryByRole('region', { name: JUDICIAL_OPINIONS_HEADING })).toBeNull()

    const text = container.textContent ?? ''
    for (const verdict of VERDICTS) {
      expect(text).not.toContain(verdict)
    }
  })

  it('re-enables the button so the run can be retried', async () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Start Tribunal' }))
    await screen.findByRole('alert')

    expect(screen.getByRole('button', { name: 'Start Tribunal' })).toBeEnabled()
  })

  it('clears a failed run’s error when a working run replaces it', async () => {
    const failing = createFakeLlmClient({ respond: () => '' })
    const { rerender } = render(<App llmClient={failing} />)

    fireEvent.click(screen.getByRole('button', { name: 'Start Tribunal' }))
    await screen.findByRole('alert')

    rerender(<App llmClient={createFakeLlmClient()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Start Tribunal' }))

    await screen.findByRole('region', { name: TRANSCRIPT_HEADING })
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
