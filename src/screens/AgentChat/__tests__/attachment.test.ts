import {describe, expect, it} from '@jest/globals'

import {
  canSend,
  type ChatAttachment,
  imagesForSend,
} from '../attachment'

const uploaded: ChatAttachment = {
  previewUri: 'file:///a.jpg',
  mime: 'image/jpeg',
  uploading: false,
  url: 'https://r2/a.jpg',
}
const uploading: ChatAttachment = {
  previewUri: 'file:///a.jpg',
  mime: 'image/jpeg',
  uploading: true,
}
const failed: ChatAttachment = {
  previewUri: 'file:///a.jpg',
  mime: 'image/jpeg',
  uploading: false,
  failed: true,
}

describe('canSend', () => {
  it('text-only: needs non-empty text', () => {
    expect(canSend('hi', null, false)).toBe(true)
    expect(canSend('   ', null, false)).toBe(false)
    expect(canSend('', null, false)).toBe(false)
  })

  it('never sends while streaming', () => {
    expect(canSend('hi', null, true)).toBe(false)
    expect(canSend('hi', uploaded, true)).toBe(false)
  })

  it('allows an image-only turn once the image is uploaded', () => {
    expect(canSend('', uploaded, false)).toBe(true)
    expect(canSend('caption', uploaded, false)).toBe(true)
  })

  it('blocks send while the image is uploading or failed', () => {
    expect(canSend('hi', uploading, false)).toBe(false)
    expect(canSend('hi', failed, false)).toBe(false)
    expect(canSend('', uploading, false)).toBe(false)
  })
})

describe('imagesForSend', () => {
  it('returns the hosted URL only when one is ready', () => {
    expect(imagesForSend(uploaded)).toEqual(['https://r2/a.jpg'])
    expect(imagesForSend(uploading)).toEqual([])
    expect(imagesForSend(failed)).toEqual([])
    expect(imagesForSend(null)).toEqual([])
  })
})
