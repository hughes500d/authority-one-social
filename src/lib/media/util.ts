export function extractDataUriMime(uri: string): string {
  return uri.substring(uri.indexOf(':') + 1, uri.indexOf(';'))
}

export function getResizedDimensions(
  originalDims: {
    width: number
    height: number
  },
  maxDimension: number,
) {
  if (
    originalDims.width <= maxDimension &&
    originalDims.height <= maxDimension
  ) {
    return originalDims
  }

  const ratio = Math.min(
    maxDimension / originalDims.width,
    maxDimension / originalDims.height,
  )

  return {
    width: Math.round(originalDims.width * ratio),
    height: Math.round(originalDims.height * ratio),
  }
}

// Fairly accurate estimate that is more performant
// than decoding and checking length of URI
export function getDataUriSize(uri: string): number {
  return Math.round((uri.length * 3) / 4)
}

export function isUriImage(uri: string): boolean {
  return /\.(jpg|jpeg|png|webp).*$/.test(uri)
}

export function blobToDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
      } else {
        reject(new Error('Failed to read blob'))
      }
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

export type ImgproxyPreset =
  | 'default'
  | 'avatar_thumbnail'
  | 'avatar'
  | 'banner'
  | 'feed_fullsize'
  | 'feed_thumbnail'
  | 'download'

// Using capturing groups here instead of lookbehinds in order to support older versions of Safari.
// https://bugs.webkit.org/show_bug.cgi?id=174931
const IMGPROXY_PRESET_RE =
  /(\/img\/)(default|avatar_thumbnail|avatar|banner|feed_fullsize|feed_thumbnail|download)(\/)/

/**
 * Replaces any imgproxy preset in a CDN URI with the given preset.
 */
export function convertCdnPreset(uri: string, preset: ImgproxyPreset): string {
  return uri.replace(IMGPROXY_PRESET_RE, `$1${preset}$3`)
}

const MIME_TO_EXTENSION: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
  'image/svg+xml': 'svg',
}

/**
 * Builds a download filename for an image that is not served with a
 * Content-Disposition header (e.g. agent-chat media on R2, data URIs). The
 * extension comes from the actual MIME type of the fetched bytes, not the URL,
 * since object-store URLs may have no extension at all.
 */
export function imageDownloadFilename(uri: string, mimeType?: string): string {
  const normalizedMime = mimeType?.split(';')[0].trim().toLowerCase() ?? ''
  const extension = MIME_TO_EXTENSION[normalizedMime] ?? 'jpg'

  let base = 'image'
  if (!uri.startsWith('data:')) {
    try {
      const lastSegment = decodeURIComponent(
        new URL(uri).pathname.split('/').filter(Boolean).at(-1) ?? '',
      )
      const stem = lastSegment
        .replace(/\.[a-z0-9]+$/i, '')
        .replace(/[^\w-]+/g, '_')
        .replace(/^_+|_+$/g, '')
      if (stem) {
        base = stem
      }
    } catch {
      // Unparseable URI: fall through to the generic base name.
    }
  }

  return `${base}.${extension}`
}
