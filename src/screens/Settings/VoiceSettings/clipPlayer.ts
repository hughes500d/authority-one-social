import {bytesToBase64} from '#/lib/agent-runtime'
import {TTS} from '../../../../modules/expo-authority-voice'
import {type ClipHandlers, type ClipPlayback} from './clipPlayerTypes'

/**
 * Native clip player for voice previews: reuses the on-device clip pipeline
 * (expo-authority-voice TTS.playClip — the same path the owner voice reply and
 * public "Talk to <Agent>" chat use), so preview audio behaves exactly like the
 * agent speaking. Lifecycle events are keyed by utteranceId; TTS.stop() is a
 * global cut (fine here — only one preview plays at a time by design).
 *
 * Android's TTS backend is a no-op today (no events fire), so a preview there
 * stays "playing" until tapped again — the iOS/web experience is the target;
 * this degrades without crashing.
 */

/** Play an already-fetched base64 MP3 clip through the native player. */
export function playClipBase64(
  base64: string,
  h: ClipHandlers,
): Promise<ClipPlayback> {
  const utteranceId = TTS.playClip(base64)
  let finished = false
  const subs: Array<() => void> = []
  const finish = (cb?: () => void) => {
    if (finished) return
    finished = true
    for (const remove of subs) remove()
    cb?.()
  }
  subs.push(
    TTS.addListener('onSpeechDone', e => {
      if (e.utteranceId === utteranceId) finish(h.onDone)
    }),
    TTS.addListener('onSpeechCanceled', e => {
      // A cancel we didn't initiate (barge-in elsewhere) still ends the preview.
      if (e.utteranceId === utteranceId) finish(h.onDone)
    }),
    TTS.addListener('onSpeechError', e => {
      if (e.utteranceId === utteranceId) finish(h.onError)
    }),
  )
  return Promise.resolve({
    stop() {
      // Deliberate stop: silence the callbacks first, then cut playback.
      finish()
      try {
        TTS.stop()
      } catch {}
    },
  })
}

/** Fetch a hosted MP3 sample and play it through the native clip player. */
export async function playClipUrl(
  url: string,
  h: ClipHandlers,
): Promise<ClipPlayback> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`preview fetch failed (${res.status})`)
  const buf = await res.arrayBuffer()
  if (!buf || buf.byteLength === 0) throw new Error('empty preview clip')
  return playClipBase64(bytesToBase64(new Uint8Array(buf)), h)
}
