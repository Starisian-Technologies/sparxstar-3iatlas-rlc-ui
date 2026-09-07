/**
 * Spec §1.8 — Localization, Always:
 *
 * > Every student-facing string is a localization key. Always. From day one.
 * > Not deferred. The product mission is to honor mother tongue — English-only
 * > interface contradicts the mission.
 * > … No hardcoded English in any student-facing component.
 *
 * That is a mission requirement, not a polish item, and it is the kind of rule
 * that decays silently: one `placeholder="Type here"` added in a hurry is
 * invisible in review and permanent in the product. This test is the guard.
 *
 * It scans the student-facing screens and the shared components they render for
 * literal English in the three places it actually leaks — visible JSX text,
 * `placeholder`, and `aria-label` — and fails with the file, the line and the
 * string. `aria-label` counts: a screen reader reads it aloud to the student.
 *
 * WHAT IT DELIBERATELY DOES NOT DO is prove a string is translated. It proves a
 * string is *translatable*. Only English is bundled today; Mandinka, Wolof and
 * Fula must be supplied or approved by AIWA and are not the agent's to invent.
 * See `src/i18n/index.ts`.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Files whose rendered strings reach a student. Teacher-only screens are held
 * to the same standard where practical but are not the mission requirement, so
 * they are listed separately and can be tightened without loosening this.
 */
const STUDENT_FACING = [
  'src/screens/LandingScreen.tsx',
  'src/screens/student',
  'src/screens/qc',
  'src/screens/ceremony',
  'src/components/RlcRecorder.tsx',
  'src/components/AccessoryBar.tsx',
  'src/components/ContinuityBanner.tsx',
  'src/components/SyncStatusIndicator.tsx',
  'src/components/XpBar.tsx',
  'src/components/StarBadge.tsx',
]

function filesUnder(path: string): string[] {
  const st = statSync(path)
  if (st.isFile()) return path.endsWith('.tsx') || path.endsWith('.ts') ? [path] : []
  return readdirSync(path).flatMap((entry) => filesUnder(join(path, entry)))
}

/**
 * Visible JSX text between tags: `>Some words<`.
 *
 * The leading class is `[^<>{}\s]` and NOT `[A-Za-z]`. An earlier version
 * anchored on A-Z, which quietly excused every visible string that opens with a
 * bracket, a digit, a quote or a lowercase word — including
 * "(@sparxstar/starmus-audio — wiring in progress)", which was sitting in a
 * student-facing screen while this test reported a clean run. A guard whose
 * regex is narrower than its own docstring is worse than no guard: it converts
 * "we checked" into a false statement.
 */
const JSX_TEXT = />\s*([^<>{}\s][^<>{}\n]{2,})\s*</g
/**
 * Literal placeholder / aria-label / title attributes, single OR double quoted.
 * Template-literal attributes (`aria-label={`...`}`) are caught separately
 * below — they were the other hole, and interpolation is not translation.
 */
const ATTR = /(?:placeholder|aria-label|title)=(?:"([^"]{2,})"|'([^']{2,})')/g
/** `attr={`text ${expr}`}` — English with a value spliced into it. */
const TEMPLATE_ATTR = /(?:placeholder|aria-label|title)=\{`([^`]*[A-Za-z]{2,}[^`]*)`\}/g

/**
 * Strings that are not English prose and never need translating: bare
 * punctuation/symbol runs, single words that are the same in every locale, and
 * masked-input dots. Kept deliberately short — the temptation with a test like
 * this is to widen the allowlist until it passes, which turns the guard off.
 */
function isTranslatable(value: string): boolean {
  const v = value.trim()
  if (v.length < 3) return false
  // No ASCII letters at all → symbols, dots, digits, punctuation.
  if (!/[A-Za-z]/.test(v)) return false
  // An i18n interpolation that already went through t().
  if (v.includes('{{')) return false
  // A bare JSX expression the regex clipped, e.g. `} of {`. Requires at least
  // two consecutive letters somewhere to count as prose.
  if (!/[A-Za-z]{2,}/.test(v)) return false
  return true
}

describe('no hardcoded student-facing English (spec §1.8)', () => {
  const offenders: string[] = []

  for (const target of STUDENT_FACING) {
    for (const file of filesUnder(target)) {
      if (file.includes('.test.')) continue
      const source = readFileSync(file, 'utf8')
      const lines = source.split('\n')

      for (const [regex, kind] of [
        [JSX_TEXT, 'text'],
        [ATTR, 'attribute'],
        [TEMPLATE_ATTR, 'template-attribute'],
      ] as const) {
        regex.lastIndex = 0
        let match: RegExpExecArray | null
        while ((match = regex.exec(source)) !== null) {
          // ATTR has two alternates (double- and single-quoted); take whichever matched.
          const value = match[1] ?? match[2]
          if (!value) continue
          if (!isTranslatable(value)) continue
          const line = source.slice(0, match.index).split('\n').length
          // Skip anything on a line that is plainly a comment.
          const text = lines[line - 1]?.trim() ?? ''
          if (text.startsWith('//') || text.startsWith('*') || text.startsWith('/*')) continue
          offenders.push(`${file}:${line}  [${kind}]  ${JSON.stringify(value)}`)
        }
      }
    }
  }

  it('routes every student-facing string through i18next', () => {
    expect(offenders).toEqual([])
  })
})

/**
 * The second half of the guarantee. The scan above proves every student-facing
 * string goes through `t()`; this proves the bundle actually carries it.
 *
 * A `defaultValue` that is not in `en/common.json` renders fine in English and
 * is invisible to a translator — the key never reaches the file AIWA works
 * from, so the string silently ships untranslatable in every other locale.
 * A `defaultValue` that DISAGREES with the bundle is worse: English readers see
 * one string and every other locale is translated from another.
 */
describe('the English bundle carries every key the code defaults', () => {
  const T_WITH_DEFAULT =
    /t\(\s*'([a-zA-Z0-9_.]+)'\s*,\s*\{[^}]*?defaultValue:\s*('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")/gs

  function lookup(bundle: unknown, key: string): unknown {
    return key.split('.').reduce<unknown>((node, seg) => {
      if (node && typeof node === 'object' && seg in (node as Record<string, unknown>)) {
        return (node as Record<string, unknown>)[seg]
      }
      return undefined
    }, bundle)
  }

  const bundle: unknown = JSON.parse(readFileSync('src/i18n/locales/en/common.json', 'utf8'))
  const missing: string[] = []
  const mismatched: string[] = []

  function walk(dir: string): string[] {
    return readdirSync(dir).flatMap((entry) => {
      const full = join(dir, entry)
      if (statSync(full).isDirectory()) return walk(full)
      return full.endsWith('.tsx') || full.endsWith('.ts') ? [full] : []
    })
  }

  for (const file of walk('src')) {
    if (file.includes('.test.')) continue
    const source = readFileSync(file, 'utf8')
    T_WITH_DEFAULT.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = T_WITH_DEFAULT.exec(source)) !== null) {
      const key = match[1]
      const raw = match[2]
      const expected = raw
        .slice(1, -1)
        .replace(/\\'/g, "'")
        .replace(/\\"/g, '"')
        .replace(/\\u2019/g, '\u2019')
        .replace(/\\u2014/g, '\u2014')
      const actual = lookup(bundle, key)
      if (actual === undefined) missing.push(`${key}  (${file})`)
      else if (actual !== expected) {
        mismatched.push(`${key}: bundle ${JSON.stringify(actual)} vs code ${JSON.stringify(expected)}`)
      }
    }
  }

  it('has no key that only exists as an inline defaultValue', () => {
    expect(missing).toEqual([])
  })

  it('has no key whose bundle text disagrees with the code default', () => {
    expect(mismatched).toEqual([])
  })
})
