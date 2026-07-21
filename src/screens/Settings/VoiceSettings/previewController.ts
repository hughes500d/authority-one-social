import {type ClipHandlers, type ClipPlayback} from './clipPlayerTypes'

/**
 * The preview state machine, extracted from React for unit testing. Invariants:
 *   - at most ONE voice previews at a time (starting one stops the last)
 *   - toggling the voice that's already loading/playing stops it
 *   - a stale async completion (user already moved on) can never clobber the
 *     newer preview's state — every transition is generation-guarded
 *   - stop()/dispose() are safe to call any time (navigation away, unmount)
 */

export type PreviewState = {
  voiceId: string
  phase: 'loading' | 'playing'
} | null

export interface PreviewSource {
  id: string
  previewUrl?: string
}

export interface PreviewControllerDeps {
  playUrl(url: string, h: ClipHandlers): Promise<ClipPlayback>
  playBase64(base64: string, h: ClipHandlers): Promise<ClipPlayback>
  /** POST /preview fallback for voices with no hosted sample; null = no clip. */
  fetchFallbackClip?(voiceId: string): Promise<string | null>
  onChange(state: PreviewState): void
  /** Honest failure surface — "couldn't play" is never silent. */
  onError(voiceId: string): void
}

export interface PreviewController {
  toggle(voice: PreviewSource): Promise<void>
  stop(): void
  dispose(): void
}

export function createPreviewController(
  deps: PreviewControllerDeps,
): PreviewController {
  let generation = 0
  let playback: ClipPlayback | null = null
  let state: PreviewState = null
  let disposed = false

  const setState = (next: PreviewState) => {
    state = next
    if (!disposed) deps.onChange(next)
  }

  const stop = () => {
    generation++
    playback?.stop()
    playback = null
    // Only emit on an actual change — stopping from idle is a no-op to React.
    if (state !== null) setState(null)
  }

  const toggle = async (voice: PreviewSource) => {
    if (disposed) return
    // Tapping the voice that's already loading/playing stops it — that's the
    // whole gesture; nothing new starts.
    if (state?.voiceId === voice.id) {
      stop()
      return
    }
    stop()
    const myGen = generation
    const stale = () => disposed || myGen !== generation
    setState({voiceId: voice.id, phase: 'loading'})
    const handlers: ClipHandlers = {
      onDone: () => {
        if (!stale()) {
          playback = null
          setState(null)
        }
      },
      onError: () => {
        if (!stale()) {
          playback = null
          setState(null)
          deps.onError(voice.id)
        }
      },
    }
    try {
      let clip: ClipPlayback
      if (voice.previewUrl) {
        clip = await deps.playUrl(voice.previewUrl, handlers)
      } else {
        const base64 = (await deps.fetchFallbackClip?.(voice.id)) ?? null
        if (stale()) return
        if (!base64) throw new Error('no preview clip')
        clip = await deps.playBase64(base64, handlers)
      }
      if (stale()) {
        clip.stop()
        return
      }
      playback = clip
      setState({voiceId: voice.id, phase: 'playing'})
    } catch {
      if (!stale()) {
        setState(null)
        deps.onError(voice.id)
      }
    }
  }

  return {
    toggle,
    stop,
    dispose() {
      // Cut audio and freeze state updates — used on unmount/navigation blur.
      generation++
      playback?.stop()
      playback = null
      disposed = true
    },
  }
}
