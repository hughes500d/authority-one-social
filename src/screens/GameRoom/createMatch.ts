/**
 * "New game" launcher client — POST /app/games on the agent runtime (owner
 * bearer, same /app auth pattern as the other agent-runtime clients; the
 * shared create path is documented in pilot-agent-runtime/GAMES.md). Returns
 * the capability matchID the screen navigates to (/game/<matchID>). Same
 * resilience contract as the sibling clients: never throws — every failure
 * maps to a gentle {ok:false, error} the screen can toast.
 */
import {getAgentRuntimeAccessToken} from '#/lib/agent-runtime/authToken'
import {logger} from '#/logger'
import {GAME_SERVER_BASE_URL} from './liveGameClient'
import {type GameKind} from './types'

export interface CreateMatchResult {
  ok: boolean
  matchID?: string
  error?: string
}

export async function createLiveMatch(
  game: GameKind,
  baseUrl = GAME_SERVER_BASE_URL,
): Promise<CreateMatchResult> {
  try {
    const token = await getAgentRuntimeAccessToken()
    if (!token) {
      return {ok: false, error: 'Sign in to start a live match.'}
    }
    const res = await fetch(`${baseUrl.replace(/\/+$/, '')}/app/games`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({game}),
    })
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as {
        code?: string
        message?: string
        known?: string[]
      } | null
      const error =
        res.status === 429
          ? 'Slow down — too many new matches. Try again soon.'
          : body?.code === 'unknown-game'
            ? `The server can't host ${game} yet.`
            : (body?.message ?? `Couldn't create the match (${res.status}).`)
      return {ok: false, error}
    }
    const data = (await res.json()) as {matchID?: unknown}
    if (typeof data.matchID !== 'string' || !data.matchID) {
      return {ok: false, error: 'Match create returned no matchID.'}
    }
    return {ok: true, matchID: data.matchID}
  } catch (e) {
    logger.warn('game: match create failed', {safeMessage: String(e)})
    return {ok: false, error: 'Network error creating the match.'}
  }
}
