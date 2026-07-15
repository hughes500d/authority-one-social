import {ActivityIndicator, View} from 'react-native'

import {PressableWithHover} from '#/view/com/util/PressableWithHover'
import {atoms as a, useTheme} from '#/alf'
import {Text} from '#/components/Typography'
import {AgentAvatar} from './AgentAvatar'
import {useAgentDirectory} from './useAgentDirectory'
import {type AgentGridEntry} from './util'

/**
 * The agent grid: headshot tiles split into "Your agents" (owned) and
 * "Chatting with" (followed agents the user doesn't own). Replaces the old
 * flat agent-name list — agents are the primary, visual objects of the nav.
 * Tapping a tile opens that agent's hub (the caller supplies navigation).
 *
 * Section labels are plain literals: custom (non-Bluesky) strings are not in
 * the compiled Lingui catalog and would render as raw message IDs.
 */
export function AgentGrid({
  onPressAgent,
  tileSize = 64,
  avatarOnly = false,
  ownedAccessory,
  fallback = null,
}: {
  onPressAgent: (entry: AgentGridEntry) => void
  /** Avatar diameter in px; the tile is a bit wider to fit the name. */
  tileSize?: number
  /** Compact mode for narrow rails: avatars only, no names or section labels. */
  avatarOnly?: boolean
  /** Rendered at the right of the "Your agents" label (e.g. a New-agent button). */
  ownedAccessory?: React.ReactNode
  /** Rendered instead of the grid when there are no agents at all. */
  fallback?: React.ReactNode
}) {
  const {owned, chattingWith, isLoading, isEmpty} = useAgentDirectory()

  if (isEmpty) {
    return <>{fallback}</>
  }
  if (isLoading && owned.length === 0 && chattingWith.length === 0) {
    return (
      <View style={[a.py_md, a.align_center]}>
        <ActivityIndicator />
      </View>
    )
  }

  return (
    <View style={[avatarOnly ? a.gap_md : a.gap_xs]}>
      {owned.length > 0 || ownedAccessory ? (
        <>
          {!avatarOnly ? (
            <SectionLabel label="Your agents" accessory={ownedAccessory} />
          ) : null}
          <TileRow
            entries={owned}
            onPressAgent={onPressAgent}
            tileSize={tileSize}
            avatarOnly={avatarOnly}
          />
        </>
      ) : null}
      {chattingWith.length > 0 ? (
        <>
          {!avatarOnly ? <SectionLabel label="Chatting with" /> : null}
          <TileRow
            entries={chattingWith}
            onPressAgent={onPressAgent}
            tileSize={tileSize}
            avatarOnly={avatarOnly}
          />
        </>
      ) : null}
    </View>
  )
}

function SectionLabel({
  label,
  accessory,
}: {
  label: string
  accessory?: React.ReactNode
}) {
  const t = useTheme()
  return (
    <View style={[a.flex_row, a.align_center, a.pt_xs]}>
      <Text
        style={[
          a.flex_1,
          a.text_sm,
          a.font_bold,
          t.atoms.text_contrast_medium,
        ]}>
        {label}
      </Text>
      {accessory}
    </View>
  )
}

function TileRow({
  entries,
  onPressAgent,
  tileSize,
  avatarOnly,
}: {
  entries: AgentGridEntry[]
  onPressAgent: (entry: AgentGridEntry) => void
  tileSize: number
  avatarOnly: boolean
}) {
  return (
    <View
      style={[
        a.flex_row,
        a.flex_wrap,
        avatarOnly && [a.flex_col, a.align_center, a.gap_sm],
      ]}>
      {entries.map(entry => (
        <AgentTile
          key={entry.key}
          entry={entry}
          onPress={() => onPressAgent(entry)}
          tileSize={tileSize}
          avatarOnly={avatarOnly}
        />
      ))}
    </View>
  )
}

function AgentTile({
  entry,
  onPress,
  tileSize,
  avatarOnly,
}: {
  entry: AgentGridEntry
  onPress: () => void
  tileSize: number
  avatarOnly: boolean
}) {
  const t = useTheme()
  const name = entry.displayName || entry.handle.split('.')[0]
  return (
    <PressableWithHover
      accessibilityRole="button"
      accessibilityLabel={`Open ${name}`}
      accessibilityHint="Opens this agent's hub"
      onPress={onPress}
      hoverStyle={t.atoms.bg_contrast_25}
      style={[
        a.align_center,
        a.rounded_md,
        avatarOnly ? a.p_2xs : [a.px_xs, a.py_sm, {width: tileSize + 24}],
        {gap: 6},
      ]}>
      <View style={[entry.paused && {opacity: 0.5}]}>
        <AgentAvatar
          handle={entry.handle}
          displayName={entry.displayName}
          avatar={entry.avatar}
          size={tileSize}
          live={entry.live}
        />
      </View>
      {!avatarOnly ? (
        <Text
          emoji
          style={[a.text_xs, a.text_center, t.atoms.text]}
          numberOfLines={1}>
          {name}
        </Text>
      ) : null}
    </PressableWithHover>
  )
}
