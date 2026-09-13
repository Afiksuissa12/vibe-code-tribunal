/**
 * Structural headings for the first screen's three participant groups.
 *
 * These are UI labels only. Every name, descriptor, fact and summary on the
 * screen comes from `src/data`, which stays the single source of truth for
 * tribunal content. They live here so there is exactly one copy of each label,
 * shared by the screen and its tests.
 */

export const DEFENSE_HEADING = 'Defense representatives'
export const PROSECUTION_HEADING = 'Prosecution representatives'
export const JUDICIAL_PANEL_HEADING = 'Independent judicial panel'

/** Headings for the two result sections, which appear only after a run. */
export const TRANSCRIPT_HEADING = 'Transcript'
export const JUDICIAL_OPINIONS_HEADING = 'Judicial opinions'
