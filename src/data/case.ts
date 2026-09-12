/**
 * The canonical case: identity, central question, neutral summary and the
 * eleven canonical facts, transcribed from FOUNDER_MISSION_001.md.
 *
 * These facts are fixed. Do not add, remove, soften or reinterpret them,
 * and do not record any finding about them here.
 */

import type { CanonicalCase, CentralQuestion } from './types'

export const APP_TITLE = 'The Tribunal'
export const CASE_NAME = 'The Realm v. Jon Snow'

/**
 * The eleven canonical case facts, in the brief's order.
 * Single source of truth — treat as fixed.
 */
export const CANONICAL_FACTS: readonly string[] = [
  "King's Landing had surrendered. Its bells rang and organized resistance had stopped.",
  'After the surrender, Daenerys used Drogon against streets and civilians, causing destruction on a massive scale.',
  'After the victory, Daenerys publicly declared that the campaign of "liberation" would continue beyond King\'s Landing.',
  'Jon witnessed the destruction and heard the speech.',
  'Tyrion Lannister resigned as Hand and was imprisoned.',
  "Tyrion warned Jon that Daenerys could eventually regard Jon's sisters and others who threatened her rule as enemies.",
  'Jon asked Daenerys to forgive Tyrion and show mercy.',
  'Daenerys refused to allow others to decide what was good and presented her own judgment as decisive.',
  'Daenerys was unarmed and was not attacking Jon when he killed her.',
  'Jon used their intimacy to approach her closely enough to stab her.',
  'Before killing Daenerys, Jon had NOT: convened a council, attempted detention, demanded a public surrender of power, or attempted another formal process.',
]

/** Agents must not invent new canonical facts that materially alter the legal or moral situation. */
export const NO_NEW_FACTS_RULE =
  'Agents must not invent new canonical facts that materially alter the legal or moral situation.'

export const CENTRAL_QUESTION: CentralQuestion = {
  question:
    "Was Jon Snow's intentional killing of Daenerys Targaryen justified as the necessary defense of others and of the realm?",
  considerations: [
    'what Jon knew at the time',
    'the scale of the threatened harm',
    'whether safer alternatives existed',
    "and Jon's lack of formal authority",
  ],
}

/**
 * Neutral restatement of the canonical facts and the central question, for the
 * first screen. It states what is on the record and what must be decided; it
 * is deliberately not a conclusion and takes no side.
 */
export const CASE_SUMMARY = [
  "King's Landing had surrendered and organized resistance had stopped. After the surrender Daenerys",
  'Targaryen used Drogon against streets and civilians, and after the victory declared that the campaign',
  'of "liberation" would continue beyond the city. Jon Snow witnessed the destruction and heard the',
  'speech. He then killed her, at a moment when she was unarmed and was not attacking him, and without',
  'first convening a council, attempting detention, demanding a public surrender of power or attempting',
  'another formal process. This tribunal must decide whether that killing was justified as the necessary',
  "defense of others and of the realm, weighing what Jon knew at the time, the scale of the threatened",
  "harm, whether safer alternatives existed, and Jon's lack of formal authority. Nothing above is a",
  'finding: the representatives argue from these facts and each judge reasons to an independent',
  'conclusion.',
].join(' ')

export const CANONICAL_CASE: CanonicalCase = {
  title: APP_TITLE,
  caseName: CASE_NAME,
  centralQuestion: CENTRAL_QUESTION,
  summary: CASE_SUMMARY,
  facts: CANONICAL_FACTS,
}
