import {Platform} from 'react-native'

import {type SkinHeadingFont} from '#/lib/skins/types'

/**
 * Resolve a skin's heading font to a single platform-appropriate `fontFamily`.
 *
 *  - web:     a serif/sans fallback STACK so headlines read correctly before the
 *             web font loads.
 *  - ios:     the POSTSCRIPT name -- a unique per-face match key that avoids
 *             family-level weight resolution (see the Fraunces note in
 *             `#/alf/fonts-authority-one.ts`).
 *  - android: the FAMILY name.
 *
 * Returns `undefined` when the skin has no heading font, so callers can pass the
 * result straight to `<Text fontFamilyOverride>` (undefined = default font).
 */
export function resolveHeadingFontFamily(
  font: SkinHeadingFont | undefined,
): string | undefined {
  if (!font) return undefined
  switch (Platform.OS) {
    case 'web':
      return font.webStack
    case 'ios':
      return font.postScriptName
    default:
      return font.family
  }
}
