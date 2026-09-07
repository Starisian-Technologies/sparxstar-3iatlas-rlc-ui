/**
 * RLC token rights — the domain half of T1 rights confirmation
 * (canonical spec §1.10).
 *
 * > Set at session creation. Teacher confirms each field — suggested presets,
 * > never forced.
 * > … ai_training: Consent to use derived signal for AI model training — never
 * > defaulted true without confirmation.
 * > Rights travel with every token through every downstream system. Never
 * > stripped.
 *
 * THERE ARE NO DEFAULTS IN THIS FILE, AND THAT IS THE POINT. This module
 * replaced a `placeholderRights()` helper that returned a hardcoded envelope and
 * threw in production builds to stop itself shipping. The forcing function was
 * right, but the answer to it is a real consent step, not a louder placeholder.
 *
 * Rights cannot be narrowed after collection, so a value chosen here for
 * convenience is permanent for that class's data. `'unset'` is therefore a real
 * state, distinct from an answered "no" — collapsing the two would let an
 * untouched form submit as a deliberate refusal, which is a fabricated consent
 * answer.
 */
import type { Rights } from '@/contract'

/**
 * License presets offered to the teacher.
 *
 * DO NOT ADD IDENTIFIERS THAT ARE NOT IN USE ON THE PLATFORM. This list holds
 * the licenses actually documented across the SPARXSTAR specs and code. A
 * plausible-looking SPDX identifier invented here would travel with every token
 * through DVE and every downstream system, and it cannot be corrected after the
 * fact. Extending the list is an owner/AIWA decision, not a UI change.
 */
export const LICENSE_PRESETS: readonly string[] = ['CC-BY-NC-4.0'] as const

/** Nothing chosen yet is a real state, distinct from "chosen No". */
export type Tri = 'unset' | 'yes' | 'no'

export interface RightsDraft {
  license: string | null
  ai_training: Tri
  commercial: Tri
}

export const EMPTY_RIGHTS_DRAFT: RightsDraft = {
  license: null,
  ai_training: 'unset',
  commercial: 'unset',
}

/** True only when the teacher has answered all three fields. */
export function isRightsComplete(draft: RightsDraft): boolean {
  return draft.license !== null && draft.ai_training !== 'unset' && draft.commercial !== 'unset'
}

/**
 * Convert a completed draft into the wire shape. Returns null when the draft is
 * incomplete — a partially answered rights envelope must not be able to reach
 * the wire, and there is no value that could stand in for an answer the teacher
 * has not given.
 */
export function toRights(draft: RightsDraft): Rights | null {
  if (!isRightsComplete(draft)) return null

  /**
   * THE LICENCE IS CHECKED AGAINST THE PRESETS, NOT TRUSTED FROM THE DRAFT.
   *
   * This used to be `draft.license as string` — a cast, which is a promise to
   * the compiler rather than a check. The UI only ever offers `LICENSE_PRESETS`,
   * but the draft is runtime state: devtools, a mutated DOM, or a future caller
   * building a draft some other way all reach here.
   *
   * That matters more than a normal input check because of where the value
   * goes. The licence rides on every token the class produces, through DVE, and
   * rights cannot be narrowed after collection — so an unrecognised identifier
   * is not a validation error to surface later, it is a permanent mislabelling
   * of a community's language data. Returning null keeps the session
   * uncreatable, which is the same refusal an incomplete draft gets.
   *
   * Narrowing rather than casting also means TypeScript keeps the invariant:
   * if someone widens `RightsDraft['license']`, this stops compiling.
   */
  const license = draft.license
  if (license === null || !LICENSE_PRESETS.includes(license)) return null

  return {
    license,
    ai_training: draft.ai_training === 'yes',
    commercial: draft.commercial === 'yes',
  }
}
