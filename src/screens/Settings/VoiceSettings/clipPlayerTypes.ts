/** A playing preview clip; stop() cuts it silently (no onDone/onError). */
export interface ClipPlayback {
  stop(): void
}

/** Lifecycle callbacks for one clip. At most one fires, at most once. */
export interface ClipHandlers {
  onDone(): void
  onError(): void
}
