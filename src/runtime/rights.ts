/**
 * RLC token rights — placeholder default for the pre-consent slice.
 *
 * ⚠️ THIS IS NOT THE PRODUCTION VALUE.
 *
 * Real rights MUST be set per-token from the consent stage before any
 * actual student data is collected. Rights travel with every token and
 * cannot be retightened after the fact, so the consent flow is the only
 * legitimate source of these values in production.
 *
 * This placeholder is only here to satisfy the wire contract during
 * pre-consent demo/dev. The pair is coherent (CC-BY-NC-4.0 ↔ commercial:false);
 * the runtime guard below shouts if it ever leaks into a prod-tagged build.
 */
import type { Rights } from '@/contract'

export const DEV_PLACEHOLDER_RIGHTS: Rights = {
  license: 'CC-BY-NC-4.0',
  ai_training: true,
  commercial: false,
}

let warned = false
export function placeholderRights(): Rights {
  if (!warned && import.meta.env.PROD) {
    warned = true
    // Loud, single-shot warning. If the consent stage is wired up, this
    // module shouldn't be imported by production code paths at all.
    console.warn(
      '[RLC] DEV_PLACEHOLDER_RIGHTS in use in a production build. ' +
        'This is a pre-consent placeholder and MUST be replaced by per-token ' +
        'consent values before real student data is collected.',
    )
  }
  return DEV_PLACEHOLDER_RIGHTS
}
