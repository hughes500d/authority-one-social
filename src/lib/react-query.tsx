import {useEffect, useRef, useState} from 'react'
import {AppState, type AppStateStatus} from 'react-native'
import {createAsyncStoragePersister} from '@tanstack/query-async-storage-persister'
import {focusManager, onlineManager, QueryClient} from '@tanstack/react-query'
import {
  type PersistedClient,
  type PersistQueryClientOptions,
  PersistQueryClientProvider,
  type PersistQueryClientProviderProps,
} from '@tanstack/react-query-persist-client'

import {createPersistedQueryStorage} from '#/lib/persisted-query-storage'
import {listenNetworkConfirmed, listenNetworkLost} from '#/state/events'
import {isQueryPersisted} from '#/state/queries/util'
import * as env from '#/env'
import {IS_NATIVE, IS_WEB} from '#/env'

declare global {
  interface Window {
    // eslint-disable-next-line  @typescript-eslint/consistent-type-imports
    __TANSTACK_QUERY_CLIENT__: import('@tanstack/query-core').QueryClient
  }
}

async function checkIsOnline(): Promise<boolean> {
  try {
    const controller = new AbortController()
    setTimeout(() => {
      controller.abort()
    }, 15e3)
    const res = await fetch('https://public.api.bsky.app/xrpc/_health', {
      cache: 'no-store',
      signal: controller.signal,
    })
    const json = await res.json()
    if (json.version) {
      return true
    } else {
      return false
    }
  } catch (e) {
    return false
  }
}

let receivedNetworkLost = false
let receivedNetworkConfirmed = false
let isNetworkStateUnclear = false

listenNetworkLost(() => {
  receivedNetworkLost = true
  onlineManager.setOnline(false)
})

listenNetworkConfirmed(() => {
  receivedNetworkConfirmed = true
  onlineManager.setOnline(true)
})

let checkPromise: Promise<void> | undefined
function checkIsOnlineIfNeeded() {
  if (checkPromise) {
    return
  }
  receivedNetworkLost = false
  receivedNetworkConfirmed = false
  checkPromise = checkIsOnline().then(nextIsOnline => {
    checkPromise = undefined
    if (nextIsOnline && receivedNetworkLost) {
      isNetworkStateUnclear = true
    }
    if (!nextIsOnline && receivedNetworkConfirmed) {
      isNetworkStateUnclear = true
    }
    if (!isNetworkStateUnclear) {
      onlineManager.setOnline(nextIsOnline)
    }
  })
}

setInterval(() => {
  if (AppState.currentState === 'active') {
    if (!onlineManager.isOnline() || isNetworkStateUnclear) {
      checkIsOnlineIfNeeded()
    }
  }
}, 2000)

focusManager.setEventListener(onFocus => {
  if (IS_NATIVE) {
    const subscription = AppState.addEventListener(
      'change',
      (status: AppStateStatus) => {
        focusManager.setFocused(status === 'active')
      },
    )

    return () => subscription.remove()
  } else if (typeof window !== 'undefined' && window.addEventListener) {
    // these handlers are a bit redundant but focus catches when the browser window
    // is blurred/focused while visibilitychange seems to only handle when the
    // window minimizes (both of them catch tab changes)
    // there's no harm to redundant fires because refetchOnWindowFocus is only
    // used with queries that employ stale data times
    const handler = () => onFocus()
    window.addEventListener('focus', handler, false)
    window.addEventListener('visibilitychange', handler, false)
    return () => {
      window.removeEventListener('visibilitychange', handler)
      window.removeEventListener('focus', handler)
    }
  }
})

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        // NOTE
        // refetchOnWindowFocus breaks some UIs (like feeds)
        // so we only selectively want to enable this
        // -prf
        refetchOnWindowFocus: false,
        // Structural sharing between responses makes it impossible to rely on
        // "first seen" timestamps on objects to determine if they're fresh.
        // Disable this optimization so that we can rely on "first seen" timestamps.
        structuralSharing: false,
        // We don't want to retry queries by default, because in most cases we
        // want to fail early and show a response to the user. There are
        // exceptions, and those can be made on a per-query basis. For others, we
        // should give users controls to retry.
        retry: false,
      },
    },
  })

// Query roots whose data is post/feed content. These must NEVER be persisted
// or hydrated from a persisted payload: feed queries use staleTime INFINITY,
// so a hydrated feed page renders a stale timeline that never revalidates.
// Older deployed builds wrote feed queries into the persisted cache, and the
// buster (app version) never changed, so those payloads survived every
// update until users manually cleared IndexedDB.
const NEVER_PERSIST_QUERY_ROOTS = new Set<unknown>([
  'post-feed',
  'post-thread-v2',
  'notification-feed',
  'search-posts',
])

// Bump to drop every previously persisted query cache on next app load.
const PERSIST_CACHE_GENERATION = 2

function isSafeToPersist(queryKey: readonly unknown[]): boolean {
  return (
    isQueryPersisted(queryKey) && !NEVER_PERSIST_QUERY_ROOTS.has(queryKey[0])
  )
}

const dehydrateOptions: PersistQueryClientProviderProps['persistOptions']['dehydrateOptions'] =
  {
    shouldDehydrateMutation: (_: any) => false,
    shouldDehydrateQuery: query => {
      return isSafeToPersist(query.queryKey)
    },
  }

// Hydration does NOT re-apply shouldDehydrateQuery, so a payload written by
// an older build can restore queries the current rules would never persist.
// Filter at restore time as well.
function deserializePersistedClient(cached: string): PersistedClient {
  const client = JSON.parse(cached) as PersistedClient
  if (client?.clientState?.queries) {
    client.clientState.queries = client.clientState.queries.filter(q =>
      isSafeToPersist(q.queryKey),
    )
  }
  return client
}

export function QueryProvider({
  children,
  currentDid,
}: {
  children: React.ReactNode
  currentDid: string | undefined
}) {
  return (
    <QueryProviderInner
      // Enforce we never reuse cache between users.
      // These two props MUST stay in sync.
      key={currentDid}
      currentDid={currentDid}>
      {children}
    </QueryProviderInner>
  )
}

function QueryProviderInner({
  children,
  currentDid,
}: {
  children: React.ReactNode
  currentDid: string | undefined
}) {
  const initialDid = useRef(currentDid)
  if (currentDid !== initialDid.current) {
    throw Error(
      'Something is very wrong. Expected did to be stable due to key above.',
    )
  }
  // We create the query client here so that it's scoped to a specific DID.
  // Do not move the query client creation outside of this component.
  const [queryClient, _setQueryClient] = useState(() => createQueryClient())
  const [persistOptions, _setPersistOptions] = useState(() => {
    const storage = createPersistedQueryStorage(currentDid ?? 'logged-out')
    const asyncPersister = createAsyncStoragePersister({
      storage,
      key: 'queryClient-' + (currentDid ?? 'logged-out'),
      deserialize: deserializePersistedClient,
    })
    return {
      persister: asyncPersister,
      dehydrateOptions,
      // The persisted queries all have short staleTimes, so they revalidate
      // shortly after being restored; maxAge is a hard ceiling on top of
      // that (the library default is 24h).
      maxAge: 1000 * 60 * 60,
      buster: `${env.APP_VERSION}-${PERSIST_CACHE_GENERATION}`,
    } satisfies Omit<PersistQueryClientOptions, 'queryClient'>
  })
  useEffect(() => {
    if (IS_WEB) {
      // WARNING, BROKEN
      // something since v5.32.0 causes OOMs. not important
      // so disable for now
      // window.__TANSTACK_QUERY_CLIENT__ = queryClient
    }
  }, [queryClient])
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={persistOptions}>
      {children}
    </PersistQueryClientProvider>
  )
}
