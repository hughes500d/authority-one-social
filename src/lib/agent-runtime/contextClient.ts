import {type ContextEvent} from '#/lib/contextEngine/types'
import {logger} from '#/logger'
import {getSupabaseAccessToken} from './authToken'
import {
  CONTEXT_DELETE_ENDPOINT,
  CONTEXT_EVENTS_ENDPOINT,
  CONTEXT_RECENT_ENDPOINT,
} from './config'

/**
 * Sync client for the Context Engine (owner-scoped, same auth pattern as the
 * persona/feed clients). Uploads ONLY derived conclusions. Every call is resilient
 * (never throws) and silently no-ops when signed out or the worker isn't deployed,
 * so the local log keeps working regardless.
 */

async function authHeaders(): Promise<Record<string, string> | null> {
  const token = await getSupabaseAccessToken()
  if (!token) return null
  return {Authorization: `Bearer ${token}`}
}

/** Defensive: keep only well-formed conclusion events from a recent() response. */
export function normalizeContextEvents(json: unknown): ContextEvent[] {
  const rows = (json as {events?: unknown})?.events
  if (!Array.isArray(rows)) return []
  const out: ContextEvent[] = []
  for (const raw of rows) {
    if (!raw || typeof raw !== 'object') continue
    const r = raw as Record<string, unknown>
    if (typeof r.id !== 'string' || typeof r.place !== 'string') continue
    out.push({
      id: r.id,
      at: typeof r.at === 'number' ? r.at : 0,
      place: r.place as ContextEvent['place'],
      placeRef: typeof r.placeRef === 'string' ? r.placeRef : undefined,
      attention: {
        durationMin:
          typeof (r.attention as {durationMin?: unknown})?.durationMin === 'number'
            ? (r.attention as {durationMin: number}).durationMin
            : 0,
      },
      confidence: typeof r.confidence === 'number' ? r.confidence : 0,
      sources: ['location'],
    })
  }
  return out
}

/** POST /app/context/events — upload a batch of conclusions. Fire-and-forget. */
export async function postContextEvents(events: ContextEvent[]): Promise<void> {
  if (events.length === 0) return
  try {
    const headers = await authHeaders()
    if (!headers) return
    await fetch(CONTEXT_EVENTS_ENDPOINT, {
      method: 'POST',
      headers: {...headers, 'Content-Type': 'application/json'},
      body: JSON.stringify({events}),
    })
  } catch (e) {
    logger.warn('context: post events failed', {safeMessage: String(e)})
  }
}

/** GET /app/context/recent — synced conclusions, or [] when unavailable. */
export async function fetchRecentContext(): Promise<ContextEvent[]> {
  try {
    const headers = await authHeaders()
    if (!headers) return []
    const res = await fetch(CONTEXT_RECENT_ENDPOINT, {method: 'GET', headers})
    if (!res.ok) return []
    return normalizeContextEvents(await res.json())
  } catch (e) {
    logger.warn('context: fetch recent failed', {safeMessage: String(e)})
    return []
  }
}

/** POST /app/context/delete — delete one synced conclusion by id. Never throws. */
export async function deleteContextEvent(id: string): Promise<void> {
  try {
    const headers = await authHeaders()
    if (!headers) return
    await fetch(CONTEXT_DELETE_ENDPOINT, {
      method: 'POST',
      headers: {...headers, 'Content-Type': 'application/json'},
      body: JSON.stringify({id}),
    })
  } catch (e) {
    logger.warn('context: delete failed', {safeMessage: String(e)})
  }
}
