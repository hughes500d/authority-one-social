import {afterEach, describe, expect, it, jest} from '@jest/globals'

import {getSupabaseAccessToken} from '../authToken'
import {
  applyAutoSocialPatch,
  type AutoSocialConfig,
  fetchSocialAutonomy,
  normalizeAutoSocial,
  normalizeFriendOverrides,
  normalizeSocialAutonomyResponse,
  updateSocialAutonomy,
} from '../socialAutonomyClient'

jest.mock('../authToken', () => ({getSupabaseAccessToken: jest.fn()}))

const mockToken = jest.mocked(getSupabaseAccessToken)
const realFetch = global.fetch
afterEach(() => {
  global.fetch = realFetch
  mockToken.mockReset()
})

function jsonRes(body: unknown, status = 200) {
  return jest.fn(() =>
    Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
    }),
  ) as unknown as typeof fetch
}

describe('normalizeAutoSocial (pure)', () => {
  it('fills the full default shape from an empty object', () => {
    expect(normalizeAutoSocial({})).toEqual({
      enabled: true,
      posting: {
        enabled: false,
        time: '09:00',
        cron: null,
        directive: '',
        dailyPostCap: 1,
      },
      comment: {
        enabled: false,
        topics: [],
        probability: 1,
        dailyCommentCap: 5,
        maxThreadDepth: 0,
        freshnessMs: 3600000,
      },
      welcome: {enabled: false, mode: 'comment'},
      friends: {},
      poll: {enabled: false, intervalMin: 15},
    })
  })

  it('carries resolved values through and clamps the poll interval', () => {
    const out = normalizeAutoSocial({
      enabled: false,
      posting: {
        enabled: true,
        time: '18:30',
        cron: '0 6 * * *',
        directive: 'store news',
        dailyPostCap: 3,
      },
      comment: {
        enabled: true,
        topics: ['coffee', '', 'hiking'],
        probability: 7, // clamped to 1
        dailyCommentCap: 10,
        maxThreadDepth: 2,
        freshnessMs: 120000,
      },
      welcome: {enabled: true, mode: 'post'},
      friends: {'ada.example.com': 'always'},
      poll: {enabled: true, intervalMin: 999999},
    })
    expect(out.enabled).toBe(false)
    expect(out.posting).toEqual({
      enabled: true,
      time: '18:30',
      cron: '0 6 * * *',
      directive: 'store news',
      dailyPostCap: 3,
    })
    expect(out.comment.topics).toEqual(['coffee', 'hiking'])
    expect(out.comment.probability).toBe(1)
    expect(out.comment.maxThreadDepth).toBe(2)
    expect(out.welcome).toEqual({enabled: true, mode: 'post'})
    expect(out.friends).toEqual({'ada.example.com': 'always'})
    expect(out.poll).toEqual({enabled: true, intervalMin: 1440})
  })

  it('rejects malformed time and unknown welcome mode', () => {
    const out = normalizeAutoSocial({
      posting: {time: 'sometime'},
      welcome: {mode: 'serenade'},
    })
    expect(out.posting.time).toBe('09:00')
    expect(out.welcome.mode).toBe('comment')
  })
})

describe('normalizeFriendOverrides (pure)', () => {
  it('keeps only always/never rules and lowercases keys', () => {
    expect(
      normalizeFriendOverrides({
        'ADA.Example.Com': 'always',
        'bob.example.com': 'never',
        'junk.example.com': 'sometimes',
        '': 'always',
      }),
    ).toEqual({
      'ada.example.com': 'always',
      'bob.example.com': 'never',
    })
  })

  it('returns {} for non-object shapes', () => {
    expect(normalizeFriendOverrides(null)).toEqual({})
    expect(normalizeFriendOverrides(['always'])).toEqual({})
  })
})

describe('applyAutoSocialPatch (pure, mirrors the runtime merge)', () => {
  const base: AutoSocialConfig = normalizeAutoSocial({
    posting: {enabled: true, directive: 'keep me'},
    friends: {'ada.example.com': 'always'},
  })

  it('merges a section patch without clobbering the rest of the section', () => {
    const next = applyAutoSocialPatch(base, {posting: {dailyPostCap: 4}})
    expect(next.posting.dailyPostCap).toBe(4)
    expect(next.posting.enabled).toBe(true)
    expect(next.posting.directive).toBe('keep me')
    expect(next.friends).toEqual({'ada.example.com': 'always'})
  })

  it('adds and clears friend overrides per-key', () => {
    const added = applyAutoSocialPatch(base, {
      friends: {'bob.example.com': 'never'},
    })
    expect(added.friends).toEqual({
      'ada.example.com': 'always',
      'bob.example.com': 'never',
    })
    const cleared = applyAutoSocialPatch(added, {
      friends: {'ada.example.com': 'default'},
    })
    expect(cleared.friends).toEqual({'bob.example.com': 'never'})
  })

  it('flips the master switch without touching sections', () => {
    const next = applyAutoSocialPatch(base, {enabled: false})
    expect(next.enabled).toBe(false)
    expect(next.posting.directive).toBe('keep me')
  })
})

describe('normalizeSocialAutonomyResponse (pure)', () => {
  it('shapes config + spend, tolerating missing spend', () => {
    const out = normalizeSocialAutonomyResponse({
      autoSocial: {enabled: true},
      todaySpend: {day: '2026-07-04', posts: 2, comments: 1},
    })
    expect(out.autoSocial.enabled).toBe(true)
    expect(out.todaySpend).toEqual({day: '2026-07-04', posts: 2, comments: 1})
    expect(normalizeSocialAutonomyResponse({}).todaySpend).toEqual({
      day: undefined,
      posts: 0,
      comments: 0,
    })
  })
})

describe('fetchSocialAutonomy (transport)', () => {
  it('reports signedOut when there is no token', async () => {
    mockToken.mockResolvedValue(null)
    expect(await fetchSocialAutonomy()).toEqual({signedOut: true})
  })

  it('treats an uncoded 401 as signedOut', async () => {
    mockToken.mockResolvedValue('tok')
    global.fetch = jsonRes({error: 'unauthorized'}, 401)
    expect(await fetchSocialAutonomy('ada.x')).toEqual({signedOut: true})
  })

  it('surfaces a coded 403 as an ownership error, not signedOut', async () => {
    mockToken.mockResolvedValue('tok')
    global.fetch = jsonRes({code: 'not-your-agent', error: 'nope'}, 403)
    const out = await fetchSocialAutonomy('ada.x')
    expect(out.signedOut).toBe(false)
    expect(out.code).toBe('not-your-agent')
  })

  it('returns the normalized state on success and scopes the GET url', async () => {
    mockToken.mockResolvedValue('tok')
    const fetchMock = jsonRes({
      ok: true,
      autoSocial: {enabled: true, posting: {enabled: true}},
      todaySpend: {day: '2026-07-04', posts: 1, comments: 0},
    })
    global.fetch = fetchMock
    const out = await fetchSocialAutonomy('ada.pds.example.com')
    expect(out.state?.autoSocial.posting.enabled).toBe(true)
    expect(out.state?.todaySpend?.posts).toBe(1)
    const [url] = (fetchMock as jest.Mock).mock.calls[0] as [string]
    expect(url).toContain('?agent=ada.pds.example.com')
  })
})

describe('updateSocialAutonomy (transport)', () => {
  it('sends the patch with the agent scope and returns the resolved echo', async () => {
    mockToken.mockResolvedValue('tok')
    const fetchMock = jsonRes({
      ok: true,
      autoSocial: {enabled: true, comment: {enabled: true}},
    })
    global.fetch = fetchMock
    const out = await updateSocialAutonomy(
      {comment: {enabled: true}},
      'ada.pds.example.com',
    )
    expect(out.ok).toBe(true)
    expect(out.autoSocial?.comment.enabled).toBe(true)
    const [, init] = (fetchMock as jest.Mock).mock.calls[0] as [
      string,
      {body: string},
    ]
    expect(JSON.parse(init.body)).toEqual({
      comment: {enabled: true},
      agent: 'ada.pds.example.com',
    })
  })

  it('carries the runtime error message on a non-2xx', async () => {
    mockToken.mockResolvedValue('tok')
    global.fetch = jsonRes({error: 'empty patch'}, 400)
    const out = await updateSocialAutonomy({}, 'ada.x')
    expect(out).toEqual({
      ok: false,
      signedOut: false,
      code: undefined,
      error: 'empty patch',
    })
  })
})
