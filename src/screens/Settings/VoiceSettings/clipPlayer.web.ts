import {type ClipHandlers, type ClipPlayback} from './clipPlayerTypes'

/**
 * Web clip player for voice previews: an HTMLAudioElement per clip. The play()
 * promise resolves once playback actually starts (so the caller can flip
 * loading → playing), and rejects on an autoplay-policy block — callers must
 * invoke from a user-gesture-initiated async chain (the row's press handler),
 * same as playAgentClipBase64.
 */

function playAudio(
  audio: HTMLAudioElement,
  h: ClipHandlers,
): Promise<ClipPlayback> {
  let finished = false
  const finish = (cb: () => void) => {
    if (finished) return
    finished = true
    cb()
  }
  audio.onended = () => finish(h.onDone)
  audio.onerror = () => finish(h.onError)
  return audio.play().then(() => ({
    stop() {
      try {
        audio.pause()
        audio.currentTime = 0
      } catch {}
      // A stopped clip is done deliberately — no callbacks.
      finished = true
    },
  }))
}

/** Play a hosted MP3 sample by URL. Rejects when it can't start. */
export function playClipUrl(
  url: string,
  h: ClipHandlers,
): Promise<ClipPlayback> {
  return playAudio(new Audio(url), h)
}

/** Play a base64 MP3 clip (the POST /preview fallback path). */
export function playClipBase64(
  base64: string,
  h: ClipHandlers,
): Promise<ClipPlayback> {
  return playAudio(new Audio(`data:audio/mpeg;base64,${base64}`), h)
}
