/**
 * T1 rights confirmation — the properties spec §1.10 actually requires.
 *
 * These are not UI-polish tests. Rights travel with every token through every
 * downstream system and cannot be narrowed after collection, so a default that
 * slips through here is permanent for that class's data. Each test pins one
 * sentence of the spec.
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { RightsConfirmation } from '@/components/RightsConfirmation'
import {
  EMPTY_RIGHTS_DRAFT,
  isRightsComplete,
  toRights,
  LICENSE_PRESETS,
  type RightsDraft,
} from '@/runtime/rights'
import { ThemeProvider } from '@/theme/ThemeProvider'
import '@/i18n'

function renderRights(value: RightsDraft, onChange = vi.fn()) {
  render(
    <ThemeProvider>
      <RightsConfirmation value={value} onChange={onChange} />
    </ThemeProvider>,
  )
  return onChange
}

describe('rights confirmation (spec §1.10)', () => {
  it('starts with every field unanswered — "never forced" means no preselection', () => {
    expect(EMPTY_RIGHTS_DRAFT.license).toBeNull()
    expect(EMPTY_RIGHTS_DRAFT.ai_training).toBe('unset')
    expect(EMPTY_RIGHTS_DRAFT.commercial).toBe('unset')
  })

  it('never defaults ai_training to true', () => {
    // The literal sentence in the spec. A `false` default would satisfy its
    // letter while still being a default, which is why 'unset' is a state.
    expect(EMPTY_RIGHTS_DRAFT.ai_training).not.toBe('yes')
    expect(toRights(EMPTY_RIGHTS_DRAFT)).toBeNull()
  })

  it('renders no radio as checked before the teacher answers', () => {
    renderRights(EMPTY_RIGHTS_DRAFT)
    const radios = screen.getAllByRole('radio')
    expect(radios.length).toBeGreaterThan(0)
    expect(radios.every((r) => r.getAttribute('aria-checked') === 'false')).toBe(true)
  })

  it('refuses to produce a wire envelope until all three are answered', () => {
    expect(toRights({ license: 'CC-BY-NC-4.0', ai_training: 'yes', commercial: 'unset' })).toBeNull()
    expect(toRights({ license: null, ai_training: 'yes', commercial: 'no' })).toBeNull()
    expect(toRights({ license: 'CC-BY-NC-4.0', ai_training: 'unset', commercial: 'no' })).toBeNull()
    expect(isRightsComplete(EMPTY_RIGHTS_DRAFT)).toBe(false)
  })

  it('produces the exact wire shape once complete', () => {
    const rights = toRights({ license: 'CC-BY-NC-4.0', ai_training: 'no', commercial: 'yes' })
    expect(rights).toEqual({ license: 'CC-BY-NC-4.0', ai_training: false, commercial: true })
  })

  it('distinguishes an answered No from an unanswered field', () => {
    // The bug this guards: collapsing 'unset' and 'no' would let an untouched
    // form submit as a deliberate refusal, which is a fabricated consent answer.
    const answeredNo: RightsDraft = { license: 'CC-BY-NC-4.0', ai_training: 'no', commercial: 'no' }
    expect(isRightsComplete(answeredNo)).toBe(true)
    expect(toRights(answeredNo)).toEqual({
      license: 'CC-BY-NC-4.0',
      ai_training: false,
      commercial: false,
    })
  })

  it('offers only license identifiers that exist on the platform', () => {
    // Guards against a plausible-looking SPDX id being invented in the UI and
    // then riding on every token, unfixable, through DVE.
    expect(LICENSE_PRESETS).toEqual(['CC-BY-NC-4.0'])
    expect(LICENSE_PRESETS.every((l) => typeof l === 'string' && l.length > 0)).toBe(true)
  })

  it('reports each answer to the parent without inventing the others', () => {
    const onChange = renderRights(EMPTY_RIGHTS_DRAFT)
    fireEvent.click(screen.getAllByRole('radio')[0])
    expect(onChange).toHaveBeenCalledTimes(1)
    const next = onChange.mock.calls[0][0] as RightsDraft
    expect(next.ai_training).toBe('yes')
    // The untouched fields stay untouched — answering one question must not
    // silently answer another.
    expect(next.commercial).toBe('unset')
    expect(next.license).toBeNull()
  })

  it('is one tab stop, and the unanswered group parks it on the first option', () => {
    renderRights(EMPTY_RIGHTS_DRAFT)
    // A radiogroup is a single tab stop. With nothing selected there is no
    // chosen option to carry it, so the first holds it — per WAI-ARIA — which
    // lets a keyboard user reach the group without anything being selected for
    // them.
    const radios = screen.getAllByRole('radio')
    const tabbable = radios.filter((r) => r.getAttribute('tabindex') === '0')
    expect(tabbable).toHaveLength(2) // one per question, not one per option
    expect(radios[0].getAttribute('tabindex')).toBe('0')
    expect(radios[1].getAttribute('tabindex')).toBe('-1')
  })

  it('selects with arrow keys, so a keyboard user can answer at all', () => {
    const onChange = renderRights(EMPTY_RIGHTS_DRAFT)
    const group = screen.getAllByRole('radiogroup')[0]
    fireEvent.keyDown(group, { key: 'ArrowRight' })
    expect(onChange).toHaveBeenCalledTimes(1)
    // From unset, the arrow lands on the first option — a deliberate press by
    // the person, not a default the component supplied.
    expect((onChange.mock.calls[0][0] as RightsDraft).ai_training).toBe('yes')
  })

  it('wraps with arrow keys and jumps with Home/End', () => {
    const onChange = renderRights({ ...EMPTY_RIGHTS_DRAFT, ai_training: 'yes' })
    const group = screen.getAllByRole('radiogroup')[0]
    fireEvent.keyDown(group, { key: 'ArrowRight' })
    expect((onChange.mock.calls[0][0] as RightsDraft).ai_training).toBe('no')
    fireEvent.keyDown(group, { key: 'End' })
    expect((onChange.mock.calls[1][0] as RightsDraft).ai_training).toBe('no')
    fireEvent.keyDown(group, { key: 'Home' })
    expect((onChange.mock.calls[2][0] as RightsDraft).ai_training).toBe('yes')
  })

  it('ignores keys that are not part of the radio pattern', () => {
    const onChange = renderRights(EMPTY_RIGHTS_DRAFT)
    const group = screen.getAllByRole('radiogroup')[0]
    fireEvent.keyDown(group, { key: 'a' })
    fireEvent.keyDown(group, { key: 'Tab' })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('meets the 44px minimum touch target on every choice control', () => {
    renderRights(EMPTY_RIGHTS_DRAFT)
    for (const radio of screen.getAllByRole('radio')) {
      expect(Number.parseInt((radio as HTMLElement).style.minHeight, 10)).toBeGreaterThanOrEqual(44)
    }
  })
})
