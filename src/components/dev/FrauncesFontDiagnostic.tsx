/**
 * ⚠️ TEMPORARY FONT-REGISTRATION DIAGNOSTIC — REMOVE BEFORE RELEASE ⚠️
 *
 * Renders the Fraunces face UNCONDITIONALLY (no theme gate, no ALF) using RAW
 * react-native <Text> so nothing in the app's style pipeline can clobber the
 * fontFamily. Purpose: on the next native build, prove whether the font
 * REGISTERS AT ALL, separately from whether per-name targeting/theme-gating
 * works.
 *
 * How to read it on-device (Settings → Appearance, top of screen):
 *   • If the "PostScript" and "family" lines look like a SERIF and clearly
 *     differ from the "System (control)" line → Fraunces IS registered; the
 *     production path (PostScript name on iOS) will work.
 *   • If all three lines look identical (system sans) → the font is NOT
 *     registering in the build at all (bundling/registration problem), not a
 *     per-name-targeting problem.
 *
 * To remove: delete this file, its import, and its <FrauncesFontDiagnostic />
 * usage in src/screens/Settings/AppearanceSettings.tsx.
 */
import {Text, View} from 'react-native'

import {
  AUTHORITY_ONE_HEADING_FONT,
  AUTHORITY_ONE_HEADING_FONT_POSTSCRIPT,
} from '#/alf/fonts-authority-one'

const SAMPLE = 'AaBbCc Gg Qq 0123'

export function FrauncesFontDiagnostic() {
  return (
    <View
      style={{
        padding: 12,
        margin: 12,
        borderWidth: 2,
        borderColor: '#cc0000',
        borderRadius: 8,
        gap: 4,
      }}>
      <Text style={{fontSize: 11, fontWeight: '700', color: '#cc0000'}}>
        ⚠️ FRAUNCES FONT DIAGNOSTIC — remove before release
      </Text>
      <Text style={{fontSize: 22, fontFamily: AUTHORITY_ONE_HEADING_FONT_POSTSCRIPT}}>
        {SAMPLE} — PostScript "{AUTHORITY_ONE_HEADING_FONT_POSTSCRIPT}"
      </Text>
      <Text style={{fontSize: 22, fontFamily: AUTHORITY_ONE_HEADING_FONT}}>
        {SAMPLE} — family "{AUTHORITY_ONE_HEADING_FONT}"
      </Text>
      <Text
        style={{fontSize: 22, fontWeight: '700', fontFamily: AUTHORITY_ONE_HEADING_FONT_POSTSCRIPT}}>
        {SAMPLE} — PostScript + bold (the real heading case)
      </Text>
      <Text style={{fontSize: 22, fontFamily: 'System'}}>
        {SAMPLE} — System (control)
      </Text>
    </View>
  )
}
