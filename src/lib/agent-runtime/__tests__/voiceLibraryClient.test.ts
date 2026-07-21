import {
  filterVoices,
  findAssignedVoice,
  formatLabelValue,
  type LibraryVoice,
  normalizeVoiceLibrary,
  underlyingVoiceId,
  voiceLabelSummary,
  voiceLabelValues,
} from '../voiceLibraryClient'
import {type VoicePickOption} from '../voicesClient'

const PINNED_PAYLOAD = {
  ok: true,
  voices: [
    {
      id: 'EL111111111111111111',
      name: 'Aria',
      description: 'A husky, expressive voice',
      labels: {
        accent: 'american',
        gender: 'female',
        age: 'middle_aged',
        use_case: 'social_media',
        descriptive: 'husky',
      },
      previewUrl: 'https://cdn.example/aria.mp3',
    },
    {
      id: 'EL222222222222222222',
      name: 'Roger',
      labels: {accent: 'american', gender: 'male', age: 'middle_aged'},
    },
  ],
}

describe('normalizeVoiceLibrary', () => {
  it('parses the pinned contract shape', () => {
    const voices = normalizeVoiceLibrary(PINNED_PAYLOAD)
    expect(voices).toHaveLength(2)
    expect(voices?.[0]).toEqual({
      id: 'EL111111111111111111',
      name: 'Aria',
      description: 'A husky, expressive voice',
      labels: {
        accent: 'american',
        gender: 'female',
        age: 'middle_aged',
        use_case: 'social_media',
        descriptive: 'husky',
      },
      previewUrl: 'https://cdn.example/aria.mp3',
    })
    // Missing description/previewUrl are simply absent, not errors.
    expect(voices?.[1].previewUrl).toBeUndefined()
  })

  it('tolerates raw ElevenLabs field spellings (voice_id / preview_url)', () => {
    const voices = normalizeVoiceLibrary({
      voices: [
        {
          voice_id: 'EL333333',
          name: 'Sarah',
          labels: {gender: 'female'},
          preview_url: 'https://cdn.example/sarah.mp3',
        },
      ],
    })
    expect(voices?.[0].id).toBe('EL333333')
    expect(voices?.[0].previewUrl).toBe('https://cdn.example/sarah.mp3')
  })

  it('does NOT mistake the legacy flat list ({voiceId, name}) for the library', () => {
    expect(
      normalizeVoiceLibrary({
        voices: [
          {voiceId: 'ELBobVoice123', name: 'Bob', default: true},
          {voiceId: 'ELStormy45678', name: 'Stormy'},
        ],
      }),
    ).toBe(null)
  })

  it('returns null for registry-only / malformed payloads', () => {
    expect(normalizeVoiceLibrary({builtins: [], custom: []})).toBe(null)
    expect(normalizeVoiceLibrary(undefined)).toBe(null)
    expect(normalizeVoiceLibrary({voices: 'nope'})).toBe(null)
    expect(normalizeVoiceLibrary({voices: []})).toBe(null)
  })

  it('drops malformed rows and non-string label values', () => {
    const voices = normalizeVoiceLibrary({
      voices: [
        {id: 'EL1', name: 'Good', labels: {accent: 'british', junk: 42}},
        {id: 'EL2'}, // no name
        'garbage',
      ],
    })
    expect(voices).toHaveLength(1)
    expect(voices?.[0].labels).toEqual({accent: 'british'})
  })
})

const LIB = normalizeVoiceLibrary(PINNED_PAYLOAD) as LibraryVoice[]

describe('search + filters', () => {
  it('searches name, description, and labels case-insensitively', () => {
    expect(filterVoices(LIB, 'aria', {})).toHaveLength(1)
    expect(filterVoices(LIB, 'HUSKY', {})).toHaveLength(1)
    expect(filterVoices(LIB, 'nope', {})).toHaveLength(0)
    expect(filterVoices(LIB, '  ', {})).toHaveLength(2)
  })

  it('applies exact label filters and combines them with search', () => {
    expect(filterVoices(LIB, '', {gender: 'male'})).toEqual([LIB[1]])
    expect(filterVoices(LIB, '', {accent: 'american'})).toHaveLength(2)
    expect(filterVoices(LIB, 'aria', {gender: 'male'})).toHaveLength(0)
    // A filter on a label a voice lacks excludes it.
    expect(filterVoices(LIB, '', {use_case: 'social_media'})).toEqual([LIB[0]])
  })

  it('derives sorted unique filter values from the library', () => {
    expect(voiceLabelValues(LIB, 'gender')).toEqual(['female', 'male'])
    expect(voiceLabelValues(LIB, 'use_case')).toEqual(['social_media'])
  })

  it('formats label values and summaries for display', () => {
    expect(formatLabelValue('middle_aged')).toBe('Middle aged')
    expect(voiceLabelSummary(LIB[0])).toBe(
      'American · Female · Middle aged · Social media',
    )
  })
})

describe('current-selection resolution', () => {
  const options: VoicePickOption[] = [
    {
      value: 'builtin:bob',
      key: 'builtin:bob',
      label: 'Bob',
      voiceId: 'EL111111111111111111',
      kind: 'builtin',
    },
    {
      value: 'voice:v1',
      key: 'voice:v1',
      label: 'Narrator',
      voiceId: 'EL222222222222222222',
      kind: 'custom',
      customId: 'v1',
    },
  ]

  it('unwraps all three stored voiceId forms to the underlying ElevenLabs id', () => {
    expect(underlyingVoiceId(options, 'builtin:bob')).toBe(
      'EL111111111111111111',
    )
    expect(underlyingVoiceId(options, 'voice:v1')).toBe('EL222222222222222222')
    expect(underlyingVoiceId(options, 'ELRaw999')).toBe('ELRaw999')
    expect(underlyingVoiceId(options, undefined)).toBeUndefined()
    expect(underlyingVoiceId(options, '  ')).toBeUndefined()
  })

  it('finds the assigned library voice across stored forms', () => {
    expect(findAssignedVoice(LIB, options, 'builtin:bob')?.name).toBe('Aria')
    expect(findAssignedVoice(LIB, options, 'EL222222222222222222')?.name).toBe(
      'Roger',
    )
    expect(findAssignedVoice(LIB, options, 'ELUnknown1')).toBeUndefined()
  })
})
