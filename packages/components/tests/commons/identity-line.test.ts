/**
 * Pins `identityLine` (`src/commons/identity-line.ts`) — the joiner that lets
 * every identity rendering (cartouche, title-slide signature, shell brand)
 * absorb the blank first-launch identity without orphan separators.
 */
import { describe, expect, it } from 'vitest'
import { identityLine } from '../../src/commons/identity-line'

describe('identityLine', () => {
  it('joins the filled parts with the separator', () => {
    expect(identityLine(' · ', 'Déjà Vu Ltd.', 'DSI')).toBe('Déjà Vu Ltd. · DSI')
  })

  it('drops empty, blank and absent parts — no orphan separator', () => {
    // If this breaks, the blank first-launch identity shows « · » alone in
    // the cartouche and an em-dash alone under the title slide.
    expect(identityLine(' · ', '', 'DSI')).toBe('DSI')
    expect(identityLine(' — ', 'Déjà Vu Ltd.', '  ')).toBe('Déjà Vu Ltd.')
    expect(identityLine(' · ', undefined, 'DSI')).toBe('DSI')
  })

  it('yields the empty string when nothing is filled — the caller hides the line', () => {
    expect(identityLine(' · ', '', undefined, '   ')).toBe('')
  })
})
