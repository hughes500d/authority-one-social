import {View} from 'react-native'

import {atoms as a, useTheme} from '#/alf'
import {Text} from '#/components/Typography'

/** Green "Live" chip for a live drop-in room (thread.live). */
export function LiveBadge() {
  const t = useTheme()
  return (
    <View style={[a.flex_row, a.align_center, {gap: 4}]}>
      <View
        style={[
          a.rounded_full,
          {width: 7, height: 7, backgroundColor: t.palette.positive_500},
        ]}
      />
      <Text style={[a.text_xs, a.font_bold, {color: t.palette.positive_600}]}>
        Live
      </Text>
    </View>
  )
}
