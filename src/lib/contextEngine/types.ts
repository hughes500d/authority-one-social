/**
 * Context Engine — PHASE 1 (LOCATION ONLY). Privacy-first, opt-in.
 *
 * NO microphone / audio / transcription / vision. We sample location only while the
 * app is open (when-in-use), reduce each sample to a COARSE conclusion on-device,
 * and store ONLY the conclusion — never raw coordinates. Raw coords exist only
 * transiently in memory while deriving a place, then are discarded.
 */

/** Coarse place conclusion. Never a precise address. */
export type ContextPlace = 'home' | 'work' | 'venue' | 'out' | 'unknown'

/**
 * A derived context event — a CONCLUSION, not raw data. `placeRef` is a coarse
 * human label (venue name / city), never coordinates.
 */
export interface ContextEvent {
  id: string
  /** Unix ms when the conclusion was recorded. */
  at: number
  place: ContextPlace
  /** Coarse label (e.g. venue name or city). No coordinates. */
  placeRef?: string
  /** Phase-1 attention is place-dwell only (no audio-derived activity). */
  attention: {durationMin: number}
  /** 0..1 confidence in the place conclusion. */
  confidence: number
  /** Always exactly ['location'] in Phase 1. */
  sources: ['location']
}

/**
 * A user-designated reference point (e.g. "set current location as Home"). Stored
 * LOCALLY ONLY for on-device matching — never synced. This is the only coordinate
 * the engine persists, and only because the user explicitly anchored it.
 */
export interface Anchor {
  lat: number
  lng: number
  label?: string
}

/** Local opt-in prefs + anchors. `enabled` defaults OFF. */
export interface ContextPrefs {
  enabled: boolean
  home?: Anchor
  work?: Anchor
}

export interface Coords {
  lat: number
  lng: number
}

/** Coarse reverse-geocode fields (from expo-location), used to derive a place. */
export interface NormalizedGeocode {
  name?: string
  street?: string
  city?: string
  region?: string
  district?: string
}
