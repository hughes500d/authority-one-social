import {
  type Anchor,
  type ContextEvent,
  type ContextPlace,
  type ContextPrefs,
  type Coords,
  type NormalizedGeocode,
} from './types'

/**
 * Pure place-derivation + dwell logic for the Context Engine. No I/O, no React —
 * the provider feeds it sampled coords + a reverse-geocode and it returns a coarse
 * CONCLUSION. Trivially unit-testable.
 */

/** Great-circle distance between two coordinates, in meters. */
export function haversineMeters(a: Coords, b: Coords): number {
  const R = 6_371_000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** Radius (m) within which a sample counts as "at" a user-set home/work anchor. */
export const ANCHOR_RADIUS_M = 160

/** Match a sample against the user's home/work anchors. */
export function matchAnchor(
  coords: Coords,
  prefs: ContextPrefs,
  radiusM = ANCHOR_RADIUS_M,
): 'home' | 'work' | undefined {
  const near = (anchor?: Anchor) =>
    !!anchor && haversineMeters(coords, {lat: anchor.lat, lng: anchor.lng}) <= radiusM
  if (near(prefs.home)) return 'home'
  if (near(prefs.work)) return 'work'
  return undefined
}

/**
 * A coarse venue/place conclusion + confidence. Order of preference:
 *   1. user-set home/work anchor (high confidence)
 *   2. a named place from reverse-geocode that isn't just the street -> 'venue'
 *   3. a city -> 'out'
 *   4. nothing -> 'unknown'
 */
export function derivePlace(input: {
  coords: Coords
  geocode?: NormalizedGeocode
  prefs: ContextPrefs
}): {place: ContextPlace; placeRef?: string; confidence: number} {
  const anchor = matchAnchor(input.coords, input.prefs)
  if (anchor) {
    const ref =
      anchor === 'home' ? input.prefs.home?.label : input.prefs.work?.label
    return {place: anchor, placeRef: ref, confidence: 0.9}
  }
  const g = input.geocode
  const name = g?.name?.trim()
  const street = g?.street?.trim()
  // A POI name distinct from the street suggests a venue (bar/arena/cafe/etc.).
  if (name && name !== street) {
    return {place: 'venue', placeRef: name, confidence: 0.6}
  }
  const city = g?.city?.trim() || g?.district?.trim() || g?.region?.trim()
  if (city) {
    return {place: 'out', placeRef: city, confidence: 0.4}
  }
  return {place: 'unknown', confidence: 0.2}
}

/** Dwell duration in whole minutes (>= 0). */
export function dwellMinutes(startAt: number, endAt: number): number {
  return Math.max(0, Math.round((endAt - startAt) / 60_000))
}

/** Whether the new conclusion is a different place than the previous one. */
export function placeChanged(
  prev: {place: ContextPlace; placeRef?: string} | null,
  next: {place: ContextPlace; placeRef?: string},
): boolean {
  if (!prev) return true
  return prev.place !== next.place || prev.placeRef !== next.placeRef
}

/** Build a normalized, conclusion-only ContextEvent. */
export function buildContextEvent(input: {
  id: string
  at: number
  place: ContextPlace
  placeRef?: string
  confidence: number
  durationMin: number
}): ContextEvent {
  return {
    id: input.id,
    at: input.at,
    place: input.place,
    placeRef: input.placeRef,
    attention: {durationMin: input.durationMin},
    confidence: input.confidence,
    sources: ['location'],
  }
}

/**
 * THE OPT-IN GATE. Nothing is captured unless the engine is explicitly enabled AND
 * when-in-use location permission is granted. Used by the provider before any
 * sampling; tested to guarantee "nothing captured when off".
 */
export function shouldCapture(state: {
  enabled: boolean
  permissionGranted: boolean
}): boolean {
  return state.enabled === true && state.permissionGranted === true
}
