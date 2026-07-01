import {afterEach, describe, expect, it, jest} from '@jest/globals'

import {fetchOwnerAgents, normalizeOwnerAgents} from '../agentsClient'
import {getSupabaseAccessToken} from '../authToken'

jest.mock('../authToken', () => ({getSupabaseAccessToken: jest.fn()}))

const mockToken = jest.mocked(getSupabaseAccessToken)
const realFetch = global.fetch
afterEach(() => {
  global.fetch = realFetch
  mockToken.mockReset()
})

function okJson(body: unknown) {
  return jest.fn(() =>
    Promise.resolve({ok: true, status: 200, json: () => Promise.resolve(body)}),
  ) as unknown as typeof fetch
}

describe('normalizeOwnerAgents (pure)', () => {
  it('shapes rows, tolerates id/name aliases, and dedupes by handle', () => {
    const out = normalizeOwnerAgents({
      agents: [
        {handle: 'ada.pds.authority-one.com', displayName: 'Ada', avatar: null},
        {id: 'brian.pds.authority-one.com', name: 'Brian'}, // id + name aliases
        {handle: 'ADA.PDS.AUTHORITY-ONE.COM'}, // dupe (case-insensitive) → dropped
        {foo: 1}, // no handle → dropped
      ],
    })
    expect(out).toEqual([
      {
        handle: 'ada.pds.authority-one.com',
        displayName: 'Ada',
        avatar: undefined,
      },
      {
        handle: 'brian.pds.authority-one.com',
        displayName: 'Brian',
        avatar: undefined,
      },
    ])
  })

  it('returns [] when agents is missing or not an array', () => {
    expect(normalizeOwnerAgents({})).toEqual([])
    expect(normalizeOwnerAgents({agents: 'nope'})).toEqual([])
    expect(normalizeOwnerAgents(null)).toEqual([])
  })
})

describe('fetchOwnerAgents', () => {
  it('signed out -> no fetch, signedOut true', async () => {
    mockToken.mockResolvedValue(null)
    global.fetch = okJson({agents: []})
    const res = await fetchOwnerAgents()
    expect(res.signedOut).toBe(true)
    expect((global.fetch as unknown as jest.Mock).mock.calls).toHaveLength(0)
  })

  it('returns normalized agents on success, hitting /app/agents', async () => {
    mockToken.mockResolvedValue('tok')
    global.fetch = okJson({
      agents: [{handle: 'ada.pds.authority-one.com', displayName: 'ada'}],
    })
    const res = await fetchOwnerAgents()
    const call = (global.fetch as unknown as jest.Mock).mock.calls[0]
    expect(String(call[0])).toContain('/app/agents')
    expect(res.agents).toEqual([
      {
        handle: 'ada.pds.authority-one.com',
        displayName: 'ada',
        avatar: undefined,
      },
    ])
  })

  it('401/403 -> signedOut, empty list', async () => {
    mockToken.mockResolvedValue('tok')
    global.fetch = jest.fn(() =>
      Promise.resolve({ok: false, status: 403}),
    ) as unknown as typeof fetch
    const res = await fetchOwnerAgents()
    expect(res.signedOut).toBe(true)
    expect(res.agents).toEqual([])
  })

  it('non-ok -> error, empty list (degrades)', async () => {
    mockToken.mockResolvedValue('tok')
    global.fetch = jest.fn(() =>
      Promise.resolve({ok: false, status: 500}),
    ) as unknown as typeof fetch
    const res = await fetchOwnerAgents()
    expect(res.agents).toEqual([])
    expect(res.error).toBeDefined()
  })
})
