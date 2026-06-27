import {View} from 'react-native'
import {type AppBskyActorDefs, type ModerationDecision} from '@atproto/api'

import {sanitizeDisplayName} from '#/lib/strings/display-names'
import {sanitizeHandle} from '#/lib/strings/handles'
import {type Shadow} from '#/state/cache/types'
import {useSkinHeadingFont} from '#/state/skin'
import {atoms as a, useBreakpoints, useTheme} from '#/alf'
import {Text} from '#/components/Typography'

export function ProfileHeaderDisplayName({
  profile,
  moderation,
}: {
  profile: Shadow<AppBskyActorDefs.ProfileViewDetailed>
  moderation: ModerationDecision
}) {
  const t = useTheme()
  const {gtMobile} = useBreakpoints()
  // Active skin's display face for the display name (Fraunces under the
  // Authority skin). undefined under skins with no display font → default Inter.
  const headingFont = useSkinHeadingFont()

  return (
    <View pointerEvents="none">
      <Text
        emoji
        testID="profileHeaderDisplayName"
        fontFamilyOverride={headingFont}
        style={[
          t.atoms.text,
          gtMobile ? a.text_4xl : a.text_3xl,
          a.self_start,
          a.font_bold,
        ]}>
        {sanitizeDisplayName(
          profile.displayName || sanitizeHandle(profile.handle),
          moderation.ui('displayName'),
        )}
      </Text>
    </View>
  )
}
