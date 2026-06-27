import type * as DynamicAppIcon from '@bsky.app/expo-dynamic-app-icon'

import {type Theme as LegacyTheme} from '#/lib/ThemeContext'
import {type authorityOneThemes} from '#/alf/themes-authority-one'

/**
 * Skin system — types.
 *
 * A "skin" is a named, fully self-contained reskin of the app: a palette
 * (light + dark + dim), an optional display/heading font, an optional
 * pre-bundled alternate app icon, and the metadata the picker needs to show it.
 *
 * Design goal: adding a brand-new skin is a SINGLE registry entry (see
 * `./registry.ts`) plus its definition file. Nothing else in the app should
 * need to branch on a specific skin id. Theme consumers read the *active*
 * skin's tokens through `useSkin()` (see `#/state/skin`), never hardcoded
 * brand tokens.
 */

/**
 * Skin ids are plain strings (not a closed enum) on purpose: new skins can be
 * registered without touching the persisted schema or any union type. Unknown
 * ids resolve to {@link DEFAULT_SKIN_ID} at the registry boundary.
 */
export type SkinId = string

/** The ALF theme set ({light, dark, dim}) a skin overlays onto the app. */
export type AlfThemeSet = typeof authorityOneThemes

/** The legacy `#/lib/ThemeContext` theme set a skin overlays. */
export type LegacyThemeSet = {
  default: LegacyTheme
  dark: LegacyTheme
  dim: LegacyTheme
}

/**
 * A display/heading font, expressed once with all the per-platform match keys.
 * Resolved to a single platform-appropriate `fontFamily` string by
 * `resolveHeadingFontFamily` in `./fonts.ts`.
 */
export type SkinHeadingFont = {
  /** name-table FAMILY name (Android match key + web fallback head). */
  family: string
  /** name-table POSTSCRIPT name (the reliable iOS match key). */
  postScriptName: string
  /** web `font-family` stack (family + serif/sans fallbacks). */
  webStack: string
}

/** Two colors shown as the skin's swatch in the picker (works in light + dark). */
export type SkinSwatch = {
  /** the skin's page background / paper color. */
  background: string
  /** the skin's accent / primary color. */
  accent: string
}

export type SkinDefinition = {
  /** Stable id, persisted as the active selection. */
  id: SkinId
  /**
   * Human-readable name shown in the picker. PLAIN STRING (not a Lingui macro)
   * on purpose: brand/skin names are proper nouns that should not be translated
   * or depend on the compiled message catalog (see the appearance-labels
   * regression test).
   */
  displayName: string

  /**
   * ALF theme overlay ({light, dark, dim}). `undefined` = use the app's base
   * ALF themes (the stock look).
   */
  alfThemes?: AlfThemeSet
  /**
   * Legacy `#/lib/ThemeContext` overlay. `undefined` = use the base legacy
   * themes. Covers the remaining `usePalette()`/ThemeContext consumers.
   */
  legacyThemes?: LegacyThemeSet
  /**
   * Display/heading font. `undefined` = no override (the default UI font is
   * used for headings too).
   */
  headingFont?: SkinHeadingFont

  /**
   * Pre-bundled alternate app icon id (must be registered with the
   * `@bsky.app/expo-dynamic-app-icon` config plugin in `app.config.js`).
   *
   *  - a string id  -> switch to that icon (`DynamicAppIcon.setAppIcon(id)`)
   *  - `null`       -> explicitly reset to the primary/bundled app icon
   *  - `undefined`  -> do NOT touch the app icon (the skin's icon asset is not
   *                    in hand yet, OR the skin intentionally inherits whatever
   *                    icon the user has chosen)
   */
  alternateIconName?: DynamicAppIcon.IconName | null

  /** Color swatch shown next to the name in the picker. */
  swatch: SkinSwatch

  /**
   * When true, the skin is registered on PLACEHOLDER tokens and its real brand
   * assets (hex/font/icon/thumbnail) are not in hand yet. The picker surfaces
   * this so a stand-in skin is never mistaken for the finished look.
   */
  pending?: boolean
}
