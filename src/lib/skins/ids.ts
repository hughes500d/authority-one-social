import {type SkinId} from '#/lib/skins/types'

/**
 * Pure skin-id helpers, deliberately free of any skin DEFINITION imports (which
 * transitively pull the heavy `#/alf` -> Layout graph). Kept separate so the
 * id/migration logic is unit-testable on its own and so the skins <-> alf
 * require cycle has a pure leaf.
 */

/** The stock app look (no overlay). Its tokens are the app's base themes. */
export const DEFAULT_SKIN_ID: SkinId = 'default'

/**
 * Map the legacy `themePack` persisted value onto a skin id. Existing installs
 * stored `themePack: 'authorityOne' | 'default'` before skins existed; this lets
 * them resolve to the right skin without a destructive schema migration.
 */
export function skinIdFromLegacyThemePack(
  themePack: string | undefined,
): SkinId {
  return themePack === 'authorityOne' ? 'authority' : DEFAULT_SKIN_ID
}

/**
 * Inverse of {@link skinIdFromLegacyThemePack}: the legacy `themePack` value to
 * keep in sync when a skin is selected, so any not-yet-migrated reader of
 * `themePack` still renders the correct look.
 */
export function legacyThemePackFromSkinId(
  id: SkinId,
): 'default' | 'authorityOne' {
  return id === 'authority' ? 'authorityOne' : 'default'
}
