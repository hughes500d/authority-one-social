import {describe, expect, it} from '@jest/globals'

import {
  agentActorFromHandle,
  NEUTRAL_AGENT_NAME,
  prettyAgentHandle,
  resolveAgentDisplayName,
} from '../agentDisplayName'

/**
 * The agent's chat-UI name is resolved client-side (no hardcoded persona). Order
 * of preference: atproto profile displayName -> prettified routing handle ->
 * neutral default. These pin that contract for the pure resolver; the hook
 * (useAgentDisplayName) just feeds it the live profile + PDS host.
 */
describe('resolveAgentDisplayName', () => {
  it('prefers the profile displayName when present', () => {
    expect(
      resolveAgentDisplayName({profileDisplayName: 'Bob', handle: 'ada'}),
    ).toBe('Bob')
  })

  it('trims the displayName and ignores a blank one', () => {
    expect(
      resolveAgentDisplayName({
        profileDisplayName: '  Ada Lovelace ',
        handle: 'ada',
      }),
    ).toBe('Ada Lovelace')
    expect(
      resolveAgentDisplayName({profileDisplayName: '   ', handle: 'ada'}),
    ).toBe('Ada')
  })

  it('falls back to the prettified handle when there is no displayName', () => {
    expect(resolveAgentDisplayName({handle: 'ada'})).toBe('Ada')
  })

  it('falls back to a neutral default (never a hardcoded persona) when nothing is available', () => {
    expect(resolveAgentDisplayName({})).toBe(NEUTRAL_AGENT_NAME)
    expect(resolveAgentDisplayName({})).not.toBe('Bob')
  })
})

describe('prettyAgentHandle', () => {
  it('capitalizes the routing id', () => {
    expect(prettyAgentHandle('ada')).toBe('Ada')
  })

  it('returns undefined for missing/blank input', () => {
    expect(prettyAgentHandle(undefined)).toBeUndefined()
    expect(prettyAgentHandle('   ')).toBeUndefined()
  })
})

describe('agentActorFromHandle', () => {
  it('forms <id>.<pdsHost> from a bare routing id', () => {
    expect(agentActorFromHandle('ada', 'pds.authority-one.com')).toBe(
      'ada.pds.authority-one.com',
    )
  })

  it('uses an already-qualified handle as-is', () => {
    expect(
      agentActorFromHandle('ada.pds.authority-one.com', 'pds.authority-one.com'),
    ).toBe('ada.pds.authority-one.com')
  })

  it('returns undefined for missing/blank input', () => {
    expect(agentActorFromHandle(undefined, 'pds.authority-one.com')).toBeUndefined()
    expect(agentActorFromHandle('  ', 'pds.authority-one.com')).toBeUndefined()
  })
})
