/**
 * Composer image-attachment state + pure send-gating logic, factored out of the
 * AgentChat screen so it's unit-testable without rendering React Native.
 */

export interface ChatAttachment {
  /** Local preview URI from the picker, shown immediately. */
  previewUri: string
  /** MIME of the picked image. */
  mime: string
  /** True while the upload to R2 is in flight. */
  uploading: boolean
  /** Hosted R2 URL once the upload succeeds. */
  url?: string
  /** True if the upload failed; the preview stays so the user can remove/retry. */
  failed?: boolean
}

/**
 * Can the composer send right now?
 * - Never while a turn is streaming.
 * - An attachment that is still uploading or failed (no hosted URL) blocks send — the
 *   user must wait or remove it, so we never send a turn referencing an image that
 *   isn't hosted.
 * - Otherwise: send if there's text, OR a fully-uploaded image (image-only turn).
 */
export function canSend(
  text: string,
  attachment: ChatAttachment | null,
  isStreaming: boolean,
): boolean {
  if (isStreaming) return false
  if (attachment && (attachment.uploading || !attachment.url)) return false
  return text.trim().length > 0 || Boolean(attachment?.url)
}

/** The hosted image URLs to send with the turn (empty when none is ready). */
export function imagesForSend(attachment: ChatAttachment | null): string[] {
  return attachment?.url ? [attachment.url] : []
}
