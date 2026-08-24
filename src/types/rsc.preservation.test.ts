import { describe, expect, it } from 'vitest'
import { GRAMMAR_DOMAINS, SPECIAL_CHARS } from './index'

/**
 * RSC AND ORTHOGRAPHY PRESERVATION.
 *
 * This change reworked QC and the ceremony; it must not have disturbed the
 * grammar sequence or the character bar. These are regression guards for design
 * decisions that were deliberate and are easy to erode by accident:
 *
 *   - twelve domains, in a fixed order the game walks automatically
 *   - domains 11 and 12 elicit register (formal / informal), which is grammar in
 *     these languages and the quietest good idea in the design
 *   - every domain declares a focus element, because the red underline needs one
 *   - `ŋ` is FIRST in the character bar: if it is not trivially reachable,
 *     students type `n` and never learn the difference
 */

describe('the twelve grammar domains are intact', () => {
  it('has exactly twelve, numbered 1..12 in order', () => {
    expect(GRAMMAR_DOMAINS).toHaveLength(12)
    expect(GRAMMAR_DOMAINS.map((d) => d.index)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
  })

  it('keeps the fixed sequence — the game walks these, the teacher does not choose', () => {
    expect(GRAMMAR_DOMAINS.map((d) => d.slug)).toEqual([
      'noun_phrase',
      'verb_phrase',
      'adjective',
      'adverb',
      'possession',
      'numeric',
      'interjection',
      'conjunction',
      'classifier',
      'question',
      'formal',
      'informal'
    ])
  })

  it('ends with the two register domains', () => {
    // Greeting an elder and then a friend elicits the formal/informal
    // distinction without ever teaching it. Reordering these away from the end,
    // or dropping them, loses that.
    expect(GRAMMAR_DOMAINS[10]!.slug).toBe('formal')
    expect(GRAMMAR_DOMAINS[11]!.slug).toBe('informal')
  })

  it('gives every domain a prompt and a focus element', () => {
    for (const domain of GRAMMAR_DOMAINS) {
      expect(domain.prompt.length, `${domain.slug} has no prompt`).toBeGreaterThan(0)
      // The focus element is what the red underline points at. A domain without
      // one silently degrades to no underline for every sentence.
      expect(domain.focus_element.length, `${domain.slug} has no focus element`).toBeGreaterThan(0)
      expect(domain.label.length).toBeGreaterThan(0)
    }
  })

  it('has no duplicate slugs or indices', () => {
    expect(new Set(GRAMMAR_DOMAINS.map((d) => d.slug)).size).toBe(12)
    expect(new Set(GRAMMAR_DOMAINS.map((d) => d.index)).size).toBe(12)
  })
})

describe('the special-character bar', () => {
  it('puts ŋ first', () => {
    // Non-negotiable: highest-risk character, so it gets the first position.
    expect(SPECIAL_CHARS[0]).toBe('ŋ')
  })

  it('carries the five consonants the spec names, plus the glottal stop', () => {
    // ŋ ɓ ɗ ñ ɲ are the spec's list. `ʔ` is an intentional addition — the
    // glottal stop is a phoneme in the target languages, and a student who
    // cannot type it will drop it. Recorded here so it is a decision rather than
    // an undocumented drift, and matched in the spec's §7.5 note.
    expect([...SPECIAL_CHARS]).toEqual(['ŋ', 'ɓ', 'ɗ', 'ñ', 'ɲ', 'ʔ'])
  })

  it('has no duplicates and no ASCII stand-ins', () => {
    expect(new Set(SPECIAL_CHARS).size).toBe(SPECIAL_CHARS.length)
    for (const char of SPECIAL_CHARS) {
      // An ASCII letter here would mean a student inserting `n` for `ŋ`, which
      // is the exact failure the bar exists to prevent.
      expect(/^[a-zA-Z]$/.test(char)).toBe(false)
    }
  })
})
