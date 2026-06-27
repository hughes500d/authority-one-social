import {Platform} from 'react-native'

/**
 * Authority One display / headline font — Fraunces (serif), matching the live
 * marketing site https://authority-one.com whose display headlines render in
 * Fraunces while body/UI stays Inter.
 *
 * Scope: this is applied ONLY to large headline/display-name/title text, and
 * ONLY when the Authority One app theme is active (themePack === 'authorityOne').
 * Body text stays Inter (the site's body face), and the default theme is wholly
 * unaffected. ALF's UI font is global (see `src/alf/fonts.ts`), so rather than
 * swap the global body font to a serif we target specific heading Text nodes via
 * the `fontFamilyOverride` prop on `#/components/Typography`'s `Text`.
 *
 * Font family naming — IMPORTANT for the native bundle:
 *   The face is registered through the `expo-font` config plugin in
 *   `app.config.js`. We register the STATIC instance
 *   `assets/fonts/fraunces/Fraunces-Static.ttf`, NOT the variable
 *   `Fraunces.ttf`: the Google Fonts file is a variable font (axes
 *   opsz/wght/SOFT/WONK, default instance "Fraunces 9pt Black"), and React
 *   Native / iOS do not reliably register variable `.ttf`s — they silently
 *   fall back to the system sans, which is the bug this fixes.
 *   The static cut's internal names are: family (name 1) = "Fraunces",
 *   full (name 4) = "Fraunces", PostScript (name 6) = "Fraunces-Regular".
 *
 *   iOS MATCH KEY — use the PostScript name, not the family name. The original
 *   bug was NOT a family-name typo (the family is correctly "Fraunces"); it was
 *   that the *variable* `Fraunces.ttf` ALSO declares family "Fraunces", and when
 *   both faces are registered, an iOS `fontFamily:'Fraunces'` request carrying a
 *   bold/semibold weight (our headings use `font_bold`/`font_semi_bold`)
 *   weight-matches within the family and resolves to the variable Black (900)
 *   face — which iOS cannot reliably render from a UIAppFonts-bundled variable
 *   TTF, so it falls back to the system sans. Targeting the UNIQUE PostScript
 *   name "Fraunces-Regular" pins the exact static face and bypasses family-level
 *   weight resolution entirely. (We also stop bundling the variable file — see
 *   app.config.js / the native project — so the collision can't recur.)
 *
 *   Android registers/matches by the family name "Fraunces"; web uses a serif
 *   stack headed by the family name. Only iOS needs the PostScript name. The
 *   guard test `fonts-authority-one.test.ts` asserts BOTH the family and the
 *   PostScript name against the actual font file. If the file is NOT bundled, RN
 *   falls back to the system font (native) / the serif stack (web) — nothing
 *   breaks, headlines just lose the serif until the build includes the file.
 */
// Internal name-table FAMILY name of the static cut (name ID 1). Used for
// Android matching, the web fallback stack, and the guard test.
export const AUTHORITY_ONE_HEADING_FONT = 'Fraunces'

// Internal name-table POSTSCRIPT name of the static cut (name ID 6). This is the
// reliable iOS match key — unique per face, immune to family-level weight
// resolution. MUST equal the font file's real PostScript name (guard test).
export const AUTHORITY_ONE_HEADING_FONT_POSTSCRIPT = 'Fraunces-Regular'

/**
 * On web we can list a serif fallback stack so headlines read editorial even
 * before the web font is loaded/bundled. On native, fontFamily must be an exact
 * registered family name (no comma-separated fallbacks), so we use the bare
 * family and let RN fall back to the system font if it is missing.
 */
const AUTHORITY_ONE_HEADING_FONT_WEB = `${AUTHORITY_ONE_HEADING_FONT}, Georgia, "Times New Roman", serif`

export function getAuthorityOneHeadingFontFamily(): string {
  switch (Platform.OS) {
    case 'web':
      return AUTHORITY_ONE_HEADING_FONT_WEB
    case 'ios':
      // PostScript name — unique match key, avoids the variable-font family
      // collision that was silently falling back to the system sans.
      return AUTHORITY_ONE_HEADING_FONT_POSTSCRIPT
    default:
      // Android: match by family name.
      return AUTHORITY_ONE_HEADING_FONT
  }
}

/**
 * NOTE: the old `useAuthorityOneHeadingFont` hook moved to the skin system. Use
 * `useSkinHeadingFont` from `#/state/skin`, which resolves whatever display font
 * the ACTIVE skin defines (Fraunces for the Authority skin). This module now
 * holds only the pure Fraunces constants/resolver -- keeping it free of any
 * React/state import avoids a skins <-> fonts import cycle.
 */
