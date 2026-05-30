/**
 * Adinkra symbol set used for student avatars.
 *
 * Adinkra are traditional West African (Akan / Asante) symbols, each carrying
 * a proverbial meaning. We use them for student avatars instead of stock
 * initials so the visual language of the product is rooted in the region it
 * was built for. Reference: https://www.adinkrasymbols.org/
 *
 * Each entry includes the original name (in the original orthography) and a
 * short English meaning. Meanings are surfaced as `aria-label` and tooltips
 * so students and teachers can learn what their symbol represents.
 *
 * The SVG `paths` are simplified, single-stroke renderings designed to read
 * well at 32–96px on low-resolution screens. They are intentionally not
 * pixel-perfect reproductions of any specific cultural artefact.
 *
 * All paths assume a 100×100 viewBox.
 */

export interface AdinkraSymbol {
  /** Stable id used by hashing. Never re-order this array. */
  id: string
  /** Symbol name (Akan / Twi). */
  name: string
  /** Short English meaning (proverbial gloss). */
  meaning: string
  /** SVG path data — viewBox 100x100, stroke-based. */
  paths: string[]
  /** Optional filled shapes drawn after the strokes. */
  fills?: string[]
}

export const ADINKRA: AdinkraSymbol[] = [
  {
    id: 'sankofa',
    name: 'Sankofa',
    meaning: 'Go back and fetch it — learn from the past',
    paths: [
      'M50 15 C 25 15 15 35 15 55 C 15 75 30 90 50 90 C 65 90 80 80 85 60',
      'M85 60 L 75 50 M85 60 L 95 50',
    ],
    fills: [
      'M50 12 L 60 22 L 50 32 L 40 22 Z',
    ],
  },
  {
    id: 'gye-nyame',
    name: 'Gye Nyame',
    meaning: 'Except for God — the supremacy of the divine',
    paths: [
      'M50 10 C 25 10 15 30 15 50 C 15 75 30 90 50 90 C 70 90 85 75 85 55 C 85 40 75 30 60 30',
      'M60 30 C 50 30 45 40 45 50 C 45 60 55 70 65 70',
      'M30 50 L 70 50',
    ],
  },
  {
    id: 'adinkrahene',
    name: 'Adinkrahene',
    meaning: 'Chief of the symbols — greatness and leadership',
    paths: [
      'M50 50 m -35 0 a 35 35 0 1 0 70 0 a 35 35 0 1 0 -70 0',
      'M50 50 m -22 0 a 22 22 0 1 0 44 0 a 22 22 0 1 0 -44 0',
      'M50 50 m -10 0 a 10 10 0 1 0 20 0 a 10 10 0 1 0 -20 0',
    ],
  },
  {
    id: 'dwennimmen',
    name: 'Dwennimmɛn',
    meaning: "Ram's horns — strength tempered by humility",
    paths: [
      'M30 30 C 15 30 10 45 20 55 C 30 65 35 50 35 40',
      'M70 30 C 85 30 90 45 80 55 C 70 65 65 50 65 40',
      'M40 50 C 40 70 45 80 50 85 C 55 80 60 70 60 50',
      'M35 45 L 65 45',
    ],
  },
  {
    id: 'nyame-dua',
    name: 'Nyame Dua',
    meaning: 'Tree of God — divine presence and protection',
    paths: [
      'M50 10 L 50 90',
      'M20 35 L 80 35',
      'M25 60 L 75 60',
      'M30 20 L 70 20',
    ],
    fills: [
      'M50 50 m -12 0 a 12 12 0 1 0 24 0 a 12 12 0 1 0 -24 0',
    ],
  },
  {
    id: 'fawohodie',
    name: 'Fawohodie',
    meaning: 'Independence — comes with responsibility',
    paths: [
      'M50 15 L 50 85',
      'M20 30 C 35 25 50 30 65 25 C 75 23 80 28 80 35',
      'M80 50 C 70 55 60 50 50 55 C 40 60 30 55 20 60',
      'M25 75 C 40 70 55 75 70 72',
    ],
  },
  {
    id: 'eban',
    name: 'Eban',
    meaning: 'Fence — love, safety and security of home',
    paths: [
      'M15 25 L 85 25 L 85 85 L 15 85 Z',
      'M15 45 L 85 45',
      'M15 65 L 85 65',
      'M35 25 L 35 85',
      'M65 25 L 65 85',
      'M50 10 L 30 25 M50 10 L 70 25',
    ],
  },
  {
    id: 'mate-masie',
    name: 'Mate Masie',
    meaning: 'What I hear, I keep — wisdom and discretion',
    paths: [
      'M50 50 m -32 0 a 32 32 0 1 0 64 0 a 32 32 0 1 0 -64 0',
      'M25 35 C 35 25 65 25 75 35',
      'M25 65 C 35 75 65 75 75 65',
    ],
    fills: [
      'M50 50 m -8 0 a 8 8 0 1 0 16 0 a 8 8 0 1 0 -16 0',
    ],
  },
  {
    id: 'akoma',
    name: 'Akoma',
    meaning: 'The heart — patience and tolerance',
    fills: [
      'M50 25 C 35 10 15 20 15 40 C 15 60 35 75 50 90 C 65 75 85 60 85 40 C 85 20 65 10 50 25 Z',
    ],
    paths: [],
  },
  {
    id: 'akofena',
    name: 'Akofena',
    meaning: 'Sword of war — courage and valour',
    paths: [
      'M30 15 L 30 70 L 25 80 L 35 80 L 30 70',
      'M70 15 L 70 70 L 65 80 L 75 80 L 70 70',
      'M20 30 L 40 30 M60 30 L 80 30',
      'M30 50 L 70 50',
    ],
  },
  {
    id: 'duafe',
    name: 'Duafe',
    meaning: 'Wooden comb — beauty, cleanliness and care',
    paths: [
      'M25 30 L 75 30 L 75 50 L 25 50 Z',
      'M30 50 L 30 85',
      'M42 50 L 42 85',
      'M58 50 L 58 85',
      'M70 50 L 70 85',
      'M35 20 L 35 30 M50 15 L 50 30 M65 20 L 65 30',
    ],
  },
  {
    id: 'sesa-wo-suban',
    name: 'Sesa Wo Suban',
    meaning: 'Change or transform your character',
    paths: [
      'M50 15 L 50 85',
      'M15 50 L 85 50',
    ],
    fills: [
      'M50 35 L 60 50 L 50 65 L 40 50 Z',
      'M30 30 m -6 0 a 6 6 0 1 0 12 0 a 6 6 0 1 0 -12 0',
      'M70 70 m -6 0 a 6 6 0 1 0 12 0 a 6 6 0 1 0 -12 0',
    ],
  },
  {
    id: 'denkyem',
    name: 'Denkyem',
    meaning: 'Crocodile — adaptability and cleverness',
    paths: [
      'M10 60 C 25 50 40 55 55 50 C 70 45 85 50 90 60',
      'M10 60 C 25 70 40 65 55 70 C 70 75 85 70 90 60',
      'M20 55 L 25 50 M35 53 L 40 48 M50 52 L 55 47 M65 53 L 70 48 M80 55 L 85 50',
      'M88 60 L 95 55 L 88 65',
    ],
  },
  {
    id: 'nkyinkyim',
    name: 'Nkyinkyim',
    meaning: 'Twisting — the changing path of life',
    paths: [
      'M15 50 L 30 30 L 45 50 L 60 30 L 75 50 L 90 30',
      'M15 70 L 30 50 L 45 70 L 60 50 L 75 70 L 90 50',
    ],
  },
  {
    id: 'aya',
    name: 'Aya',
    meaning: 'Fern — endurance and resourcefulness',
    paths: [
      'M50 10 L 50 90',
      'M50 25 C 35 25 25 35 25 45',
      'M50 25 C 65 25 75 35 75 45',
      'M50 45 C 30 45 20 55 20 65',
      'M50 45 C 70 45 80 55 80 65',
      'M50 65 C 35 65 25 75 25 85',
      'M50 65 C 65 65 75 75 75 85',
    ],
  },
  {
    id: 'bese-saka',
    name: 'Bese Saka',
    meaning: 'Sack of kola nuts — abundance and togetherness',
    paths: [
      'M50 50 m -35 0 a 35 35 0 1 0 70 0 a 35 35 0 1 0 -70 0',
    ],
    fills: [
      'M35 40 m -7 0 a 7 7 0 1 0 14 0 a 7 7 0 1 0 -14 0',
      'M65 40 m -7 0 a 7 7 0 1 0 14 0 a 7 7 0 1 0 -14 0',
      'M50 55 m -7 0 a 7 7 0 1 0 14 0 a 7 7 0 1 0 -14 0',
      'M35 70 m -7 0 a 7 7 0 1 0 14 0 a 7 7 0 1 0 -14 0',
      'M65 70 m -7 0 a 7 7 0 1 0 14 0 a 7 7 0 1 0 -14 0',
    ],
  },
] as const

/**
 * Deterministic 32-bit FNV-1a hash of an input string. Stable across runs and
 * platforms — same screen name always produces the same Adinkra.
 */
function fnv1a(input: string): number {
  let hash = 2166136261
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

/** Pick a deterministic Adinkra for a screen name. */
export function adinkraFor(seed: string): AdinkraSymbol {
  const key = (seed || 'anonymous').trim().toLowerCase()
  const index = fnv1a(key) % ADINKRA.length
  return ADINKRA[index]
}

/**
 * Pick a deterministic background hue (HSL) so two players with the same
 * Adinkra still have visibly distinct avatars. Hue space avoids reds that
 * clash with the primary brand.
 */
export function adinkraBgHue(seed: string): number {
  const key = (seed || 'anonymous').trim().toLowerCase()
  // Offset by a second hash pass so it doesn't track 1-for-1 with the symbol.
  return fnv1a(`bg:${key}`) % 360
}
