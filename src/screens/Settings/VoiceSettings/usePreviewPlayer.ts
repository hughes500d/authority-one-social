import {useEffect, useRef, useState} from 'react'
import {useNavigation} from '@react-navigation/native'

import {fetchVoicePreviewClip} from '#/lib/agent-runtime'
import {playClipBase64, playClipUrl} from './clipPlayer'
import {
  createPreviewController,
  type PreviewController,
  type PreviewSource,
  type PreviewState,
} from './previewController'

/** Sample line for voices with no hosted preview (POST /app/voices/preview). */
const PREVIEW_TEXT = 'Hi! This is how I sound. Pick me and let’s talk.'

/**
 * React binding for the preview state machine: one playing voice at a time,
 * loading/playing state per row, stopped cleanly on unmount AND on navigation
 * blur (pushing another screen over this one must not leave audio running).
 */
export function usePreviewPlayer({
  onError,
}: {
  onError: (voiceId: string) => void
}) {
  const [state, setState] = useState<PreviewState>(null)
  const onErrorRef = useRef(onError)
  useEffect(() => {
    onErrorRef.current = onError
  })

  // The controller lives for the mounted lifetime of the screen; it's created in
  // an effect (not render) so the react-hooks/refs rule stays satisfied, and its
  // dispose() on cleanup guarantees no audio survives unmount.
  const controllerRef = useRef<PreviewController | null>(null)
  const navigation = useNavigation()
  useEffect(() => {
    const controller = createPreviewController({
      playUrl: playClipUrl,
      playBase64: playClipBase64,
      fetchFallbackClip: voiceId =>
        fetchVoicePreviewClip(voiceId, PREVIEW_TEXT),
      onChange: setState,
      onError: voiceId => onErrorRef.current(voiceId),
    })
    controllerRef.current = controller
    const unsubscribe = navigation.addListener('blur', () => controller.stop())
    return () => {
      unsubscribe()
      controller.dispose()
      controllerRef.current = null
    }
  }, [navigation])

  return {
    state,
    toggle: (voice: PreviewSource) => void controllerRef.current?.toggle(voice),
    stop: () => controllerRef.current?.stop(),
  }
}
