/* eslint-disable import-x/no-nodejs-modules -- Node-side font-file parsing test */
import {existsSync, readFileSync} from 'fs'
import {join} from 'path'

import {
  AUTHORITY_ONE_HEADING_FONT,
  AUTHORITY_ONE_HEADING_FONT_POSTSCRIPT,
} from './fonts-authority-one'

// NOTE: the theme/skin GATING of this font (return the family only when the
// active skin defines a display font) moved to the skin system. It is covered
// by `src/lib/skins/__tests__/skins.test.ts` (resolveHeadingFontFamily). This
// file now guards only the pure Fraunces constants + file bundling.

/**
 * Guard: the family-name string the app hands to `fontFamilyOverride` MUST equal
 * the internal name-table family of the Fraunces face that `app.config.js`
 * actually registers — otherwise iOS/Android register the font under a different
 * name and headlines silently fall back to the system sans (the bug this fixes).
 *
 * Also guards against re-introducing the *variable* `.ttf`: RN/iOS do not
 * reliably register variable fonts, so the registered file must be a static cut
 * (no `fvar` table).
 *
 * Dependency-free sfnt parser (no fontkit/opentype.js in the tree).
 */

const FONTS_DIR = join(__dirname, '../../assets/fonts/fraunces')
// Mirror app.config.js AUTHORITY_ONE_FONT_CANDIDATES (static preferred).
const CANDIDATES = ['Fraunces-Static.ttf', 'Fraunces.ttf']

function tableOffsets(buf: Buffer): Map<string, {offset: number; length: number}> {
  const numTables = buf.readUInt16BE(4)
  const map = new Map<string, {offset: number; length: number}>()
  let p = 12
  for (let i = 0; i < numTables; i++) {
    const tag = buf.toString('latin1', p, p + 4)
    map.set(tag, {offset: buf.readUInt32BE(p + 8), length: buf.readUInt32BE(p + 12)})
    p += 16
  }
  return map
}

/** Read a name-table record (default: nameID 1 = font family). */
function readName(buf: Buffer, nameTableOffset: number, wantNameId = 1): string | null {
  const count = buf.readUInt16BE(nameTableOffset + 2)
  const stringOffset = buf.readUInt16BE(nameTableOffset + 4)
  const stringsBase = nameTableOffset + stringOffset
  let recP = nameTableOffset + 6
  let fallback: string | null = null
  for (let i = 0; i < count; i++) {
    const platformID = buf.readUInt16BE(recP)
    const nameID = buf.readUInt16BE(recP + 6)
    const length = buf.readUInt16BE(recP + 8)
    const offset = buf.readUInt16BE(recP + 10)
    recP += 12
    if (nameID !== wantNameId) continue
    const start = stringsBase + offset
    const slice = buf.subarray(start, start + length)
    if (platformID === 3) {
      // Windows: UTF-16BE — preferred. Swap to LE then decode.
      return Buffer.from(slice).swap16().toString('utf16le')
    }
    if (platformID === 1 && fallback == null) {
      // Mac: ASCII/MacRoman.
      fallback = slice.toString('latin1')
    }
  }
  return fallback
}

describe('Authority One heading font (Fraunces)', () => {
  const registered = CANDIDATES.map(f => join(FONTS_DIR, f)).find(existsSync)

  it('has a registered Fraunces face on disk', () => {
    expect(registered).toBeDefined()
  })

  it('registers a STATIC cut, not a variable font (no fvar table)', () => {
    if (!registered) return
    const buf = readFileSync(registered)
    const tables = tableOffsets(buf)
    expect(tables.has('fvar')).toBe(false)
  })

  it("font's internal family name (name 1) exactly matches AUTHORITY_ONE_HEADING_FONT", () => {
    if (!registered) return
    const buf = readFileSync(registered)
    const tables = tableOffsets(buf)
    const nameTbl = tables.get('name')
    expect(nameTbl).toBeDefined()
    const family = readName(buf, nameTbl!.offset, 1)
    expect(family).toBe(AUTHORITY_ONE_HEADING_FONT)
  })

  it("font's PostScript name (name 6) exactly matches AUTHORITY_ONE_HEADING_FONT_POSTSCRIPT (the iOS match key)", () => {
    if (!registered) return
    const buf = readFileSync(registered)
    const tables = tableOffsets(buf)
    const nameTbl = tables.get('name')
    expect(nameTbl).toBeDefined()
    const postScript = readName(buf, nameTbl!.offset, 6)
    expect(postScript).toBe(AUTHORITY_ONE_HEADING_FONT_POSTSCRIPT)
  })

  it('iOS font family resolves to the PostScript name, not the family name', () => {
    // Regression guard for the variable-font collision: on iOS we MUST target
    // the unique PostScript name so a bold heading request can't weight-match
    // the (now-removed, but be safe) variable "Fraunces" Black face.
    jest.resetModules()
    jest.doMock('react-native', () => ({Platform: {OS: 'ios'}}))
    // runtime re-require to pick up the mocked Platform; typed so the call is safe
    const mod = require('./fonts-authority-one') as {
      getAuthorityOneHeadingFontFamily: () => string
    }
    expect(mod.getAuthorityOneHeadingFontFamily()).toBe(
      AUTHORITY_ONE_HEADING_FONT_POSTSCRIPT,
    )
    jest.dontMock('react-native')
    jest.resetModules()
  })
})
