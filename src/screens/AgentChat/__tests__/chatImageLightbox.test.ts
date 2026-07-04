/**
 * Chat images must be tappable and openable in the app lightbox, which is
 * where the Save/Download affordances live (native: header Save button ->
 * useSaveImageToMediaLibrary; web: image-options menu -> Download image).
 *
 * Two layers of guard, matching the sibling tests in this directory:
 *
 *  1. BEHAVIOURAL - `lightboxImagesForMedia` must produce ImageSource entries
 *     the lightbox accepts for arbitrary chat media (https R2 URLs or data
 *     URIs), with null dimensions (the lightbox fetches real dimensions
 *     itself) and null thumb rect/ref (skips the zoom-from-thumb animation).
 *
 *  2. SOURCE-LEVEL - pin that MessageBubble actually wraps each media
 *     thumbnail in a Pressable wired to openLightbox. A full component render
 *     is impractical here (the `#/alf` import chain can't be evaluated under
 *     jest-expo - see ApprovalCard.test.tsx), so we guard the wiring at
 *     source like the sibling tests do.
 */
// eslint-disable-next-line import-x/no-nodejs-modules
import {readFileSync} from 'fs'
// eslint-disable-next-line import-x/no-nodejs-modules
import {join} from 'path'

import {CHAT_IMAGE_ALT, lightboxImagesForMedia} from '../chatImageLightbox'

describe('lightboxImagesForMedia', () => {
  it('maps each media URL to a lightbox ImageSource', () => {
    const media = [
      'https://pub-abc123.r2.dev/ada/1720000000-a.png',
      'data:image/png;base64,iVBORw0KGgo=',
    ]
    const images = lightboxImagesForMedia(media)

    expect(images).toHaveLength(2)
    images.forEach((img, i) => {
      expect(img.uri).toBe(media[i])
      expect(img.thumbUri).toBe(media[i])
      expect(img.type).toBe('image')
      expect(img.alt).toBe(CHAT_IMAGE_ALT)
      // The lightbox fetches real dimensions when these are null, and a null
      // thumbRect/thumbRef opens without the zoom-from-thumbnail animation.
      expect(img.dimensions).toBeNull()
      expect(img.thumbDimensions).toBeNull()
      expect(img.thumbRect).toBeNull()
      expect(img.thumbRef).toBeNull()
    })
  })

  it('returns an empty list for a message with no media', () => {
    expect(lightboxImagesForMedia([])).toEqual([])
  })
})

describe('MessageBubble media wiring (source-level guard)', () => {
  const SRC = readFileSync(join(__dirname, '..', 'MessageBubble.tsx'), 'utf8')

  it('wraps media thumbnails in a Pressable that opens the lightbox', () => {
    expect(SRC).toMatch(/useLightboxControls\(\)/)
    expect(SRC).toMatch(
      /openLightbox\(\s*\{\s*images: lightboxImagesForMedia\(media\)/,
    )
    // The Pressable must come from react-native and wrap the thumbnail.
    expect(SRC).toMatch(/import \{Pressable, View\} from 'react-native'/)
    expect(SRC).toMatch(/<Pressable[\s\S]*?onPress=\{\(\) =>\s*openLightbox\(/)
  })

  it('keeps the media alt/labels as plain literals (no compiled-catalog dependency)', () => {
    expect(SRC).toMatch(/CHAT_IMAGE_ALT/)
    expect(SRC).not.toMatch(/@lingui/)
  })
})
