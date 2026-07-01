import {useQuery} from '@tanstack/react-query'

import {fetchOwnerAgents, type OwnerAgent} from '#/lib/agent-runtime'
import {STALE} from '#/state/queries'
import {createQueryKey} from '#/state/queries/util'

const ownerAgentsQueryKeyRoot = 'ownerAgents'
export const createOwnerAgentsQueryKey = () =>
  createQueryKey(ownerAgentsQueryKeyRoot, {})

/**
 * The agents the current owner may CHOOSE to add to a group (GET /app/agents). Resolves
 * to an empty list when signed out / unreachable / not deployed, so the picker degrades to
 * "no agents to add" rather than erroring. Never throws.
 */
export function useOwnerAgentsQuery() {
  return useQuery<{agents: OwnerAgent[]; signedOut: boolean}>({
    queryKey: createOwnerAgentsQueryKey(),
    queryFn: async () => {
      const result = await fetchOwnerAgents()
      return {agents: result.agents, signedOut: result.signedOut}
    },
    staleTime: STALE.MINUTES.ONE,
  })
}
