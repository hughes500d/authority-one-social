import {logger} from '#/logger'
import {getSupabaseAccessToken} from './authToken'
import {
  PERSONAS_ACTIVE_ENDPOINT,
  PERSONAS_DELETE_ENDPOINT,
  PERSONAS_ENDPOINT,
  PERSONAS_UPDATE_ENDPOINT,
  VOICES_ENDPOINT,
} from './config'

/**
 * Client for the runtime's owner-scoped persona/avatar system. Owner-scoping is
 * enforced server-side from the Supabase bearer; no agent/handle is sent. Every
 * call is resilient (never throws): reads return `signedOut`/`unreachable` flags
 * so the UI degrades to the profile-name behavior, and writes return ok/error.
 */

export interface PersonaVoice {
  voiceId: string
  name: string
  default?: boolean
}

export interface Persona {
  id: string
  name: string
  voiceId?: string
  personality?: string
}

/** The full GET /app/personas payload, normalized. */
export interface PersonasState {
  personas: Persona[]
  activePersonaId?: string
  activeName?: string
  activeVoiceId?: string
  voices: PersonaVoice[]
}

export interface PersonasResult {
  /** Present on success; undefined when signed out / unreachable. */
  state?: PersonasState
  signedOut: boolean
  error?: string
}

export interface PersonaWriteResult {
  ok: boolean
  signedOut: boolean
  error?: string
}

// ── Pure normalizers / helpers (unit-tested) ─────────────────────────────────

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined
}

/** Normalize one raw persona object defensively. Returns null if it has no id. */
function normalizePersona(raw: unknown): Persona | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const id = str(r.id)
  if (!id) return null
  return {
    id,
    name: str(r.name) ?? id,
    voiceId: str(r.voiceId),
    personality: typeof r.personality === 'string' ? r.personality : undefined,
  }
}

function normalizeVoice(raw: unknown): PersonaVoice | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const voiceId = str(r.voiceId)
  if (!voiceId) return null
  return {voiceId, name: str(r.name) ?? voiceId, default: r.default === true}
}

/**
 * Pure: GET /app/personas JSON -> PersonasState. Derives active name/voice from the
 * active persona when the server doesn't echo them, so the header/voice always have
 * a value when there's an active persona.
 */
export function normalizePersonasResponse(json: unknown): PersonasState {
  const j = (json ?? {}) as Record<string, unknown>
  const personas = Array.isArray(j.personas)
    ? j.personas.map(normalizePersona).filter((p): p is Persona => p !== null)
    : []
  const voices = Array.isArray(j.voices)
    ? j.voices.map(normalizeVoice).filter((v): v is PersonaVoice => v !== null)
    : []
  const activePersonaId = str(j.activePersonaId)
  const active = personas.find(p => p.id === activePersonaId)
  return {
    personas,
    voices,
    activePersonaId,
    activeName: str(j.activeName) ?? active?.name,
    activeVoiceId: str(j.activeVoiceId) ?? active?.voiceId,
  }
}

/** Pure: the chat header name — active persona name wins, else the fallback. */
export function pickAgentHeaderName(
  activeName: string | undefined,
  fallback: string,
): string {
  const trimmed = activeName?.trim()
  return trimmed || fallback
}

/** Pure: the voice-mode voice id — the active persona's voice, if any. */
export function pickActiveVoiceId(
  activeVoiceId: string | undefined,
): string | undefined {
  const trimmed = activeVoiceId?.trim()
  return trimmed || undefined
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

/** GET /app/personas — the full persona state. Never throws. */
export async function fetchPersonas(): Promise<PersonasResult> {
  let headers: Record<string, string> | null
  try {
    headers = await authHeaders()
  } catch (e) {
    return {signedOut: false, error: errorMessage(e) ?? 'auth error'}
  }
  if (!headers) return {signedOut: true}

  try {
    const res = await fetch(PERSONAS_ENDPOINT, {method: 'GET', headers})
    if (res.status === 401 || res.status === 403) return {signedOut: false}
    if (!res.ok) return {signedOut: false, error: `Runtime error ${res.status}`}
    const json: unknown = await res.json()
    return {state: normalizePersonasResponse(json), signedOut: false}
  } catch (e) {
    logger.warn('personas: fetch failed', {safeMessage: String(e)})
    return {signedOut: false, error: errorMessage(e) ?? 'network error'}
  }
}

/** GET /app/voices — available voices (also included in GET /app/personas). */
export async function fetchVoices(): Promise<PersonaVoice[]> {
  try {
    const headers = await authHeaders()
    if (!headers) return []
    const res = await fetch(VOICES_ENDPOINT, {method: 'GET', headers})
    if (!res.ok) return []
    const json = (await res.json()) as {voices?: unknown}
    return Array.isArray(json?.voices)
      ? json.voices.map(normalizeVoice).filter((v): v is PersonaVoice => v !== null)
      : []
  } catch (e) {
    logger.warn('personas: fetchVoices failed', {safeMessage: String(e)})
    return []
  }
}

async function postJson(
  url: string,
  body: Record<string, unknown>,
): Promise<PersonaWriteResult> {
  let headers: Record<string, string> | null
  try {
    headers = await authHeaders()
  } catch (e) {
    return {ok: false, signedOut: false, error: errorMessage(e) ?? 'auth error'}
  }
  if (!headers) return {ok: false, signedOut: true}
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {...headers, 'Content-Type': 'application/json'},
      body: JSON.stringify(body),
    })
    if (res.status === 401 || res.status === 403) {
      return {ok: false, signedOut: true}
    }
    if (!res.ok) {
      return {ok: false, signedOut: false, error: `Runtime error ${res.status}`}
    }
    return {ok: true, signedOut: false}
  } catch (e) {
    logger.warn('personas: write failed', {safeMessage: String(e)})
    return {ok: false, signedOut: false, error: errorMessage(e) ?? 'network error'}
  }
}

export function createPersona(input: {
  name: string
  voiceId?: string
  personality?: string
}): Promise<PersonaWriteResult> {
  return postJson(PERSONAS_ENDPOINT, {
    name: input.name,
    voiceId: input.voiceId,
    personality: input.personality,
  })
}

export function updatePersona(input: {
  id: string
  name?: string
  voiceId?: string
  personality?: string
}): Promise<PersonaWriteResult> {
  return postJson(PERSONAS_UPDATE_ENDPOINT, {
    id: input.id,
    name: input.name,
    voiceId: input.voiceId,
    personality: input.personality,
  })
}

export function deletePersona(input: {id: string}): Promise<PersonaWriteResult> {
  return postJson(PERSONAS_DELETE_ENDPOINT, {id: input.id})
}

export function setActivePersona(input: {id: string}): Promise<PersonaWriteResult> {
  return postJson(PERSONAS_ACTIVE_ENDPOINT, {id: input.id})
}
