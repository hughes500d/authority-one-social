import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'

import {
  fetchVoiceLibrary,
  type LibraryVoice,
  setAgentVoice,
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
 * Assign a library voice to an agent. Primary path: POST /app/agents/voice —
 * voice as a FIRST-CLASS AGENT ATTRIBUTE (runtime 06ea03c), which wins over the
 * persona voiceId at every spoken surface. If the runtime predates that route
 * (plain 404), fall back to writing the raw ElevenLabs id onto the agent's
 * ACTIVE persona via /app/personas/update — the legacy resolution path. A failed
 * write throws (never a silent no-op); on success the personas view is refreshed
 * (its activeVoiceId folds the agent attribute in server-side) so the "current
 * voice" card reflects the change.
 */
export function useAssignAgentVoiceMutation(agent?: string) {
  const qc = useQueryClient()
  const personasKey = createPersonasQueryKey(agent)
  return useMutation({
    mutationFn: async (input: {personaId?: string; voiceId: string}) => {
      const res = await setAgentVoice({agent, voiceId: input.voiceId})
      if (res.ok) return {legacy: false as const}
      if (res.unsupported && input.personaId) {
        const legacy = await updatePersona(
          {id: input.personaId, voiceId: input.voiceId},
          agent,
        )
        if (!legacy.ok) {
          if (legacy.signedOut)
            throw new PersonaWriteError('Please sign in to change the voice.')
          throw new PersonaWriteError(
            legacy.error ?? 'Could not set the voice.',
            legacy.code,
          )
        }
        return {legacy: true as const, state: legacy.state}
      }
      if (res.signedOut)
        throw new PersonaWriteError('Please sign in to change the voice.')
      throw new PersonaWriteError(
        res.error ?? 'Could not set the voice.',
        res.code,
      )
    },
    onSuccess: res => {
      if (res.legacy && res.state) {
        qc.setQueryData(personasKey, res.state)
      } else {
        void qc.invalidateQueries({queryKey: personasKey})
      }
    },
  })
}
