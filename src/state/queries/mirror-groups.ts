import {useQuery} from '@tanstack/react-query'

import {fetchOwnerGroups, type MirrorGroup} from '#/lib/agent-runtime'
import {STALE} from '#/state/queries'
import {createQueryKey} from '#/state/queries/util'

const mirrorGroupsQueryKeyRoot = 'mirrorGroups'
export const createMirrorGroupsQueryKey = (args: {agent?: string}) =>
  createQueryKey(mirrorGroupsQueryKeyRoot, args)

/**
 * The read-only SMS/MMS groups a given agent hosts (GET /app/groups?agent=...),
 * for the hub's Messages tab. Owner-scoped server-side; degrades to an empty
 * list when signed out / unreachable — never throws. Omitting `agent` lists the
 * owner's default agent's groups (the legacy SMSGroupsSection behavior).
 */
export function useMirrorGroupsQuery(
  agent?: string,
  {enabled = true}: {enabled?: boolean} = {},
) {
  return useQuery<MirrorGroup[]>({
    queryKey: createMirrorGroupsQueryKey({agent: agent?.toLowerCase()}),
    queryFn: () => fetchOwnerGroups(agent),
    staleTime: STALE.SECONDS.THIRTY,
    enabled,
  })
}
