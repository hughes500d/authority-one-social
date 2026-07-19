/**
 * CHESS mock transport — hot-seat dev board, same discipline as the other
 * mocks. State is a FEN string exactly like the live wire; `legalMoves` are
 * the PSEUDO-legal set from chess.ts (no castling / en passant / check
 * filter — see that module's docblock), and the mock game ends when a king
 * is captured. Good enough to develop and demo the board; the live server
 * is the real rules authority.
 */
import {
  applyChessMove,
  buildFen,
  type ChessColor,
  INITIAL_FEN,
  isKingAttacked,
  parseFen,
  pseudoLegalMoves,
} from './chess'
import {MOCK_AGENT_ID, MOCK_AGENT_NAME} from './mockAgent'
import {
  type GameClient,
  type GameClientOptions,
  type GameCtx,
  type GameG,
  type GameMove,
  type PlayerInfo,
} from './types'

const seatOf = (color: ChessColor) => (color === 'w' ? '0' : '1')

export function createMockChessClient(opts: GameClientOptions): GameClient {
  const {playerID, name, callbacks} = opts
  let {squares, active} = parseFen(INITIAL_FEN)
  let lastMove: {from: string; to: string} | null = null
  let winner: string | null = null
  let over = false
  let connected = false
  const timers: Array<ReturnType<typeof setTimeout>> = []

  const players: PlayerInfo[] = [
    {id: playerID, name},
    {id: playerID === '0' ? '1' : '0', name: 'Guest'},
  ]

  const appG = (): GameG => ({
    kind: 'chess',
    fen: buildFen(squares, active),
    check: isKingAttacked(squares, active),
    lastMove,
    legalMoves: over ? [] : pseudoLegalMoves(squares, active),
  })
  const ctx = (): GameCtx => ({
    currentPlayer: seatOf(active),
    gameover: over ? {winner} : null,
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
      agentSay('Chess board is live — white to move.', 900)
    },

    disconnect() {
      connected = false
      for (const id of timers) clearTimeout(id)
      timers.length = 0
    },

    sendMove(move: GameMove) {
      if (!connected || over) return
      if (move.type !== 'move') return
      const args = (move.args ?? {}) as {
        from?: unknown
        to?: unknown
        promotion?: unknown
      }
      const from = typeof args.from === 'string' ? args.from : ''
      const to = typeof args.to === 'string' ? args.to : ''
      const promotion =
        typeof args.promotion === 'string' ? args.promotion : undefined
      const legal = pseudoLegalMoves(squares, active).some(
        m => m.from === from && m.to === to && m.promotion === promotion,
      )
      if (!legal) return
      const mover = active
      const applied = applyChessMove(squares, active, {from, to, promotion})
      if (!applied) return
      squares = applied.squares
      active = applied.active
      lastMove = {from, to}
      if (applied.capturedKing) {
        over = true
        winner = seatOf(mover)
        later(0, () => callbacks.onState(appG(), ctx(), players))
        later(0, () => callbacks.onGameover(winner))
        agentSay('The king falls — game over! 👑')
        return
      }
      later(0, () => callbacks.onState(appG(), ctx(), players))
      if (isKingAttacked(squares, active)) agentSay('Check!', 400)
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
