import {afterEach, describe, expect, it, jest} from '@jest/globals'

import {getSupabaseAccessToken} from '../authToken'
import {updatePersona} from '../personasClient'
import {
  fetchVoiceLibrary,
  fetchVoicePreviewClip,
  setAgentVoice,
} from '../voiceLibraryClient'

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

describe('setAgentVoice (POST /app/agents/voice — the primary assign path)', () => {
  it('POSTs {voiceId, agent} and resolves ok', async () => {
    mockToken.mockResolvedValue('tok')
    const fn = mockOkJson({ok: true, agent: 'hecate', voice: {voiceId: 'EL1'}})
    const res = await setAgentVoice({
      agent: 'hecate.pds.authority-one.com',
      voiceId: 'EL111111111111111111',
    })
    expect(res.ok).toBe(true)
    const [url, init] = fn.mock.calls[0] as unknown as [
      string,
      {body: string; method: string},
    ]
    expect(url).toContain('/app/agents/voice')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual({
      voiceId: 'EL111111111111111111',
      agent: 'hecate.pds.authority-one.com',
    })
  })

  it('flags a codeless 404 as unsupported (legacy runtime → persona fallback)', async () => {
    mockToken.mockResolvedValue('tok')
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: false,
        status: 404,
        json: () => Promise.resolve({error: 'not found'}),
      }),
    ) as unknown as typeof fetch
    const res = await setAgentVoice({voiceId: 'EL111111111111111111'})
    expect(res.ok).toBe(false)
    expect(res.unsupported).toBe(true)
  })

  it('surfaces the runtime code + message on a coded failure (422 voice-not-found)', async () => {
    mockToken.mockResolvedValue('tok')
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: false,
        status: 422,
        json: () =>
          Promise.resolve({
            error: 'ElevenLabs has no voice with that id on this account',
            code: 'voice-not-found',
          }),
      }),
    ) as unknown as typeof fetch
    const res = await setAgentVoice({voiceId: 'EL111111111111111111'})
    expect(res.ok).toBe(false)
    expect(res.unsupported).toBeUndefined()
    expect(res.code).toBe('voice-not-found')
    expect(res.error).toContain('no voice with that id')
  })
})

describe('assigning a voice (updatePersona merge path — legacy fallback)', () => {
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

  it('follows a JSON {previewUrl} answer and encodes the hosted sample', async () => {
    mockToken.mockResolvedValue('tok')
    const fn = jest.fn((url: unknown) =>
      String(url).includes('cdn.example')
        ? Promise.resolve({
            ok: true,
            status: 200,
            arrayBuffer: () =>
              Promise.resolve(new Uint8Array([65, 66, 67]).buffer),
          })
        : Promise.resolve({
            ok: true,
            status: 200,
            headers: {get: () => 'application/json'},
            json: () =>
              Promise.resolve({previewUrl: 'https://cdn.example/s.mp3'}),
          }),
    )
    global.fetch = fn as unknown as typeof fetch
    expect(await fetchVoicePreviewClip('EL1')).toBe('QUJD')
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
