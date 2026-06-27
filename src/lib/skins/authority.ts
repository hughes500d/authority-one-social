import {type SkinDefinition} from '#/lib/skins/types'
import {
  authorityOneDarkTheme,
  authorityOneDefaultTheme,
  authorityOneDimTheme,
} from '#/lib/themes-authority-one'
import {
  AUTHORITY_ONE_HEADING_FONT,
  AUTHORITY_ONE_HEADING_FONT_POSTSCRIPT,
} from '#/alf/fonts-authority-one'
import {
  authorityOnePalettes,
  authorityOneThemes,
} from '#/alf/themes-authority-one'

/**
 * Authority One — the launch brand skin (warm "paper" + terracotta + Fraunces).
 *
 * This is the FIRST registered skin. It does not introduce any new tokens: it
 * SOURCES the already-shipped Authority One theme/font modules so the skin
 * registry becomes the single thing theme consumers read, with ZERO change to
 * the actual look. The token values still live in:
 *   - `#/alf/themes-authority-one`   (ALF themes + palettes)
 *   - `#/lib/themes-authority-one`   (legacy ThemeContext themes)
 *   - `#/alf/fonts-authority-one`    (Fraunces family + PostScript names)
 */
export const authoritySkin: SkinDefinition = {
  id: 'authority',
  displayName: 'Authority',

  alfThemes: authorityOneThemes,
  legacyThemes: {
    default: authorityOneDefaultTheme,
    dark: authorityOneDarkTheme,
    dim: authorityOneDimTheme,
  },
  headingFont: {
    family: AUTHORITY_ONE_HEADING_FONT, // 'Fraunces'
    postScriptName: AUTHORITY_ONE_HEADING_FONT_POSTSCRIPT, // 'Fraunces-Regular'
    webStack: `${AUTHORITY_ONE_HEADING_FONT}, Georgia, "Times New Roman", serif`,
  },

  // The primary One/Authority app icon is the build's main bundled icon, so the
  // Authority skin has no *alternate* icon -- selecting it resets to the primary
  // icon rather than swapping to a registered alternate.
  alternateIconName: null,

  swatch: {
    background: authorityOnePalettes.light.contrast_0, // warm paper #ECE2CD
    accent: authorityOnePalettes.light.primary_500, // terracotta #C25F40
  },
}
