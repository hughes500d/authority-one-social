import {
  createThemes,
  DEFAULT_PALETTE,
  DEFAULT_SUBDUED_PALETTE,
} from '@bsky.app/alf'

/**
 * Authority One demo reskin: red primary ramp replacing Bluesky blue.
 * Lightness steps mirror the original blue ramp.
 */
const ONE_RED = {
  primary_25: '#FFF5F6',
  primary_50: '#FEE9EB',
  primary_100: '#FDD2D7',
  primary_200: '#FBADB6',
  primary_300: '#F87E8C',
  primary_400: '#F04E61',
  primary_500: '#DC2638',
  primary_600: '#C0182B',
  primary_700: '#9C1323',
  primary_800: '#7A0E1C',
  primary_900: '#570A14',
  primary_950: '#3F070E',
  primary_975: '#2C0509',
}

const ONE_PALETTE = {...DEFAULT_PALETTE, ...ONE_RED}
const ONE_SUBDUED_PALETTE = {...DEFAULT_SUBDUED_PALETTE, ...ONE_RED}

const DEFAULT_THEMES = createThemes({
  defaultPalette: ONE_PALETTE,
  subduedPalette: ONE_SUBDUED_PALETTE,
})

export const themes = {
  lightPalette: DEFAULT_THEMES.light.palette,
  darkPalette: DEFAULT_THEMES.dark.palette,
  dimPalette: DEFAULT_THEMES.dim.palette,
  light: DEFAULT_THEMES.light,
  dark: DEFAULT_THEMES.dark,
  dim: DEFAULT_THEMES.dim,
}

/**
 * @deprecated use ALF and access palette from `useTheme()`
 */
export const lightPalette = DEFAULT_THEMES.light.palette
/**
 * @deprecated use ALF and access palette from `useTheme()`
 */
export const darkPalette = DEFAULT_THEMES.dark.palette
/**
 * @deprecated use ALF and access palette from `useTheme()`
 */
export const dimPalette = DEFAULT_THEMES.dim.palette
/**
 * @deprecated use ALF and access theme from `useTheme()`
 */
export const light = DEFAULT_THEMES.light
/**
 * @deprecated use ALF and access theme from `useTheme()`
 */
export const dark = DEFAULT_THEMES.dark
/**
 * @deprecated use ALF and access theme from `useTheme()`
 */
export const dim = DEFAULT_THEMES.dim
