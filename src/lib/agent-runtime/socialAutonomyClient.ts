import {logger} from '#/logger'
import {getSupabaseAccessToken} from './authToken'
import {SOCIAL_AUTONOMY_ENDPOINT} from './config'

/**
 * Client for the runtime's owner-scoped social-autonomy config (config.autoSocial):
 * scheduled posting, auto-comment policy/caps, new-follower welcomes, per-friend
 * overrides. Agent-scoped exactly like the persona client: `?agent=` on GET, an
 * `agent` body field on POST (the FULL handle from a GET /app/agents row); omitted
 * = the owner's token-mapped agent. A non-owned handle gets a 403
 * {code:'not-your-agent'} — surfaced as a code, NOT as signedOut. Never throws.
 *
 * The GET returns the FULLY-RESOLVED config (the runtime fills defaults and ANDs
 * the master `enabled` into every sub-feature's `enabled`), plus today's spend
 * against the daily caps. The POST is a TARGETED merge: each sub-section patch
 * merges over the existing section, and `friends` merges per-key where any value
 * other than 'always'/'never' (we send 'default') REMOVES that override. The POST
 * echoes the resolved config so callers can update caches authoritatively.
 *
 * Autonomy is APPROVE-EACH only: every draft the config produces waits for the
 * owner's approval (YES/NO by text or the in-app approval surface). There is no
 * auto-execute mode to configure from here.
 */

export interface AutoSocialPosting {
  enabled: boolean
  /** Owner-local time of day, 'HH:MM'. */
  time: string
  /** Advanced cron override; null = use `time`. */
  cron: string | null
  /** What to post about (freeform owner directive, runtime caps at 500 chars). */
  directive: string
  dailyPostCap: number
}

export interface AutoSocialComment {
  enabled: boolean
  /** Topic keywords (runtime lowercases + caps at 50). */
  topics: string[]
  /** Chance 0..1 that an eligible post gets a comment draft. */
  probability: number
  dailyCommentCap: number
  /** 0 = top-level posts only (the loop guard). */
  maxThreadDepth: number
  /** Only consider posts younger than this. */
  freshnessMs: number
}

export interface AutoSocialWelcome {
  enabled: boolean
  /** Welcome a new follower by commenting on their content, or with a fresh post. */
  mode: 'comment' | 'post'
}

export type FriendRule = 'always' | 'never'

export interface AutoSocialPoll {
  enabled: boolean
  intervalMin: number
}

export interface AutoSocialConfig {
  /** Master kill switch. The resolved view ANDs this into every sub `enabled`. */
  enabled: boolean
  posting: AutoSocialPosting
  comment: AutoSocialComment
  welcome: AutoSocialWelcome
  /** Per-friend overrides, keyed by did-or-handle (lowercased by the runtime). */
  friends: Record<string, FriendRule>
  poll: AutoSocialPoll
}

/** Today's spend against the daily caps (rolls at UTC midnight). */
export interface AutoSocialSpend {
  day?: string
  posts: number
  comments: number
}

/**
 * A targeted patch. Sections are Partial — the runtime merges each provided
 * section over the existing one. `friends` values may be 'default' to CLEAR
 * that friend's override (the runtime deletes non-always/never values).
 */
export interface AutoSocialPatch {
  enabled?: boolean
  posting?: Partial<AutoSocialPosting>
  comment?: Partial<AutoSocialComment>
  welcome?: Partial<AutoSocialWelcome>
  friends?: Record<string, FriendRule | 'default'>
  poll?: Partial<AutoSocialPoll>
}

export interface SocialAutonomyState {
  autoSocial: AutoSocialConfig
  todaySpend?: AutoSocialSpend
}

export interface SocialAutonomyResult {
  state?: SocialAutonomyState
  signedOut: boolean
  error?: string
  /** Machine-readable error code from a 4xx (e.g. 'not-your-agent'). */
  code?: string
}

export interface SocialAutonomyWriteResult {
  ok: boolean
  signedOut: boolean
  error?: string
  code?: string
  /** The resolved config the runtime echoes on success. */
  autoSocial?: AutoSocialConfig
}

// ── Pure normalizers / helpers (unit-tested) ─────────────────────────────────
// Mirror the runtime's resolveAutoSocialConfig defaults so a sparse/legacy body
// still renders a coherent editor. The wire body is normally already resolved.

const DEFAULT_DAILY_POST_CAP = 1
const DEFAULT_DAILY_COMMENT_CAP = 5
const DEFAULT_COMMENT_FRESHNESS_MS = 60 * 60 * 1000
const DEFAULT_POLL_INTERVAL_MIN = 15

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined
}

function posInt(v: unknown, fallback: number): number {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback
}

function clamp01(v: unknown, fallback: number): number {
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n)) return fallback
  return Math.min(1, Math.max(0, n))
}

/** Normalize the per-friend override map: keep only 'always'/'never' rules. PURE. */
export function normalizeFriendOverrides(
  raw: unknown,
): Record<string, FriendRule> {
  const out: Record<string, FriendRule> = {}
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const [who, rule] of Object.entries(raw as Record<string, unknown>)) {
      const key = who.trim().toLowerCase()
      if (key && (rule === 'always' || rule === 'never')) out[key] = rule
    }
  }
  return out
}

/** Normalize a raw autoSocial object into a fully-defaulted config. PURE. */
export function normalizeAutoSocial(raw: unknown): AutoSocialConfig {
  const a = (raw && typeof raw === 'object' ? raw : {}) as Record<
    string,
    unknown
  >
  const p = (
    a.posting && typeof a.posting === 'object' ? a.posting : {}
  ) as Record<string, unknown>
  const c = (
    a.comment && typeof a.comment === 'object' ? a.comment : {}
  ) as Record<string, unknown>
  const w = (
    a.welcome && typeof a.welcome === 'object' ? a.welcome : {}
  ) as Record<string, unknown>
  const q = (a.poll && typeof a.poll === 'object' ? a.poll : {}) as Record<
    string,
    unknown
  >
  const master = a.enabled !== false
  return {
    enabled: master,
    posting: {
      enabled: p.enabled === true,
      time:
        typeof p.time === 'string' && /^\d{1,2}:\d{2}$/.test(p.time)
          ? p.time
          : '09:00',
      cron: str(typeof p.cron === 'string' ? p.cron.trim() : undefined) ?? null,
      directive: typeof p.directive === 'string' ? p.directive : '',
      dailyPostCap: posInt(p.dailyPostCap, DEFAULT_DAILY_POST_CAP),
    },
    comment: {
      enabled: c.enabled === true,
      topics: Array.isArray(c.topics)
        ? c.topics
            .map(t => String(t ?? '').trim())
            .filter(Boolean)
            .slice(0, 50)
        : [],
      probability: clamp01(c.probability, 1),
      dailyCommentCap: posInt(c.dailyCommentCap, DEFAULT_DAILY_COMMENT_CAP),
      maxThreadDepth:
        typeof c.maxThreadDepth === 'number' &&
        Number.isFinite(c.maxThreadDepth) &&
        c.maxThreadDepth >= 0
          ? Math.floor(c.maxThreadDepth)
          : 0,
      freshnessMs: posInt(c.freshnessMs, DEFAULT_COMMENT_FRESHNESS_MS),
    },
    welcome: {
      enabled: w.enabled === true,
      mode: w.mode === 'post' ? 'post' : 'comment',
    },
    friends: normalizeFriendOverrides(a.friends),
    poll: {
      enabled: q.enabled === true,
      intervalMin: Math.min(
        1440,
        Math.max(5, posInt(q.intervalMin, DEFAULT_POLL_INTERVAL_MIN)),
      ),
    },
  }
}

/** Normalize today's spend; missing/foreign shapes read as zeros. PURE. */
export function normalizeSpend(raw: unknown): AutoSocialSpend {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<
    string,
    unknown
  >
  return {
    day: str(r.day),
    posts: posInt(r.posts, 0) || 0,
    comments: posInt(r.comments, 0) || 0,
  }
}

/** Normalize the GET /app/social-autonomy payload. PURE. */
export function normalizeSocialAutonomyResponse(
  json: unknown,
): SocialAutonomyState {
  const j = (json ?? {}) as Record<string, unknown>
  return {
    autoSocial: normalizeAutoSocial(j.autoSocial),
    todaySpend: normalizeSpend(j.todaySpend),
  }
}

/**
 * Client mirror of the runtime's targeted merge, applied to the RESOLVED config
 * for optimistic cache updates. Sections merge over the existing section; friends
 * merge per-key ('default' clears). The runtime's echo is still authoritative
 * (e.g. master-off keeps resolved sub-`enabled` false). PURE.
 */
export function applyAutoSocialPatch(
  existing: AutoSocialConfig,
  patch: AutoSocialPatch,
): AutoSocialConfig {
  const next: AutoSocialConfig = {
    ...existing,
    ...(patch.enabled !== undefined ? {enabled: patch.enabled} : {}),
    posting: {...existing.posting, ...patch.posting},
    comment: {...existing.comment, ...patch.comment},
    welcome: {...existing.welcome, ...patch.welcome},
    poll: {...existing.poll, ...patch.poll},
  }
  if (patch.friends) {
    const merged = {...existing.friends}
    for (const [who, rule] of Object.entries(patch.friends)) {
      const key = who.trim().toLowerCase()
      if (!key) continue
      if (rule === 'always' || rule === 'never') merged[key] = rule
      else delete merged[key]
    }
    next.friends = merged
  }
  return next
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

/**
 * GET /app/social-autonomy — the agent's resolved autonomy config + today's spend.
 * Optionally scoped via `agent` (full handle). Never throws.
 */
export async function fetchSocialAutonomy(
  agent?: string,
): Promise<SocialAutonomyResult> {
  let headers: Record<string, string> | null
  try {
    headers = await authHeaders()
  } catch (e) {
    return {signedOut: false, error: errorMessage(e) ?? 'auth error'}
  }
  if (!headers) return {signedOut: true}
  try {
    const url = agent
      ? `${SOCIAL_AUTONOMY_ENDPOINT}?agent=${encodeURIComponent(agent)}`
      : SOCIAL_AUTONOMY_ENDPOINT
    const res = await fetch(url, {method: 'GET', headers})
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>
    if (!res.ok) {
      const code = str(body.code)
      // A coded 401/403 (e.g. not-your-agent) is an ownership error, NOT a dead
      // session — only an uncoded one degrades to signedOut.
      if ((res.status === 401 || res.status === 403) && !code) {
        return {signedOut: true}
      }
      return {
        signedOut: false,
        code,
        error:
          str(body.error) ?? str(body.message) ?? `Runtime error ${res.status}`,
      }
    }
    return {state: normalizeSocialAutonomyResponse(body), signedOut: false}
  } catch (e) {
    logger.warn('socialAutonomy: fetch failed', {safeMessage: String(e)})
    return {signedOut: false, error: errorMessage(e) ?? 'network error'}
  }
}

/**
 * POST /app/social-autonomy — apply a targeted config patch. Returns the
 * resolved config the runtime echoes so the caller can update caches without a
 * refetch race. Typed result, never throws.
 */
export async function updateSocialAutonomy(
  patch: AutoSocialPatch,
  agent?: string,
): Promise<SocialAutonomyWriteResult> {
  let headers: Record<string, string> | null
  try {
    headers = await authHeaders()
  } catch (e) {
    return {ok: false, signedOut: false, error: errorMessage(e) ?? 'auth error'}
  }
  if (!headers) return {ok: false, signedOut: true}
  try {
    const res = await fetch(SOCIAL_AUTONOMY_ENDPOINT, {
      method: 'POST',
      headers: {...headers, 'Content-Type': 'application/json'},
      body: JSON.stringify(agent ? {...patch, agent} : patch),
    })
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>
    if (!res.ok) {
      const code = str(body.code)
      if ((res.status === 401 || res.status === 403) && !code) {
        return {ok: false, signedOut: true}
      }
      return {
        ok: false,
        signedOut: false,
        code,
        error:
          str(body.error) ?? str(body.message) ?? `Runtime error ${res.status}`,
      }
    }
    return {
      ok: true,
      signedOut: false,
      ...(body.autoSocial && typeof body.autoSocial === 'object'
        ? {autoSocial: normalizeAutoSocial(body.autoSocial)}
        : {}),
    }
  } catch (e) {
    logger.warn('socialAutonomy: write failed', {safeMessage: String(e)})
    return {
      ok: false,
      signedOut: false,
      error: errorMessage(e) ?? 'network error',
    }
  }
}
