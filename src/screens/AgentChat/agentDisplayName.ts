/**
 * Pure helpers for resolving the agent's UI display name. No imports, so they're
 * trivially unit-testable; the `useAgentDisplayName` hook supplies the runtime
 * values (profile displayName + PDS host).
 *
 * The chat route only carries the agent's short runtime ROUTING id (e.g. 'ada'),
 * not its human name. The human name the user chose lives in the runtime config
 * (identity.name) and is NOT returned by any /app/* response, so the cleanest
 * client-side source is the agent's atproto profile displayName (resolved via the
 * AppView). When that isn't available we fall back to the routing handle, never a
 * hardcoded persona name.
 */

/** Neutral fallback when neither a profile displayName nor a handle is available. */
export const NEUTRAL_AGENT_NAME = 'your agent'

/** Capitalize a bare routing id for display ('ada' -> 'Ada'). */
export function prettyAgentHandle(
  routingId: string | undefined,
): string | undefined {
  const id = routingId?.trim()
  if (!id) return undefined
  return id.charAt(0).toUpperCase() + id.slice(1)
}

/**
 * Form the agent's atproto actor (handle) from its routing id: '<id>.<pdsHost>'.
 * If the id already looks like a handle (contains a dot), it's used as-is.
 */
export function agentActorFromHandle(
  routingId: string | undefined,
  pdsHost: string,
): string | undefined {
  const id = routingId?.trim()
  if (!id) return undefined
  return id.includes('.') ? id : `${id}.${pdsHost}`
}

/**
 * Resolve the agent's display name, preferring the atproto profile displayName,
 * then the prettified routing handle, then a neutral default. Never a hardcoded
 * persona name.
 */
export function resolveAgentDisplayName(args: {
  profileDisplayName?: string | undefined
  handle?: string | undefined
}): string {
  const displayName = args.profileDisplayName?.trim()
  if (displayName) return displayName
  return prettyAgentHandle(args.handle) ?? NEUTRAL_AGENT_NAME
}
