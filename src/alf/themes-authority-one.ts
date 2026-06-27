import {
  createTheme,
  DEFAULT_PALETTE,
  type Palette,
} from '@bsky.app/alf'

/**
 * Authority One brand theme — ADDITIVE, non-destructive.
 *
 * Color/type tokens are extracted verbatim from the live marketing site
 * https://authority-one.com (compiled Tailwind/oklch design tokens, read via
 * computed styles on 2026-06-22). The site's `:root` scope is the warm "paper"
 * light theme; its `.dark` scope is the warm near-black dark theme. Exact
 * source values + provenance are documented in
 * AUTHORITY-ONE-THEME-TOKENS.md at the repo root.
 *
 * This file does NOT touch the base light/dark/dim themes in `./themes.ts`.
 * It is only consumed when the user selects the "Authority One" app theme
 * (themePack === 'authorityOne'), via `themesOverride` on the ALF provider.
 *
 * Site tokens (sRGB hex resolved from oklch). NOTE: the LIGHT scope below is a
 * WARMED derivative of the site's literal light tokens — the site's #f4f0e8
 * background read as "white" on-device, so it was deepened to honey/tan paper
 * (see AUTHORITY_ONE_LIGHT_PALETTE). The accent and dark scope are verbatim.
 *   LIGHT  bg #ece2cd (was #f4f0e8) · muted #e1d5bb · text #14110e
 *          muted-text #5a4e40 · accent #c25f40 · border #c8b89a · input #d8c9ac
 *          ring #c25f40 · rule #9e8e76 · destructive #cc2827
 *   DARK   bg #110c09 · card #1a1512 · muted #29231e · text #f2eee6
 *          muted-text #a79d91 · accent #d86b49 · border #38322d · input #2d2823
 *          ring #d86b49 · rule #4e4640 · destructive #ea3d38
 *   Fonts  display: Fraunces (serif) · body/UI: Inter · mono: JetBrains Mono
 */

const STATIC = {
  white: DEFAULT_PALETTE.white,
  black: DEFAULT_PALETTE.black,
  pink: DEFAULT_PALETTE.pink,
  yellow: DEFAULT_PALETTE.yellow,
  like: DEFAULT_PALETTE.like,
}

/**
 * Terracotta / "authority orange" primary ramp anchored on the site accent.
 * primary_500 === site light --accent (#c25f40); the dark scope uses #d86b49,
 * which sits between 400 and 500 here and reads correctly on dark surfaces.
 */
const PRIMARY = {
  primary_25: '#FBF2EC',
  primary_50: '#F7E2D8',
  primary_100: '#F0C9B6',
  primary_200: '#E6A988',
  primary_300: '#DB8862',
  primary_400: '#D0704F',
  primary_500: '#C25F40', // site light --accent
  primary_600: '#A94F34',
  primary_700: '#8C4029',
  primary_800: '#6F331F',
  primary_900: '#522515',
  primary_950: '#3C1B0F',
  primary_975: '#2A130A',
}

// Keep ALF's well-tuned positive (success) ramp; it is hue-neutral enough to
// sit happily on the warm surfaces.
const POSITIVE = {
  positive_25: DEFAULT_PALETTE.positive_25,
  positive_50: DEFAULT_PALETTE.positive_50,
  positive_100: DEFAULT_PALETTE.positive_100,
  positive_200: DEFAULT_PALETTE.positive_200,
  positive_300: DEFAULT_PALETTE.positive_300,
  positive_400: DEFAULT_PALETTE.positive_400,
  positive_500: DEFAULT_PALETTE.positive_500,
  positive_600: DEFAULT_PALETTE.positive_600,
  positive_700: DEFAULT_PALETTE.positive_700,
  positive_800: DEFAULT_PALETTE.positive_800,
  positive_900: DEFAULT_PALETTE.positive_900,
  positive_950: DEFAULT_PALETTE.positive_950,
  positive_975: DEFAULT_PALETTE.positive_975,
}

/** Negative ramp anchored on the site --destructive (#cc2827 light). */
const NEGATIVE = {
  negative_25: '#FDF1F0',
  negative_50: '#FADBD9',
  negative_100: '#F5B8B5',
  negative_200: '#EE8B87',
  negative_300: '#E45F5A',
  negative_400: '#DA3F39',
  negative_500: '#CC2827', // site light --destructive
  negative_600: '#AE201F',
  negative_700: '#8E1A19',
  negative_800: '#6E1413',
  negative_900: '#500E0E',
  negative_950: '#3A0A0A',
  negative_975: '#280707',
}

/**
 * LIGHT — warm "paper". contrast_0 is the page background; the ramp walks from
 * the cream base to the near-black text color (contrast_1000).
 *
 * WARMING PASS (2026-06-23): the site's literal `--background` (#F4F0E8) read as
 * "white" on a real phone, so the light scope is deepened toward honey/tan to
 * read like real paper. The base is now #ECE2CD (was #F4F0E8) with the whole
 * ramp pulled warmer (more red/yellow, less neutral grey). Text steps stay dark
 * for contrast and the terracotta accent (PRIMARY, unchanged) still pops.
 * Contrast checks (WCAG): near-black text on bg ≈ 14.6:1 (AAA); muted text
 * (#5A4E40) on bg ≈ 6.3:1 (AA); accent (#C25F40) on bg ≈ 3.3:1 (large/UI, on par
 * with the site's own terracotta-on-cream); white on accent ≈ 4.2:1. NOTE: ALF
 * uses *darker* steps for elevation in light mode, so raised surfaces sit a hair
 * deeper than the page (contrast_25/50), not lighter — the whole set is warmed
 * together so it stays coherent paper.
 */
const AUTHORITY_ONE_LIGHT_PALETTE: Palette = {
  ...STATIC,
  ...PRIMARY,
  ...POSITIVE,
  ...NEGATIVE,

  contrast_0: '#ECE2CD', // warmed page background (was site --background #F4F0E8)
  contrast_25: '#E7DCC4', // backgroundLight / subtle raised surface
  contrast_50: '#E1D5BB', // muted / secondary surface (warmed from #E9E4DA)
  contrast_100: '#D8C9AC', // input -> border_contrast_low (warmed from #DDD6CE)
  contrast_200: '#C8B89A', // border -> border_contrast_medium (warmed from #CCC2B8)
  contrast_300: '#B4A484', // border_contrast_high (warmed from #B8AC9F)
  contrast_400: '#9E8E76', // rule -> text_contrast_low (warmed from #A79D91)
  contrast_500: '#82735F',
  contrast_600: '#6B5D49',
  contrast_700: '#5A4E40', // muted-foreground -> text_contrast_medium (warmed from #5E534A)
  contrast_800: '#423829',
  contrast_900: '#2A2118', // text_contrast_high
  contrast_950: '#201A14',
  contrast_975: '#1A1511', // site --foreground (kept)
  contrast_1000: '#14110E', // site --primary (near-black) -> text (kept)
}

/**
 * DARK — warm near-black, matched to the site `.dark` scope.
 */
const AUTHORITY_ONE_DARK_PALETTE: Palette = {
  ...STATIC,
  // On dark surfaces the brand lifts the accent toward #d86b49; expose it at
  // 500 so links/buttons read correctly, with a ramp around it.
  primary_25: '#2A130C',
  primary_50: '#3A1B11',
  primary_100: '#50271A',
  primary_200: '#6F3624',
  primary_300: '#94492F',
  primary_400: '#BA5A3B',
  primary_500: '#D86B49', // site dark --accent
  primary_600: '#E08263',
  primary_700: '#E89A80',
  primary_800: '#F0B49F',
  primary_900: '#F6CDBF',
  primary_950: '#FAE2D8',
  primary_975: '#FDF1EC',
  ...POSITIVE,
  // Brighter negative for dark, anchored on site dark --destructive (#ea3d38).
  negative_25: '#280707',
  negative_50: '#3A0A0A',
  negative_100: '#500E0E',
  negative_200: '#6E1413',
  negative_300: '#8E1A19',
  negative_400: '#C2302D',
  negative_500: '#EA3D38', // site dark --destructive
  negative_600: '#EE5D58',
  negative_700: '#F2807C',
  negative_800: '#F6A5A2',
  negative_900: '#F9C6C4',
  negative_950: '#FBDEDC',
  negative_975: '#FDEFEE',

  contrast_0: '#110C09', // site dark --background
  contrast_25: '#16100C',
  contrast_50: '#1A1512', // site dark --card
  contrast_100: '#29231E', // site dark --muted / --secondary -> border low
  contrast_200: '#38322D', // site dark --border -> border medium
  contrast_300: '#4E4640', // site dark --rule -> border high
  contrast_400: '#6B6157', // text_contrast_low
  contrast_500: '#857A6E',
  contrast_600: '#978B7E',
  contrast_700: '#A79D91', // site dark --muted-foreground -> text_contrast_medium
  contrast_800: '#C4BBB0',
  contrast_900: '#DDD5CA', // text_contrast_high
  contrast_950: '#E8E2D8',
  contrast_975: '#EDE8DF',
  contrast_1000: '#F2EEE6', // site dark --foreground -> text
}

/**
 * DIM — same warm dark family, slightly lifted base (less pure black), mirroring
 * Bluesky's dim-vs-dark relationship. Surfaces lift; text/accent unchanged.
 */
const AUTHORITY_ONE_DIM_PALETTE: Palette = {
  ...AUTHORITY_ONE_DARK_PALETTE,
  contrast_0: '#1A1512', // lifted base (site --card)
  contrast_25: '#1F1A16',
  contrast_50: '#241E1A',
  contrast_100: '#322B25',
  contrast_200: '#403933',
  contrast_300: '#544B44',
}

export const authorityOneThemes = {
  light: createTheme({
    scheme: 'light',
    name: 'light',
    palette: AUTHORITY_ONE_LIGHT_PALETTE,
  }),
  dark: createTheme({
    scheme: 'dark',
    name: 'dark',
    palette: AUTHORITY_ONE_DARK_PALETTE,
    options: {shadowOpacity: 0.4},
  }),
  dim: createTheme({
    scheme: 'dark',
    name: 'dim',
    palette: AUTHORITY_ONE_DIM_PALETTE,
    options: {shadowOpacity: 0.4},
  }),
}

export const authorityOnePalettes = {
  light: AUTHORITY_ONE_LIGHT_PALETTE,
  dark: AUTHORITY_ONE_DARK_PALETTE,
  dim: AUTHORITY_ONE_DIM_PALETTE,
}
