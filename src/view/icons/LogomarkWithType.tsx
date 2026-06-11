import Svg, {
  Circle,
  Path,
  type PathProps,
  type SvgProps,
  Text as SvgText,
} from 'react-native-svg'

import {useTheme} from '#/alf'

const ratio = 17 / 64

/**
 * Authority One demo reskin: disc-mark + "One" wordmark.
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
      <Circle cx="15" cy="15" r="14" fill={fill || t.palette.primary_500} />
      <Path
        fill="#FFFFFF"
        d="M17.2 8.5h-3.7l-5 3.5 1.9 2.8 3.1-2.1V22h3.7V8.5Z"
      />
      <SvgText
        // @ts-ignore react-native-svg fill type is fine with strings
        fill={fill || t.atoms.text.color}
        x="36"
        y="22"
        fontSize="20"
        fontWeight="800"
        fontFamily="-apple-system, system-ui, sans-serif"
        letterSpacing="0.5">
        One
      </SvgText>
    </Svg>
  )
}
