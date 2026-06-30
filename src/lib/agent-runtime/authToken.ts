// ─────────────────────────────────────────────────────────────────────────────
// Agent-runtime bearer provider.
//
// SINGLE-LOGIN (2026-06-30): the agent runtime ('/app/*') now authenticates with
// the user's **atproto/PDS session** — the same login that signs them into the
// social app — NOT a separate Supabase token. The runtime validates the access
// token against the PDS (com.atproto.server.getSession → DID) and authorizes the
// agent by the verified DID, so this provider just returns the current atproto
// access token from the persisted session.
//
// Backward-compat: `setSupabaseTokenProvider` is retained as a NO-OP so the legacy
// Supabase auth module still imports + calls cleanly during the transition; it can
// no longer override the atproto token.
// ─────────────────────────────────────────────────────────────────────────────
import * as persisted from '#/state/persisted'

export type TokenProvider = () => Promise<string | null>

/**
 * The current atproto/PDS access token (the bearer the agent runtime '/app/*'
 * authenticates with), or null when signed out. Read from the persisted session so
 * the network layer needs no React context.
 */
export function getAgentRuntimeAccessToken(): Promise<string | null> {
  try {
    const session = persisted.get('session')
    return Promise.resolve(session?.currentAccount?.accessJwt ?? null)
  } catch {
    return Promise.resolve(null)
  }
}

/**
 * @deprecated SINGLE-LOGIN migration: the agent channel authenticates with the
 * atproto/PDS session now, not a separate Supabase token. Retained as a NO-OP so
 * the legacy Supabase module's `setSupabaseTokenProvider(...)` calls don't break
 * and can no longer override the atproto token.
 */
export function setSupabaseTokenProvider(_next: TokenProvider): void {
  // intentional no-op — atproto is the single front door now
}

/**
 * @deprecated alias kept so existing '/app/*' clients compile unchanged. Now
 * returns the atproto access token (see getAgentRuntimeAccessToken).
 */
export const getSupabaseAccessToken = getAgentRuntimeAccessToken
