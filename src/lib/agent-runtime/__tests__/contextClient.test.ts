import {afterEach, describe, expect, it, jest} from '@jest/globals'

import {type ContextEvent} from '#/lib/contextEngine/types'
import {getSupabaseAccessToken} from '../authToken'
import {
  deleteContextEvent,
  fetchRecentContext,
  normalizeContextEvents,
  postContextEvents,
} from '../contextClient'

jest.mock('../authToken', () => ({getSupabaseAccessToken: jest.fn()}))

const mockToken = jest.mocked(getSupabaseAccessToken)
const realFetch = global.fetch
afterEach(() => {
  global.fetch = realFetch
  mockToken.mockReset()
})

const event: ContextEvent = {
  id: 'e1',
  at: 5,
  place: 'venue',
  placeRef: 'Bar',
  attention: {durationMin: 12},
  confidence: 0.6,
  sources: ['location'],
}

describe('normalizeContextEvents', () => {
  it('keeps well-formed conclusion events and drops junk', () => {
    expect(
      normalizeContextEvents({
        events: [
          {id: 'a', at: 1, place: 'home', attention: {durationMin: 3}, confidence: 0.9},
          {place: 'venue'}, // no id -> dropped
          null,
        ],
      }),
    ).toEqual([
      {
        id: 'a',
        at: 1,
        place: 'home',
        placeRef: undefined,
        attention: {durationMin: 3},
        confidence: 0.9,
        sources: ['location'],
      },
    ])
    expect(normalizeContextEvents(null)).toEqual([])
  })
})

describe('postContextEvents', () => {
  it('no-ops (no fetch) with no token or empty events; never throws', async () => {
    mockToken.mockResolvedValue(null)
    global.fetch = jest.fn(() =>
      Promise.resolve({ok: true, status: 200}),
    ) as unknown as typeof fetch
    await expect(postContextEvents([event])).resolves.toBeUndefined()
    expect((global.fetch as unknown as jest.Mock).mock.calls).toHaveLength(0)

    mockToken.mockResolvedValue('tok')
    await expect(postContextEvents([])).resolves.toBeUndefined()
    expect((global.fetch as unknown as jest.Mock).mock.calls).toHaveLength(0)
  })

  it('POSTs { events } to /app/context/events when signed in', async () => {
    mockToken.mockResolvedValue('tok')
    global.fetch = jest.fn(() =>
      Promise.resolve({ok: true, status: 200}),
    ) as unknown as typeof fetch
    await postContextEvents([event])
    const call = (global.fetch as unknown as jest.Mock).mock.calls[0]
    expect(String(call[0])).toContain('/app/context/events')
    expect(JSON.parse(String((call[1] as {body: string}).body))).toEqual({
      events: [event],
    })
  })

  it('never throws on network error', async () => {
    mockToken.mockResolvedValue('tok')
    global.fetch = jest.fn(() =>
      Promise.reject(new Error('offline')),
    )
    await expect(postContextEvents([event])).resolves.toBeUndefined()
  })
})

describe('fetchRecentContext', () => {
  it('returns [] when signed out', async () => {
    mockToken.mockResolvedValue(null)
    expect(await fetchRecentContext()).toEqual([])
  })

  it('returns normalized events on success', async () => {
    mockToken.mockResolvedValue('tok')
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            events: [
              {id: 'a', at: 1, place: 'out', placeRef: 'Raleigh', confidence: 0.4},
            ],
          }),
      }),
    ) as unknown as typeof fetch
    const events = await fetchRecentContext()
    expect(events).toHaveLength(1)
    expect(events[0].placeRef).toBe('Raleigh')
  })

  it('returns [] on a non-ok response (degrades gracefully)', async () => {
    mockToken.mockResolvedValue('tok')
    global.fetch = jest.fn(() =>
      Promise.resolve({ok: false, status: 404}),
    ) as unknown as typeof fetch
    expect(await fetchRecentContext()).toEqual([])
  })
})

describe('deleteContextEvent', () => {
  it('POSTs { id } to /app/context/delete; never throws', async () => {
    mockToken.mockResolvedValue('tok')
    global.fetch = jest.fn(() =>
      Promise.resolve({ok: true, status: 200}),
    ) as unknown as typeof fetch
    await deleteContextEvent('e1')
    const call = (global.fetch as unknown as jest.Mock).mock.calls[0]
    expect(String(call[0])).toContain('/app/context/delete')
    expect(JSON.parse(String((call[1] as {body: string}).body))).toEqual({id: 'e1'})
  })
})
