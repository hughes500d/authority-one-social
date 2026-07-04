import {
  type $Typed,
  AppBskyFeedDefs,
  type AppBskyFeedPost,
  type AppBskyUnspeccedDefs,
  type AppBskyUnspeccedGetPostThreadV2,
  AtUri,
  type BskyAgent,
} from '@atproto/api'

/**
 * app.bsky.unspecced.getPostThreadV2 with a graceful fallback to the stable
 * app.bsky.feed.getPostThread. The Authority One AppView implements only the
 * stable method (V2 returns MethodNotImplemented), while Bluesky's public
 * AppView (the local dev fallback) implements both. Callers get the V2
 * response shape either way.
 */

type ThreadItemV2 = AppBskyUnspeccedGetPostThreadV2.ThreadItem

const DEFAULT_BELOW = 6
const MAX_PARENT_HEIGHT = 80

/** Once the server says MethodNotImplemented, skip straight to V1. */
let v2Unsupported = false

/** Test-only: forget that the server lacked V2. */
export function resetPostThreadCompatForTests() {
  v2Unsupported = false
}

export async function getPostThreadV2Compat(
  agent: BskyAgent,
  params: AppBskyUnspeccedGetPostThreadV2.QueryParams,
): Promise<{data: AppBskyUnspeccedGetPostThreadV2.OutputSchema}> {
  if (!v2Unsupported) {
    try {
      return await agent.app.bsky.unspecced.getPostThreadV2(params)
    } catch (e) {
      if (isMethodNotImplemented(e)) {
        v2Unsupported = true
      } else {
        throw e
      }
    }
  }
  return getPostThreadV1Adapted(agent, params)
}

function isMethodNotImplemented(e: unknown): boolean {
  const err = e as {status?: number; error?: string} | undefined
  return err?.status === 501 || err?.error === 'MethodNotImplemented'
}

function isPostNotFound(e: unknown): boolean {
  const err = e as {error?: string} | undefined
  return err?.error === 'NotFound'
}

/**
 * Fetch via V1 getPostThread and flatten the nested tree into the V2 item
 * list: parents root-first at negative depths, the anchor at depth 0, then
 * replies in depth-first pre-order at positive depths.
 */
async function getPostThreadV1Adapted(
  agent: BskyAgent,
  params: AppBskyUnspeccedGetPostThreadV2.QueryParams,
): Promise<{data: AppBskyUnspeccedGetPostThreadV2.OutputSchema}> {
  const {anchor, above = true, branchingFactor, sort} = params
  const below = params.below ?? DEFAULT_BELOW

  let thread: AppBskyFeedDefs.ThreadViewPost
  let threadgate: AppBskyFeedDefs.ThreadgateView | undefined
  try {
    const res = await agent.getPostThread({
      uri: anchor,
      depth: below,
      parentHeight: above ? MAX_PARENT_HEIGHT : 0,
    })
    threadgate = res.data.threadgate
    const root = res.data.thread
    if (AppBskyFeedDefs.isNotFoundPost(root)) {
      return v2Output([notFoundItem(root.uri, 0)], threadgate)
    } else if (AppBskyFeedDefs.isBlockedPost(root)) {
      return v2Output([blockedItem(root, 0)], threadgate)
    } else if (AppBskyFeedDefs.isThreadViewPost(root)) {
      thread = root
    } else {
      return v2Output([notFoundItem(anchor, 0)], threadgate)
    }
  } catch (e) {
    // Bluesky's AppView 400s with `NotFound`; ours returns a notFoundPost at
    // 200. Normalize the error form to the graceful V2 shape too.
    if (isPostNotFound(e)) {
      return v2Output([notFoundItem(anchor, 0)])
    }
    throw e
  }

  const items: ThreadItemV2[] = []

  // The OP is the author of the thread root. If the anchor is a reply, the
  // root did is baked into its record's reply ref even when the parent chain
  // is truncated.
  const anchorRecord = thread.post.record as AppBskyFeedPost.Record
  const rootUri = anchorRecord.reply?.root?.uri ?? thread.post.uri
  const opDid = new AtUri(rootUri).host

  // Parents: walk up the chain, then emit root-first at depths -N..-1.
  const parents: (
    | $Typed<AppBskyFeedDefs.ThreadViewPost>
    | $Typed<AppBskyFeedDefs.NotFoundPost>
    | $Typed<AppBskyFeedDefs.BlockedPost>
  )[] = []
  let cursor = thread.parent
  while (cursor) {
    if (
      AppBskyFeedDefs.isThreadViewPost(cursor) ||
      AppBskyFeedDefs.isNotFoundPost(cursor) ||
      AppBskyFeedDefs.isBlockedPost(cursor)
    ) {
      parents.unshift(cursor)
      cursor = AppBskyFeedDefs.isThreadViewPost(cursor)
        ? cursor.parent
        : undefined
    } else {
      break
    }
  }
  let parentOp = true
  for (let i = 0; i < parents.length; i++) {
    const parent = parents[i]
    const depth = i - parents.length
    if (AppBskyFeedDefs.isThreadViewPost(parent)) {
      const record = parent.post.record as AppBskyFeedPost.Record
      // The topmost hydrated parent still replies to something we didn't get.
      const moreParents = i === 0 && !!record.reply?.parent
      parentOp = parentOp && parent.post.author.did === opDid
      items.push(
        postItem(parent.post, depth, {
          opThread: parentOp,
          moreParents,
        }),
      )
    } else if (AppBskyFeedDefs.isNotFoundPost(parent)) {
      items.push(notFoundItem(parent.uri, depth))
      parentOp = false
    } else {
      items.push(blockedItem(parent, depth))
      parentOp = false
    }
  }

  // Anchor.
  const anchorOp = parentOp && thread.post.author.did === opDid
  items.push(
    postItem(thread.post, 0, {
      opThread: anchorOp,
      // No hydrated parent, but the record says one exists (above=false or a
      // fetch gap): let the UI offer "read more" upwards.
      moreParents: parents.length === 0 && !!anchorRecord.reply?.parent,
      moreReplies: unhydratedReplyCount(thread, 0, below, branchingFactor),
    }),
  )

  // Replies: depth-first pre-order, respecting sort + branching factor.
  walkReplies(items, thread, 0, anchorOp, {below, branchingFactor, sort, opDid})

  return v2Output(items, threadgate)
}

function walkReplies(
  items: ThreadItemV2[],
  node: AppBskyFeedDefs.ThreadViewPost,
  nodeDepth: number,
  nodeOp: boolean,
  opts: {
    below: number
    branchingFactor?: number
    sort?: string
    opDid: string
  },
) {
  if (nodeDepth >= opts.below) return
  const children = sortReplies(hydratedReplies(node), opts.sort)
  const shown =
    opts.branchingFactor != null
      ? children.slice(0, opts.branchingFactor)
      : children
  for (const child of shown) {
    const childDepth = nodeDepth + 1
    const childOp = nodeOp && child.post.author.did === opts.opDid
    items.push(
      postItem(child.post, childDepth, {
        opThread: childOp,
        moreReplies: unhydratedReplyCount(
          child,
          childDepth,
          opts.below,
          opts.branchingFactor,
        ),
      }),
    )
    walkReplies(items, child, childDepth, childOp, opts)
  }
}

function hydratedReplies(
  node: AppBskyFeedDefs.ThreadViewPost,
): $Typed<AppBskyFeedDefs.ThreadViewPost>[] {
  // V2 omits unavailable replies entirely; match that.
  return (node.replies ?? []).filter(AppBskyFeedDefs.isThreadViewPost)
}

/** How many replies exist on the server that this response won't render. */
function unhydratedReplyCount(
  node: AppBskyFeedDefs.ThreadViewPost,
  depth: number,
  below: number,
  branchingFactor?: number,
): number {
  const total = node.post.replyCount ?? 0
  const shown =
    depth >= below
      ? 0
      : branchingFactor != null
        ? Math.min(branchingFactor, hydratedReplies(node).length)
        : hydratedReplies(node).length
  return Math.max(0, total - shown)
}

function sortReplies(
  replies: $Typed<AppBskyFeedDefs.ThreadViewPost>[],
  sort?: string,
): $Typed<AppBskyFeedDefs.ThreadViewPost>[] {
  const createdAt = (p: AppBskyFeedDefs.ThreadViewPost) =>
    (p.post.record as AppBskyFeedPost.Record).createdAt ?? ''
  const sorted = [...replies]
  if (sort === 'oldest') {
    sorted.sort((a, b) => createdAt(a).localeCompare(createdAt(b)))
  } else if (sort === 'newest') {
    sorted.sort((a, b) => createdAt(b).localeCompare(createdAt(a)))
  } else {
    // 'top' (and anything unrecognized): most-liked first, oldest tiebreak.
    sorted.sort(
      (a, b) =>
        (b.post.likeCount ?? 0) - (a.post.likeCount ?? 0) ||
        createdAt(a).localeCompare(createdAt(b)),
    )
  }
  return sorted
}

function postItem(
  post: AppBskyFeedDefs.PostView,
  depth: number,
  {
    opThread,
    moreParents = false,
    moreReplies = 0,
  }: {opThread: boolean; moreParents?: boolean; moreReplies?: number},
): ThreadItemV2 {
  const value: $Typed<AppBskyUnspeccedDefs.ThreadItemPost> = {
    $type: 'app.bsky.unspecced.defs#threadItemPost',
    post,
    opThread,
    moreParents,
    moreReplies,
    hiddenByThreadgate: false,
    mutedByViewer: post.author.viewer?.muted ?? false,
  }
  return {
    $type: 'app.bsky.unspecced.getPostThreadV2#threadItem',
    uri: post.uri,
    depth,
    value,
  }
}

function notFoundItem(uri: string, depth: number): ThreadItemV2 {
  const value: $Typed<AppBskyUnspeccedDefs.ThreadItemNotFound> = {
    $type: 'app.bsky.unspecced.defs#threadItemNotFound',
  }
  return {
    $type: 'app.bsky.unspecced.getPostThreadV2#threadItem',
    uri,
    depth,
    value,
  }
}

function blockedItem(
  blocked: AppBskyFeedDefs.BlockedPost,
  depth: number,
): ThreadItemV2 {
  const value: $Typed<AppBskyUnspeccedDefs.ThreadItemBlocked> = {
    $type: 'app.bsky.unspecced.defs#threadItemBlocked',
    author: blocked.author,
  }
  return {
    $type: 'app.bsky.unspecced.getPostThreadV2#threadItem',
    uri: blocked.uri,
    depth,
    value,
  }
}

function v2Output(
  thread: ThreadItemV2[],
  threadgate?: AppBskyFeedDefs.ThreadgateView,
): {data: AppBskyUnspeccedGetPostThreadV2.OutputSchema} {
  return {
    data: {
      thread,
      ...(threadgate ? {threadgate} : {}),
      hasOtherReplies: false,
    },
  }
}
