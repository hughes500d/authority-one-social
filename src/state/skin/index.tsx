import {createContext, useContext, useEffect, useMemo, useState} from 'react'

import {
  applySkinAppIcon,
  DEFAULT_SKIN_ID,
  getSkin,
  legacyThemePackFromSkinId,
  resolveHeadingFontFamily,
  type SkinDefinition,
  type SkinId,
  skinIdFromLegacyThemePack,
} from '#/lib/skins'
import * as persisted from '#/state/persisted'

/**
 * Active-skin state.
 *
 * The persisted `activeSkin` key (a free-form skin id string) is the canonical
 * pointer to the current skin. For installs that predate the skin system, the
 * legacy `themePack` value is used as a one-time seed (so an existing Authority
 * One user keeps their look without any destructive migration).
 *
 * `useSkin()` resolves that id to a full `SkinDefinition` from the registry --
 * this is the single thing theme/font consumers read.
 */

function readInitialSkinId(): SkinId {
  const stored = persisted.get('activeSkin')
  if (stored) return stored
  // Legacy seed: themePack -> skin id.
  return skinIdFromLegacyThemePack(persisted.get('themePack'))
}

type StateContext = {
  skinId: SkinId
  skin: SkinDefinition
}
type SetContext = {
  setSkin: (id: SkinId) => void
}

// Defaults are `null` (resolved from the registry at render time, never at
// module-eval) so this module participates in the skins <-> alf require graph
// without touching the registry before it has initialized.
const stateContext = createContext<StateContext | null>(null)
stateContext.displayName = 'SkinStateContext'
const setContext = createContext<SetContext | null>(null)
setContext.displayName = 'SkinSetContext'

export function Provider({children}: React.PropsWithChildren<{}>) {
  const [skinId, setSkinId] = useState(readInitialSkinId)

  const stateContextValue = useMemo<StateContext>(
    () => ({
      skinId,
      skin: getSkin(skinId),
    }),
    [skinId],
  )

  const setContextValue = useMemo<SetContext>(
    () => ({
      setSkin: (id: SkinId) => {
        setSkinId(id)
        void persisted.write('activeSkin', id)
        // Keep the legacy themePack value in sync so any reader that still
        // looks at it stays consistent with the active skin.
        void persisted.write('themePack', legacyThemePackFromSkinId(id))
        // Switch the native app icon to the skin's pre-bundled alternate (if
        // any). No-op on web / for skins whose icon is pending.
        applySkinAppIcon(getSkin(id))
      },
    }),
    [],
  )

  useEffect(() => {
    const unsub = persisted.onUpdate('activeSkin', next => {
      if (next) setSkinId(next)
    })
    return () => unsub()
  }, [])

  return (
    <stateContext.Provider value={stateContextValue}>
      <setContext.Provider value={setContextValue}>
        {children}
      </setContext.Provider>
    </stateContext.Provider>
  )
}

/** The resolved active skin definition (tokens, font, icon, picker metadata). */
export function useSkin(): SkinDefinition {
  const ctx = useContext(stateContext)
  return ctx ? ctx.skin : getSkin(DEFAULT_SKIN_ID)
}

/** The active skin id (for the picker's selected state). */
export function useSkinId(): SkinId {
  return useContext(stateContext)?.skinId ?? DEFAULT_SKIN_ID
}

/** Switch the active skin (persists, syncs legacy themePack, swaps app icon). */
export function useSetSkin(): (id: SkinId) => void {
  const ctx = useContext(setContext)
  return ctx ? ctx.setSkin : noop
}

function noop() {}

/**
 * The active skin's heading/display font resolved to a platform-appropriate
 * `fontFamily` for `<Text fontFamilyOverride>`. `undefined` when the active skin
 * has no display font (the default UI font is used).
 */
export function useSkinHeadingFont(): string | undefined {
  const skin = useSkin()
  return resolveHeadingFontFamily(skin.headingFont)
}
