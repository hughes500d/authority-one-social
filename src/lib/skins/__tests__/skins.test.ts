/* eslint-disable import-x/no-nodejs-modules -- Node-side source-reading test */
import {readFileSync} from 'fs'
import {join} from 'path'

import {resolveHeadingFontFamily} from '#/lib/skins/fonts'
import {
  DEFAULT_SKIN_ID,
  legacyThemePackFromSkinId,
  skinIdFromLegacyThemePack,
} from '#/lib/skins/ids'

// Import only the PURE skin modules here. The registry/skin DEFINITIONS pull the
// `#/alf` -> Layout -> native chain, which jest-expo cannot evaluate (same
// constraint the appearance-labels test notes), so the registry CONTENT is
// guarded at the source level below.

describe('skin id helpers (legacy migration, pure)', () => {
  it('maps the legacy themePack value to a skin id (no destructive migration)', () => {
    expect(skinIdFromLegacyThemePack('authorityOne')).toBe('authority')
    expect(skinIdFromLegacyThemePack('default')).toBe('default')
    expect(skinIdFromLegacyThemePack(undefined)).toBe('default')
  })

  it('maps a skin id back to the legacy themePack value (kept in sync)', () => {
    expect(legacyThemePackFromSkinId('authority')).toBe('authorityOne')
    expect(legacyThemePackFromSkinId('hurricanes')).toBe('default')
    expect(legacyThemePackFromSkinId('default')).toBe('default')
  })

  it('exposes the default skin id', () => {
    expect(DEFAULT_SKIN_ID).toBe('default')
  })
})

describe('resolveHeadingFontFamily (pure)', () => {
  it('returns undefined when the skin has no display font (default font path)', () => {
    expect(resolveHeadingFontFamily(undefined)).toBeUndefined()
  })

  it('returns a defined family when the skin defines a display font', () => {
    const family = resolveHeadingFontFamily({
      family: 'Fraunces',
      postScriptName: 'Fraunces-Regular',
      webStack: 'Fraunces, serif',
    })
    expect(family).toBeDefined()
    // one of the three platform match keys
    expect(['Fraunces', 'Fraunces-Regular', 'Fraunces, serif']).toContain(
      family,
    )
  })
})

const SKINS_DIR = join(__dirname, '..')
const read = (f: string) => readFileSync(join(SKINS_DIR, f), 'utf8')

describe('registry registers the launch skins (source-level)', () => {
  it('lists default, authority, and hurricanes in display order', () => {
    const registry = read('registry.ts')
    const order = registry.match(
      /SKIN_LIST[^=]*=\s*\[([^\]]*)\]/,
    )?.[1]
    expect(order).toBeTruthy()
    expect(order).toMatch(/defaultSkin[\s\S]*authoritySkin[\s\S]*hurricanesSkin/)
  })
})

describe('authority skin sources the shipped Authority One tokens', () => {
  const src = read('authority.ts')

  it("has id 'authority' and sources the AO ALF + legacy themes", () => {
    expect(src).toMatch(/id:\s*'authority'/)
    expect(src).toMatch(/alfThemes:\s*authorityOneThemes/)
    expect(src).toMatch(/from '#\/alf\/themes-authority-one'/)
    expect(src).toMatch(/from '#\/lib\/themes-authority-one'/)
  })

  it('uses the Fraunces display font (PostScript match key for iOS)', () => {
    expect(src).toMatch(/AUTHORITY_ONE_HEADING_FONT_POSTSCRIPT/)
  })
})

describe('hurricanes skin is LIVE with authentic brand assets', () => {
  const src = read('hurricanes.ts')

  it('is no longer pending (flipped to live)', () => {
    expect(src).toMatch(/pending:\s*false/)
    expect(src).not.toMatch(/pending:\s*true/)
  })

  it('uses the authentic Hurricanes red #CE1126 for the ramp and swatch', () => {
    expect(src).toMatch(/red:\s*'#CE1126'/)
    expect(src).toMatch(/primary_500:\s*'#CE1126'/)
    expect(src).not.toMatch(/#CC0000/) // stand-in red is gone
  })

  it('uses the NHL Carolina display font (PostScript match key for iOS)', () => {
    expect(src).toMatch(/family:\s*HURRICANES_HEADING_FONT/)
    expect(src).toMatch(/postScriptName:\s*HURRICANES_HEADING_FONT_POSTSCRIPT/)
    expect(src).toMatch(/'NHL Carolina'/)
    expect(src).toMatch(/'NHLCarolina'/)
  })

  it('switches to the pre-bundled Stormy app icon', () => {
    expect(src).toMatch(/alternateIconName:\s*'skin_hurricanes'/)
  })
})

describe('hurricanes assets are registered in app.config.js', () => {
  // app.config.js lives at the repo root (four levels up from this dir).
  const configPath = join(SKINS_DIR, '..', '..', '..', 'app.config.js')
  const config = readFileSync(configPath, 'utf8')

  it('registers the NHL Carolina static font', () => {
    expect(config).toMatch(/nhl-carolina\/NHLCarolina-Static\.ttf/)
    expect(config).toMatch(/HURRICANES_FONT_PRESENT/)
  })

  it('registers the skin_hurricanes app icon (ios + android)', () => {
    expect(config).toMatch(/skin_hurricanes:\s*{/)
    expect(config).toMatch(/ios_icon_skin_hurricanes\.png/)
    expect(config).toMatch(/android_icon_skin_hurricanes\.png/)
  })
})
