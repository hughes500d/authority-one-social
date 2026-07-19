import {afterEach, beforeEach, describe, expect, it, jest} from '@jest/globals'

import {createMockCheckersClient} from '../mockCheckersClient'
import {createMockChessClient} from '../mockChessClient'
import {
  type GameCallbacks,
  type GameClient,
  type GameCtx,
  type GameG,
} from '../types'

function harness() {
  const states: Array<{G: GameG; ctx: GameCtx}> = []
  const gameovers: Array<string | null> = []
  const callbacks: GameCallbacks = {
    onState: (G, ctx) => states.push({G, ctx}),
    onChat: () => {},
    onPlayers: () => {},
    onGameover: w => gameovers.push(w),
  }
  return {callbacks, states, gameovers}
}

describe('createMockCheckersClient', () => {
  let client: GameClient | null = null

  beforeEach(() => {
    jest.useFakeTimers()
  })
  afterEach(() => {
    client?.disconnect()
    client = null
    jest.useRealTimers()
  })

  it('emits a checkers state with legalMoves and applies valid hops', () => {
    const h = harness()
    client = createMockCheckersClient({
      matchID: 'm1',
      playerID: '0',
      name: 'Elliott',
      callbacks: h.callbacks,
    })
    client.connect()
    jest.runAllTimers()
    const first = h.states[0]
    if (first.G.kind !== 'checkers') throw new Error('expected checkers G')
    expect(first.G.board.filter(Boolean)).toHaveLength(24)
    expect(first.G.legalMoves.length).toBeGreaterThan(0)
    expect(first.ctx.currentPlayer).toBe('0')

    const hop = first.G.legalMoves[0]
    client.sendMove({type: 'move', args: {from: hop.from, to: hop.to}})
    jest.runAllTimers()
    const next = h.states[h.states.length - 1]
    if (next.G.kind !== 'checkers') throw new Error('expected checkers G')
    expect(next.G.board[hop.from]).toBeNull()
    expect(next.G.board[hop.to]).toEqual({player: 0, king: false})
    expect(next.ctx.currentPlayer).toBe('1')

    // Invalid hops (wrong shape / illegal) change nothing.
    const n = h.states.length
    client.sendMove({type: 'move', args: {from: 0, to: 63}})
    client.sendMove({type: 'place', args: {cell: 4}})
    jest.runAllTimers()
    expect(h.states).toHaveLength(n)
  })
})

describe('createMockChessClient', () => {
  let client: GameClient | null = null

  beforeEach(() => {
    jest.useFakeTimers()
  })
  afterEach(() => {
    client?.disconnect()
    client = null
    jest.useRealTimers()
  })

  it('emits a FEN state with legalMoves and applies a legal move', () => {
    const h = harness()
    client = createMockChessClient({
      matchID: 'm1',
      playerID: '0',
      name: 'Elliott',
      callbacks: h.callbacks,
    })
    client.connect()
    jest.runAllTimers()
    const first = h.states[0]
    if (first.G.kind !== 'chess') throw new Error('expected chess G')
    expect(first.G.fen.startsWith('rnbqkbnr/pppppppp/')).toBe(true)
    expect(first.G.legalMoves).toHaveLength(20)
    expect(first.ctx.currentPlayer).toBe('0')

    client.sendMove({type: 'move', args: {from: 'e2', to: 'e4'}})
    jest.runAllTimers()
    const next = h.states[h.states.length - 1]
    if (next.G.kind !== 'chess') throw new Error('expected chess G')
    expect(next.G.fen.split(' ')[1]).toBe('b')
    expect(next.G.lastMove).toEqual({from: 'e2', to: 'e4'})
    expect(next.ctx.currentPlayer).toBe('1')

    // Illegal move: white piece while black to move.
    const n = h.states.length
    client.sendMove({type: 'move', args: {from: 'd2', to: 'd4'}})
    jest.runAllTimers()
    expect(h.states).toHaveLength(n)
  })
})
