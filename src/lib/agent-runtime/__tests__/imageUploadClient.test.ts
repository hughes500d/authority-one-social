import {afterEach, describe, expect, it, jest} from '@jest/globals'

import {getSupabaseAccessToken} from '../authToken'
import {uploadChatImage} from '../imageUploadClient'

jest.mock('../authToken', () => ({getSupabaseAccessToken: jest.fn()}))

const mockToken = jest.mocked(getSupabaseAccessToken)
const realFetch = global.fetch
afterEach(() => {
  global.fetch = realFetch
  mockToken.mockReset()
})

const image = {uri: 'file:///photo.jpg', mime: 'image/jpeg'}

describe('uploadChatImage', () => {
  it('returns null (no fetch) when signed out', async () => {
    mockToken.mockResolvedValue(null)
    global.fetch = jest.fn(() =>
      Promise.resolve({ok: true, json: () => Promise.resolve({url: 'x'})}),
    ) as unknown as typeof fetch
    expect(await uploadChatImage(image)).toBeNull()
    expect((global.fetch as unknown as jest.Mock).mock.calls).toHaveLength(0)
  })

  it('POSTs the image to the upload endpoint and returns the hosted URL', async () => {
    mockToken.mockResolvedValue('tok')
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({url: 'https://r2/p.jpg'}),
      }),
    ) as unknown as typeof fetch
    const url = await uploadChatImage(image)
    expect(url).toBe('https://r2/p.jpg')
    const call = (global.fetch as unknown as jest.Mock).mock.calls[0]
    expect(String(call[0])).toContain('/app/chat/image')
    const init = call[1] as {method: string; headers: Record<string, string>}
    expect(init.method).toBe('POST')
    expect(init.headers.Authorization).toBe('Bearer tok')
    // multipart boundary is set by fetch from the FormData body — we must NOT set
    // Content-Type ourselves.
    expect(init.headers['Content-Type']).toBeUndefined()
  })

  it('returns null on a non-ok response (degrades gracefully)', async () => {
    mockToken.mockResolvedValue('tok')
    global.fetch = jest.fn(() =>
      Promise.resolve({ok: false, status: 500}),
    ) as unknown as typeof fetch
    expect(await uploadChatImage(image)).toBeNull()
  })

  it('returns null when the response omits a url', async () => {
    mockToken.mockResolvedValue('tok')
    global.fetch = jest.fn(() =>
      Promise.resolve({ok: true, json: () => Promise.resolve({})}),
    ) as unknown as typeof fetch
    expect(await uploadChatImage(image)).toBeNull()
  })

  it('never throws on network error', async () => {
    mockToken.mockResolvedValue('tok')
    global.fetch = jest.fn(() => Promise.reject(new Error('offline')))
    expect(await uploadChatImage(image)).toBeNull()
  })
})
