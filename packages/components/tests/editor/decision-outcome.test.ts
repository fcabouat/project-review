import { describe, expect, it } from 'vitest'
import { isoDate } from '@project-review/core/values/date'
import { matchesOutcome, outcomeDraft, readOutcomeDraft } from '../../src/editor/decision-outcome'

describe('outcome draft — two fields, one domain value', () => {
  const taken = { text: 'Approved', when: isoDate('2026-09-12')! }

  it('holds either first half until its counterpart arrives', () => {
    const empty = outcomeDraft(undefined)
    expect(empty).toEqual({ text: '', when: '' })
    for (const first of [{ text: taken.text }, { when: taken.when }]) {
      const partial = { ...empty, ...first }
      expect(readOutcomeDraft(partial)).toEqual({ ok: false, reason: 'incomplete' })
      expect(matchesOutcome(partial, undefined)).toBe(false)
      expect(readOutcomeDraft({ ...partial, ...taken })).toEqual({ ok: true, taken })
    }
  })

  it('keeps an invalid calendar date outside the model and can recover', () => {
    expect(readOutcomeDraft({ text: taken.text, when: '2026-02-30' })).toEqual({
      ok: false,
      reason: 'invalidDate',
    })
    expect(readOutcomeDraft(outcomeDraft(taken))).toEqual({ ok: true, taken })
  })

  it('recognizes unchanged values and an explicit clearing of both fields', () => {
    expect(matchesOutcome(outcomeDraft(taken), taken)).toBe(true)
    expect(matchesOutcome(outcomeDraft(undefined), undefined)).toBe(true)
    expect(matchesOutcome({ ...taken, when: '2026-09-13' }, taken)).toBe(false)
    expect(readOutcomeDraft(outcomeDraft(undefined))).toEqual({ ok: true, taken: undefined })
  })
})
