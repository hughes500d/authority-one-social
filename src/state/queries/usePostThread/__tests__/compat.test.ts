import {type BskyAgent} from '@atproto/api'
import {beforeEach, describe, expect, it, jest} from '@jest/globals'

import {getPostThreadV2Compat, resetPostThreadCompatForTests} from '../compat'

const OP_DID = 'did:plc:op'
const OTHER_DID = 'did:plc:other'

function post(
  did: string,
  rkey: string,
  {
    reply,
    likeCount = 0,
    createdAt = '2026-07-01T00:00:00.000Z',
    replyCount = 0,
  }: {
    reply?: {rootUri: string; parentUri: string}
    likeCount?: number
    createdAt?: string
    replyCount?: number
  } = {},
) {
  const uri = `at://${did}/app.bsky.feed.post/${rkey}`
  return {
    $type: 'app.bsky.feed.defs#postView' as const,
    uri,
    cid: `cid-${rkey}`,
    author: {did, handle: `${did.slice(8)}.test`},
    record: {
      $type: 'app.bsky.feed.post',
      text: rkey,
      createdAt,
      ...(reply
        ? {
            reply: {
              root: {uri: reply.rootUri, cid: 'cid-root'},
              parent: {uri: reply.parentUri, cid: 'cid-parent'},
            },
          }
        : {}),
    },
    likeCount,
    replyCount,
    indexedAt: createdAt,
  }
}

function tvp(p: ReturnType<typeof post>, extra: object = {}) {
  return {
    $type: 'app.bsky.feed.defs#threadViewPost' as const,
    post: p,
    ...extra,
  }
}

function makeAgent({
  v2Error,
  v1Response,
  v1Error,
}: {
  v2Error?: Error & {status?: number; error?: string}
  v1Response?: unknown
  v1Error?: Error & {error?: string}
}) {
  const v2 = jest.fn(() =>
    v2Error
      ? Promise.reject(v2Error)
      : Promise.resolve({data: {thread: [], hasOtherReplies: false}}),
  )
  const v1 = jest.fn(() =>
    v1Error ? Promise.reject(v1Error) : Promise.resolve({data: v1Response}),
  )
  return {
    agent: {
      app: {bsky: {unspecced: {getPostThreadV2: v2}}},
      getPostThread: v1,
    } as unknown as BskyAgent,
    v2,
    v1,
  }
}

function methodNotImplemented() {
  const e = new Error('app.bsky.unspecced.getPostThreadV2') as Error & {
    status: number
    error: string
  }
  e.status = 501
  e.error = 'MethodNotImplemented'
  return e
}

beforeEach(() => {
  resetPostThreadCompatForTests()
})

describe('getPostThreadV2Compat', () => {
  it('uses V2 when the server implements it', async () => {
    const {agent, v2, v1} = makeAgent({})
    const res = await getPostThreadV2Compat(agent, {anchor: 'at://x'})
    expect(res.data.thread).toEqual([])
    expect(v2).toHaveBeenCalledTimes(1)
    expect(v1).not.toHaveBeenCalled()
  })

  it('rethrows non-501 V2 errors instead of falling back', async () => {
    const upstream = new Error('boom') as Error & {status: number}
    upstream.status = 500
    const {agent} = makeAgent({v2Error: upstream})
    await expect(
      getPostThreadV2Compat(agent, {anchor: 'at://x'}),
    ).rejects.toThrow('boom')
  })

  it('falls back to V1 on MethodNotImplemented and flattens the tree', async () => {
    const anchorUri = `at://${OP_DID}/app.bsky.feed.post/anchor`
    const anchor = post(OP_DID, 'anchor', {replyCount: 2})
    const r1 = post(OTHER_DID, 'r1', {
      reply: {rootUri: anchorUri, parentUri: anchorUri},
      likeCount: 5,
      createdAt: '2026-07-01T01:00:00.000Z',
    })
    const r2 = post(OP_DID, 'r2', {
      reply: {rootUri: anchorUri, parentUri: anchorUri},
      likeCount: 1,
      createdAt: '2026-07-01T02:00:00.000Z',
      replyCount: 0,
    })
    const r1a = post(OP_DID, 'r1a', {
      reply: {rootUri: anchorUri, parentUri: r1.uri},
    })

    const {agent, v2, v1} = makeAgent({
      v2Error: methodNotImplemented(),
      v1Response: {
        thread: tvp(anchor, {
          replies: [tvp(r2), tvp(r1, {replies: [tvp(r1a)]})],
        }),
      },
    })

    const res = await getPostThreadV2Compat(agent, {
      anchor: anchorUri,
      below: 6,
      sort: 'top',
    })
    expect(v2).toHaveBeenCalledTimes(1)
    expect(v1).toHaveBeenCalledTimes(1)

    const items = res.data.thread
    // anchor first at depth 0, then DFS: r1 (5 likes) before r2, r1a under r1
    expect(items.map(i => [i.uri.split('/').pop(), i.depth])).toEqual([
      ['anchor', 0],
      ['r1', 1],
      ['r1a', 2],
      ['r2', 1],
    ])
    for (const item of items) {
      expect(item.$type).toBe('app.bsky.unspecced.getPostThreadV2#threadItem')
      expect(item.value.$type).toBe('app.bsky.unspecced.defs#threadItemPost')
    }
    // opThread: contiguous OP chain — anchor yes; r1 (other author) no; r1a is
    // OP-authored but under a non-OP parent; r2 directly under the OP anchor.
    const opFlags = items.map(i => (i.value as {opThread?: boolean}).opThread)
    expect(opFlags).toEqual([true, false, false, true])

    // remembers V2 is unsupported: second call goes straight to V1
    await getPostThreadV2Compat(agent, {anchor: anchorUri})
    expect(v2).toHaveBeenCalledTimes(1)
    expect(v1).toHaveBeenCalledTimes(2)
  })

  it('flattens the parent chain root-first at negative depths', async () => {
    const rootUri = `at://${OP_DID}/app.bsky.feed.post/root`
    const root = post(OP_DID, 'root')
    const mid = post(OTHER_DID, 'mid', {
      reply: {rootUri, parentUri: rootUri},
    })
    const anchor = post(OP_DID, 'anchor', {
      reply: {rootUri, parentUri: mid.uri},
    })

    const {agent} = makeAgent({
      v2Error: methodNotImplemented(),
      v1Response: {
        thread: tvp(anchor, {parent: tvp(mid, {parent: tvp(root)})}),
      },
    })

    const res = await getPostThreadV2Compat(agent, {anchor: anchor.uri})
    expect(res.data.thread.map(i => [i.uri.split('/').pop(), i.depth])).toEqual(
      [
        ['root', -2],
        ['mid', -1],
        ['anchor', 0],
      ],
    )
    // fully hydrated chain: nothing above the root
    expect(
      (res.data.thread[0].value as {moreParents?: boolean}).moreParents,
    ).toBe(false)
  })

  it('maps a notFound anchor to a graceful threadItemNotFound (no throw)', async () => {
    const uri = 'at://did:plc:x/app.bsky.feed.post/gone'
    const {agent} = makeAgent({
      v2Error: methodNotImplemented(),
      v1Response: {
        thread: {
          $type: 'app.bsky.feed.defs#notFoundPost',
          uri,
          notFound: true,
        },
      },
    })
    const res = await getPostThreadV2Compat(agent, {anchor: uri})
    expect(res.data.thread).toHaveLength(1)
    expect(res.data.thread[0].depth).toBe(0)
    expect(res.data.thread[0].value.$type).toBe(
      'app.bsky.unspecced.defs#threadItemNotFound',
    )
  })

  it('maps a V1 NotFound ERROR to the graceful shape too', async () => {
    const uri = 'at://did:plc:x/app.bsky.feed.post/gone'
    const notFound = new Error('Post not found') as Error & {error: string}
    notFound.error = 'NotFound'
    const {agent} = makeAgent({
      v2Error: methodNotImplemented(),
      v1Error: notFound,
    })
    const res = await getPostThreadV2Compat(agent, {anchor: uri})
    expect(res.data.thread[0].value.$type).toBe(
      'app.bsky.unspecced.defs#threadItemNotFound',
    )
  })

  it('respects branchingFactor and reports unhydrated replies', async () => {
    const anchorUri = `at://${OP_DID}/app.bsky.feed.post/anchor`
    const anchor = post(OP_DID, 'anchor', {replyCount: 3})
    const kids = ['a', 'b', 'c'].map((k, i) =>
      post(OTHER_DID, k, {
        reply: {rootUri: anchorUri, parentUri: anchorUri},
        createdAt: `2026-07-0${i + 1}T00:00:00.000Z`,
      }),
    )
    const {agent} = makeAgent({
      v2Error: methodNotImplemented(),
      v1Response: {thread: tvp(anchor, {replies: kids.map(k => tvp(k))})},
    })
    const res = await getPostThreadV2Compat(agent, {
      anchor: anchorUri,
      branchingFactor: 1,
      sort: 'oldest',
    })
    expect(res.data.thread.map(i => i.uri.split('/').pop())).toEqual([
      'anchor',
      'a',
    ])
    expect(
      (res.data.thread[0].value as {moreReplies?: number}).moreReplies,
    ).toBe(2)
  })
})
