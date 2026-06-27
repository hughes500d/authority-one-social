import {useState} from 'react'
import {Pressable, View} from 'react-native'
import {Trans} from '@lingui/react/macro'

import {type Persona, type PersonaVoice} from '#/lib/agent-runtime'
import {
  useCreatePersonaMutation,
  useUpdatePersonaMutation,
} from '#/state/queries/personas'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import * as TextField from '#/components/forms/TextField'
import {Check_Stroke2_Corner0_Rounded as CheckIcon} from '#/components/icons/Check'
import {Text} from '#/components/Typography'

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

  const trimmedName = name.trim()
  const canSave = trimmedName.length > 0 && !create.isPending && !update.isPending

  const onSave = () => {
    if (!canSave) return
    const done = () => control.close()
    if (isEdit && persona) {
      update.mutate(
        {id: persona.id, name: trimmedName, voiceId, personality},
        {onSuccess: done},
      )
    } else {
      create.mutate({name: trimmedName, voiceId, personality}, {onSuccess: done})
    }
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
