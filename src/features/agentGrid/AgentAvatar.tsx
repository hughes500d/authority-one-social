import {View} from 'react-native'

import {UserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a, useTheme} from '#/alf'
import {Text} from '#/components/Typography'
import {initialsFor, rampFor} from './util'

/**
 * A circular agent headshot: the real profile photo when one exists, otherwise
 * a deterministic initials tile (same agent, same color everywhere). An agent
 * with an active live room gets a green dot on the avatar's corner.
 */
export function AgentAvatar({
  handle,
  displayName,
  avatar,
  size,
  live = false,
}: {
  handle: string
  displayName?: string
  avatar?: string
  size: number
  live?: boolean
}) {
  const t = useTheme()
  const dotSize = Math.max(10, Math.round(size * 0.24))
  return (
    <View style={{width: size, height: size}}>
      {avatar ? (
        <UserAvatar avatar={avatar} size={size} type="user" />
      ) : (
        <InitialsAvatar handle={handle} displayName={displayName} size={size} />
      )}
      {live ? (
        <View
          testID="agentLiveDot"
          style={[
            a.absolute,
            a.rounded_full,
            {
              right: 0,
              bottom: 0,
              width: dotSize,
              height: dotSize,
              backgroundColor: t.palette.positive_500,
              borderWidth: 2,
              borderColor: t.atoms.bg.backgroundColor,
            },
          ]}
        />
      ) : null}
    </View>
  )
}

function InitialsAvatar({
  handle,
  displayName,
  size,
}: {
  handle: string
  displayName?: string
  size: number
}) {
  const ramp = rampFor(handle.toLowerCase())
  return (
    <View
      testID="agentInitialsAvatar"
      style={[
        a.rounded_full,
        a.align_center,
        a.justify_center,
        {width: size, height: size, backgroundColor: ramp.bg},
      ]}>
      <Text
        style={{
          color: ramp.fg,
          fontSize: Math.round(size * 0.34),
          fontWeight: '600',
        }}>
        {initialsFor(displayName, handle)}
      </Text>
    </View>
  )
}
