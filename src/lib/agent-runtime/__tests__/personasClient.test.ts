import {afterEach, describe, expect, it, jest} from '@jest/globals'

import {getSupabaseAccessToken} from '../authToken'
import {
  createPersona,
  deletePersona,
  fetchPersonas,
  normalizePersonasResponse,
  pickActiveVoiceId,
  pickAgentHeaderName,
  setActivePersona,
  updatePersona,
} from '../personasClient'

jest.mock('../authToken', () => ({
  getSupabaseAccessToken: jest.fn(),
}))

const mockToken = jest.mocked(getSupabaseAccessToken)
const realFetch = global.fetch

afterEach(() => {
  global.fetch = realFetch
  mockToken.mockReset()
})

function mockOkJson(body: unknown) {
  global.fetch = jest.fn(() =>
    Promise.resolve({ok: true, status: 200, json: () => Promise.resolve(body)}),
  ) as unknown as typeof fetch
}

describe('normalizePersonasResponse', () => {
  it('derives activeName/activeVoiceId from the active persona when not echoed', () => {
    const state = normalizePersonasResponse({
      personas: [
        {id: 'p1', name: 'Bob', voiceId: 'v1'},
        {id: 'p2', name: 'Ada', voiceId: 'v2', personality: 'curious'},
      ],
      activePersonaId: 'p2',
      voices: [{voiceId: 'v2', name: 'Ada Voice', default: true}],
    })
    expect(state.activePersonaId).toBe('p2')
    expect(state.activeName).toBe('Ada')
    expect(state.activeVoiceId).toBe('v2')
    expect(state.personas).toHaveLength(2)
    expect(state.voices[0].default).toBe(true)
  })

  it('prefers explicit activeName/activeVoiceId from the payload', () => {
    const state = normalizePersonasResponse({
      personas: [{id: 'p1', name: 'Bob', voiceId: 'v1'}],
      activePersonaId: 'p1',
      activeName: 'Override',
      activeVoiceId: 'vX',
      voices: [],
    })
    expect(state.activeName).toBe('Override')
    expect(state.activeVoiceId).toBe('vX')
  })

  it('is defensive: drops malformed entries, defaults name to id/voiceId', () => {
    const state = normalizePersonasResponse({
      personas: [{name: 'no id'}, {id: 'p1'}, null, 42],
      voices: [{name: 'no voiceId'}, {voiceId: 'v9'}],
    })
    expect(state.personas).toEqual([
      {id: 'p1', name: 'p1', voiceId: undefined, personality: undefined},
    ])
    expect(state.voices).toEqual([{voiceId: 'v9', name: 'v9', default: false}])
  })

  it('handles empty/missing input', () => {
    expect(normalizePersonasResponse(null)).toEqual({
      personas: [],
      voices: [],
      activePersonaId: undefined,
      activeName: undefined,
      activeVoiceId: undefined,
    })
  })
})

describe('pickAgentHeaderName (active persona feeds the header)', () => {
  it('uses the active persona name when present', () => {
    expect(pickAgentHeaderName('Ada', 'profile-fallback')).toBe('Ada')
  })
  it('falls back when the active name is missing/blank', () => {
    expect(pickAgentHeaderName(undefined, 'Fallback')).toBe('Fallback')
    expect(pickAgentHeaderName('   ', 'Fallback')).toBe('Fallback')
  })
})

describe('pickActiveVoiceId (active persona feeds voice mode)', () => {
  it('returns the active voice id, trimmed', () => {
    expect(pickActiveVoiceId('v2')).toBe('v2')
  })
  it('returns undefined when there is no active voice (runtime default applies)', () => {
    expect(pickActiveVoiceId(undefined)).toBeUndefined()
    expect(pickActiveVoiceId('  ')).toBeUndefined()
  })
})

describe('fetchPersonas', () => {
  it('returns signedOut when there is no token', async () => {
    mockToken.mockResolvedValue(null)
    const res = await fetchPersonas()
    expect(res).toEqual({signedOut: true})
  })

  it('returns normalized state on success', async () => {
    mockToken.mockResolvedValue('tok')
    mockOkJson({
      personas: [{id: 'p1', name: 'Bob', voiceId: 'v1'}],
      activePersonaId: 'p1',
      voices: [{voiceId: 'v1', name: 'Bob Voice'}],
    })
    const res = await fetchPersonas()
    expect(res.signedOut).toBe(false)
    expect(res.state?.activeName).toBe('Bob')
    expect(res.state?.activeVoiceId).toBe('v1')
  })

  it('treats 401/403 as no-state (not a hard error)', async () => {
    mockToken.mockResolvedValue('tok')
    global.fetch = jest.fn(() =>
      Promise.resolve({ok: false, status: 401}),
    ) as unknown as typeof fetch
    const res = await fetchPersonas()
    expect(res).toEqual({signedOut: false})
  })

  it('never throws on network error', async () => {
    mockToken.mockResolvedValue('tok')
    global.fetch = jest.fn(() => Promise.reject(new Error('offline')))
    const res = await fetchPersonas()
    expect(res.signedOut).toBe(false)
    expect(res.error).toBeDefined()
    expect(res.state).toBeUndefined()
  })
})

describe('CRUD request shaping', () => {
  it('POSTs the right bodies and is signed out without a token', async () => {
    mockToken.mockResolvedValue(null)
    expect(await createPersona({name: 'x'})).toEqual({
      ok: false,
      signedOut: true,
    })

    mockToken.mockResolvedValue('tok')
    mockOkJson({})
    await createPersona({name: 'Ada', voiceId: 'v2', personality: 'curious'})
    await updatePersona({id: 'p2', name: 'Ada 2'})
    await deletePersona({id: 'p2'})
    await setActivePersona({id: 'p1'})

    const calls = (global.fetch as unknown as jest.Mock).mock.calls
    const byUrl = (suffix: string) =>
      calls.find(c => String(c[0]).endsWith(suffix))
    const bodyOf = (c: unknown[]) =>
      JSON.parse(String((c[1] as {body: string}).body))

    expect(bodyOf(byUrl('/app/personas')!)).toEqual({
      name: 'Ada',
      voiceId: 'v2',
      personality: 'curious',
    })
    expect(bodyOf(byUrl('/app/personas/update')!)).toMatchObject({
      id: 'p2',
      name: 'Ada 2',
    })
    expect(bodyOf(byUrl('/app/personas/delete')!)).toEqual({id: 'p2'})
    expect(bodyOf(byUrl('/app/personas/active')!)).toEqual({id: 'p1'})
  })

  it('returns the refreshed state when the runtime echoes a personas view', async () => {
    mockToken.mockResolvedValue('tok')
    mockOkJson({
      personas: [
        {id: 'p1', name: 'Bob'},
        {id: 'p2', name: 'Stormy', personality: 'an ice hog'},
      ],
      activePersonaId: 'p1',
      voices: [{voiceId: 'v1', name: 'Bob'}],
    })
    const res = await createPersona({name: 'Stormy', personality: 'an ice hog'})
    expect(res.ok).toBe(true)
    // The authoritative list comes back so the cache can update without a refetch.
    expect(res.state?.personas.map(p => p.name)).toEqual(['Bob', 'Stormy'])
  })

  it('omits state when the runtime body is not a personas view', async () => {
    mockToken.mockResolvedValue('tok')
    mockOkJson({ok: true})
    const res = await setActivePersona({id: 'p1'})
    expect(res.ok).toBe(true)
    expect(res.state).toBeUndefined()
  })
})
