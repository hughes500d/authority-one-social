/**
 * Web image download filename derivation.
 *
 * Agent-chat media lives on R2 at extension-less object keys, and the old
 * web save path built the filename from the raw URL (garbage for data URIs)
 * and hardcoded `.jpg`. `imageDownloadFilename` derives the extension from
 * the fetched blob's real MIME type and a safe base name from the URL path.
 */
import {imageDownloadFilename} from '../util'

describe('imageDownloadFilename', () => {
  it('uses the URL path stem and the blob MIME type for the extension', () => {
    expect(
      imageDownloadFilename(
        'https://pub-abc123.r2.dev/ada/1720000000-portrait.png',
        'image/png',
      ),
    ).toBe('1720000000-portrait.png')
  })

  it('replaces a misleading URL extension with the real MIME extension', () => {
    expect(
      imageDownloadFilename('https://cdn.example.com/photo.jpg', 'image/webp'),
    ).toBe('photo.webp')
  })

  it('handles extension-less object-store keys', () => {
    expect(
      imageDownloadFilename(
        'https://pub-abc123.r2.dev/media/abcdef',
        'image/jpeg',
      ),
    ).toBe('abcdef.jpg')
  })

  it('ignores MIME parameters and casing', () => {
    expect(
      imageDownloadFilename(
        'https://example.com/pic',
        'IMAGE/PNG; charset=binary',
      ),
    ).toBe('pic.png')
  })

  it('falls back to jpg for unknown or missing MIME types', () => {
    expect(imageDownloadFilename('https://example.com/pic', '')).toBe('pic.jpg')
    expect(imageDownloadFilename('https://example.com/pic', undefined)).toBe(
      'pic.jpg',
    )
    expect(
      imageDownloadFilename('https://example.com/pic', 'application/pdf'),
    ).toBe('pic.jpg')
  })

  it('uses a generic base name for data URIs instead of the URI contents', () => {
    const dataUri = `data:image/png;base64,${'A'.repeat(500)}`
    expect(imageDownloadFilename(dataUri, 'image/png')).toBe('image.png')
  })

  it('sanitizes unsafe characters and strips query strings', () => {
    expect(
      imageDownloadFilename(
        'https://example.com/a%20weird%2Fname!.png?x=1&y=2',
        'image/png',
      ),
    ).toBe('a_weird_name.png')
  })

  it('falls back to a generic name for unparseable URIs', () => {
    expect(imageDownloadFilename('not a uri', 'image/gif')).toBe('image.gif')
    expect(imageDownloadFilename('https://example.com/', 'image/gif')).toBe(
      'image.gif',
    )
  })
})
