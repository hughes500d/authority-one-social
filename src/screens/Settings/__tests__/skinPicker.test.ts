/**
 * Regression guard for garbled App-theme labels on the Appearance screen.
 *
 * SYMPTOM (live, in-app, original bug): the App-theme selector rendered raw
 * Lingui message IDs ("rg8lHb", "Q23end", "4KIDdO") instead of real text,
 * because those `msg`…`` macro IDs were missing from the compiled catalog.
 *
 * FIX/CONTRACT: the App-theme section copy and every skin name are PLAIN
 * LITERALS, so they render the same regardless of compiled-catalog state. Skin
 * names are also proper nouns that must not be translated. This is a
 * source-level guard (a full render of the `#/alf` -> Layout -> native chain is
 * impractical under jest-expo), pinning exactly the thing that regressed.
 */
/* eslint-disable import-x/no-nodejs-modules -- Node-side source-reading test */
import {readFileSync} from 'fs'
import {join} from 'path'

const SETTINGS_DIR = join(__dirname, '..')
const SKINS_DIR = join(__dirname, '..', '..', '..', 'lib', 'skins')

const PICKER_SRC = readFileSync(join(SETTINGS_DIR, 'SkinPicker.tsx'), 'utf8')

describe('SkinPicker App-theme copy is plain literals (no catalog dependency)', () => {
  it('renders the "App theme" section title as a plain literal, not a Lingui macro', () => {
    expect(PICKER_SRC).toMatch(/<SettingsList\.ItemText>App theme<\/SettingsList\.ItemText>/)
    expect(PICKER_SRC).not.toMatch(/_\(msg`App theme`\)/)
  })

  it('renders the section description as a plain literal, not a Lingui macro', () => {
    expect(PICKER_SRC).toMatch(/Reskin the app with a brand palette and type\./)
    expect(PICKER_SRC).not.toMatch(/msg`Reskin the app/)
    expect(PICKER_SRC).not.toMatch(/<Trans[\s>]/)
  })
})

describe('skin display names are plain string literals (proper nouns, no macros)', () => {
  const files = ['authority.ts', 'hurricanes.ts', 'registry.ts']

  it('the registry and skin definitions do not wrap displayName in a Lingui macro', () => {
    for (const f of files) {
      const src = readFileSync(join(SKINS_DIR, f), 'utf8')
      // every displayName is assigned a bare string literal
      const matches = src.match(/displayName:\s*'[^']+'/g) ?? []
      expect(matches.length).toBeGreaterThan(0)
      expect(src).not.toMatch(/displayName:\s*_\(msg`/)
      expect(src).not.toMatch(/displayName:\s*msg`/)
    }
  })

  it('names the launch skins (Authority, Carolina Hurricanes)', () => {
    const authority = readFileSync(join(SKINS_DIR, 'authority.ts'), 'utf8')
    const hurricanes = readFileSync(join(SKINS_DIR, 'hurricanes.ts'), 'utf8')
    expect(authority).toMatch(/displayName:\s*'Authority'/)
    expect(hurricanes).toMatch(/displayName:\s*'Carolina Hurricanes'/)
  })
})
