import { describe, expect, it } from 'vitest'

import { VERDICTS } from '../data'
import { InvalidVerdictError, normalizeVerdict, parseJudgeResponse } from './verdict'

const OPINION = 'A concise reasoned opinion returned by the model.'

/** Acceptance criterion 8: valid verdict parsing works. */
describe('parsing a well-formed judge reply', () => {
  it('reads both allowed verdicts and the reasoning behind them', () => {
    for (const verdict of VERDICTS) {
      expect(parseJudgeResponse(`VERDICT: ${verdict}\n${OPINION}`)).toEqual({
        verdict,
        opinion: OPINION,
      })
    }
  })

  it('keeps a multi-paragraph opinion whole', () => {
    const opinion = 'First paragraph.\n\nSecond paragraph.'

    expect(parseJudgeResponse(`VERDICT: JUSTIFIED\n\n${opinion}`).opinion).toBe(opinion)
  })

  it('accepts the spellings and decoration a model actually emits', () => {
    const spellings = [
      'VERDICT: NOT JUSTIFIED',
      'VERDICT: not_justified',
      'VERDICT: Not-Justified',
      'VERDICT:   **NOT_JUSTIFIED**  ',
      'verdict: `NOT_JUSTIFIED`',
      '**VERDICT:** NOT_JUSTIFIED.',
      '# VERDICT: NOT_JUSTIFIED',
      '> VERDICT: NOT_JUSTIFIED',
    ]

    for (const line of spellings) {
      expect(parseJudgeResponse(`${line}\n${OPINION}`).verdict).toBe('NOT_JUSTIFIED')
    }
  })

  it('normalizes a bare token without touching an unrecognized one', () => {
    expect(normalizeVerdict('  justified ')).toBe('JUSTIFIED')
    expect(normalizeVerdict('NOT JUSTIFIED')).toBe('NOT_JUSTIFIED')
    expect(normalizeVerdict('MOSTLY JUSTIFIED')).toBeNull()
  })

  it('does not read NOT_JUSTIFIED as JUSTIFIED', () => {
    // The dangerous near-miss: one token contains the other as a substring.
    expect(parseJudgeResponse(`VERDICT: NOT_JUSTIFIED\n${OPINION}`).verdict).toBe(
      'NOT_JUSTIFIED',
    )
    expect(normalizeVerdict('NOT_JUSTIFIED')).not.toBe('JUSTIFIED')
  })
})

/** Acceptance criterion 9: invalid verdict output fails clearly. */
describe('parsing a malformed judge reply', () => {
  const malformed: ReadonlyArray<readonly [string, string]> = [
    ['an empty string', ''],
    ['whitespace only', '   \n  '],
    ['prose with no verdict line', `${OPINION} I find the killing justified.`],
    ['an unknown verdict token', `VERDICT: MAYBE\n${OPINION}`],
    ['a hedged verdict', `VERDICT: JUSTIFIED AND NOT_JUSTIFIED\n${OPINION}`],
    ['an empty verdict token', `VERDICT:\n${OPINION}`],
    ['a verdict with no reasoning', 'VERDICT: JUSTIFIED'],
    ['a refusal', 'I am not able to decide this case.'],
  ]

  for (const [description, response] of malformed) {
    it(`rejects ${description}`, () => {
      expect(() => parseJudgeResponse(response)).toThrow(InvalidVerdictError)
    })
  }

  it('never substitutes a verdict of its own when output is malformed', () => {
    for (const [, response] of malformed) {
      let parsed: unknown = 'no value was produced'

      try {
        parsed = parseJudgeResponse(response)
      } catch (caught) {
        expect(caught).toBeInstanceOf(InvalidVerdictError)
      }

      expect(parsed).toBe('no value was produced')
    }
  })

  it('explains what was expected and shows what arrived', () => {
    let caught: unknown

    try {
      parseJudgeResponse('VERDICT: MAYBE\nSome reasoning.')
    } catch (error) {
      caught = error
    }

    expect(caught).toBeInstanceOf(InvalidVerdictError)
    const message = (caught as InvalidVerdictError).message
    expect(message).toContain('MAYBE')
    expect(message).toContain('JUSTIFIED')
    expect(message).toContain('NOT_JUSTIFIED')
    expect((caught as InvalidVerdictError).rawResponse).toBe('VERDICT: MAYBE\nSome reasoning.')
  })

  it('truncates a runaway response instead of pasting it whole into the message', () => {
    const flood = 'x'.repeat(5000)
    let message = ''

    try {
      parseJudgeResponse(flood)
    } catch (caught) {
      message = (caught as Error).message
    }

    expect(message).not.toBe('')
    expect(message.length).toBeLessThan(600)
  })
})
