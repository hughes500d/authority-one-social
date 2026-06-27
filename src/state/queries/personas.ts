import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'

import {
  createPersona,
  deletePersona,
  fetchPersonas,
  type PersonaFiction,
  type PersonasState,
  setActivePersona,
  updatePersona,
} from '#/lib/agent-runtime'
import {STALE} from '#/state/queries'
import {createQueryKey} from '#/state/queries/util'

const personasQueryKeyRoot = 'agentPersonas'
export const createPersonasQueryKey = () =>
  createQueryKey(personasQueryKeyRoot, {})

/**
 * The owner's agent personas + active selection + available voices, from the
 * runtime (GET /app/personas). Resolves to `undefined` data when signed out or the
 * endpoint isn't reachable yet, so consumers degrade gracefully (the chat header
 * falls back to the atproto profile name). Never throws.
 */
export function usePersonasQuery() {
  return useQuery<PersonasState | undefined>({
    queryKey: createPersonasQueryKey(),
    queryFn: async () => {
      const result = await fetchPersonas()
      return result.state
    },
    staleTime: STALE.MINUTES.ONE,
  })
}

function useInvalidatePersonas() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({queryKey: createPersonasQueryKey()})
}

export function useCreatePersonaMutation() {
  const invalidate = useInvalidatePersonas()
  return useMutation({
    mutationFn: (input: {name: string; voiceId?: string; personality?: string}) =>
      createPersona(input),
    onSuccess: invalidate,
  })
}

export function useUpdatePersonaMutation() {
  const invalidate = useInvalidatePersonas()
  return useMutation({
    mutationFn: (input: {
      id: string
      name?: string
      voiceId?: string
      personality?: string
      fiction?: PersonaFiction
    }) => updatePersona(input),
    onSuccess: invalidate,
  })
}

export function useDeletePersonaMutation() {
  const invalidate = useInvalidatePersonas()
  return useMutation({
    mutationFn: (input: {id: string}) => deletePersona(input),
    onSuccess: invalidate,
  })
}

export function useSetActivePersonaMutation() {
  const invalidate = useInvalidatePersonas()
  return useMutation({
    mutationFn: (input: {id: string}) => setActivePersona(input),
    onSuccess: invalidate,
  })
}
