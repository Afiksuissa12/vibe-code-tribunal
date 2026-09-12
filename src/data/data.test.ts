import { describe, expect, it } from 'vitest'

import {
  CANONICAL_CASE,
  CANONICAL_FACTS,
  CASE_NAME,
  CASE_SUMMARY,
  JUDICIAL_PROFILES,
  REPRESENTATIVES,
  VERDICTS,
  buildJudgePrompt,
  buildRepresentativePrompt,
} from './index'
import type { Transcript } from './index'

const EMPTY_TRANSCRIPT: Transcript = []

describe('canonical case facts', () => {
  it('holds all eleven canonical facts, each non-empty', () => {
    expect(CANONICAL_FACTS).toHaveLength(11)
    for (const fact of CANONICAL_FACTS) {
      expect(fact.trim()).not.toHaveLength(0)
    }
  })

  it('keeps the facts distinct', () => {
    expect(new Set(CANONICAL_FACTS).size).toBe(CANONICAL_FACTS.length)
  })

  it('carries the case identity, central question and a neutral summary', () => {
    expect(CANONICAL_CASE.title).toBe('The Tribunal')
    expect(CANONICAL_CASE.caseName).toBe(CASE_NAME)
    expect(CANONICAL_CASE.caseName).toBe('The Realm v. Jon Snow')
    expect(CANONICAL_CASE.facts).toBe(CANONICAL_FACTS)
    expect(CANONICAL_CASE.centralQuestion.question.trim()).not.toHaveLength(0)
    expect(CANONICAL_CASE.centralQuestion.considerations).toHaveLength(4)
    expect(CASE_SUMMARY.trim()).not.toHaveLength(0)
  })
})

describe('representatives', () => {
  it('has exactly the four named representatives', () => {
    expect(REPRESENTATIVES.map((r) => r.displayName)).toEqual([
      'Jon Snow',
      'Tyrion Lannister',
      'Daenerys Targaryen',
      'Grey Worm',
    ])
  })

  it('splits two on the defense and two on the prosecution', () => {
    const bySide = (side: string) => REPRESENTATIVES.filter((r) => r.side === side)
    expect(bySide('defense').map((r) => r.displayName)).toEqual(['Jon Snow', 'Tyrion Lannister'])
    expect(bySide('prosecution').map((r) => r.displayName)).toEqual([
      'Daenerys Targaryen',
      'Grey Worm',
    ])
  })

  it('gives every representative an id, a UI descriptor and a full profile', () => {
    const ids = REPRESENTATIVES.map((r) => r.id)
    expect(new Set(ids).size).toBe(REPRESENTATIVES.length)
    for (const representative of REPRESENTATIVES) {
      expect(representative.descriptor.trim()).not.toHaveLength(0)
      expect(representative.profile.trim()).not.toHaveLength(0)
    }
  })
})

describe('judicial profiles', () => {
  it('has exactly the three named judicial models', () => {
    expect(JUDICIAL_PROFILES.map((j) => j.displayName)).toEqual([
      'Aharon Barak model',
      'Menachem Elon model',
      'Meir Shamgar model',
    ])
  })

  it('keeps each profile open-ended about the outcome', () => {
    for (const judge of JUDICIAL_PROFILES) {
      expect(judge.descriptor.trim()).not.toHaveLength(0)
      expect(judge.profile).toMatch(/Do NOT predefine whether .+ finds the killing justified\./)
    }
  })
})

describe('verdicts', () => {
  it('offers exactly the two V1 verdicts', () => {
    expect(VERDICTS).toEqual(['JUSTIFIED', 'NOT JUSTIFIED'])
  })
})

describe('prompt builders', () => {
  const transcript: Transcript = [
    {
      speakerId: 'jon-snow',
      speakerName: 'Jon Snow',
      side: 'defense',
      text: 'A statement recorded earlier in the tribunal.',
    },
  ]

  it('builds a representative prompt with the canonical facts and that profile', () => {
    for (const representative of REPRESENTATIVES) {
      const prompt = buildRepresentativePrompt(representative, transcript)
      expect(prompt).toContain(representative.displayName)
      expect(prompt).toContain(representative.profile)
      for (const fact of CANONICAL_FACTS) {
        expect(prompt).toContain(fact)
      }
      expect(prompt).toContain(transcript[0].text)
    }
  })

  it('builds a judge prompt with the canonical facts, that profile and both verdict labels', () => {
    for (const judge of JUDICIAL_PROFILES) {
      const prompt = buildJudgePrompt(judge, transcript)
      expect(prompt).toContain(judge.displayName)
      expect(prompt).toContain(judge.profile)
      for (const fact of CANONICAL_FACTS) {
        expect(prompt).toContain(fact)
      }
      for (const verdict of VERDICTS) {
        expect(prompt).toContain(verdict)
      }
    }
  })

  it('does not crash on an empty transcript', () => {
    const representativePrompt = buildRepresentativePrompt(REPRESENTATIVES[0], EMPTY_TRANSCRIPT)
    const judgePrompt = buildJudgePrompt(JUDICIAL_PROFILES[0], EMPTY_TRANSCRIPT)
    expect(representativePrompt).toContain('No statements have been made yet')
    expect(judgePrompt).toContain('No statements have been made yet')
  })
})
