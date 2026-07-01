import {logger} from '#/logger'
import {getSupabaseAccessToken} from './authToken'
import {AGENTS_ENDPOINT} from './config'

/**
 * Owner-agents client: the read side that lets an owner CHOOSE one of THEIR agents to add
 * to a group chat. Same owner-scoped /app auth + resilience contract as the other agent-
 * runtime clients — every call degrades gracefully (an unreachable / not-yet-deployed
 * endpoint yields an empty list, never throws), so the picker just shows nothing to add.
 */

/** One selectable agent identity for the picker. */
export interface OwnerAgent {
  /** The agent's PDS handle (e.g. ada.pds.authority-one.com) — the id used to add it. */
  handle: string
  /** Display name from the runtime; the UI can refine it from the atproto profile. */
  displayName?: string
  /** Avatar URL when the runtime resolves one; usually null (the UI enriches it). */
  avatar?: string
}

export interface OwnerAgentsResult {
  agents: OwnerAgent[]
  signedOut: boolean
  error?: string
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined
}

/** Normalize the GET /app/agents payload into a deduped agent list. PURE + tested. */
export function normalizeOwnerAgents(json: unknown): OwnerAgent[] {
  const rows = (json as {agents?: unknown})?.agents
  if (!Array.isArray(rows)) return []
  const seen = new Set<string>()
  const out: OwnerAgent[] = []
  for (const raw of rows) {
    if (!raw || typeof raw !== 'object') continue
    const r = raw as Record<string, unknown>
    const handle = str(r.handle) ?? str(r.id) ?? str(r.did)
    if (!handle || seen.has(handle.toLowerCase())) continue
    seen.add(handle.toLowerCase())
    out.push({
      handle,
      displayName: str(r.displayName) ?? str(r.name),
      avatar: str(r.avatar),
    })
  }
  return out
}

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

/**
 * GET /app/agents — the agents this owner may choose for a group. Returns an empty list
 * when signed out, unreachable, or the endpoint isn't deployed yet, so the picker degrades
 * to "no agents to add" rather than erroring. Never throws.
 */
export async function fetchOwnerAgents(): Promise<OwnerAgentsResult> {
  let headers: Record<string, string> | null
  try {
    headers = await authHeaders()
  } catch (e) {
    return {
      agents: [],
      signedOut: false,
      error: errorMessage(e) ?? 'auth error',
    }
  }
  if (!headers) return {agents: [], signedOut: true}
  try {
    const res = await fetch(AGENTS_ENDPOINT, {method: 'GET', headers})
    if (res.status === 401 || res.status === 403)
      return {agents: [], signedOut: true}
    if (!res.ok)
      return {
        agents: [],
        signedOut: false,
        error: `Runtime error ${res.status}`,
      }
    return {agents: normalizeOwnerAgents(await res.json()), signedOut: false}
  } catch (e) {
    logger.warn('agents: fetch failed', {safeMessage: String(e)})
    return {
      agents: [],
      signedOut: false,
      error: errorMessage(e) ?? 'network error',
    }
  }
}
