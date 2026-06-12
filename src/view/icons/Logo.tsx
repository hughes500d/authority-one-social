import {forwardRef} from 'react'
import {type TextProps} from 'react-native'
import Svg, {Path, type PathProps, Rect, type SvgProps} from 'react-native-svg'

import {flatten, useTheme} from '#/alf'

const ratio = 1

// Varsity "1" — black numeral with white outline (One brand mark)
const ONE_NUMERAL =
  'M40 10 L28 10 L17 17 L17 26 L26 26 L26 46 L19 46 L19 54 L47 54 L47 46 L40 46 Z'

type Props = {
  fill?: PathProps['fill']
  style?: TextProps['style']
} & Omit<SvgProps, 'style'>

/**
 * One brand mark: varsity numeral 1 (black, white outline) on the brand
 * orange tile.
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
      <Rect x="0" y="0" width="64" height="64" rx="10" fill={_fill} />
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
})
