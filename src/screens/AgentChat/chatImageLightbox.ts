import {type ImageSource} from '#/components/Lightbox/types'

// Plain literal (not Lingui) like the rest of the agent-chat screen, so it
// never depends on the compiled catalog.
export const CHAT_IMAGE_ALT = 'Image from your agent'

/**
 * Maps a message's media URLs onto the lightbox's ImageSource shape. The
 * lightbox fetches real dimensions itself when they're unknown, and a null
 * thumbRect/thumbRef simply skips the zoom-from-thumbnail animation.
 */
export function lightboxImagesForMedia(media: string[]): ImageSource[] {
  return media.map(uri => ({
    uri,
    thumbUri: uri,
    thumbRect: null,
    thumbRef: null,
    dimensions: null,
    thumbDimensions: null,
    type: 'image',
    alt: CHAT_IMAGE_ALT,
  }))
}
