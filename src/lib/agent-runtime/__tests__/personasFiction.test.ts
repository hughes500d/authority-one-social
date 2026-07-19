import {afterEach, describe, expect, it, jest} from '@jest/globals'

import {getSupabaseAccessToken} from '../authToken'
import {
  normalizeFiction,
  type PersonaFiction,
  updatePersona,
} from '../personasClient'

jest.mock('../authToken', () => ({getSupabaseAccessToken: jest.fn()}))

const mockToken = jest.mocked(getSupabaseAccessToken)
const realFetch = global.fetch
afterEach(() => {
  global.fetch = realFetch
  mockToken.mockReset()
})

const fiction: PersonaFiction = {
  enabled: true,
  backstory: 'Grew up by the sea',
  homeBase: 'Raleigh',
  haunts: ['the pier', 'a jazz bar'],
  weeklyRhythm: 'Surfs Saturdays',
}

describe('normalizeFiction', () => {
  it('returns undefined for non-objects', () => {
    expect(normalizeFiction(undefined)).toBeUndefined()
    expect(normalizeFiction('x')).toBeUndefined()
  })
  it('defaults enabled false, drops junk haunts', () => {
    expect(normalizeFiction({haunts: ['a', '', '  ', 2, 'b']})).toEqual({
      enabled: false,
      backstory: undefined,
      homeBase: undefined,
      haunts: ['a', 'b'],
      weeklyRhythm: undefined,
    })
  })
})

describe('updatePersona payload', () => {
  it('includes fiction when provided', async () => {
    mockToken.mockResolvedValue('tok')
    // The response must carry a json() body: without one the client's internal
    // res.json() throws and the write silently takes the error path.
    global.fetch = jest.fn(() =>
      Promise.resolve({ok: true, status: 200, json: () => Promise.resolve({})}),
    ) as unknown as typeof fetch
    const res = await updatePersona({id: 'p1', name: 'Ada', fiction})
    expect(res.ok).toBe(true)
    const call = (global.fetch as unknown as jest.Mock).mock.calls[0]
    expect(String(call[0])).toContain('/app/personas/update')
    const body = JSON.parse(String((call[1] as {body: string}).body)) as {
      id: string
      fiction?: PersonaFiction
    }
    expect(body.id).toBe('p1')
    expect(body.fiction).toEqual(fiction)
  })

  it('omits fiction entirely when not provided (unchanged prior shape)', async () => {
    mockToken.mockResolvedValue('tok')
    global.fetch = jest.fn(() =>
      Promise.resolve({ok: true, status: 200, json: () => Promise.resolve({})}),
    ) as unknown as typeof fetch
    await updatePersona({id: 'p1', name: 'Ada'})
    const call = (global.fetch as unknown as jest.Mock).mock.calls[0]
    const body = JSON.parse(String((call[1] as {body: string}).body)) as Record<
      string,
      unknown
    >
    expect('fiction' in body).toBe(false)
  })

  it('signed out -> no fetch, never throws', async () => {
    mockToken.mockResolvedValue(null)
    global.fetch = jest.fn(() =>
      Promise.resolve({ok: true, status: 200}),
    ) as unknown as typeof fetch
    const res = await updatePersona({id: 'p1', fiction})
    expect(res.signedOut).toBe(true)
    expect((global.fetch as unknown as jest.Mock).mock.calls).toHaveLength(0)
  })
})
