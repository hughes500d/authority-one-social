import {
  createThemes,
  DEFAULT_PALETTE,
  DEFAULT_SUBDUED_PALETTE,
} from '@bsky.app/alf'

/**
 * Authority One reskin: orange-red primary ramp matched to the One logo
 * background (#E8431F). Lightness steps mirror the original blue ramp.
 */
const ONE_ORANGE = {
  primary_25: '#FFF6F3',
  primary_50: '#FEEAE4',
  primary_100: '#FDD3C6',
  primary_200: '#FAAE98',
  primary_300: '#F58263',
  primary_400: '#EF5F38',
  primary_500: '#E8431F',
  primary_600: '#C93517',
  primary_700: '#A52A12',
  primary_800: '#82210E',
  primary_900: '#5E180A',
  primary_950: '#441107',
  primary_975: '#2F0C05',
}

const ONE_PALETTE = {...DEFAULT_PALETTE, ...ONE_ORANGE}
const ONE_SUBDUED_PALETTE = {...DEFAULT_SUBDUED_PALETTE, ...ONE_ORANGE}

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
