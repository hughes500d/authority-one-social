import {forwardRef} from 'react'
import {type TextProps} from 'react-native'
import Svg, {
  Circle,
  Path,
  type PathProps,
  type SvgProps,
} from 'react-native-svg'

import {flatten, useTheme} from '#/alf'

const ratio = 1

type Props = {
  fill?: PathProps['fill']
  style?: TextProps['style']
} & Omit<SvgProps, 'style'>

/**
 * Authority One demo reskin: "One" mark — bold numeral 1 in a solid disc.
 */
export const Logo = forwardRef(function LogoImpl(props: Props, ref) {
  const t = useTheme()
  const {fill, ...rest} = props
  const styles = flatten(props.style)
  const _fill =
    fill === 'sky'
      ? t.palette.primary_500
      : fill || styles?.color || t.palette.primary_500
  // @ts-ignore it's fiiiiine
  const size = parseInt(rest.width || 32, 10)

  return (
    <Svg
      fill="none"
      // @ts-ignore it's fiiiiine
      ref={ref}
      viewBox="0 0 64 64"
      accessibilityLabel="One"
      accessibilityHint=""
      {...rest}
      style={[{width: size, height: size * ratio}, styles]}>
      <Circle cx="32" cy="32" r="32" fill={_fill} />
      <Path fill="#FFFFFF" d="M37 14h-8.4L17.2 21.9l4.4 6.4 7-4.8V50H37V14Z" />
    </Svg>
  )
})
