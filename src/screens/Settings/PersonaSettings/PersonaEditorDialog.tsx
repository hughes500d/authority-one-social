import {useState} from 'react'
import {Pressable, View} from 'react-native'
import {Trans} from '@lingui/react/macro'

import {type Persona, type PersonaVoice} from '#/lib/agent-runtime'
import {
  useCreatePersonaMutation,
  useUpdatePersonaMutation,
} from '#/state/queries/personas'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import * as TextField from '#/components/forms/TextField'
import {Check_Stroke2_Corner0_Rounded as CheckIcon} from '#/components/icons/Check'
import {PlusLarge_Stroke2_Corner0_Rounded as PlusIcon} from '#/components/icons/Plus'
import {TimesLarge_Stroke2_Corner0_Rounded as CloseIcon} from '#/components/icons/Times'
import {Text} from '#/components/Typography'
import {
  addHaunt,
  fictionDraftFromPersona,
  fictionForUpdate,
  removeHaunt,
} from './fiction'

/**
 * Create / edit a persona: name + a voice picked from the runtime's voices list +
 * a free-text personality (applied server-side — the client only sets it).
 */
export function PersonaEditorDialog({
  control,
  persona,
  voices,
}: {
  control: Dialog.DialogControlProps
  persona: Persona | null
  voices: PersonaVoice[]
}) {
  return (
    <Dialog.Outer control={control}>
      <Dialog.Handle />
      {/* Remount the form per-open so create vs edit starts from the right state. */}
      <EditorInner persona={persona} voices={voices} control={control} />
    </Dialog.Outer>
  )
}

function EditorInner({
  persona,
  voices,
  control,
}: {
  persona: Persona | null
  voices: PersonaVoice[]
  control: Dialog.DialogControlProps
}) {
  const t = useTheme()
  const create = useCreatePersonaMutation()
  const update = useUpdatePersonaMutation()
  const isEdit = !!persona

  const [name, setName] = useState(persona?.name ?? '')
  const [personality, setPersonality] = useState(persona?.personality ?? '')
  const [voiceId, setVoiceId] = useState<string | undefined>(
    persona?.voiceId ?? voices.find(v => v.default)?.voiceId ?? voices[0]?.voiceId,
  )
  // Fictional life — authored only on an existing persona (wired to /app/personas/update).
  const [fiction, setFiction] = useState(() => fictionDraftFromPersona(persona))
  const [haunt, setHaunt] = useState('')

  const trimmedName = name.trim()
  const canSave = trimmedName.length > 0 && !create.isPending && !update.isPending

  const onSave = () => {
    if (!canSave) return
    const done = () => control.close()
    if (isEdit && persona) {
      update.mutate(
        {
          id: persona.id,
          name: trimmedName,
          voiceId,
          personality,
          fiction: fictionForUpdate(fiction),
        },
        {onSuccess: done},
      )
    } else {
      create.mutate({name: trimmedName, voiceId, personality}, {onSuccess: done})
    }
  }

  const onAddHaunt = () => {
    const next = addHaunt(fiction.haunts, haunt)
    setFiction(f => ({...f, haunts: next}))
    setHaunt('')
  }

  return (
    <Dialog.ScrollableInner
      label={isEdit ? 'Edit persona' : 'Create persona'}>
      <Dialog.Header>
        <Dialog.HeaderText>
          {isEdit ? <Trans>Edit persona</Trans> : <Trans>Create persona</Trans>}
        </Dialog.HeaderText>
      </Dialog.Header>

      <View style={[a.gap_lg]}>
        <View style={[a.gap_xs]}>
          <TextField.LabelText>
            <Trans>Name</Trans>
          </TextField.LabelText>
          <TextField.Root>
            <TextField.Input
              label="Persona name"
              defaultValue={name}
              onChangeText={setName}
              autoCapitalize="words"
            />
          </TextField.Root>
        </View>

        <View style={[a.gap_xs]}>
          <TextField.LabelText>
            <Trans>Voice</Trans>
          </TextField.LabelText>
          {voices.length === 0 ? (
            <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
              <Trans>No voices available yet.</Trans>
            </Text>
          ) : (
            <View style={[a.gap_2xs]}>
              {voices.map(v => {
                const selected = v.voiceId === voiceId
                return (
                  <Pressable
                    key={v.voiceId}
                    accessibilityRole="button"
                    accessibilityLabel={`Use voice ${v.name}`}
                    accessibilityHint="Selects this voice for the persona"
                    accessibilityState={{selected}}
                    onPress={() => setVoiceId(v.voiceId)}
                    style={[
                      a.flex_row,
                      a.align_center,
                      a.justify_between,
                      a.rounded_sm,
                      a.px_md,
                      a.py_sm,
                      a.border,
                      selected
                        ? {borderColor: t.palette.primary_500}
                        : t.atoms.border_contrast_low,
                    ]}>
                    <Text style={[a.text_md, t.atoms.text]}>
                      {v.name}
                      {v.default ? ' ·' : ''}
                    </Text>
                    {selected ? (
                      <CheckIcon size="sm" fill={t.palette.primary_500} />
                    ) : null}
                  </Pressable>
                )
              })}
            </View>
          )}
        </View>

        <View style={[a.gap_xs]}>
          <TextField.LabelText>
            <Trans>Personality</Trans>
          </TextField.LabelText>
          <TextField.Root>
            <TextField.Input
              label="Persona personality"
              defaultValue={personality}
              onChangeText={setPersonality}
              multiline
              numberOfLines={4}
              style={{minHeight: 96}}
            />
          </TextField.Root>
          <Text style={[a.text_xs, t.atoms.text_contrast_medium]}>
            <Trans>
              How the agent should sound and behave. Applied server-side to the
              system prompt.
            </Trans>
          </Text>
        </View>

        {/* Fictional life — authored on an existing persona; saved via the update
            endpoint. Hidden on create (no persona id yet); add it after creating. */}
        {isEdit ? (
          <View
            style={[
              a.gap_lg,
              a.pt_lg,
              a.border_t,
              t.atoms.border_contrast_low,
            ]}>
            <View style={[a.gap_2xs]}>
              <Text style={[a.text_md, a.font_bold, t.atoms.text]}>
                <Trans>Fictional life</Trans>
              </Text>
              <Text style={[a.text_xs, t.atoms.text_contrast_medium]}>
                <Trans>
                  An optional authored backstory and routine. The agent draws on it
                  when “bring to life” is on.
                </Trans>
              </Text>
            </View>

            {/* Enable toggle */}
            <Pressable
              accessibilityRole="switch"
              accessibilityLabel="Bring this persona to life"
              accessibilityHint="Toggles whether the agent uses this fictional backstory"
              accessibilityState={{checked: fiction.enabled}}
              onPress={() => setFiction(f => ({...f, enabled: !f.enabled}))}
              style={[
                a.flex_row,
                a.align_center,
                a.justify_between,
                a.rounded_sm,
                a.px_md,
                a.py_sm,
                a.border,
                fiction.enabled
                  ? {borderColor: t.palette.primary_500}
                  : t.atoms.border_contrast_low,
              ]}>
              <Text style={[a.text_md, t.atoms.text]}>
                <Trans>Bring this persona to life</Trans>
              </Text>
              <View
                style={[
                  a.rounded_full,
                  a.px_sm,
                  {
                    paddingVertical: 2,
                    backgroundColor: fiction.enabled
                      ? t.palette.primary_500
                      : t.palette.contrast_100,
                  },
                ]}>
                <Text
                  style={[
                    a.text_xs,
                    a.font_bold,
                    {
                      color: fiction.enabled
                        ? t.palette.white
                        : t.palette.contrast_600,
                    },
                  ]}>
                  {fiction.enabled ? 'On' : 'Off'}
                </Text>
              </View>
            </Pressable>

            {/* Backstory */}
            <View style={[a.gap_xs]}>
              <TextField.LabelText>
                <Trans>Backstory</Trans>
              </TextField.LabelText>
              <TextField.Root>
                <TextField.Input
                  label="Persona backstory"
                  defaultValue={fiction.backstory}
                  onChangeText={text =>
                    setFiction(f => ({...f, backstory: text}))
                  }
                  multiline
                  numberOfLines={4}
                  style={{minHeight: 96}}
                />
              </TextField.Root>
            </View>

            {/* Home base */}
            <View style={[a.gap_xs]}>
              <TextField.LabelText>
                <Trans>Home base</Trans>
              </TextField.LabelText>
              <TextField.Root>
                <TextField.Input
                  label="Persona home base"
                  placeholder="e.g. Raleigh, NC"
                  defaultValue={fiction.homeBase}
                  onChangeText={text =>
                    setFiction(f => ({...f, homeBase: text}))
                  }
                />
              </TextField.Root>
            </View>

            {/* Haunts — editable list */}
            <View style={[a.gap_xs]}>
              <TextField.LabelText>
                <Trans>Haunts</Trans>
              </TextField.LabelText>
              <View style={[a.flex_row, a.gap_sm]}>
                <View style={[a.flex_1]}>
                  <TextField.Root>
                    <TextField.Input
                      label="Add a haunt"
                      placeholder="e.g. the corner coffee shop"
                      value={haunt}
                      onChangeText={setHaunt}
                      onSubmitEditing={onAddHaunt}
                    />
                  </TextField.Root>
                </View>
                <Button
                  label="Add haunt"
                  size="small"
                  variant="solid"
                  color="secondary"
                  shape="square"
                  disabled={!haunt.trim()}
                  onPress={onAddHaunt}>
                  <ButtonIcon icon={PlusIcon} />
                </Button>
              </View>
              {fiction.haunts.length > 0 ? (
                <View style={[a.gap_2xs, a.pt_2xs]}>
                  {fiction.haunts.map((h, i) => (
                    <View
                      key={`${h}_${i}`}
                      style={[
                        a.flex_row,
                        a.align_center,
                        a.justify_between,
                        a.rounded_sm,
                        a.px_md,
                        a.py_xs,
                        t.atoms.bg_contrast_25,
                      ]}>
                      <Text
                        style={[a.flex_1, a.text_sm, t.atoms.text]}
                        numberOfLines={1}>
                        {h}
                      </Text>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Remove ${h}`}
                        accessibilityHint=""
                        onPress={() =>
                          setFiction(f => ({
                            ...f,
                            haunts: removeHaunt(f.haunts, i),
                          }))
                        }
                        style={[a.p_xs]}>
                        <CloseIcon
                          size="xs"
                          fill={t.atoms.text_contrast_medium.color}
                        />
                      </Pressable>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>

            {/* Weekly rhythm */}
            <View style={[a.gap_xs]}>
              <TextField.LabelText>
                <Trans>Weekly rhythm</Trans>
              </TextField.LabelText>
              <TextField.Root>
                <TextField.Input
                  label="Persona weekly rhythm"
                  placeholder="e.g. Mondays at the gym, Fridays out with friends"
                  defaultValue={fiction.weeklyRhythm}
                  onChangeText={text =>
                    setFiction(f => ({...f, weeklyRhythm: text}))
                  }
                  multiline
                  numberOfLines={3}
                  style={{minHeight: 72}}
                />
              </TextField.Root>
            </View>
          </View>
        ) : null}

        <Button
          label={isEdit ? 'Save changes' : 'Create persona'}
          size="large"
          variant="solid"
          color="primary"
          disabled={!canSave}
          onPress={onSave}>
          <ButtonText>
            {isEdit ? <Trans>Save changes</Trans> : <Trans>Create persona</Trans>}
          </ButtonText>
        </Button>
      </View>

      <Dialog.Close />
    </Dialog.ScrollableInner>
  )
}
