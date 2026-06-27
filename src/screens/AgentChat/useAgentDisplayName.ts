import {AUTHORITY_ONE_SERVICE} from '#/lib/constants'
import {useProfileQuery} from '#/state/queries/profile'
import {
  agentActorFromHandle,
  resolveAgentDisplayName,
} from './agentDisplayName'

/** Host portion of the PDS, used to form an agent's atproto handle from its id. */
function pdsHandleHost(): string {
  try {
    return new URL(AUTHORITY_ONE_SERVICE).host
  } catch {
    return 'pds.authority-one.com'
  }
}

/**
 * The agent's display name for the chat UI. Prefers the agent's atproto profile
 * displayName (resolved via the AppView from its '<routingId>.<pdsHost>' handle),
 * falling back to the prettified routing handle, then a neutral default. Replaces
 * the old hardcoded "Bob" constant so the header / empty-state / placeholders
 * reflect whatever the agent is actually named.
 *
 * Best-effort and non-blocking: in isolated-PDS / unindexed-agent setups the
 * profile lookup just returns nothing (`useProfileQuery` captures the error) and
 * the handle fallback is used. It never throws and never shows a stale persona.
 */
export function useAgentDisplayName(agentHandle: string | undefined): string {
  const actor = agentActorFromHandle(agentHandle, pdsHandleHost())
  const {data} = useProfileQuery({did: actor})
  return resolveAgentDisplayName({
    profileDisplayName: data?.displayName,
    handle: agentHandle,
  })
}
