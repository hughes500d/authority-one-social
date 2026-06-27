import * as DynamicAppIcon from '@bsky.app/expo-dynamic-app-icon'

import {type SkinDefinition} from '#/lib/skins/types'
import {logger} from '#/logger'

/**
 * Apply a skin's alternate app icon (native: iOS/Android via
 * `@bsky.app/expo-dynamic-app-icon`).
 *
 *  - `alternateIconName` is a string -> switch to that (pre-bundled) icon.
 *  - `alternateIconName` is `null`   -> reset to the primary bundled icon.
 *  - `alternateIconName` is `undefined` -> leave the current icon untouched
 *    (the skin's icon asset is not in hand yet, e.g. Hurricanes).
 *
 * NOTE: any concrete value here overrides whatever icon the user picked in
 * App Icon settings -- skin selection takes precedence over the manual picker.
 */
export function applySkinAppIcon(skin: SkinDefinition): void {
  if (skin.alternateIconName === undefined) {
    return // pending / not configured -> do not touch the icon
  }
  try {
    DynamicAppIcon.setAppIcon(skin.alternateIconName)
  } catch (e) {
    logger.warn('skins: failed to set alternate app icon', {
      safeMessage: String(e),
      skin: skin.id,
    })
  }
}
