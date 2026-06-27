import {themes as baseThemes} from '#/alf/themes'
import {
  authorityOnePalettes,
  authorityOneThemes,
} from '#/alf/themes-authority-one'

describe('Authority One theme', () => {
  it('exposes light/dark/dim variants', () => {
    expect(Object.keys(authorityOneThemes).sort()).toEqual([
      'dark',
      'dim',
      'light',
    ])
  })

  it('maps the extracted site background tokens onto surfaces', () => {
    // LIGHT bg is a WARMED derivative of the site --background (#F4F0E8 read as
    // "white" on-device); dark/dim remain the verbatim site .dark tokens.
    expect(authorityOneThemes.light.atoms.bg.backgroundColor).toBe('#ECE2CD')
    expect(authorityOneThemes.dark.atoms.bg.backgroundColor).toBe('#110C09')
    expect(authorityOneThemes.dim.atoms.bg.backgroundColor).toBe('#1A1512')
  })

  it('keeps the warmed light background clearly off-white (warm paper)', () => {
    // guard against regressing to the near-white original: red channel should
    // lead and the blue channel should sit well below it (a warm, tan hue).
    const bg = authorityOneThemes.light.atoms.bg.backgroundColor
    const r = parseInt(bg.slice(1, 3), 16)
    const b = parseInt(bg.slice(5, 7), 16)
    expect(r).toBeGreaterThan(b + 20) // distinctly warm, not neutral/white
  })

  it('maps the extracted text tokens onto the text atom', () => {
    // light --primary (near-black) and dark --foreground
    expect(authorityOneThemes.light.atoms.text.color).toBe('#14110E')
    expect(authorityOneThemes.dark.atoms.text.color).toBe('#F2EEE6')
  })

  it('uses the terracotta accent as the primary ramp', () => {
    // site --accent: light #c25f40, dark #d86b49
    expect(authorityOnePalettes.light.primary_500).toBe('#C25F40')
    expect(authorityOnePalettes.dark.primary_500).toBe('#D86B49')
  })

  it('exposes brand borders distinct from the base themes', () => {
    expect(authorityOneThemes.light.atoms.border_contrast_medium.borderColor).toBe(
      '#C8B89A', // warmed light border (from site --border #CCC2B8)
    )
    expect(authorityOneThemes.dark.atoms.border_contrast_medium.borderColor).toBe(
      '#38322D', // site --border (dark)
    )
  })

  it('is additive — does not mutate the base light/dark/dim themes', () => {
    expect(baseThemes.light.atoms.bg.backgroundColor).not.toBe(
      authorityOneThemes.light.atoms.bg.backgroundColor,
    )
    // base themes keep their own (pre-existing) background tokens
    expect(baseThemes.light.atoms.bg.backgroundColor).toBe('#FFFFFF')
  })
})
