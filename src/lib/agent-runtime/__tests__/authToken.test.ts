import {beforeEach, describe, expect, it, jest} from '@jest/globals'

// SINGLE-LOGIN (2026-06-30): the runtime bearer is the atproto/PDS access token
// read from the persisted session. These tests pin that contract, including the
// regression-critical part: the legacy setSupabaseTokenProvider shim is a no-op
// and can NEVER override the atproto token again.
jest.mock('#/state/persisted', () => ({get: jest.fn()}))

import * as persisted from '#/state/persisted'
import {
  getAgentRuntimeAccessToken,
  getSupabaseAccessToken,
  setSupabaseTokenProvider,
} from '../authToken'

const mockGet = jest.mocked(persisted.get)

function session(accessJwt?: string) {
  return {currentAccount: accessJwt ? {accessJwt} : undefined} as ReturnType<
    typeof persisted.get
  >
}

describe('agent-runtime token provider (single-login)', () => {
  beforeEach(() => {
    mockGet.mockReset()
  })

  it('returns the persisted atproto access token', async () => {
    mockGet.mockReturnValue(session('ATPROTO_JWT_XYZ'))
    await expect(getAgentRuntimeAccessToken()).resolves.toBe('ATPROTO_JWT_XYZ')
    expect(mockGet).toHaveBeenCalledWith('session')
  })

  it('returns null when signed out (no session / no current account)', async () => {
    mockGet.mockReturnValue(undefined as ReturnType<typeof persisted.get>)
    await expect(getAgentRuntimeAccessToken()).resolves.toBeNull()

    mockGet.mockReturnValue(session(undefined))
    await expect(getAgentRuntimeAccessToken()).resolves.toBeNull()
  })

  it('returns null (never throws) when persisted storage fails', async () => {
    mockGet.mockImplementation(() => {
      throw new Error('storage exploded')
    })
    await expect(getAgentRuntimeAccessToken()).resolves.toBeNull()
  })

  it('getSupabaseAccessToken is an alias for the atproto token getter', () => {
    expect(getSupabaseAccessToken).toBe(getAgentRuntimeAccessToken)
  })

  it('setSupabaseTokenProvider is a no-op and cannot override the atproto token', async () => {
    mockGet.mockReturnValue(session('ATPROTO_JWT_XYZ'))
    setSupabaseTokenProvider(() => Promise.resolve('LEGACY_SUPABASE_TOKEN'))
    await expect(getSupabaseAccessToken()).resolves.toBe('ATPROTO_JWT_XYZ')
  })
})
