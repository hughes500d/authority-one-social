import {logger} from '#/logger'
import {getSupabaseAccessToken} from './authToken'
import {
  AGENTS_VOICE_ENDPOINT,
  VOICES_ENDPOINT,
  VOICES_PREVIEW_ENDPOINT,
} from './config'
import {bytesToBase64} from './tts'
import {type VoicePickOption} from './voicesClient'

/**
 * Voice LIBRARY client (owner-scoped): the full browsable catalog behind the
 * dedicated voice picker screen — distinct from the small voice REGISTRY
 * ({builtins, custom}) that voicesClient reads off the same GET /app/voices.
 *
 * Library contract (pinned with the runtime):
 *   GET /app/voices → {ok, voices: [{id, name, description, labels: {accent,
 *   gender, age, use_case, ...}, previewUrl}]}
 * The normalizer is tolerant of the raw ElevenLabs field spellings (voice_id /
 * preview_url) in case the runtime passes rows through unmapped. The DEPLOYED
 * legacy flat list ({voiceId, name, default}) has no `id` field, so its rows
 * normalize away and the library correctly reads as "not available yet" on a
 * runtime that predates this contract.
 */

export interface LibraryVoice {
  /** ElevenLabs voice id — also the value written to the persona's voiceId. */
  id: string
  name: string
  description?: string
  /** ElevenLabs labels: accent, gender, age, use_case, descriptive, language… */
  labels: Record<string, string>
  /** Hosted MP3 sample; when absent the preview falls back to POST /preview. */
  previewUrl?: string
}

export interface VoiceLibraryResult {
  /** Present when the runtime serves the library contract; undefined when signed
   *  out, unreachable, or the runtime predates the library shape. */
  voices?: LibraryVoice[]
  signedOut: boolean
  error?: string
}

/** The label keys the picker exposes as filters, in display order. */
export const VOICE_FILTER_KEYS = [
  'accent',
  'gender',
  'age',
  'use_case',
] as const
export type VoiceFilterKey = (typeof VOICE_FILTER_KEYS)[number]
export type VoiceFilters = Partial<Record<VoiceFilterKey, string>>

// ── Pure helpers (unit-tested) ───────────────────────────────────────────────

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined
}

/** Normalize one library row; null when it isn't one (e.g. a legacy flat row). */
export function normalizeLibraryVoice(raw: unknown): LibraryVoice | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  // `id` per the pinned contract; `voice_id` tolerates raw ElevenLabs
  // passthrough. Deliberately NOT `voiceId` — that spelling is the legacy flat
  // list, which must not be mistaken for the library.
  const id = str(r.id) ?? str(r.voice_id)
  const name = str(r.name)
  if (!id || !name) return null
  const labels: Record<string, string> = {}
  if (r.labels && typeof r.labels === 'object') {
    for (const [k, v] of Object.entries(r.labels as Record<string, unknown>)) {
      const val = str(v)
      if (val) labels[k] = val
    }
  }
  return {
    id,
    name,
    description: str(r.description),
    labels,
    previewUrl: str(r.previewUrl) ?? str(r.preview_url),
  }
}

/** Normalize the GET /app/voices payload into the library list; null when the
 *  payload carries no library (legacy runtime / registry-only shape). PURE. */
export function normalizeVoiceLibrary(json: unknown): LibraryVoice[] | null {
  const j = (json ?? {}) as Record<string, unknown>
  if (!Array.isArray(j.voices)) return null
  const voices = j.voices
    .map(normalizeLibraryVoice)
    .filter((v): v is LibraryVoice => v !== null)
  // A voices array whose rows all normalize away is the legacy flat list —
  // report "no library" so the screen shows an honest unavailable notice
  // instead of an empty catalog.
  return voices.length > 0 ? voices : null
}

/** "middle_aged" → "Middle aged". PURE. */
export function formatLabelValue(raw: string): string {
  const s = raw.replace(/[_-]+/g, ' ').trim()
  return s ? s[0].toUpperCase() + s.slice(1) : s
}

/** Unique values present for one label key, sorted for stable filter menus. PURE. */
export function voiceLabelValues(
  voices: LibraryVoice[],
  key: VoiceFilterKey,
): string[] {
  const seen = new Set<string>()
  for (const v of voices) {
    const val = v.labels[key]?.trim().toLowerCase()
    if (val) seen.add(val)
  }
  return [...seen].sort()
}

/**
 * Search (name/description/label text, case-insensitive substring) + exact label
 * filters. All filtering is client-side over the fetched library. PURE.
 */
export function filterVoices(
  voices: LibraryVoice[],
  search: string,
  filters: VoiceFilters,
): LibraryVoice[] {
  const q = search.trim().toLowerCase()
  return voices.filter(v => {
    for (const key of VOICE_FILTER_KEYS) {
      const want = filters[key]
      if (want && v.labels[key]?.trim().toLowerCase() !== want) return false
    }
    if (!q) return true
    const hay = [v.name, v.description ?? '', ...Object.values(v.labels)]
      .join(' ')
      .toLowerCase()
    return hay.includes(q)
  })
}

/** "American · Female · Young · Conversational" from a voice's labels. PURE. */
export function voiceLabelSummary(v: LibraryVoice): string {
  return VOICE_FILTER_KEYS.map(k => v.labels[k])
    .filter((s): s is string => !!s)
    .map(formatLabelValue)
    .join(' · ')
}

/**
 * Resolve a persona's STORED voiceId (raw ElevenLabs id, `builtin:<key>`, or
 * `voice:<id>`) to the underlying ElevenLabs id, using the registry options to
 * unwrap the prefixed forms. Falls back to the stored value itself (raw id). PURE.
 */
export function underlyingVoiceId(
  registryOptions: VoicePickOption[],
  storedVoiceId: string | undefined,
): string | undefined {
  const stored = storedVoiceId?.trim()
  if (!stored) return undefined
  const opt = registryOptions.find(o => o.value === stored)
  return opt?.voiceId ?? stored
}

/** The library row an agent's stored voiceId points at, if it's in the library. PURE. */
export function findAssignedVoice(
  voices: LibraryVoice[],
  registryOptions: VoicePickOption[],
  storedVoiceId: string | undefined,
): LibraryVoice | undefined {
  const id = underlyingVoiceId(registryOptions, storedVoiceId)
  if (!id) return undefined
  return voices.find(v => v.id === id)
}

// ── Authed transport ─────────────────────────────────────────────────────────

function errorMessage(e: unknown): string | undefined {
  if (e instanceof Error) return e.message
  if (typeof e === 'string') return e
  return undefined
}

async function authHeaders(): Promise<Record<string, string> | null> {
  const token = await getSupabaseAccessToken()
  if (!token) return null
  return {Authorization: `Bearer ${token}`}
}

/** GET /app/voices → the full voice library. Never throws. */
export async function fetchVoiceLibrary(): Promise<VoiceLibraryResult> {
  try {
    const headers = await authHeaders()
    if (!headers) return {signedOut: true}
    const res = await fetch(VOICES_ENDPOINT, {method: 'GET', headers})
    if (res.status === 401 || res.status === 403) return {signedOut: true}
    if (!res.ok) return {signedOut: false, error: `Runtime error ${res.status}`}
    const voices = normalizeVoiceLibrary(await res.json())
    return {voices: voices ?? undefined, signedOut: false}
  } catch (e) {
    logger.warn('voice library: fetch failed', {safeMessage: String(e)})
    return {signedOut: false, error: errorMessage(e) ?? 'network error'}
  }
}

/**
 * POST /app/voices/preview {voiceId, text?} → a base64 MP3 sample, for library
 * voices with no hosted previewUrl. Accepts either raw audio bytes or a JSON body
 * carrying base64 (`audio`/`base64`/`clip`). Returns null on ANY failure —
 * preview is an enhancement, the caller just shows "no preview available".
 */
export async function fetchVoicePreviewClip(
  voiceId: string,
  text?: string,
): Promise<string | null> {
  try {
    const headers = await authHeaders()
    if (!headers) return null
    const res = await fetch(VOICES_PREVIEW_ENDPOINT, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({voiceId, ...(text ? {text} : {})}),
    })
    if (!res.ok) {
      logger.warn('voice library: preview synth non-ok', {status: res.status})
      return null
    }
    const contentType = res.headers.get('content-type') ?? ''
    if (contentType.includes('application/json')) {
      const j = (await res.json().catch(() => ({}))) as Record<string, unknown>
      const inline = str(j.audio) ?? str(j.base64) ?? str(j.clip)
      if (inline) return inline
      // The runtime answers {previewUrl} when ElevenLabs ships a hosted sample
      // (no synthesis spent) — fetch it and hand back the same base64 shape.
      const previewUrl = str(j.previewUrl) ?? str(j.preview_url)
      if (previewUrl) {
        const clip = await fetch(previewUrl)
        if (!clip.ok) return null
        const bytes = await clip.arrayBuffer()
        return bytes && bytes.byteLength > 0
          ? bytesToBase64(new Uint8Array(bytes))
          : null
      }
      return null
    }
    const buf = await res.arrayBuffer()
    if (!buf || buf.byteLength === 0) return null
    return bytesToBase64(new Uint8Array(buf))
  } catch (e) {
    logger.warn('voice library: preview synth failed', {safeMessage: String(e)})
    return null
  }
}

/** Result of POST /app/agents/voice. `unsupported` = the runtime predates the
 *  route (plain 404), so callers can fall back to the persona voiceId path. */
export interface SetAgentVoiceResult {
  ok: boolean
  signedOut: boolean
  unsupported?: boolean
  code?: string
  error?: string
}

/**
 * POST /app/agents/voice {agent?, voiceId} — assign the voice this agent SPEAKS
 * with, as a first-class agent attribute (wins over the persona voiceId at every
 * spoken surface; runtime verifies the id against ElevenLabs — a definite
 * unknown id is a 422 voice-not-found). Never throws.
 */
export async function setAgentVoice(input: {
  agent?: string
  voiceId: string
}): Promise<SetAgentVoiceResult> {
  try {
    const headers = await authHeaders()
    if (!headers) return {ok: false, signedOut: true}
    const res = await fetch(AGENTS_VOICE_ENDPOINT, {
      method: 'POST',
      headers: {...headers, 'Content-Type': 'application/json'},
      body: JSON.stringify({
        voiceId: input.voiceId,
        ...(input.agent ? {agent: input.agent} : {}),
      }),
    })
    const j = (await res.json().catch(() => ({}))) as Record<string, unknown>
    if (res.ok) return {ok: true, signedOut: false}
    const code = str(j.code)
    if ((res.status === 401 || res.status === 403) && !code) {
      return {ok: false, signedOut: true}
    }
    // A codeless 404 is a runtime that predates the route — NOT a user error.
    if (res.status === 404 && !code) {
      return {ok: false, signedOut: false, unsupported: true}
    }
    return {
      ok: false,
      signedOut: false,
      code,
      error: str(j.error) ?? str(j.message) ?? `Runtime error ${res.status}`,
    }
  } catch (e) {
    logger.warn('voice library: set agent voice failed', {
      safeMessage: String(e),
    })
    return {
      ok: false,
      signedOut: false,
      error: errorMessage(e) ?? 'network error',
    }
  }
}
