import {Platform} from 'react-native'

import {authorityOnePalettes as aoP} from '#/alf/themes-authority-one'
import {type Theme} from './ThemeContext'
import {darkTheme, defaultTheme, dimTheme} from './themes'

/**
 * Authority One brand variants of the legacy (`#/lib/ThemeContext`) themes.
 * ADDITIVE: the base defaultTheme/darkTheme/dimTheme are untouched — these are
 * separate objects, only used when the "Authority One" app theme is active.
 *
 * Most of the app's chrome is styled through ALF (see
 * `#/alf/themes-authority-one`); these cover the remaining legacy
 * `usePalette()`/ThemeContext consumers so the brand reads consistently.
 *
 * Display-font note: the site's display face is Fraunces (a serif). The app
 * bundles Inter only as its UI font (which is exactly the site's BODY font, so
 * body type is a true match). Fraunces is now bundled for real via the
 * `expo-font` plugin (the STATIC cut assets/fonts/fraunces/Fraunces-Static.ttf —
 * NOT the variable Fraunces.ttf, which RN/iOS fail to register), so the AO
 * theme's large `title-*` variants below reference the Fraunces family directly.
 * If the .ttf isn't yet in the build, RN falls back to the platform serif (web) /
 * the system font (native) — nothing breaks. See AUTHORITY-ONE-THEME-TOKENS.md
 * and `src/alf/fonts-authority-one.ts` for the family-name + bundling details.
 */
const DISPLAY_SERIF = Platform.select({
  // Native: must be the exact registered family name ('Fraunces'); RN falls
  // back to the system font if the face isn't bundled.
  ios: 'Fraunces',
  android: 'Fraunces',
  // Web: list a serif fallback stack so headlines stay editorial pre-load.
  default: 'Fraunces, Georgia, "Times New Roman", serif',
})

const aoTitleTypography = {
  'title-2xl': {
    ...defaultTheme.typography['title-2xl'],
    fontFamily: DISPLAY_SERIF,
  },
  'title-xl': {
    ...defaultTheme.typography['title-xl'],
    fontFamily: DISPLAY_SERIF,
  },
  'title-lg': {
    ...defaultTheme.typography['title-lg'],
    fontFamily: DISPLAY_SERIF,
  },
  title: {...defaultTheme.typography['title'], fontFamily: DISPLAY_SERIF},
}

export const authorityOneDefaultTheme: Theme = {
  ...defaultTheme,
  colorScheme: 'light',
  palette: {
    ...defaultTheme.palette,
    default: {
      background: aoP.light.contrast_0,
      backgroundLight: aoP.light.contrast_25,
      text: aoP.light.contrast_1000,
      textLight: aoP.light.contrast_700,
      textInverted: aoP.light.contrast_0,
      link: aoP.light.primary_500,
      border: aoP.light.contrast_100,
    },
    primary: {
      background: aoP.light.primary_500,
      backgroundLight: aoP.light.primary_400,
      text: aoP.light.contrast_0,
      textLight: aoP.light.primary_50,
      textInverted: aoP.light.primary_500,
      link: aoP.light.primary_100,
      border: aoP.light.primary_600,
    },
    inverted: {
      background: aoP.dark.contrast_0,
      backgroundLight: aoP.dark.contrast_50,
      text: aoP.dark.contrast_1000,
      textLight: aoP.dark.contrast_700,
      textInverted: aoP.dark.contrast_0,
      link: aoP.dark.primary_500,
      border: aoP.dark.contrast_100,
    },
  },
  typography: {
    ...defaultTheme.typography,
    ...aoTitleTypography,
  },
}

export const authorityOneDarkTheme: Theme = {
  ...darkTheme,
  colorScheme: 'dark',
  palette: {
    ...authorityOneDefaultTheme.palette,
    default: {
      background: aoP.dark.contrast_0,
      backgroundLight: aoP.dark.contrast_25,
      text: aoP.dark.contrast_1000,
      textLight: aoP.dark.contrast_600,
      textInverted: aoP.dark.contrast_0,
      link: aoP.dark.primary_500,
      border: aoP.dark.contrast_100,
    },
    primary: {
      background: aoP.dark.primary_500,
      backgroundLight: aoP.dark.primary_400,
      text: aoP.dark.contrast_0,
      textLight: aoP.dark.primary_100,
      textInverted: aoP.dark.primary_500,
      link: aoP.dark.primary_200,
      border: aoP.dark.primary_600,
    },
    inverted: {
      background: aoP.light.contrast_0,
      backgroundLight: aoP.light.contrast_50,
      text: aoP.light.contrast_1000,
      textLight: aoP.light.contrast_700,
      textInverted: aoP.light.contrast_0,
      link: aoP.light.primary_500,
      border: aoP.light.contrast_100,
    },
  },
  typography: {
    ...darkTheme.typography,
    ...aoTitleTypography,
  },
}

export const authorityOneDimTheme: Theme = {
  ...dimTheme,
  palette: {
    ...authorityOneDarkTheme.palette,
    default: {
      ...authorityOneDarkTheme.palette.default,
      background: aoP.dim.contrast_0,
      backgroundLight: aoP.dim.contrast_25,
      text: aoP.dim.contrast_1000,
      textLight: aoP.dim.contrast_700,
      textInverted: aoP.dim.contrast_0,
      link: aoP.dim.primary_500,
      border: aoP.dim.contrast_100,
    },
  },
  typography: {
    ...dimTheme.typography,
    ...aoTitleTypography,
  },
}
