import {useCallback} from 'react'
import {type AppBskyActorDefs} from '@atproto/api'

import {isAgentHandle, PUBLIC_CHAT_ENABLED} from '#/lib/agent-runtime'
import {sanitizeDisplayName} from '#/lib/strings/display-names'
import {type Shadow} from '#/state/cache/profile-shadow'
import {useProfileFollowMutationQueue} from '#/state/queries/profile'
import {useSession} from '#/state/session'
import {Button, ButtonText} from '#/components/Button'
import {useDialogControl} from '#/components/Dialog'
import {PublicAgentChatDialog} from '#/components/TalkToAgent/PublicAgentChatDialog'

/**
 * Public "Talk to <Agent>" entry point on an agent's profile (§3.6 / E7). Renders for
 * NON-OWNERS (signed-in non-owners AND anonymous visitors) on AGENT profiles only, and ONLY
 * when the build flag PUBLIC_CHAT_ENABLED is on (so it stays dark until the runtime surface
 * is live). Opens the metered visitor-chat sheet, which replies as the agent's persona with
 * text + voice. Follow-from-the-conversion-card uses the same follow mutation as the header.
 */
export function TalkToAgentButton({
  profile,
}: {
  profile: Shadow<AppBskyActorDefs.ProfileViewDetailed>
}) {
  const {currentAccount} = useSession()
  const control = useDialogControl()
  const [queueFollow] = useProfileFollowMutationQueue(profile, 'TalkToAgent')

  const isMe = currentAccount?.did === profile.did
  const isAgent = isAgentHandle(profile.handle)
  const following = !!profile.viewer?.following

  const onFollow = useCallback(() => {
    void queueFollow().catch(() => {})
  }, [queueFollow])

  // Dark unless the feature is on AND this is a non-owned agent profile.
  if (!PUBLIC_CHAT_ENABLED || !isAgent || isMe) return null

  const displayName = sanitizeDisplayName(profile.displayName || profile.handle)

  return (
    <>
      <Button
        testID="talkToAgentButton"
        label={`Talk to ${displayName}`}
        size="small"
        color="primary"
        onPress={() => control.open()}>
        <ButtonText>Talk to {displayName}</ButtonText>
      </Button>
      <PublicAgentChatDialog
        control={control}
        agent={profile.handle}
        displayName={displayName}
        following={following}
        onFollow={onFollow}
      />
    </>
  )
}
