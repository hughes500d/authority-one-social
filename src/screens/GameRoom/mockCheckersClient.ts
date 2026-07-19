/**
 * CHECKERS mock transport — the same in-memory hot-seat discipline as the
 * tic-tac-toe mock (see createMockGameClient): moves are validated against
 * the pure rules, every accepted hop re-emits a full authoritative state
 * (with `legalMoves` for the side to move, exactly like the live server's
 * state frame), chat echoes back, gameover fires once. Taps act as the
 * CURRENT player so the board is developable solo.
 */
import {
  applyCheckersMove,
  checkersGameover,
  checkersLegalMoves,
  initialCheckersG,
} from './checkers'
import {MOCK_AGENT_ID, MOCK_AGENT_NAME} from './mockAgent'
import {
  type GameClient,
  type GameClientOptions,
  type GameCtx,
  type GameG,
  type GameMove,
  type PlayerInfo,
} from './types'

export function createMockCheckersClient(opts: GameClientOptions): GameClient {
  const {playerID, name, callbacks} = opts
  let G = initialCheckersG()
  let connected = false
  let gameoverSent = false
  const timers: Array<ReturnType<typeof setTimeout>> = []

  const players: PlayerInfo[] = [
    {id: playerID, name},
    {id: playerID === '0' ? '1' : '0', name: 'Guest'},
  ]

  const appG = (): GameG => ({
    kind: 'checkers',
    ...G,
    legalMoves: checkersLegalMoves(G),
  })
  const ctx = (): GameCtx => ({
    currentPlayer: G.currentPlayer,
    gameover: checkersGameover(G),
  })

  const later = (ms: number, fn: () => void) => {
    const id = setTimeout(() => {
      if (connected) fn()
    }, ms)
    timers.push(id)
  }

  const agentSay = (text: string, delayMs = 600) => {
    later(delayMs, () =>
      callbacks.onChat({
        from: MOCK_AGENT_ID,
        name: MOCK_AGENT_NAME,
        text,
        ts: Date.now(),
      }),
    )
  }

  return {
    connect() {
      if (connected) return
      connected = true
      later(0, () => {
        callbacks.onConnection?.('online')
        callbacks.onPlayers(players)
        callbacks.onState(appG(), ctx(), players)
      })
      agentSay('Checkers is up — dark squares only, captures are forced.', 900)
    },

    disconnect() {
      connected = false
      for (const id of timers) clearTimeout(id)
      timers.length = 0
    },

    sendMove(move: GameMove) {
      if (!connected) return
      if (move.type !== 'move') return
      const from = Number((move.args as {from?: unknown} | undefined)?.from)
      const to = Number((move.args as {to?: unknown} | undefined)?.to)
      const next = applyCheckersMove(G, from, to)
      if (!next) return // invalid — authoritative server would drop it too
      G = next
      later(0, () => callbacks.onState(appG(), ctx(), players))
      const over = checkersGameover(G)
      if (over && !gameoverSent) {
        gameoverSent = true
        later(0, () => callbacks.onGameover(over.winner))
        agentSay('And that is the board — well played! 🎉')
      } else if (G.mustContinueFrom !== null) {
        agentSay('Double jump! Keep going.', 400)
      }
    },

    sendChat(text: string) {
      if (!connected) return
      const trimmed = text.trim()
      if (!trimmed) return
      later(0, () =>
        callbacks.onChat({from: playerID, name, text: trimmed, ts: Date.now()}),
      )
    },

    // Board matches have no branch points; only the story transports act on this.
    sendChoice() {},
  }
}
