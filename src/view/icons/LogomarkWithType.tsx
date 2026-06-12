import Svg, {
  Path,
  type PathProps,
  Rect,
  type SvgProps,
  Text as SvgText,
} from 'react-native-svg'

import {useTheme} from '#/alf'

const ratio = 17 / 64

// Varsity "1" scaled to a 30x30 tile (factor 0.469 of the 64 grid)
const ONE_NUMERAL_SMALL =
  'M18.8 4.7 L13.1 4.7 L8 8 L8 12.2 L12.2 12.2 L12.2 21.6 L8.9 21.6 L8.9 25.4 L22 25.4 L22 21.6 L18.8 21.6 Z'

/**
 * One brand: tile mark + "One" wordmark.
 */
export function LogomarkWithType({
  fill,
  ...rest
}: {fill?: PathProps['fill']} & SvgProps) {
  const t = useTheme()
  const size = parseInt(`${rest.width || 32}`)

  return (
    <Svg
      fill="none"
      viewBox="0 0 136 31"
      {...rest}
      width={size}
      height={Number(size) * ratio}>
      <Rect
        x="0"
        y="0"
        width="30"
        height="30"
        rx="5"
        fill={fill || t.palette.primary_500}
      />
      <Path
        d={ONE_NUMERAL_SMALL}
        fill="#FFFFFF"
        stroke="#FFFFFF"
        strokeWidth={2.4}
        strokeLinejoin="miter"
      />
      <Path d={ONE_NUMERAL_SMALL} fill="#000000" />
      <SvgText
        // @ts-ignore react-native-svg fill type is fine with strings
        fill={fill || t.atoms.text.color}
        x="38"
        y="23"
        fontSize="20"
        fontWeight="800"
        fontFamily="-apple-system, system-ui, sans-serif"
        letterSpacing="0.5">
        One
      </SvgText>
    </Svg>
  )
}
