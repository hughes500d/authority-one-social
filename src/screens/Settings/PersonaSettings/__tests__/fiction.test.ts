import {describe, expect, it} from '@jest/globals'

import {type Persona} from '#/lib/agent-runtime'
import {
  addHaunt,
  buildFictionPayload,
  cleanHaunts,
  emptyFictionDraft,
  fictionDraftFromPersona,
  fictionForUpdate,
  fictionHasContent,
  removeHaunt,
} from '../fiction'

describe('haunts list ops', () => {
  it('adds trimmed, non-empty, de-duped (case-insensitive)', () => {
    expect(addHaunt([], '  Cafe  ')).toEqual(['Cafe'])
    expect(addHaunt(['Cafe'], 'cafe')).toEqual(['Cafe']) // dup ignored
    expect(addHaunt(['Cafe'], '   ')).toEqual(['Cafe']) // empty ignored
    expect(addHaunt(['Cafe'], 'Gym')).toEqual(['Cafe', 'Gym'])
  })
  it('removes by index', () => {
    expect(removeHaunt(['a', 'b', 'c'], 1)).toEqual(['a', 'c'])
  })
  it('cleanHaunts trims, drops empties, de-dupes', () => {
    expect(cleanHaunts([' a ', 'A', '', 'b'])).toEqual(['a', 'b'])
  })
})

describe('fictionDraftFromPersona', () => {
  it('empty when persona has no fiction', () => {
    expect(fictionDraftFromPersona(null)).toEqual(emptyFictionDraft())
    expect(fictionDraftFromPersona({id: 'p', name: 'P'})).toEqual(
      emptyFictionDraft(),
    )
  })
  it('seeds from existing fiction', () => {
    const persona: Persona = {
      id: 'p',
      name: 'P',
      fiction: {
        enabled: true,
        backstory: 'b',
        homeBase: 'h',
        haunts: ['x'],
        weeklyRhythm: 'w',
      },
    }
    expect(fictionDraftFromPersona(persona)).toEqual({
      enabled: true,
      backstory: 'b',
      homeBase: 'h',
      haunts: ['x'],
      weeklyRhythm: 'w',
    })
  })
})

describe('fictionHasContent', () => {
  it('false for an untouched empty draft', () => {
    expect(fictionHasContent(emptyFictionDraft())).toBe(false)
  })
  it('true when enabled or any field has content', () => {
    expect(fictionHasContent({...emptyFictionDraft(), enabled: true})).toBe(true)
    expect(
      fictionHasContent({...emptyFictionDraft(), backstory: 'hi'}),
    ).toBe(true)
    expect(
      fictionHasContent({...emptyFictionDraft(), haunts: ['  ']}),
    ).toBe(false) // whitespace-only doesn't count
    expect(fictionHasContent({...emptyFictionDraft(), haunts: ['x']})).toBe(true)
  })
})

describe('buildFictionPayload / fictionForUpdate', () => {
  it('trims fields to undefined and cleans haunts', () => {
    expect(
      buildFictionPayload({
        enabled: true,
        backstory: '  story  ',
        homeBase: '   ',
        haunts: [' a ', 'A', 'b'],
        weeklyRhythm: '',
      }),
    ).toEqual({
      enabled: true,
      backstory: 'story',
      homeBase: undefined,
      haunts: ['a', 'b'],
      weeklyRhythm: undefined,
    })
  })
  it('fictionForUpdate omits (undefined) an empty draft, builds when content exists', () => {
    expect(fictionForUpdate(emptyFictionDraft())).toBeUndefined()
    const out = fictionForUpdate({...emptyFictionDraft(), enabled: true})
    expect(out).toEqual({
      enabled: true,
      backstory: undefined,
      homeBase: undefined,
      haunts: [],
      weeklyRhythm: undefined,
    })
  })
})
