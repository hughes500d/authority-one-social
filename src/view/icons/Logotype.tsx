import Svg, {
  type PathProps,
  type SvgProps,
  Text as SvgText,
} from 'react-native-svg'

import {usePalette} from '#/lib/hooks/usePalette'

const ratio = 17 / 64

/**
 * Authority One demo reskin: "One" wordmark.
 */
export function Logotype({
  fill,
  ...rest
}: {fill?: PathProps['fill']} & SvgProps) {
  const pal = usePalette('default')
  // @ts-ignore it's fiiiiine
  const size = parseInt(rest.width || 32)

  return (
    <Svg
      fill="none"
      viewBox="0 0 64 17"
      {...rest}
      width={size}
      height={Number(size) * ratio}>
      <SvgText
        // @ts-ignore react-native-svg fill type is fine with strings
        fill={fill || pal.text.color}
        x="0"
        y="14"
        fontSize="17"
        fontWeight="800"
        fontFamily="-apple-system, system-ui, sans-serif"
        letterSpacing="0.5">
        One
      </SvgText>
    </Svg>
  )
}
