import {useState} from 'react'
import {ActivityIndicator, View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {type Persona} from '#/lib/agent-runtime'
import {
  type CommonNavigatorParams,
  type NativeStackScreenProps,
} from '#/lib/routes/types'
import {
  useDeletePersonaMutation,
  usePersonasQuery,
  useSetActivePersonaMutation,
} from '#/state/queries/personas'
import * as SettingsList from '#/screens/Settings/components/SettingsList'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import {Check_Stroke2_Corner0_Rounded as CheckIcon} from '#/components/icons/Check'
import {PencilLine_Stroke2_Corner0_Rounded as PencilIcon} from '#/components/icons/Pencil'
import {PlusLarge_Stroke2_Corner0_Rounded as PlusIcon} from '#/components/icons/Plus'
import {Trash_Stroke2_Corner0_Rounded as TrashIcon} from '#/components/icons/Trash'
import * as Layout from '#/components/Layout'
import * as Prompt from '#/components/Prompt'
import * as Toast from '#/components/Toast'
import {Text} from '#/components/Typography'
import {PersonaEditorDialog} from './PersonaEditorDialog'

type Props = NativeStackScreenProps<CommonNavigatorParams, 'PersonaSettings'>

/**
 * Persona / Avatar selector + editor. SEPARATE from the skin picker — persona is
 * the agent's identity (name + voice + personality), skin is the app's look. Lists
 * personas, shows the active one, switches active, and supports full CRUD. Degrades
 * gracefully when the runtime persona endpoints aren't reachable yet.
 */
export function PersonaSettingsScreen({}: Props) {
  const {t: l} = useLingui()
  const {data, isLoading, error} = usePersonasQuery()
  const setActive = useSetActivePersonaMutation()
  const del = useDeletePersonaMutation()
  const editorControl = Dialog.useDialogControl()
  const deletePrompt = Prompt.usePromptControl()
  const [editing, setEditing] = useState<Persona | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Persona | null>(null)

  const personas = data?.personas ?? []
  const voices = data?.voices ?? []
  const activeId = data?.activePersonaId
  const canDelete = personas.length > 1

  const openCreate = () => {
    setEditing(null)
    editorControl.open()
  }
  const openEdit = (p: Persona) => {
    setEditing(p)
    editorControl.open()
  }
  const confirmDelete = (p: Persona) => {
    setPendingDelete(p)
    deletePrompt.open()
  }

  return (
    <Layout.Screen>
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content>
          <Layout.Header.TitleText>
            <Trans>Persona</Trans>
          </Layout.Header.TitleText>
        </Layout.Header.Content>
        <Layout.Header.Slot />
      </Layout.Header.Outer>

      <Layout.Content>
        <SettingsList.Container>
          {isLoading ? (
            <View style={[a.py_2xl, a.align_center]}>
              <ActivityIndicator />
            </View>
          ) : !data ? (
            <UnavailableNotice />
          ) : personas.length === 0 ? (
            <EmptyNotice />
          ) : (
            personas.map(p => (
              <PersonaRow
                key={p.id}
                persona={p}
                active={p.id === activeId}
                voiceName={
                  voices.find(v => v.voiceId === p.voiceId)?.name ?? p.voiceId
                }
                switching={setActive.isPending}
                onSetActive={() =>
                  setActive.mutate(
                    {id: p.id},
                    {
                      onError: () =>
                        Toast.show(l`Could not switch persona.`, {
                          type: 'error',
                        }),
                    },
                  )
                }
                onEdit={() => openEdit(p)}
                onDelete={canDelete ? () => confirmDelete(p) : undefined}
              />
            ))
          )}

          {error && data ? (
            <Text style={[a.px_lg, a.pt_sm, a.text_sm, {color: '#cc2827'}]}>
              <Trans>
                Couldn’t refresh personas. Showing the last known list.
              </Trans>
            </Text>
          ) : null}

          <SettingsList.Divider />
          <View style={[a.px_lg, a.py_sm]}>
            <Button
              label="Create persona"
              size="large"
              variant="solid"
              color="primary"
              onPress={openCreate}>
              <ButtonIcon icon={PlusIcon} />
              <ButtonText>
                <Trans>Create persona</Trans>
              </ButtonText>
            </Button>
          </View>
        </SettingsList.Container>
      </Layout.Content>

      <PersonaEditorDialog
        control={editorControl}
        persona={editing}
        voices={voices}
      />

      <Prompt.Basic
        control={deletePrompt}
        title="Delete persona?"
        description={
          pendingDelete
            ? `“${pendingDelete.name}” will be removed. This can’t be undone.`
            : ''
        }
        confirmButtonCta="Delete"
        confirmButtonColor="negative"
        onConfirm={() => {
          if (pendingDelete)
            del.mutate(
              {id: pendingDelete.id},
              {
                onError: () =>
                  Toast.show(l`Could not delete the persona.`, {type: 'error'}),
              },
            )
        }}
      />
    </Layout.Screen>
  )
}

function PersonaRow({
  persona,
  active,
  voiceName,
  switching,
  onSetActive,
  onEdit,
  onDelete,
}: {
  persona: Persona
  active: boolean
  voiceName?: string
  switching: boolean
  onSetActive: () => void
  onEdit: () => void
  onDelete?: () => void
}) {
  const t = useTheme()
  return (
    <SettingsList.Item>
      <View style={[a.flex_1, a.gap_2xs]}>
        <View style={[a.flex_row, a.align_center, a.gap_sm]}>
          <Text emoji style={[a.text_md, a.font_bold, t.atoms.text]}>
            {persona.name}
          </Text>
          {active ? (
            <View
              style={[
                a.flex_row,
                a.align_center,
                a.gap_2xs,
                a.rounded_full,
                a.px_sm,
                {paddingVertical: 2, backgroundColor: t.palette.primary_50},
              ]}>
              <CheckIcon size="xs" fill={t.palette.primary_600} />
              <Text
                style={[
                  a.text_xs,
                  a.font_bold,
                  {color: t.palette.primary_700},
                ]}>
                <Trans>Active</Trans>
              </Text>
            </View>
          ) : null}
        </View>
        {voiceName ? (
          <Text style={[a.text_xs, t.atoms.text_contrast_medium]}>
            <Trans>Voice: {voiceName}</Trans>
          </Text>
        ) : null}
        {persona.personality ? (
          <Text
            numberOfLines={2}
            style={[a.text_xs, t.atoms.text_contrast_medium]}>
            {persona.personality}
          </Text>
        ) : null}
      </View>

      <View style={[a.flex_row, a.align_center, a.gap_xs]}>
        {!active ? (
          <Button
            label={`Switch to ${persona.name}`}
            size="small"
            variant="solid"
            color="secondary"
            disabled={switching}
            onPress={onSetActive}>
            <ButtonText>
              <Trans>Use</Trans>
            </ButtonText>
          </Button>
        ) : null}
        <Button
          label={`Edit ${persona.name}`}
          size="small"
          variant="ghost"
          color="secondary"
          shape="round"
          onPress={onEdit}>
          <ButtonIcon icon={PencilIcon} />
        </Button>
        {onDelete ? (
          <Button
            label={`Delete ${persona.name}`}
            size="small"
            variant="ghost"
            color="negative"
            shape="round"
            onPress={onDelete}>
            <ButtonIcon icon={TrashIcon} />
          </Button>
        ) : null}
      </View>
    </SettingsList.Item>
  )
}

function UnavailableNotice() {
  const t = useTheme()
  return (
    <View style={[a.px_lg, a.py_2xl, a.gap_sm]}>
      <Text style={[a.text_md, a.font_bold, t.atoms.text]}>
        <Trans>Personas unavailable</Trans>
      </Text>
      <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
        <Trans>
          Sign in to your Authority One account and make sure the agent runtime
          is reachable. Your agent keeps working with its default name and voice
          in the meantime.
        </Trans>
      </Text>
    </View>
  )
}

function EmptyNotice() {
  const t = useTheme()
  return (
    <View style={[a.px_lg, a.py_2xl, a.gap_sm]}>
      <Text style={[a.text_md, a.font_bold, t.atoms.text]}>
        <Trans>No personas yet</Trans>
      </Text>
      <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
        <Trans>
          Create a persona to give your agent a name, voice, and personality.
        </Trans>
      </Text>
    </View>
  )
}
