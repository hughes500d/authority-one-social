import {useState} from 'react'
import {ActivityIndicator, View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {
  filterVoices,
  findAssignedVoice,
  formatLabelValue,
  type LibraryVoice,
  voiceDisplayLabel,
  type VoiceFilterKey,
  type VoiceFilters,
  voiceLabelSummary,
  voiceLabelValues,
  voicePickOptions,
} from '#/lib/agent-runtime'
import {
  type CommonNavigatorParams,
  type NativeStackScreenProps,
} from '#/lib/routes/types'
import {sanitizeHandle} from '#/lib/strings/handles'
import {useOwnerAgentsQuery} from '#/state/queries/agents'
import {PersonaWriteError, usePersonasQuery} from '#/state/queries/personas'
import {
  useAssignAgentVoiceMutation,
  useVoiceLibraryQuery,
} from '#/state/queries/voiceLibrary'
import {useVoiceRegistryQuery} from '#/state/queries/voices'
import * as SettingsList from '#/screens/Settings/components/SettingsList'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import * as TextField from '#/components/forms/TextField'
import {Check_Stroke2_Corner0_Rounded as CheckIcon} from '#/components/icons/Check'
import {ChevronBottom_Stroke2_Corner0_Rounded as ChevronDownIcon} from '#/components/icons/Chevron'
import {MagnifyingGlass_Stroke2_Corner0_Rounded as SearchIcon} from '#/components/icons/MagnifyingGlass'
import {Pause_Filled_Corner0_Rounded as PauseIcon} from '#/components/icons/Pause'
import {Play_Filled_Corner0_Rounded as PlayIcon} from '#/components/icons/Play'
import {SpeakerVolumeFull_Stroke2_Corner0_Rounded as SpeakerIcon} from '#/components/icons/Speaker'
import * as Layout from '#/components/Layout'
import * as Menu from '#/components/Menu'
import * as Toast from '#/components/Toast'
import {Text} from '#/components/Typography'
import {usePreviewPlayer} from './usePreviewPlayer'

type Props = NativeStackScreenProps<CommonNavigatorParams, 'VoiceSettings'>

/**
 * The agent VOICE PICKER: browse the full voice library (GET /app/voices, pinned
 * library contract), hear a sample of any voice before committing (one preview at
 * a time; hosted previewUrl or the POST /preview fallback), and assign one to the
 * agent. The library is large, so nothing renders unfiltered past a cap — search
 * + label filters (accent/gender/age/use case) are the way in.
 *
 * Scoped like PersonaSettings/KnowledgeBaseSettings via route param `agent` (the
 * FULL handle from My Agents); without it, this manages the owner's token-mapped
 * agent. Assignment writes the raw ElevenLabs id to the agent's ACTIVE persona
 * via the existing /app/personas/update merge path — the runtime resolves the
 * agent's spoken voice from that server-side.
 */
export function VoiceSettingsScreen({route}: Props) {
  const t = useTheme()
  const {t: l} = useLingui()
  const agent = route.params?.agent
  const personas = usePersonasQuery(agent)
  const registry = useVoiceRegistryQuery()
  const library = useVoiceLibrary()
  const assign = useAssignAgentVoiceMutation(agent)
  const ownerAgents = useOwnerAgentsQuery()

  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<VoiceFilters>({})

  const preview = usePreviewPlayer({
    onError: () =>
      Toast.show(l`Couldn’t play that preview. Try another voice.`, {
        type: 'error',
      }),
  })

  const agentRow = agent
    ? ownerAgents.data?.agents.find(
        a2 => a2.handle.toLowerCase() === agent.toLowerCase(),
      )
    : undefined
  const agentLabel =
    agentRow?.displayName ??
    (agent ? sanitizeHandle(agent, '@') : l`your agent`)
  const notYourAgent =
    personas.error instanceof PersonaWriteError &&
    personas.error.code === 'not-your-agent'

  const voices = library.voices ?? []
  const registryOptions = registry.data ? voicePickOptions(registry.data) : []

  // The agent's CURRENT voice: the active persona's stored voiceId (any of the
  // three stored forms), resolved to a library row when possible.
  const activePersona = personas.data?.personas.find(
    p => p.id === personas.data?.activePersonaId,
  )
  // activeVoiceId first: the runtime folds the agent-level voice attribute into
  // it (attribute > persona voice), so it is the authoritative "sounds like now".
  const storedVoiceId = personas.data?.activeVoiceId ?? activePersona?.voiceId
  const assignedVoice = findAssignedVoice(
    voices,
    registryOptions,
    storedVoiceId,
  )
  // A stored voice the library doesn't know still deserves an honest name.
  const fallbackVoiceName =
    voiceDisplayLabel(registryOptions, storedVoiceId) ??
    personas.data?.voices.find(v => v.voiceId === storedVoiceId)?.name

  const filtered = filterVoices(voices, search, filters)
  const shown = filtered.slice(0, RESULTS_CAP)

  const canAssign = !!personas.data?.activePersonaId && !assign.isPending
  const pendingVoiceId = assign.isPending
    ? assign.variables?.voiceId
    : undefined

  const onUse = (voice: LibraryVoice) => {
    // personaId is only the LEGACY fallback target (pre-06ea03c runtime); the
    // primary path assigns the agent-level voice attribute.
    const personaId = personas.data?.activePersonaId
    if (!personaId) return
    assign.mutate(
      {personaId, voiceId: voice.id},
      {
        onSuccess: () => {
          // Plain template literal, not l`` — uncompiled interpolated messages
          // render the raw ICU placeholder (same gotcha as the KB toasts). The
          // label leads the sentence, so the unscoped "your agent" needs a cap.
          const lead = agentLabel.charAt(0).toUpperCase() + agentLabel.slice(1)
          Toast.show(`${lead} now speaks as “${voice.name}”.`, {
            type: 'success',
          })
        },
        onError: err => {
          Toast.show(
            err instanceof PersonaWriteError && err.code === 'not-your-agent'
              ? l`That agent isn’t linked to your account.`
              : err instanceof Error && err.message
                ? err.message
                : l`Could not set the voice.`,
            {type: 'error'},
          )
        },
      },
    )
  }

  const loading = (library.isLoading || personas.isLoading) && !notYourAgent

  return (
    <Layout.Screen testID="voiceSettingsScreen">
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content>
          <Layout.Header.TitleText>
            <Trans>Voice</Trans>
          </Layout.Header.TitleText>
        </Layout.Header.Content>
        <Layout.Header.Slot />
      </Layout.Header.Outer>

      <Layout.Content>
        <SettingsList.Container>
          <View style={[a.px_lg, a.pb_md, a.gap_xs]}>
            <Text
              style={[a.text_sm, t.atoms.text_contrast_medium, a.leading_snug]}>
              {`Pick the voice ${agentLabel} speaks with. Tap play to hear a sample before you choose.`}
            </Text>
          </View>

          {notYourAgent ? (
            <Notice
              title={l`Not your agent`}
              body={l`This agent isn’t linked to your account, so its voice can’t be changed from here. Pick one of your own agents from My Agents.`}
            />
          ) : loading ? (
            <View style={[a.py_2xl, a.align_center]}>
              <ActivityIndicator />
            </View>
          ) : library.voices === null ? (
            <Notice
              title={l`Voice library unavailable`}
              body={l`The voice library couldn’t be loaded. Make sure you’re signed in and the agent runtime is reachable — the current voice keeps working in the meantime.`}
            />
          ) : (
            <>
              <CurrentVoiceCard
                voice={assignedVoice}
                fallbackName={fallbackVoiceName ?? storedVoiceId}
                agentLabel={agentLabel}
                previewState={preview.state}
                onTogglePreview={preview.toggle}
              />

              {assign.isError ? (
                <Text
                  style={[
                    a.px_lg,
                    a.pb_sm,
                    a.text_sm,
                    {color: t.palette.negative_500},
                  ]}>
                  {assign.error instanceof Error
                    ? assign.error.message
                    : l`Could not set the voice.`}
                </Text>
              ) : null}

              <SettingsList.Divider />

              <View style={[a.px_lg, a.py_sm, a.gap_sm]}>
                <TextField.Root>
                  <TextField.Icon icon={SearchIcon} />
                  <TextField.Input
                    label={l`Search voices`}
                    placeholder={l`Search by name or style`}
                    defaultValue={search}
                    onChangeText={setSearch}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </TextField.Root>
                <FilterRow
                  voices={voices}
                  filters={filters}
                  onChange={setFilters}
                />
              </View>

              {shown.length === 0 ? (
                <Notice
                  title={l`No voices match`}
                  body={l`Try a different search or clear some filters.`}
                />
              ) : (
                shown.map(voice => (
                  <VoiceRow
                    key={voice.id}
                    voice={voice}
                    assigned={assignedVoice?.id === voice.id}
                    previewState={preview.state}
                    onTogglePreview={() => preview.toggle(voice)}
                    canAssign={canAssign}
                    assigning={pendingVoiceId === voice.id}
                    onUse={() => onUse(voice)}
                  />
                ))
              )}

              {filtered.length > shown.length ? (
                <Text
                  style={[
                    a.px_lg,
                    a.py_md,
                    a.text_xs,
                    t.atoms.text_contrast_medium,
                  ]}>
                  {`Showing the first ${shown.length} of ${filtered.length} voices — search or filter to narrow it down.`}
                </Text>
              ) : null}

              {!personas.data?.activePersonaId && !personas.isLoading ? (
                <Text
                  style={[
                    a.px_lg,
                    a.py_md,
                    a.text_xs,
                    t.atoms.text_contrast_medium,
                  ]}>
                  <Trans>
                    Voices can be previewed, but not assigned right now — the
                    agent’s persona couldn’t be loaded.
                  </Trans>
                </Text>
              ) : null}
            </>
          )}
        </SettingsList.Container>
      </Layout.Content>
    </Layout.Screen>
  )
}

/** How many rows render at once — the library is large; search/filters reach the rest. */
const RESULTS_CAP = 50

function useVoiceLibrary() {
  const {data, isLoading} = useVoiceLibraryQuery()
  return {voices: data, isLoading}
}

/** The agent's current voice, obvious at a glance — with its own play control. */
function CurrentVoiceCard({
  voice,
  fallbackName,
  agentLabel,
  previewState,
  onTogglePreview,
}: {
  voice?: LibraryVoice
  fallbackName?: string
  agentLabel: string
  previewState: {voiceId: string; phase: 'loading' | 'playing'} | null
  onTogglePreview: (voice: LibraryVoice) => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  return (
    <View style={[a.px_lg, a.pb_md]}>
      <View
        style={[
          a.flex_row,
          a.align_center,
          a.gap_md,
          a.rounded_md,
          a.p_md,
          a.border,
          {borderColor: t.palette.primary_500},
        ]}>
        <SpeakerIcon size="lg" fill={t.palette.primary_500} />
        <View style={[a.flex_1, a.gap_2xs]}>
          <Text style={[a.text_xs, t.atoms.text_contrast_medium]}>
            <Trans>Current voice</Trans>
          </Text>
          {voice ? (
            <>
              <Text emoji style={[a.text_md, a.font_bold, t.atoms.text]}>
                {voice.name}
              </Text>
              {voiceLabelSummary(voice) ? (
                <Text style={[a.text_xs, t.atoms.text_contrast_medium]}>
                  {voiceLabelSummary(voice)}
                </Text>
              ) : null}
            </>
          ) : fallbackName ? (
            <>
              <Text emoji style={[a.text_md, a.font_bold, t.atoms.text]}>
                {fallbackName}
              </Text>
              <Text style={[a.text_xs, t.atoms.text_contrast_low]}>
                <Trans>Not in the voice library</Trans>
              </Text>
            </>
          ) : (
            <Text style={[a.text_md, t.atoms.text_contrast_medium]}>
              {`${agentLabel} is using the default voice.`}
            </Text>
          )}
        </View>
        {voice ? (
          <PreviewButton
            voiceName={voice.name}
            state={
              previewState?.voiceId === voice.id ? previewState.phase : null
            }
            onPress={() => onTogglePreview(voice)}
            label={l`Preview the current voice`}
          />
        ) : null}
      </View>
    </View>
  )
}

/** Play/stop control with explicit loading state; only one plays at a time. */
function PreviewButton({
  voiceName,
  state,
  onPress,
  label,
}: {
  voiceName: string
  state: 'loading' | 'playing' | null
  onPress: () => void
  label?: string
}) {
  const t = useTheme()
  return (
    <Button
      label={
        label ??
        (state ? `Stop the ${voiceName} preview` : `Play a ${voiceName} sample`)
      }
      size="small"
      variant="solid"
      color={state === 'playing' ? 'primary' : 'secondary'}
      shape="round"
      onPress={onPress}>
      {state === 'loading' ? (
        <ActivityIndicator size="small" color={t.atoms.text.color} />
      ) : state === 'playing' ? (
        <ButtonIcon icon={PauseIcon} />
      ) : (
        <ButtonIcon icon={PlayIcon} />
      )}
    </Button>
  )
}

/** One library voice: preview control, name + labels + description, Use/Current. */
function VoiceRow({
  voice,
  assigned,
  previewState,
  onTogglePreview,
  canAssign,
  assigning,
  onUse,
}: {
  voice: LibraryVoice
  assigned: boolean
  previewState: {voiceId: string; phase: 'loading' | 'playing'} | null
  onTogglePreview: () => void
  canAssign: boolean
  assigning: boolean
  onUse: () => void
}) {
  const t = useTheme()
  const rowPreview =
    previewState?.voiceId === voice.id ? previewState.phase : null
  const summary = voiceLabelSummary(voice)
  return (
    <SettingsList.Item>
      <PreviewButton
        voiceName={voice.name}
        state={rowPreview}
        onPress={onTogglePreview}
      />
      <View style={[a.flex_1, a.gap_2xs]}>
        <Text emoji style={[a.text_md, a.font_bold, t.atoms.text]}>
          {voice.name}
        </Text>
        {summary ? (
          <Text style={[a.text_xs, t.atoms.text_contrast_medium]}>
            {summary}
          </Text>
        ) : null}
        {voice.description ? (
          <Text
            style={[a.text_xs, t.atoms.text_contrast_low]}
            numberOfLines={2}>
            {voice.description}
          </Text>
        ) : null}
      </View>
      {assigned ? (
        <View
          style={[
            a.flex_row,
            a.align_center,
            a.gap_2xs,
            a.rounded_full,
            a.px_sm,
            {paddingVertical: 3, backgroundColor: t.palette.primary_50},
          ]}>
          <CheckIcon size="xs" fill={t.palette.primary_600} />
          <Text
            style={[a.text_xs, a.font_bold, {color: t.palette.primary_700}]}>
            <Trans>Current</Trans>
          </Text>
        </View>
      ) : (
        <Button
          label={`Use the ${voice.name} voice`}
          size="small"
          variant="solid"
          color="secondary"
          disabled={!canAssign || assigning}
          onPress={onUse}>
          {assigning ? (
            <ActivityIndicator size="small" color={t.atoms.text.color} />
          ) : (
            <ButtonText>
              <Trans>Use</Trans>
            </ButtonText>
          )}
        </Button>
      )}
    </SettingsList.Item>
  )
}

const FILTER_TITLES: Record<VoiceFilterKey, string> = {
  accent: 'Accent',
  gender: 'Gender',
  age: 'Age',
  use_case: 'Use case',
}

/** One dropdown per useful label (accent/gender/age/use case) + Clear. Options
 *  are derived from the loaded library, so they always match real data. */
function FilterRow({
  voices,
  filters,
  onChange,
}: {
  voices: LibraryVoice[]
  filters: VoiceFilters
  onChange: (next: VoiceFilters) => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const anyActive = Object.values(filters).some(Boolean)
  return (
    <View style={[a.flex_row, a.flex_wrap, a.gap_xs, a.align_center]}>
      {(Object.keys(FILTER_TITLES) as VoiceFilterKey[]).map(key => {
        const values = voiceLabelValues(voices, key)
        if (values.length === 0) return null
        const active = filters[key]
        return (
          <Menu.Root key={key}>
            <Menu.Trigger
              label={`Filter by ${FILTER_TITLES[key].toLowerCase()}`}>
              {({props}) => (
                <Button
                  {...props}
                  label={`Filter by ${FILTER_TITLES[key].toLowerCase()}`}
                  size="tiny"
                  variant="solid"
                  color={active ? 'primary_subtle' : 'secondary'}>
                  <ButtonText>
                    {active ? formatLabelValue(active) : FILTER_TITLES[key]}
                  </ButtonText>
                  <ButtonIcon icon={ChevronDownIcon} />
                </Button>
              )}
            </Menu.Trigger>
            <Menu.Outer>
              <Menu.Group>
                <Menu.Item
                  label={l`Any`}
                  onPress={() => onChange({...filters, [key]: undefined})}>
                  <Menu.ItemText>
                    <Trans>Any</Trans>
                  </Menu.ItemText>
                </Menu.Item>
                {values.map(value => (
                  <Menu.Item
                    key={value}
                    label={formatLabelValue(value)}
                    onPress={() => onChange({...filters, [key]: value})}>
                    <Menu.ItemText>{formatLabelValue(value)}</Menu.ItemText>
                    {active === value ? (
                      <Menu.ItemIcon icon={CheckIcon} />
                    ) : null}
                  </Menu.Item>
                ))}
              </Menu.Group>
            </Menu.Outer>
          </Menu.Root>
        )
      })}
      {anyActive ? (
        <Button
          label={l`Clear all filters`}
          size="tiny"
          variant="ghost"
          color="secondary"
          onPress={() => onChange({})}>
          <ButtonText style={[t.atoms.text_contrast_medium]}>
            <Trans>Clear</Trans>
          </ButtonText>
        </Button>
      ) : null}
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
