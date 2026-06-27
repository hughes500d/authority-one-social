import {type ReactNode} from 'react'
import {createContext, useContext} from 'react'
import {type TextStyle, type ViewStyle} from 'react-native'
import {type ThemeName} from '@bsky.app/alf'

import {darkTheme, defaultTheme, dimTheme} from './themes'

export type ColorScheme = 'light' | 'dark'

/** @deprecated legacy brand-pack union; skins are now data-driven, see #/lib/skins */
export type ThemePack = 'default' | 'authorityOne'

export type PaletteColorName =
  | 'default'
  | 'primary'
  | 'secondary'
  | 'inverted'
  | 'error'
export type PaletteColor = {
  background: string
  backgroundLight: string
  text: string
  textLight: string
  textInverted: string
  link: string
  border: string
  [k: string]: string
}
export type Palette = Record<PaletteColorName, PaletteColor>

export type ShapeName = 'button' | 'bigButton' | 'smallButton'
export type Shapes = Record<ShapeName, ViewStyle>

/**
 * @deprecated use typography atoms from `#/alf`
 */
export type TypographyVariant =
  | '2xl-thin'
  | '2xl'
  | '2xl-medium'
  | '2xl-bold'
  | '2xl-heavy'
  | 'xl-thin'
  | 'xl'
  | 'xl-medium'
  | 'xl-bold'
  | 'xl-heavy'
  | 'lg-thin'
  | 'lg'
  | 'lg-medium'
  | 'lg-bold'
  | 'lg-heavy'
  | 'md-thin'
  | 'md'
  | 'md-medium'
  | 'md-bold'
  | 'md-heavy'
  | 'sm-thin'
  | 'sm'
  | 'sm-medium'
  | 'sm-bold'
  | 'sm-heavy'
  | 'xs-thin'
  | 'xs'
  | 'xs-medium'
  | 'xs-bold'
  | 'xs-heavy'
  | 'title-2xl'
  | 'title-xl'
  | 'title-lg'
  | 'title'
  | 'title-sm'
  | 'post-text-lg'
  | 'post-text'
  | 'button'
  | 'button-lg'
  | 'mono'
export type Typography = Record<TypographyVariant, TextStyle>

export interface Theme {
  colorScheme: ColorScheme
  palette: Palette
  shapes: Shapes
  typography: Typography
}

/** Optional skin overlay of the legacy themes. `undefined` = the base themes. */
export type LegacyThemeOverride = {
  default: Theme
  dark: Theme
  dim: Theme
}

export interface ThemeProviderProps {
  children?: ReactNode
  theme: ThemeName
  /**
   * Active skin's legacy theme set (from #/lib/skins). When omitted, the base
   * themes are used -- so plain `<ThemeProvider theme="dark">` callers are
   * unaffected.
   */
  themes?: LegacyThemeOverride
}

export const ThemeContext = createContext<Theme>(defaultTheme)
ThemeContext.displayName = 'ThemeContext'

export const useTheme = () => useContext(ThemeContext)

function getTheme(theme: ThemeName, themes?: LegacyThemeOverride) {
  const set: LegacyThemeOverride = themes ?? {
    default: defaultTheme,
    dark: darkTheme,
    dim: dimTheme,
  }
  switch (theme) {
    case 'light':
      return set.default
    case 'dim':
      return set.dim
    case 'dark':
      return set.dark
    default:
      return set.default
  }
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  theme,
  themes,
  children,
}) => {
  const themeValue = getTheme(theme, themes)

  return (
    <ThemeContext.Provider value={themeValue}>{children}</ThemeContext.Provider>
  )
}
