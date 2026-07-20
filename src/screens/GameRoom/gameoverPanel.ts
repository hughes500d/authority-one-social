/**
 * What the game-over panel under a LIVE board can TRUTHFULLY offer. The live
 * server has no reset — a finished match is final, and the agent cannot
 * restart it from chat (asking produced confabulated "fresh board" replies,
 * found live 2026-07-20). So the panel states that plainly and offers only
 * real capabilities:
 *
 *   'new-match'  — signed-in viewers can CREATE a fresh live match (the same
 *                  POST /app/games the lobby launcher uses) and jump to it
 *   'guest-hint' — a guest's token is scoped to this one match; the only
 *                  honest next step is asking their host for a fresh link
 *   'none'       — nothing to show: match still running, no authoritative
 *                  state yet, a mock room (those have a real local reset via
 *                  the boards' own New game button), or story mode (the scene
 *                  pane owns its endgame flow)
 */
export function gameoverPanelMode({
  live,
  storyMode,
  hasState,
  gameover,
  isGuest,
}: {
  live: boolean
  storyMode: boolean
  hasState: boolean
  gameover: boolean
  isGuest: boolean
}): 'none' | 'new-match' | 'guest-hint' {
  if (!live || storyMode || !hasState || !gameover) return 'none'
  return isGuest ? 'guest-hint' : 'new-match'
}
