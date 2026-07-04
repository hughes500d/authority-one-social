import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'

import {
  applyAutoSocialPatch,
  type AutoSocialPatch,
  fetchSocialAutonomy,
  type SocialAutonomyState,
  updateSocialAutonomy,
} from '#/lib/agent-runtime'
import {STALE} from '#/state/queries'
import {createQueryKey} from '#/state/queries/util'

const socialAutonomyQueryKeyRoot = 'socialAutonomy'
/**
 * Keyed by the optional agent scope (full handle) so each agent's autonomy view
 * caches independently. No agent = the owner's token-mapped agent.
 */
export const createSocialAutonomyQueryKey = (agent?: string) =>
  createQueryKey(socialAutonomyQueryKeyRoot, {agent: agent ?? null})

/** An Error that also carries the runtime's machine-readable code. */
export class SocialAutonomyError extends Error {
  code?: string
  constructor(message: string, code?: string) {
    super(message)
    this.name = 'SocialAutonomyError'
    this.code = code
  }
}

/**
 * The agent's resolved social-autonomy config + today's spend, from the runtime
 * (GET /app/social-autonomy). Same contract as the persona hooks: `undefined`
 * data when signed out / unreachable so the screen degrades gracefully; throws
 * only on an ownership error (403 not-your-agent) so the scoped screen can
 * message it specifically.
 */
export function useSocialAutonomyQuery(agent?: string) {
  return useQuery<SocialAutonomyState | undefined>({
    queryKey: createSocialAutonomyQueryKey(agent),
    queryFn: async () => {
      const result = await fetchSocialAutonomy(agent)
      if (result.code === 'not-your-agent') {
        throw new SocialAutonomyError(
          result.error ?? 'This agent is not linked to your account.',
          result.code,
        )
      }
      return result.state
    },
    staleTime: STALE.MINUTES.ONE,
    retry: (failureCount, error) =>
      // Ownership won't change on retry.
      !(
        error instanceof SocialAutonomyError && error.code === 'not-your-agent'
      ) && failureCount < 3,
  })
}

/**
 * Targeted-merge update (POST /app/social-autonomy) with an OPTIMISTIC cache
 * patch: the local mirror of the runtime's merge applies immediately, the
 * runtime's resolved echo replaces it on success, and the snapshot rolls back
 * on failure. A failed write throws (react-query onError) so the screen can
 * toast it — nothing silently no-ops.
 */
export function useUpdateSocialAutonomyMutation(agent?: string) {
  const qc = useQueryClient()
  const queryKey = createSocialAutonomyQueryKey(agent)
  return useMutation({
    mutationFn: async (patch: AutoSocialPatch) => {
      const res = await updateSocialAutonomy(patch, agent)
      if (!res.ok) {
        if (res.signedOut)
          throw new SocialAutonomyError(
            'Please sign in to manage social autonomy.',
          )
        throw new SocialAutonomyError(
          res.error ?? 'Could not save the change.',
          res.code,
        )
      }
      return res
    },
    onMutate: async (patch: AutoSocialPatch) => {
      await qc.cancelQueries({queryKey})
      const previous = qc.getQueryData<SocialAutonomyState | undefined>(
        queryKey,
      )
      if (previous) {
        qc.setQueryData<SocialAutonomyState>(queryKey, {
          ...previous,
          autoSocial: applyAutoSocialPatch(previous.autoSocial, patch),
        })
      }
      return {previous}
    },
    onError: (_err, _patch, context) => {
      if (context?.previous) qc.setQueryData(queryKey, context.previous)
    },
    onSuccess: res => {
      const auto = res.autoSocial
      if (auto) {
        qc.setQueryData<SocialAutonomyState | undefined>(queryKey, prev =>
          prev ? {...prev, autoSocial: auto} : {autoSocial: auto},
        )
      }
    },
    onSettled: () => qc.invalidateQueries({queryKey}),
  })
}
