import {useCallback, useEffect, useRef, useState} from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native'
import {useNavigation} from '@react-navigation/native'

import {
  DEFAULT_AGENT,
  pickActiveVoiceId,
  pickAgentHeaderName,
} from '#/lib/agent-runtime'
import {useBottomBarOffset} from '#/lib/hooks/useBottomBarOffset'
import {useIsKeyboardVisible} from '#/lib/hooks/useIsKeyboardVisible'
import {
  type CommonNavigatorParams,
  type NativeStackScreenProps,
  type NavigationProp,
} from '#/lib/routes/types'
import {usePersonasQuery} from '#/state/queries/personas'
import {useSupabaseSession} from '#/state/supabase'
import {atoms as a, useBreakpoints, useTheme} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {Microphone_Stroke2_Corner0_Rounded as MicIcon} from '#/components/icons/Microphone'
import {PaperPlaneVertical_Filled_Stroke2_Corner1_Rounded as SendIcon} from '#/components/icons/PaperPlane'
import {SpeakerVolumeFull_Stroke2_Corner0_Rounded as SpeakerIcon} from '#/components/icons/Speaker'
import * as Layout from '#/components/Layout'
import {Loader} from '#/components/Loader'
import {Text} from '#/components/Typography'
import {
  COMPOSER_KEYBOARD_VERTICAL_OFFSET,
  composerBottomOffset,
} from './composerOffset'
import {agentChatHeaderTitleSize} from './headerTitleStyle'
import {MessageBubble} from './MessageBubble'
import {useAgentChat} from './useAgentChat'
import {useAgentDisplayName} from './useAgentDisplayName'
import {useVoiceConversation} from './useVoiceConversation'

type Props = NativeStackScreenProps<CommonNavigatorParams, 'AgentChat'>

export function AgentChatScreen({route}: Props) {
  const t = useTheme()
  const {gtMobile} = useBreakpoints()
  const navigation = useNavigation<NavigationProp>()
  // Authority One account session (Supabase). The agent channel needs a bearer
  // from this session; when signed out we surface a tappable prompt instead of a
  // dead composer.
  const {status: accountStatus} = useSupabaseSession()
  // Lift the composer above the native bottom tab bar (and mobile-web bottom
  // bar). Returns 0 on desktop web, so the web centered layout is unaffected.
  const bottomBarOffset = useBottomBarOffset(8)
  // When the keyboard is OPEN, the iOS KeyboardAvoidingView already lifts the
  // composer by the full keyboard height (which spans the home-indicator inset),
  // and the tab bar is covered — so the tab-bar offset must NOT be added on top,
  // or the composer floats above the keyboard by exactly that gap. Use the
  // "will" events so the padding change rides the keyboard animation.
  const [isKeyboardVisible] = useIsKeyboardVisible({iosUseWillEvents: true})
  const agent = route.params?.agent ?? DEFAULT_AGENT
  // Active persona (name + voice) from the runtime. Degrades to undefined when
  // signed out / unreachable, so the name falls back to the atproto profile.
  const {data: personas} = usePersonasQuery()
  // Dynamic agent display name (header / empty-state / placeholders): the active
  // persona's name wins; otherwise the atproto profile displayName, then the handle.
  const profileName = useAgentDisplayName(agent)
  const agentName = pickAgentHeaderName(personas?.activeName, profileName)
  // Voice-mode voice follows the active persona's voiceId (else the runtime default).
  const personaVoiceId = pickActiveVoiceId(personas?.activeVoiceId)

  // Constrain the conversation to a readable, centered column on web/wide
  // screens; on narrow windows / native it falls back to full width.
  const centerColumn = gtMobile
    ? {maxWidth: Layout.CENTER_COLUMN_WIDTH, width: '100%' as const, marginHorizontal: 'auto' as const}
    : null

  const {
    messages,
    isStreaming,
    isHydrating,
    send,
    abort,
    decide,
    transportError,
    retry,
  } = useAgentChat(agent)
  const [input, setInput] = useState('')

  // ~20% larger title than the shared header default, applied only to this screen.
  const headerTitleStyle = {fontSize: agentChatHeaderTitleSize(gtMobile)}
  const [autoSpeak, setAutoSpeak] = useState(true)

  const scrollRef = useRef<ScrollView>(null)
  const wasStreaming = useRef(false)

  // Latest assistant reply text — read by the continuous loop when a turn ends.
  const getReplyText = useCallback(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') return messages[i].text ?? ''
    }
    return ''
  }, [messages])

  // Continuous, hands-free voice chat (idle ↔ listening ↔ thinking ↔ speaking),
  // with barge-in and the ElevenLabs "Bob" voice. Exposes the shared voice engine
  // (for the partial transcript + text-mode speak) and the single ON/OFF control.
  const {voice, convState, isOn: voiceModeOn, toggle: toggleVoiceMode} =
    useVoiceConversation({
      send: text => send(text),
      isStreaming,
      getReplyText,
      localeId: 'en-US',
      voiceId: personaVoiceId,
    })

  const doSend = useCallback(
    (text: string) => {
      const trimmed = text.trim()
      if (!trimmed) return
      // Sending interrupts any ongoing agent speech (barge-in via text, too).
      voice.stopSpeaking()
      setInput('')
      send(trimmed)
    },
    [send, voice],
  )

  // Speak the assistant reply once a TEXT turn finishes streaming (if autoSpeak on).
  // In continuous voice mode the loop already speaks the reply, so skip it here to
  // avoid double playback.
  useEffect(() => {
    if (wasStreaming.current && !isStreaming) {
      const last = messages[messages.length - 1]
      if (!voiceModeOn && autoSpeak && last?.role === 'assistant' && last.text) {
        voice.speak(last.text)
      }
    }
    wasStreaming.current = isStreaming
  }, [isStreaming, messages, autoSpeak, voiceModeOn, voice])

  // Keep pinned to the newest message.
  const onContentSizeChange = useCallback(() => {
    scrollRef.current?.scrollToEnd({animated: true})
  }, [])

  const showMic = voice.capabilities.available
  // Show the live partial transcript whenever the mic is actively capturing the
  // user (continuous listening — not while thinking/speaking).
  const micActive = voice.listening && convState !== 'speaking'

  // One-line status for the header while continuous voice mode is on.
  const voiceStatusLabel =
    convState === 'listening'
      ? 'Listening…'
      : convState === 'thinking'
        ? `${agentName} is thinking…`
        : convState === 'speaking'
          ? `${agentName} is speaking…`
          : null

  // Signed out of the Authority One account → no bearer can be attached, so the
  // chat can't run. Show a tappable sign-in prompt that routes to the account
  // screen. After signing in, `accountStatus` flips to 'signedIn' and this
  // screen re-renders into the chat (the account screen also offers a "Talk to
  // your agent" button as a direct return path).
  if (accountStatus === 'signedOut') {
    return (
      <Layout.Screen>
        <Layout.Header.Outer>
          <Layout.Header.BackButton />
          <Layout.Header.Content>
            <Layout.Header.TitleText style={headerTitleStyle}>
              {`Talk to ${agentName}`}
            </Layout.Header.TitleText>
          </Layout.Header.Content>
        </Layout.Header.Outer>
        <View
          style={[
            a.flex_1,
            a.align_center,
            a.justify_center,
            a.px_xl,
            a.gap_lg,
          ]}>
          <Text
            style={[a.text_md, t.atoms.text_contrast_medium, a.text_center]}>
            {/* Custom (non-Bluesky) copy: plain literal so it never depends on
                the compiled Lingui catalog (which would render a raw msg ID). */}
            Sign in to your Authority One account to chat with{' '}
            {agentName}.
          </Text>
          <Button
            label="Sign in to chat"
            size="large"
            variant="solid"
            color="primary"
            onPress={() => navigation.navigate('AuthorityAccount')}>
            <ButtonText>Sign in to chat</ButtonText>
          </Button>
        </View>
      </Layout.Screen>
    )
  }

  return (
    <Layout.Screen>
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content>
          <Layout.Header.TitleText style={headerTitleStyle}>
            {`Talk to ${agentName}`}
          </Layout.Header.TitleText>
          {!showMic ? (
            <Layout.Header.SubtitleText>
              Voice unavailable on this device
            </Layout.Header.SubtitleText>
          ) : voiceModeOn && voiceStatusLabel ? (
            <Layout.Header.SubtitleText>
              {voiceStatusLabel}
            </Layout.Header.SubtitleText>
          ) : null}
        </Layout.Header.Content>
        {/* Toggle auto-speak of replies. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Toggle spoken replies"
          accessibilityHint=""
          onPress={() => {
            if (autoSpeak) voice.stopSpeaking()
            setAutoSpeak(v => !v)
          }}
          style={[a.p_sm, a.rounded_full, !autoSpeak && {opacity: 0.4}]}>
          <SpeakerIcon size="md" fill={t.atoms.text.color} />
        </Pressable>
      </Layout.Header.Outer>

      <KeyboardAvoidingView
        style={[a.flex_1]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        // MUST be 0: this KAV is rendered below the header, so RN already measures
        // its frame correctly and the padding it inserts equals the keyboard
        // overlap. A non-zero offset (the old `insets.top + 44`) opened exactly
        // that much empty band above the keyboard. See composerOffset.ts.
        keyboardVerticalOffset={COMPOSER_KEYBOARD_VERTICAL_OFFSET}>
        <ScrollView
          ref={scrollRef}
          style={[a.flex_1]}
          contentContainerStyle={[
            a.px_md,
            a.py_lg,
            a.gap_sm,
            {flexGrow: 1},
            centerColumn,
          ]}
          onContentSizeChange={onContentSizeChange}
          keyboardDismissMode="interactive">
          {messages.length === 0 && isHydrating ? (
            // Recent thread is loading — show a quiet loader instead of the empty-state
            // copy so a returning user doesn't see a flash of "blank chat".
            <View style={[a.flex_1, a.align_center, a.justify_center, a.pt_5xl]}>
              <Loader size="lg" />
            </View>
          ) : messages.length === 0 ? (
            <View
              style={[a.flex_1, a.align_center, a.justify_center, a.pt_5xl]}>
              <Text
                style={[
                  a.text_md,
                  t.atoms.text_contrast_medium,
                  a.text_center,
                ]}>
                {`Ask ${agentName} anything. Tap the mic to start a hands-free voice chat — talk naturally and interrupt any time.`}
              </Text>
            </View>
          ) : (
            messages.map(m => (
              <MessageBubble
                key={m.id}
                message={m}
                decideDisabled={isStreaming}
                onDecision={(action, decision) => {
                  void decide(action, decision)
                }}
              />
            ))
          )}
        </ScrollView>

        {/* Live partial transcript while listening. */}
        {micActive ? (
          <View style={[t.atoms.bg_contrast_25]}>
            <View style={[a.px_md, a.py_sm, a.w_full, centerColumn]}>
              <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
                {/* Plain literal (not a Lingui msg): the compiled catalog miss is what
                    renders this listening-state placeholder as a raw message ID
                    ("ZVCRHy"), exactly like the idle composer placeholder we fixed. */}
                {voice.partial ? voice.partial : 'Listening…'}
              </Text>
            </View>
          </View>
        ) : null}

        {/* Transport failure (dropped connection) — a quiet, tappable retry row,
            NOT a fake assistant bubble with a raw network string. Tapping replays
            the failed turn. Real server/agent errors still render as a message. */}
        {transportError ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Couldn't reach ${agentName} — tap to retry`}
            accessibilityHint="Resends your last message"
            onPress={retry}
            style={[a.w_full, centerColumn]}>
            <View
              style={[
                a.flex_row,
                a.align_center,
                a.justify_center,
                a.gap_xs,
                a.px_md,
                a.py_sm,
              ]}>
              <Text
                style={[
                  a.text_sm,
                  t.atoms.text_contrast_medium,
                  a.text_center,
                ]}>
                {`Couldn't reach ${agentName} — tap to retry`}
              </Text>
            </View>
          </Pressable>
        ) : null}

        {/* Composer — pinned to bottom, aligned to the centered column. */}
        <View style={[a.border_t, t.atoms.border_contrast_low]}>
          <View
            style={[
              a.flex_row,
              a.align_center,
              a.gap_sm,
              a.px_md,
              a.py_sm,
              a.w_full,
              centerColumn,
              {paddingBottom: composerBottomOffset(bottomBarOffset, isKeyboardVisible)},
            ]}>
          {showMic ? (
            // Single ON/OFF control for continuous, hands-free voice chat. ON =
            // a live "call" with Bob (listen → reply → listen, with barge-in);
            // OFF = back to text. One toggle, not a per-message button.
            <Button
              label={voiceModeOn ? 'End voice chat' : 'Start voice chat'}
              size="large"
              shape="round"
              variant="solid"
              color={voiceModeOn ? 'negative' : 'secondary'}
              onPress={toggleVoiceMode}>
              <ButtonIcon icon={MicIcon} />
            </Button>
          ) : null}

          <TextInput
            accessibilityLabel="Text input field"
            accessibilityHint="Type a message to send to the agent"
            value={input}
            onChangeText={setInput}
            // Plain literal (not a Lingui msg): the compiled catalog miss is what
            // renders the placeholder as a raw message ID ("l9RW8S").
            placeholder={`Message ${agentName}…`}
            placeholderTextColor={t.atoms.text_contrast_low.color}
            multiline
            style={[
              a.flex_1,
              a.px_md,
              a.py_sm,
              a.rounded_full,
              a.text_md,
              t.atoms.bg_contrast_25,
              t.atoms.text,
              {maxHeight: 120},
            ]}
            onSubmitEditing={() => doSend(input)}
            editable={!voiceModeOn}
          />

          {isStreaming ? (
            <Button
              label="Stop"
              size="large"
              shape="round"
              variant="solid"
              color="secondary"
              onPress={abort}>
              <ButtonIcon icon={SpeakerIcon} />
            </Button>
          ) : (
            <Button
              label="Send"
              size="large"
              shape="round"
              variant="solid"
              color="primary"
              disabled={!input.trim()}
              onPress={() => doSend(input)}>
              <ButtonIcon icon={SendIcon} />
            </Button>
          )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Layout.Screen>
  )
}
