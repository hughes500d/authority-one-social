import {logger} from '#/logger'
import {getSupabaseAccessToken} from './authToken'
import {CHAT_IMAGE_UPLOAD_ENDPOINT} from './config'

/**
 * Upload a picked image to the runtime, which hosts it in R2 and returns the public
 * URL. The URL is then sent with the chat turn (see `streamChat`) so the runtime's
 * existing vision pipeline processes it — no new vision code on either side.
 *
 * Owner-scoped (Supabase bearer). RESILIENT: never throws. Returns the hosted URL on
 * success, or `null` when signed out / unreachable / the endpoint isn't deployed yet,
 * so the composer can degrade gracefully (send text-only) instead of crashing.
 */
export interface ChatImageToUpload {
  /** Local file URI from the image picker (file:// or blob:). */
  uri: string
  /** MIME type, e.g. "image/jpeg". */
  mime: string
  /** Optional file name; a sensible default is derived from the MIME otherwise. */
  name?: string
}

function fileNameFor(image: ChatImageToUpload): string {
  if (image.name) return image.name
  const ext = image.mime.split('/')[1] || 'jpg'
  return `upload.${ext}`
}

export async function uploadChatImage(
  image: ChatImageToUpload,
): Promise<string | null> {
  try {
    const token = await getSupabaseAccessToken()
    if (!token) return null

    const form = new FormData()
    // React Native multipart file part: {uri, name, type}. Cast — RN's FormData
    // accepts this shape though the DOM lib types only allow Blob/string.
    form.append('file', {
      uri: image.uri,
      name: fileNameFor(image),
      type: image.mime,
    } as unknown as Blob)

    const res = await fetch(CHAT_IMAGE_UPLOAD_ENDPOINT, {
      method: 'POST',
      // No explicit Content-Type: fetch sets multipart/form-data with the boundary.
      headers: {Authorization: `Bearer ${token}`},
      body: form,
    })
    if (!res.ok) return null

    const data = (await res.json()) as {url?: unknown}
    return typeof data?.url === 'string' && data.url.length > 0 ? data.url : null
  } catch (e) {
    logger.warn('chat image upload failed', {safeMessage: String(e)})
    return null
  }
}
