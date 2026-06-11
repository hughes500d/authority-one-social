import Svg, {
  Circle,
  Path,
  type PathProps,
  type SvgProps,
} from 'react-native-svg'

import {usePalette} from '#/lib/hooks/usePalette'

const ratio = 1

/**
 * Authority One demo reskin: disc-mark with numeral 1.
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
      <Circle cx="32" cy="32" r="32" fill={fill || pal.text.color} />
      <Path fill="#FFFFFF" d="M37 14h-8.4L17.2 21.9l4.4 6.4 7-4.8V50H37V14Z" />
    </Svg>
  )
}
