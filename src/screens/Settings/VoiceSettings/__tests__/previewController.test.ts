import {describe, expect, it, jest} from '@jest/globals'

import {type ClipHandlers, type ClipPlayback} from '../clipPlayerTypes'
import {createPreviewController, type PreviewState} from '../previewController'

/** A controllable fake clip: resolves when told, exposes its handlers. */
function fakeClip() {
  const stop = jest.fn()
  let handlers: ClipHandlers | null = null
  let resolvePlay: (p: ClipPlayback) => void = () => {}
  let rejectPlay: (e: unknown) => void = () => {}
  const promise = new Promise<ClipPlayback>((resolve, reject) => {
    resolvePlay = resolve
    rejectPlay = reject
  })
  return {
    stop,
    play: (h: ClipHandlers) => {
      handlers = h
      return promise
    },
    start: () => resolvePlay({stop}),
    fail: (e: unknown = new Error('nope')) => rejectPlay(e),
    finish: () => handlers?.onDone(),
    error: () => handlers?.onError(),
  }
}

function harness(opts?: {fallback?: (id: string) => Promise<string | null>}) {
  const states: PreviewState[] = []
  const errors: string[] = []
  const clips: ReturnType<typeof fakeClip>[] = []
  const nextClip = () => {
    const c = fakeClip()
    clips.push(c)
    return c
  }
  const controller = createPreviewController({
    playUrl: (_url, h) => nextClip().play(h),
    playBase64: (_b64, h) => nextClip().play(h),
    fetchFallbackClip: opts?.fallback,
    onChange: s => states.push(s),
    onError: id => errors.push(id),
  })
  return {controller, states, errors, clips}
}

const ARIA = {id: 'aria', previewUrl: 'https://cdn/aria.mp3'}
const ROGER = {id: 'roger', previewUrl: 'https://cdn/roger.mp3'}

describe('previewController', () => {
  it('walks loading → playing → idle on a normal preview', async () => {
    const h = harness()
    const p = h.controller.toggle(ARIA)
    expect(h.states).toEqual([{voiceId: 'aria', phase: 'loading'}])
    h.clips[0].start()
    await p
    expect(h.states.at(-1)).toEqual({voiceId: 'aria', phase: 'playing'})
    h.clips[0].finish()
    expect(h.states.at(-1)).toBe(null)
    expect(h.errors).toEqual([])
  })

  it('toggling the playing voice stops it without starting again', async () => {
    const h = harness()
    const p = h.controller.toggle(ARIA)
    h.clips[0].start()
    await p
    await h.controller.toggle(ARIA)
    expect(h.clips[0].stop).toHaveBeenCalled()
    expect(h.states.at(-1)).toBe(null)
    expect(h.clips).toHaveLength(1)
  })

  it('starting a second voice stops the first — only one plays at a time', async () => {
    const h = harness()
    const p1 = h.controller.toggle(ARIA)
    h.clips[0].start()
    await p1
    const p2 = h.controller.toggle(ROGER)
    expect(h.clips[0].stop).toHaveBeenCalled()
    h.clips[1].start()
    await p2
    expect(h.states.at(-1)).toEqual({voiceId: 'roger', phase: 'playing'})
    // The first clip's late onDone must not clear roger's state.
    h.clips[0].finish()
    expect(h.states.at(-1)).toEqual({voiceId: 'roger', phase: 'playing'})
  })

  it('a stale play completion is stopped, not surfaced', async () => {
    const h = harness()
    const p1 = h.controller.toggle(ARIA) // still loading…
    const p2 = h.controller.toggle(ROGER) // user moved on
    h.clips[0].start() // aria's clip finally starts — too late
    h.clips[1].start()
    await Promise.all([p1, p2])
    expect(h.clips[0].stop).toHaveBeenCalled()
    expect(h.states.at(-1)).toEqual({voiceId: 'roger', phase: 'playing'})
  })

  it('reports an honest error when the clip cannot start', async () => {
    const h = harness()
    const p = h.controller.toggle(ARIA)
    h.clips[0].fail()
    await p
    expect(h.states.at(-1)).toBe(null)
    expect(h.errors).toEqual(['aria'])
  })

  it('reports a mid-playback error and resets', async () => {
    const h = harness()
    const p = h.controller.toggle(ARIA)
    h.clips[0].start()
    await p
    h.clips[0].error()
    expect(h.states.at(-1)).toBe(null)
    expect(h.errors).toEqual(['aria'])
  })

  it('uses the POST /preview fallback when there is no previewUrl', async () => {
    const fallback = jest.fn(() => Promise.resolve<string | null>('QUJD'))
    const h = harness({fallback})
    const p = h.controller.toggle({id: 'nopreview'})
    await Promise.resolve() // let the fallback resolve
    h.clips[0]?.start()
    await p
    expect(fallback).toHaveBeenCalledWith('nopreview')
    expect(h.states.at(-1)).toEqual({voiceId: 'nopreview', phase: 'playing'})
  })

  it('errors honestly when no preview clip exists at all', async () => {
    const h = harness({fallback: () => Promise.resolve(null)})
    await h.controller.toggle({id: 'silent'})
    expect(h.states.at(-1)).toBe(null)
    expect(h.errors).toEqual(['silent'])
  })

  it('dispose() cuts audio and freezes state updates (unmount safety)', async () => {
    const h = harness()
    const p = h.controller.toggle(ARIA)
    h.clips[0].start()
    await p
    const before = h.states.length
    h.controller.dispose()
    expect(h.clips[0].stop).toHaveBeenCalled()
    h.clips[0].finish() // late event after unmount
    expect(h.states.length).toBe(before)
  })
})
