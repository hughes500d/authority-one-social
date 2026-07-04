import {useState} from 'react'
import {ActivityIndicator, View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {
  type AutoSocialConfig,
  type AutoSocialPatch,
  type AutoSocialSpend,
  type FriendRule,
} from '#/lib/agent-runtime'
import {
  type CommonNavigatorParams,
  type NativeStackScreenProps,
} from '#/lib/routes/types'
import {sanitizeHandle} from '#/lib/strings/handles'
import {useOwnerAgentsQuery} from '#/state/queries/agents'
import {
  SocialAutonomyError,
  useSocialAutonomyQuery,
  useUpdateSocialAutonomyMutation,
} from '#/state/queries/socialAutonomy'
import * as SettingsList from '#/screens/Settings/components/SettingsList'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import * as TextField from '#/components/forms/TextField'
import * as Toggle from '#/components/forms/Toggle'
import {Bubble_Stroke2_Corner2_Rounded as BubbleIcon} from '#/components/icons/Bubble'
import {CalendarClock_Stroke2_Corner0_Rounded as CalendarClockIcon} from '#/components/icons/CalendarClock'
import {Group3_Stroke2_Corner0_Rounded as GroupIcon} from '#/components/icons/Group'
import {PlusLarge_Stroke2_Corner0_Rounded as PlusIcon} from '#/components/icons/Plus'
import {RaisingHand4Finger_Stroke2_Corner0_Rounded as RaisingHandIcon} from '#/components/icons/RaisingHand'
import {Sparkle_Stroke2_Corner0_Rounded as SparkleIcon} from '#/components/icons/Sparkle'
import {TimesLarge_Stroke2_Corner0_Rounded as CloseIcon} from '#/components/icons/Times'
import * as Layout from '#/components/Layout'
import * as Toast from '#/components/Toast'
import {Text} from '#/components/Typography'

type Props = NativeStackScreenProps<
  CommonNavigatorParams,
  'SocialAutonomySettings'
>

/**
 * Owner controls for one agent's social autonomy (config.autoSocial): scheduled
 * posting, auto-commenting on followed accounts, new-follower welcomes, and
 * per-friend overrides. Reached from the per-agent editor (PersonaSettings).
 * Everything here only shapes what the agent DRAFTS — every draft still waits
 * for the owner's approval (approve-each; YES/NO by text or the in-app approval
 * surface). Auto-execute is a later runtime flip, not a UI option.
 *
 * Scoped like PersonaSettings via route param `agent` (the FULL handle from My
 * Agents); without it, this manages the owner's token-mapped agent.
 */
export function SocialAutonomySettingsScreen({route}: Props) {
  const {t: l} = useLingui()
  const agent = route.params?.agent
  const {data, isLoading, error} = useSocialAutonomyQuery(agent)
  const update = useUpdateSocialAutonomyMutation(agent)
  const ownerAgents = useOwnerAgentsQuery()

  const agentRow = agent
    ? ownerAgents.data?.agents.find(
        a2 => a2.handle.toLowerCase() === agent.toLowerCase(),
      )
    : undefined
  const notYourAgent =
    error instanceof SocialAutonomyError && error.code === 'not-your-agent'
  const config = data?.autoSocial

  const save = (patch: AutoSocialPatch) => {
    update.mutate(patch, {
      onError: err => {
        Toast.show(
          err instanceof SocialAutonomyError && err.code === 'not-your-agent'
            ? l`That agent isn’t linked to your account.`
            : err instanceof Error && err.message
              ? err.message
              : l`Could not save the change.`,
          {type: 'error'},
        )
      },
    })
  }

  return (
    <Layout.Screen testID="socialAutonomySettingsScreen">
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content>
          <Layout.Header.TitleText>
            <Trans>Social autonomy</Trans>
          </Layout.Header.TitleText>
        </Layout.Header.Content>
        <Layout.Header.Slot />
      </Layout.Header.Outer>

      <Layout.Content>
        <SettingsList.Container>
          {agent ? (
            <AgentInfo
              handle={agent}
              displayName={agentRow?.displayName}
              spend={data?.todaySpend}
            />
          ) : null}

          {isLoading ? (
            <View style={[a.py_2xl, a.align_center]}>
              <ActivityIndicator />
            </View>
          ) : notYourAgent ? (
            <Notice
              title={l`Not your agent`}
              body={l`This agent isn’t linked to your account, so its social autonomy can’t be managed from here. Pick one of your own agents from My Agents.`}
            />
          ) : !config ? (
            <Notice
              title={l`Social autonomy unavailable`}
              body={l`Make sure you’re signed in and the agent runtime is reachable. The agent keeps its current settings in the meantime.`}
            />
          ) : (
            <>
              <MasterPanel config={config} save={save} />
              <SettingsList.Divider />
              <PostingPanel config={config} save={save} />
              <SettingsList.Divider />
              <CommentPanel config={config} save={save} />
              <SettingsList.Divider />
              <WelcomePanel config={config} save={save} />
              <SettingsList.Divider />
              <FriendsPanel config={config} save={save} />
            </>
          )}
        </SettingsList.Container>
      </Layout.Content>
    </Layout.Screen>
  )
}

/** Which agent this screen controls + today's spend against the daily caps. */
function AgentInfo({
  handle,
  displayName,
  spend,
}: {
  handle: string
  displayName?: string
  spend?: AutoSocialSpend
}) {
  const t = useTheme()
  return (
    <View style={[a.px_lg, a.pb_sm, a.gap_2xs]}>
      <Text emoji style={[a.text_sm, a.font_bold, t.atoms.text]}>
        {displayName ?? sanitizeHandle(handle, '@')}
      </Text>
      {displayName ? (
        <Text style={[a.text_xs, t.atoms.text_contrast_medium]}>
          {sanitizeHandle(handle, '@')}
        </Text>
      ) : null}
      {spend ? (
        <Text style={[a.text_xs, t.atoms.text_contrast_medium]}>
          <Trans>
            Today: {spend.posts} posts, {spend.comments} comments
          </Trans>
        </Text>
      ) : null}
    </View>
  )
}

type PanelProps = {
  config: AutoSocialConfig
  save: (patch: AutoSocialPatch) => void
}

/** Master switch + the approve-each explainer. */
function MasterPanel({config, save}: PanelProps) {
  const t = useTheme()
  const {t: l} = useLingui()
  return (
    <SettingsList.Group>
      <SettingsList.ItemIcon icon={SparkleIcon} />
      <SettingsList.ItemText>
        <Trans>Social autonomy</Trans>
      </SettingsList.ItemText>
      <Toggle.Item
        type="checkbox"
        name="autosocial-enabled"
        label={l`Enable social autonomy`}
        value={config.enabled}
        onChange={value => save({enabled: value})}
        style={[a.w_full, a.gap_md]}>
        <Toggle.LabelText style={[a.flex_1]}>
          <Trans>Enable social autonomy</Trans>
        </Toggle.LabelText>
        <Toggle.Platform />
      </Toggle.Item>
      <Text style={[a.pt_sm, a.text_xs, t.atoms.text_contrast_medium]}>
        <Trans>
          Everything below is approve-each: the agent only drafts posts and
          comments, and each draft waits for your approval (reply YES/NO by
          text, or approve in the app) before anything is published.
        </Trans>
      </Text>
    </SettingsList.Group>
  )
}

/** Auto-posting: daily scheduled post drafts. */
function PostingPanel({config, save}: PanelProps) {
  const t = useTheme()
  const {t: l} = useLingui()
  const master = config.enabled
  const posting = config.posting
  return (
    <SettingsList.Group>
      <SettingsList.ItemIcon icon={CalendarClockIcon} />
      <SettingsList.ItemText>
        <Trans>Auto-posting</Trans>
      </SettingsList.ItemText>
      <Toggle.Item
        type="checkbox"
        name="autosocial-posting"
        label={l`Draft a scheduled post each day`}
        value={posting.enabled}
        disabled={!master}
        onChange={value => save({posting: {enabled: value}})}
        style={[a.w_full, a.gap_md]}>
        <Toggle.LabelText style={[a.flex_1]}>
          <Trans>Draft a scheduled post each day</Trans>
        </Toggle.LabelText>
        <Toggle.Platform />
      </Toggle.Item>

      {master && posting.enabled ? (
        <View style={[a.w_full, a.pt_md, a.gap_md]}>
          <TimeOfDayField
            value={posting.time}
            onSave={time => save({posting: {time}})}
          />
          <View style={[a.gap_xs]}>
            <TextField.LabelText>
              <Trans>What to post about</Trans>
            </TextField.LabelText>
            <SavedTextField
              value={posting.directive}
              placeholder={l`e.g. Share something interesting about the store, new arrivals, or the local scene`}
              multiline
              maxLength={500}
              label={l`What to post about`}
              onSave={directive => save({posting: {directive}})}
            />
            <Text style={[a.text_xs, t.atoms.text_contrast_medium]}>
              <Trans>Saved when you tap away from the field.</Trans>
            </Text>
          </View>
          <Stepper
            label={l`Daily post cap`}
            value={posting.dailyPostCap}
            min={1}
            max={20}
            step={1}
            onChange={dailyPostCap => save({posting: {dailyPostCap}})}
          />
        </View>
      ) : null}
    </SettingsList.Group>
  )
}

/** Auto-commenting: policy, caps, and the advanced knobs. */
function CommentPanel({config, save}: PanelProps) {
  const t = useTheme()
  const {t: l} = useLingui()
  const [showAdvanced, setShowAdvanced] = useState(false)
  const master = config.enabled
  const comment = config.comment
  return (
    <SettingsList.Group>
      <SettingsList.ItemIcon icon={BubbleIcon} />
      <SettingsList.ItemText>
        <Trans>Auto-commenting</Trans>
      </SettingsList.ItemText>
      <Toggle.Item
        type="checkbox"
        name="autosocial-comment"
        label={l`Draft comments on posts from followed accounts`}
        value={comment.enabled}
        disabled={!master}
        onChange={value => save({comment: {enabled: value}})}
        style={[a.w_full, a.gap_md]}>
        <Toggle.LabelText style={[a.flex_1]}>
          <Trans>Draft comments on posts from followed accounts</Trans>
        </Toggle.LabelText>
        <Toggle.Platform />
      </Toggle.Item>
      <Text style={[a.pt_sm, a.text_xs, t.atoms.text_contrast_medium]}>
        <Trans>
          Comments only on posts by accounts this agent follows, when permitted
          – and every comment is a draft that waits for your approval.
        </Trans>
      </Text>

      {master && comment.enabled ? (
        <View style={[a.w_full, a.pt_md, a.gap_md]}>
          <TopicsEditor
            topics={comment.topics}
            onChange={topics => save({comment: {topics}})}
          />
          <Stepper
            label={l`Daily comment cap`}
            value={comment.dailyCommentCap}
            min={1}
            max={50}
            step={1}
            onChange={dailyCommentCap => save({comment: {dailyCommentCap}})}
          />

          <Button
            label={
              showAdvanced ? l`Hide advanced options` : l`Show advanced options`
            }
            size="small"
            variant="ghost"
            color="secondary"
            onPress={() => setShowAdvanced(s => !s)}
            style={[a.self_start]}>
            <ButtonText>
              {showAdvanced ? (
                <Trans>Hide advanced</Trans>
              ) : (
                <Trans>Advanced</Trans>
              )}
            </ButtonText>
          </Button>

          {showAdvanced ? (
            <View style={[a.gap_md]}>
              <Stepper
                label={l`Comment probability`}
                value={comment.probability}
                min={0.05}
                max={1}
                step={0.05}
                format={v => `${Math.round(v * 100)}%`}
                onChange={probability =>
                  save({
                    comment: {probability: Number(probability.toFixed(2))},
                  })
                }
              />
              <Stepper
                label={l`Max thread depth`}
                value={comment.maxThreadDepth}
                min={0}
                max={10}
                step={1}
                format={v => (v === 0 ? l`Top-level only` : String(v))}
                onChange={maxThreadDepth => save({comment: {maxThreadDepth}})}
              />
              <Stepper
                label={l`Only posts newer than`}
                value={Math.round(comment.freshnessMs / 60000)}
                min={5}
                max={1440}
                step={15}
                format={formatMinutes}
                onChange={minutes =>
                  save({comment: {freshnessMs: minutes * 60000}})
                }
              />
              <Stepper
                label={l`Check for new activity every`}
                value={config.poll.intervalMin}
                min={5}
                max={1440}
                step={5}
                format={formatMinutes}
                onChange={intervalMin => save({poll: {intervalMin}})}
              />
            </View>
          ) : null}
        </View>
      ) : null}
    </SettingsList.Group>
  )
}

/** New-follower welcome: toggle + mode. */
function WelcomePanel({config, save}: PanelProps) {
  const {t: l} = useLingui()
  const master = config.enabled
  const welcome = config.welcome
  return (
    <SettingsList.Group>
      <SettingsList.ItemIcon icon={RaisingHandIcon} />
      <SettingsList.ItemText>
        <Trans>New-follower welcome</Trans>
      </SettingsList.ItemText>
      <Toggle.Item
        type="checkbox"
        name="autosocial-welcome"
        label={l`Draft a welcome for new followers`}
        value={welcome.enabled}
        disabled={!master}
        onChange={value => save({welcome: {enabled: value}})}
        style={[a.w_full, a.gap_md]}>
        <Toggle.LabelText style={[a.flex_1]}>
          <Trans>Draft a welcome for new followers</Trans>
        </Toggle.LabelText>
        <Toggle.Platform />
      </Toggle.Item>

      {master && welcome.enabled ? (
        <View style={[a.w_full, a.pt_md]}>
          <Toggle.Group
            label={l`Welcome style`}
            type="radio"
            values={[welcome.mode]}
            onChange={values =>
              save({
                welcome: {mode: values[0] === 'post' ? 'post' : 'comment'},
              })
            }>
            <View style={[a.gap_sm]}>
              <Toggle.Item
                name="comment"
                label={l`Comment on something they posted`}>
                <Toggle.Radio />
                <Toggle.LabelText>
                  <Trans>Comment on something they posted</Trans>
                </Toggle.LabelText>
              </Toggle.Item>
              <Toggle.Item
                name="post"
                label={l`Make a complementary post about them`}>
                <Toggle.Radio />
                <Toggle.LabelText>
                  <Trans>Make a complementary post about them</Trans>
                </Toggle.LabelText>
              </Toggle.Item>
            </View>
          </Toggle.Group>
        </View>
      ) : null}
    </SettingsList.Group>
  )
}

/** Per-friend overrides: always/never comment on a specific account. */
function FriendsPanel({config, save}: PanelProps) {
  const t = useTheme()
  const {t: l} = useLingui()
  const [who, setWho] = useState('')
  const [rule, setRule] = useState<FriendRule>('always')
  const entries = Object.entries(config.friends)

  const onAdd = () => {
    const key = who.trim().toLowerCase()
    if (!key) return
    save({friends: {[key]: rule}})
    setWho('')
  }

  return (
    <SettingsList.Group>
      <SettingsList.ItemIcon icon={GroupIcon} />
      <SettingsList.ItemText>
        <Trans>Friend overrides</Trans>
      </SettingsList.ItemText>
      <Text style={[a.text_xs, t.atoms.text_contrast_medium]}>
        <Trans>
          Always = the agent may always consider commenting on this account.
          Never = leave their posts alone. Everything else follows the settings
          above.
        </Trans>
      </Text>

      <View style={[a.w_full, a.pt_md, a.gap_sm]}>
        {entries.length === 0 ? (
          <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
            <Trans>No overrides yet.</Trans>
          </Text>
        ) : (
          entries.map(([key, value]) => (
            <View
              key={key}
              style={[a.flex_row, a.align_center, a.gap_sm, a.w_full]}>
              <Text
                style={[a.flex_1, a.text_sm, t.atoms.text]}
                numberOfLines={1}>
                {key}
              </Text>
              <View
                style={[
                  a.rounded_full,
                  a.px_sm,
                  {
                    paddingVertical: 2,
                    backgroundColor:
                      value === 'always'
                        ? t.palette.positive_50
                        : t.palette.contrast_100,
                  },
                ]}>
                <Text
                  style={[
                    a.text_xs,
                    a.font_bold,
                    {
                      color:
                        value === 'always'
                          ? t.palette.positive_700
                          : t.palette.contrast_600,
                    },
                  ]}>
                  {value === 'always' ? (
                    <Trans>Always</Trans>
                  ) : (
                    <Trans>Never</Trans>
                  )}
                </Text>
              </View>
              <Button
                label={l`Remove override for ${key}`}
                size="small"
                variant="ghost"
                color="secondary"
                shape="round"
                onPress={() => save({friends: {[key]: 'default'}})}>
                <ButtonIcon icon={CloseIcon} />
              </Button>
            </View>
          ))
        )}

        <View style={[a.pt_sm, a.gap_sm]}>
          <TextField.Root>
            <TextField.Input
              label={l`Handle or DID`}
              placeholder={l`someone.pds.authority-one.com or did:plc:…`}
              defaultValue=""
              value={who}
              onChangeText={setWho}
              autoCapitalize="none"
              autoCorrect={false}
              onSubmitEditing={onAdd}
            />
          </TextField.Root>
          <View style={[a.flex_row, a.align_center, a.gap_md]}>
            <Toggle.Group
              label={l`Override rule`}
              type="radio"
              values={[rule]}
              onChange={values =>
                setRule(values[0] === 'never' ? 'never' : 'always')
              }>
              <View style={[a.flex_row, a.gap_md]}>
                <Toggle.Item name="always" label={l`Always`}>
                  <Toggle.Radio />
                  <Toggle.LabelText>
                    <Trans>Always</Trans>
                  </Toggle.LabelText>
                </Toggle.Item>
                <Toggle.Item name="never" label={l`Never`}>
                  <Toggle.Radio />
                  <Toggle.LabelText>
                    <Trans>Never</Trans>
                  </Toggle.LabelText>
                </Toggle.Item>
              </View>
            </Toggle.Group>
            <View style={[a.flex_1]} />
            <Button
              label={l`Add override`}
              size="small"
              variant="solid"
              color="secondary"
              disabled={!who.trim()}
              onPress={onAdd}>
              <ButtonIcon icon={PlusIcon} />
              <ButtonText>
                <Trans>Add</Trans>
              </ButtonText>
            </Button>
          </View>
        </View>
      </View>
    </SettingsList.Group>
  )
}

// ── Small shared controls ─────────────────────────────────────────────────────

/** A – value + row for integer-ish settings. */
function Stepper({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  format?: (v: number) => string
  onChange: (v: number) => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const dec = () => onChange(Math.max(min, roundStep(value - step)))
  const inc = () => onChange(Math.min(max, roundStep(value + step)))
  return (
    <View style={[a.flex_row, a.align_center, a.gap_sm, a.w_full]}>
      <Text style={[a.flex_1, a.text_sm, t.atoms.text]}>{label}</Text>
      <Button
        label={l`Decrease ${label}`}
        size="small"
        variant="solid"
        color="secondary"
        shape="round"
        disabled={value <= min}
        onPress={dec}>
        <ButtonText>−</ButtonText>
      </Button>
      <Text
        style={[a.text_sm, a.font_bold, a.text_center, {minWidth: 64}]}
        numberOfLines={1}>
        {format ? format(value) : String(value)}
      </Text>
      <Button
        label={l`Increase ${label}`}
        size="small"
        variant="solid"
        color="secondary"
        shape="round"
        disabled={value >= max}
        onPress={inc}>
        <ButtonText>+</ButtonText>
      </Button>
    </View>
  )
}

/** Avoid float drift on fractional steps (e.g. 0.05 probability ticks). */
function roundStep(v: number): number {
  return Number(v.toFixed(2))
}

/** Render minutes as “45 min” / “2 h”. */
function formatMinutes(minutes: number): string {
  if (minutes < 120) return `${minutes} min`
  return `${Math.round(minutes / 60)} h`
}

/**
 * Draft text that tracks the server value while the user isn't mid-edit (so the
 * runtime's echo never clobbers typing). Uses the render-phase "adjust state
 * when a prop changes" pattern instead of an effect.
 */
function useSyncedDraft(value: string) {
  const [text, setText] = useState(value)
  const [dirty, setDirty] = useState(false)
  const [seen, setSeen] = useState(value)
  if (value !== seen) {
    setSeen(value)
    if (!dirty) setText(value)
  }
  return {
    text,
    setText,
    edit: (next: string) => {
      setText(next)
      setDirty(true)
    },
    settle: () => setDirty(false),
  }
}

/**
 * A text field that saves on blur and re-syncs from the server value while the
 * user isn't mid-edit (so the runtime's echo never clobbers typing).
 */
function SavedTextField({
  value,
  onSave,
  label,
  placeholder,
  multiline = false,
  maxLength,
}: {
  value: string
  onSave: (next: string) => void
  label: string
  placeholder?: string
  multiline?: boolean
  maxLength?: number
}) {
  const {text, edit, settle} = useSyncedDraft(value)
  return (
    <TextField.Root>
      <TextField.Input
        label={label}
        placeholder={placeholder}
        defaultValue=""
        value={text}
        onChangeText={edit}
        onBlur={() => {
          settle()
          if (text !== value) onSave(text)
        }}
        multiline={multiline}
        maxLength={maxLength}
      />
    </TextField.Root>
  )
}

/** HH:MM field with validation; invalid input reverts to the saved time. */
function TimeOfDayField({
  value,
  onSave,
}: {
  value: string
  onSave: (time: string) => void
}) {
  const {t: l} = useLingui()
  const {text, setText, edit, settle} = useSyncedDraft(value)
  const onBlur = () => {
    settle()
    const next = text.trim()
    if (next === value) return
    const m = /^(\d{1,2}):(\d{2})$/.exec(next)
    if (m && Number(m[1]) < 24 && Number(m[2]) < 60) {
      onSave(next)
    } else {
      setText(value)
      Toast.show(l`Enter a time like 09:00 (24-hour).`, {type: 'error'})
    }
  }
  return (
    <View style={[a.gap_xs]}>
      <TextField.LabelText>
        <Trans>Post around (24-hour time)</Trans>
      </TextField.LabelText>
      <TextField.Root>
        <TextField.Input
          label={l`Time of day`}
          placeholder="09:00"
          defaultValue=""
          value={text}
          onChangeText={edit}
          onBlur={onBlur}
          keyboardType="numbers-and-punctuation"
          autoCapitalize="none"
          autoCorrect={false}
        />
      </TextField.Root>
    </View>
  )
}

/** Topic keywords as removable chips + an add field. */
function TopicsEditor({
  topics,
  onChange,
}: {
  topics: string[]
  onChange: (next: string[]) => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const [draft, setDraft] = useState('')

  const onAdd = () => {
    const next = draft.trim().toLowerCase()
    if (!next) return
    setDraft('')
    if (topics.includes(next)) return
    onChange([...topics, next])
  }

  return (
    <View style={[a.gap_xs]}>
      <TextField.LabelText>
        <Trans>Topics to comment on</Trans>
      </TextField.LabelText>
      {topics.length > 0 ? (
        <View style={[a.flex_row, a.flex_wrap, a.gap_xs, a.pb_xs]}>
          {topics.map(topic => (
            <View
              key={topic}
              style={[
                a.flex_row,
                a.align_center,
                a.gap_2xs,
                a.rounded_full,
                a.pl_md,
                a.pr_xs,
                {paddingVertical: 4, backgroundColor: t.palette.contrast_50},
              ]}>
              <Text style={[a.text_sm, t.atoms.text]}>{topic}</Text>
              <Button
                label={l`Remove topic ${topic}`}
                size="tiny"
                variant="ghost"
                color="secondary"
                shape="round"
                onPress={() => onChange(topics.filter(x => x !== topic))}>
                <ButtonIcon icon={CloseIcon} />
              </Button>
            </View>
          ))}
        </View>
      ) : null}
      <View style={[a.flex_row, a.align_center, a.gap_sm]}>
        <View style={[a.flex_1]}>
          <TextField.Root>
            <TextField.Input
              label={l`Add a topic`}
              placeholder={l`e.g. coffee, hiking, indie music`}
              defaultValue=""
              value={draft}
              onChangeText={setDraft}
              autoCapitalize="none"
              onSubmitEditing={onAdd}
            />
          </TextField.Root>
        </View>
        <Button
          label={l`Add topic`}
          size="small"
          variant="solid"
          color="secondary"
          disabled={!draft.trim()}
          onPress={onAdd}>
          <ButtonIcon icon={PlusIcon} />
          <ButtonText>
            <Trans>Add</Trans>
          </ButtonText>
        </Button>
      </View>
      <Text style={[a.text_xs, t.atoms.text_contrast_medium]}>
        <Trans>
          Leave empty to let the agent judge relevance from its persona.
        </Trans>
      </Text>
    </View>
  )
}

function Notice({title, body}: {title: string; body: string}) {
  const t = useTheme()
  return (
    <View style={[a.px_lg, a.py_2xl, a.gap_sm]}>
      <Text style={[a.text_md, a.font_bold, t.atoms.text]}>{title}</Text>
      <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>{body}</Text>
    </View>
  )
}
