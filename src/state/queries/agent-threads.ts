import {useQueries} from '@tanstack/react-query'

import {
  fetchThreadMembers,
  rosterAgentKeys,
  type Thread,
  type ThreadRoster,
} from '#/lib/agent-runtime'
import {STALE} from '#/state/queries'
import {
  createThreadMembersQueryKey,
  useThreadsQuery,
} from '#/state/queries/threads'

/** The identity of one agent as the grid/hub reference it (handle required, DID when known). */
export interface AgentIdentity {
  handle: string
  did?: string
}

/** Lowercased match keys for an agent identity. */
function identityKeys(agent: AgentIdentity): string[] {
  const keys = [agent.handle.trim().toLowerCase()]
  if (agent.did) keys.push(agent.did.trim().toLowerCase())
  return keys
}

/** Does this roster contain the given agent as an AGENT member? */
export function rosterHasAgent(
  roster: ThreadRoster | undefined,
  agent: AgentIdentity,
): boolean {
  const agentKeys = rosterAgentKeys(roster)
  if (agentKeys.length === 0) return false
  const wanted = identityKeys(agent)
  return agentKeys.some(k => wanted.includes(k))
}

/**
 * The signed-in user's GROUP threads that include `agent` as a member — the data
 * behind the AgentHub "Groups" tab. `Thread` rows carry no agent identity, so
 * membership is resolved from each group's roster (GET /app/threads/:id/members,
 * cache shared with useThreadMembersQuery). Rosters resolve independently, so the
 * list fills in as they land; group counts are small at pilot scale.
 */
export function useAgentGroupThreadsQuery(agent: AgentIdentity | undefined) {
  const {data: threadsData, isLoading: threadsLoading} = useThreadsQuery()
  const groups = (threadsData?.threads ?? []).filter(
    th => th.kind === 'group' && th.membership !== 'pending',
  )

  const memberResults = useQueries({
    queries: groups.map(th => ({
      queryKey: createThreadMembersQueryKey(th.id),
      queryFn: () => fetchThreadMembers(th.id),
      staleTime: STALE.SECONDS.FIFTEEN,
      enabled: !!agent,
    })),
  })

  const matched: Thread[] = []
  let membersLoading = false
  if (agent) {
    groups.forEach((th, i) => {
      const res = memberResults[i]
      if (res.isLoading) membersLoading = true
      if (rosterHasAgent(res.data, agent)) matched.push(th)
    })
  }

  return {
    // Threads arrive pre-sorted (live first, then newest); filtering preserves that.
    groups: matched,
    isLoading: threadsLoading || membersLoading,
    /** True when the runtime was unreachable (vs a genuinely empty list). */
    unavailable: !threadsLoading && threadsData === undefined,
  }
}

/**
 * Sum unread counts per agent identity key. Each row is one thread's unread
 * count plus the agent keys of its roster; a thread's unread lands on every
 * agent in it (multi-agent groups count for each). PURE + tested.
 */
export function unreadByAgentKey(
  rows: {unreadCount: number; agentKeys: string[]}[],
): Map<string, number> {
  const totals = new Map<string, number>()
  for (const row of rows) {
    if (row.unreadCount <= 0) continue
    for (const key of row.agentKeys) {
      totals.set(key, (totals.get(key) ?? 0) + row.unreadCount)
    }
  }
  return totals
}

/**
 * Per-agent UNREAD rollup for the grid headshot badges, from the in-app thread
 * list: group threads carrying unreadCount > 0 have their rosters resolved and
 * their counts summed onto each agent member. Rosters are fetched only for
 * unread threads, so a fully-read inbox costs zero extra requests. NOTE: this
 * covers in-app group threads only — 1:1 chats and SMS/WA/iMessage threads have
 * no per-agent unread source client-side yet (runtime work; see the Messages
 * unification plan).
 */
export function useAgentUnreadCounts(): Map<string, number> {
  const {data: threadsData} = useThreadsQuery()
  const unreadThreads = (threadsData?.threads ?? []).filter(
    th =>
      th.kind === 'group' && th.membership !== 'pending' && th.unreadCount > 0,
  )

  const memberResults = useQueries({
    queries: unreadThreads.map(th => ({
      queryKey: createThreadMembersQueryKey(th.id),
      queryFn: () => fetchThreadMembers(th.id),
      staleTime: STALE.SECONDS.FIFTEEN,
    })),
  })

  return unreadByAgentKey(
    unreadThreads.map((th, i) => ({
      unreadCount: th.unreadCount,
      agentKeys: rosterAgentKeys(memberResults[i]?.data),
    })),
  )
}

/**
 * Lowercased identity keys (handle/DID) of every agent that is a member of a LIVE
 * thread — drives the live dot on agent-grid tiles. Rosters are fetched only for
 * live threads, so with no live rooms (today's steady state) this costs zero
 * requests beyond the threads list already on screen.
 */
export function useLiveAgentKeys(): Set<string> {
  const {data: threadsData} = useThreadsQuery()
  const liveThreads = (threadsData?.threads ?? []).filter(
    th => th.live === true,
  )

  const memberResults = useQueries({
    queries: liveThreads.map(th => ({
      queryKey: createThreadMembersQueryKey(th.id),
      queryFn: () => fetchThreadMembers(th.id),
      staleTime: STALE.SECONDS.FIFTEEN,
    })),
  })

  const keys = new Set<string>()
  for (const res of memberResults) {
    for (const key of rosterAgentKeys(res.data)) {
      keys.add(key)
    }
  }
  return keys
}
