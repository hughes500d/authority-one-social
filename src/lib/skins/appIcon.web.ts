import {type SkinDefinition} from '#/lib/skins/types'

/**
 * Web has no alternate app icon mechanism -- no-op. See `./appIcon.ts` for the
 * native implementation.
 */
export function applySkinAppIcon(_skin: SkinDefinition): void {}
