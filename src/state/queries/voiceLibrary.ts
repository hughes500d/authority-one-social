import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'

import {
  fetchVoiceLibrary,
  type LibraryVoice,
  updatePersona,
} from '#/lib/agent-runtime'
import {STALE} from '#/state/queries'
import {
  createPersonasQueryKey,
  PersonaWriteError,
} from '#/state/queries/personas'
import {createQueryKey} from '#/state/queries/util'

const voiceLibraryQueryKeyRoot = 'agentVoiceLibrary'
export const createVoiceLibraryQueryKey = () =>
  createQueryKey(voiceLibraryQueryKeyRoot, {})

/**
 * The full browsable voice library (GET /app/voices, pinned library contract).
 * Resolves to `null` when signed out, unreachable, or the runtime predates the
 * library shape — the picker screen then shows an honest unavailable notice
 * instead of an empty catalog. The library is one shared catalog (not
 * agent-scoped); what varies per agent is the ASSIGNMENT.
 */
export function useVoiceLibraryQuery() {
  return useQuery<LibraryVoice[] | null>({
    queryKey: createVoiceLibraryQueryKey(),
    // null (not undefined) when unavailable — react-query treats undefined as a bug.
    queryFn: async () => (await fetchVoiceLibrary()).voices ?? null,
    staleTime: STALE.MINUTES.FIVE,
  })
}

/**
 * Assign a library voice to an agent by writing the raw ElevenLabs id onto the
 * agent's ACTIVE persona (POST /app/personas/update — the runtime's existing
 * config-update path with merge semantics; the agent's spoken voice resolves
 * from the active persona's voiceId server-side). A failed write throws (never a
 * silent no-op); on success the echoed personas view updates the cache
 * authoritatively so the "current voice" card reflects the change immediately.
 */
export function useAssignAgentVoiceMutation(agent?: string) {
  const qc = useQueryClient()
  const personasKey = createPersonasQueryKey(agent)
  return useMutation({
    mutationFn: async (input: {personaId: string; voiceId: string}) => {
      const res = await updatePersona(
        {id: input.personaId, voiceId: input.voiceId},
        agent,
      )
      if (!res.ok) {
        if (res.signedOut)
          throw new PersonaWriteError('Please sign in to change the voice.')
        throw new PersonaWriteError(
          res.error ?? 'Could not set the voice.',
          res.code,
        )
      }
      return res
    },
    onSuccess: res => {
      if (res.state) {
        qc.setQueryData(personasKey, res.state)
      } else {
        void qc.invalidateQueries({queryKey: personasKey})
      }
    },
  })
}
