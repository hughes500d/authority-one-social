import {afterEach, describe, expect, it, jest} from '@jest/globals'

import {getSupabaseAccessToken} from '../authToken'
import {updatePersona} from '../personasClient'
import {fetchVoiceLibrary, fetchVoicePreviewClip} from '../voiceLibraryClient'

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
  const fn = jest.fn(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      headers: {get: () => 'application/json'},
      json: () => Promise.resolve(body),
    }),
  )
  global.fetch = fn as unknown as typeof fetch
  return fn
}

describe('fetchVoiceLibrary', () => {
  it('returns the normalized library on the pinned contract', async () => {
    mockToken.mockResolvedValue('tok')
    mockOkJson({
      ok: true,
      voices: [{id: 'EL1', name: 'Aria', labels: {gender: 'female'}}],
    })
    const res = await fetchVoiceLibrary()
    expect(res.signedOut).toBe(false)
    expect(res.voices).toHaveLength(1)
    expect(res.voices?.[0].name).toBe('Aria')
  })

  it('reports signedOut with no bearer and no library on a legacy runtime', async () => {
    mockToken.mockResolvedValue(null)
    const signedOut = await fetchVoiceLibrary()
    expect(signedOut.signedOut).toBe(true)
    expect(signedOut.voices).toBeUndefined()

    mockToken.mockResolvedValue('tok')
    mockOkJson({
      builtins: [],
      custom: [],
      voices: [{voiceId: 'x', name: 'Bob'}],
    })
    const legacy = await fetchVoiceLibrary()
    expect(legacy.voices).toBeUndefined()
    expect(legacy.error).toBeUndefined()
  })
})

describe('assigning a voice (updatePersona merge path)', () => {
  it('POSTs only {id, voiceId} (+agent) to /app/personas/update', async () => {
    mockToken.mockResolvedValue('tok')
    const fn = mockOkJson({ok: true})
    const res = await updatePersona(
      {id: 'p1', voiceId: 'EL111111111111111111'},
      'hecate.pds.authority-one.com',
    )
    expect(res.ok).toBe(true)
    const [url, init] = fn.mock.calls[0] as unknown as [
      string,
      {body: string; method: string},
    ]
    expect(url).toContain('/app/personas/update')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual({
      id: 'p1',
      voiceId: 'EL111111111111111111',
      agent: 'hecate.pds.authority-one.com',
    })
  })
})

describe('fetchVoicePreviewClip', () => {
  it('accepts a JSON base64 body', async () => {
    mockToken.mockResolvedValue('tok')
    mockOkJson({audio: 'QUJD'})
    expect(await fetchVoicePreviewClip('EL1', 'hello')).toBe('QUJD')
  })

  it('encodes raw audio bytes to base64', async () => {
    mockToken.mockResolvedValue('tok')
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        headers: {get: () => 'audio/mpeg'},
        arrayBuffer: () => Promise.resolve(new Uint8Array([65, 66, 67]).buffer),
      }),
    ) as unknown as typeof fetch
    expect(await fetchVoicePreviewClip('EL1')).toBe('QUJD')
  })

  it('returns null (never throws) on any failure', async () => {
    mockToken.mockResolvedValue('tok')
    global.fetch = jest.fn(() =>
      Promise.resolve({ok: false, status: 503}),
    ) as unknown as typeof fetch
    expect(await fetchVoicePreviewClip('EL1')).toBe(null)

    global.fetch = jest.fn(() => Promise.reject(new Error('network down')))
    expect(await fetchVoicePreviewClip('EL1')).toBe(null)
  })
})
