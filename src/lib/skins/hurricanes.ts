import {createThemes, DEFAULT_PALETTE, DEFAULT_SUBDUED_PALETTE} from '@bsky.app/alf'

import {type LegacyThemeSet, type SkinDefinition} from '#/lib/skins/types'
import {darkTheme, defaultTheme, dimTheme} from '#/lib/themes'

/**
 * ============================================================================
 *  Carolina Hurricanes skin  -- LIVE.
 * ============================================================================
 *
 * Authentic brand assets are wired in:
 *   - HEX     official Hurricanes red #CE1126 (anchors the primary ramp + swatch);
 *             white is the second tone.
 *   - FONT    "NHL Carolina" (static cut) bundled via `expo-font` in app.config.js,
 *             used ONLY as `headingFont` (team name / headings / numbers). The face
 *             is UPPERCASE + NUMERALS ONLY, so body text stays on the default sans.
 *   - ICON    "Stormy" alternate app icon registered as `skin_hurricanes` in the
 *             `@bsky.app/expo-dynamic-app-icon` plugin block.
 *
 * NOTE: the Stormy icon source is 1024x1024 opaque RGB (alpha-free, as iOS
 * requires) but is the mascot art as supplied; both the icon and the NHL Carolina
 * font are team IP pending a license decision (tracked separately, does not block
 * the build). See the `TODO` in app.config.js for the higher-res/licensed swap.
 *
 * Brand values live in the `=== BRAND TOKENS ===` block below -- one place to edit.
 */

// === BRAND TOKENS ==========================================================
const HURRICANES = {
  /** Official Carolina Hurricanes red. */
  red: '#CE1126',
  /** Second tone: white. */
  background: '#FFFFFF',
}

// Heading face internal names (see app.config.js NHL Carolina registration).
// Family is the Android/web match key; PostScript is the reliable iOS match key
// (mirrors the Fraunces approach in #/alf/fonts-authority-one).
const HURRICANES_HEADING_FONT = 'NHL Carolina'
const HURRICANES_HEADING_FONT_POSTSCRIPT = 'NHLCarolina'

/** Primary red ramp anchored on the brand red at 500 (lightness steps around it). */
const HURRICANES_RED_RAMP = {
  primary_25: '#FDF2F4',
  primary_50: '#FBE0E4',
  primary_100: '#F5BAC2',
  primary_200: '#EC8995',
  primary_300: '#E15568',
  primary_400: '#D72E45',
  primary_500: '#CE1126', // HURRICANES.red
  primary_600: '#B00E20',
  primary_700: '#8E0B1A',
  primary_800: '#6E0814',
  primary_900: '#50060F',
  primary_950: '#3A040B',
  primary_975: '#280307',
}
// ===========================================================================

// --- ALF themes (built from the base palette + the brand red ramp) ----------
const HURRICANES_PALETTE = {...DEFAULT_PALETTE, ...HURRICANES_RED_RAMP}
const HURRICANES_SUBDUED_PALETTE = {
  ...DEFAULT_SUBDUED_PALETTE,
  ...HURRICANES_RED_RAMP,
}
const hurricanesAlfThemes = createThemes({
  defaultPalette: HURRICANES_PALETTE,
  subduedPalette: HURRICANES_SUBDUED_PALETTE,
})

// --- Legacy ThemeContext themes (clone base, repoint link/primary to red) ---
function withRedLink<T extends typeof defaultTheme>(base: T): T {
  return {
    ...base,
    palette: {
      ...base.palette,
      default: {
        ...base.palette.default,
        link: HURRICANES_RED_RAMP.primary_500,
      },
      primary: {
        ...base.palette.primary,
        background: HURRICANES_RED_RAMP.primary_500,
        backgroundLight: HURRICANES_RED_RAMP.primary_400,
        border: HURRICANES_RED_RAMP.primary_600,
      },
    },
  }
}

const hurricanesLegacyThemes: LegacyThemeSet = {
  default: withRedLink(defaultTheme),
  dark: withRedLink(darkTheme),
  dim: withRedLink(dimTheme),
}

export const hurricanesSkin: SkinDefinition = {
  id: 'hurricanes',
  displayName: 'Carolina Hurricanes',

  alfThemes: hurricanesAlfThemes,
  legacyThemes: hurricanesLegacyThemes,

  // Display face for headings only (uppercase + numerals); body stays default.
  headingFont: {
    family: HURRICANES_HEADING_FONT,
    postScriptName: HURRICANES_HEADING_FONT_POSTSCRIPT,
    webStack: `'${HURRICANES_HEADING_FONT}', 'Arial Narrow', Impact, sans-serif`,
  },

  // Pre-bundled "Stormy" alternate app icon (registered in app.config.js).
  alternateIconName: 'skin_hurricanes',

  swatch: {
    background: HURRICANES.background,
    accent: HURRICANES.red,
  },

  // Live: authentic red + NHL Carolina font + Stormy icon are all wired.
  pending: false,
}
