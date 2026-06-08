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

export function placeholderRights(): Rights {
  // Forcing function: in production builds this throws hard so the placeholder
  // cannot silently become the prod default. Rights travel with every token
  // and cannot be retightened after collection — so the consent stage MUST be
  // wired up (and this function removed from prod code paths) before a prod
  // build is allowed to call /session/create. Staging that needs to mirror
  // prod should ship the consent stage too.
  if (import.meta.env.PROD) {
    throw new Error(
      '[RLC] DEV_PLACEHOLDER_RIGHTS called in a production build. ' +
        'Wire up the consent stage and route per-token rights from it before shipping.',
    )
  }
  return DEV_PLACEHOLDER_RIGHTS
}
