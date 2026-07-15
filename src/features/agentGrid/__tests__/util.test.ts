import {describe, expect, it} from '@jest/globals'

import {AVATAR_RAMPS, initialsFor, rampFor} from '../util'

describe('initialsFor', () => {
  it('takes the first letters of the first two display-name words', () => {
    expect(initialsFor('Dorothy Vale', 'dorothy.pds.authority-one.com')).toBe(
      'DV',
    )
    expect(initialsFor('bull the coach', 'bull.pds.authority-one.com')).toBe(
      'BT',
    )
  })

  it('uses the first two letters of a single-word name', () => {
    expect(initialsFor('Boogie', 'boogie.pds.authority-one.com')).toBe('BO')
  })

  it('falls back to the handle first segment when there is no name', () => {
    expect(initialsFor(undefined, 'fran.pds.authority-one.com')).toBe('FR')
    expect(initialsFor('   ', 'opie.pds.authority-one.com')).toBe('OP')
  })

  it('never returns empty', () => {
    expect(initialsFor(undefined, undefined)).toBe('?')
    expect(initialsFor('', '')).toBe('?')
  })
})

describe('rampFor', () => {
  it('is deterministic and in range', () => {
    const first = rampFor('ada.pds.authority-one.com')
    const second = rampFor('ada.pds.authority-one.com')
    expect(first).toBe(second)
    expect(AVATAR_RAMPS).toContain(first)
  })

  it('spreads different keys across ramps', () => {
    const picks = new Set(
      ['ada', 'bull', 'fran', 'dorothy', 'boogie', 'coyote', 'opie'].map(
        key => rampFor(key).bg,
      ),
    )
    expect(picks.size).toBeGreaterThan(1)
  })
})
