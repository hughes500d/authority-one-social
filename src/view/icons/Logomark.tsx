import Svg, {Path, type PathProps, Rect, type SvgProps} from 'react-native-svg'

import {usePalette} from '#/lib/hooks/usePalette'

const ratio = 1

const ONE_NUMERAL =
  'M40 10 L28 10 L17 17 L17 26 L26 26 L26 46 L19 46 L19 54 L47 54 L47 46 L40 46 Z'

/**
 * One brand mark: varsity numeral 1 on brand tile.
 */
export function Logomark({
  fill,
  ...rest
}: {fill?: PathProps['fill']} & SvgProps) {
  const pal = usePalette('default')
  // @ts-ignore it's fiiiiine
  const size = parseInt(rest.width || 32)

  return (
    <Svg
      fill="none"
      viewBox="0 0 64 64"
      {...rest}
      width={size}
      height={Number(size) * ratio}>
      <Rect
        x="0"
        y="0"
        width="64"
        height="64"
        rx="10"
        fill={fill || pal.text.color}
      />
      <Path
        d={ONE_NUMERAL}
        fill="#FFFFFF"
        stroke="#FFFFFF"
        strokeWidth={5}
        strokeLinejoin="miter"
      />
      <Path d={ONE_NUMERAL} fill="#000000" />
    </Svg>
  )
}
