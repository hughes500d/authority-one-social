import {gameoverPanelMode} from '../gameoverPanel'

const base = {
  live: true,
  storyMode: false,
  hasState: true,
  gameover: true,
  isGuest: false,
}

describe('gameoverPanelMode', () => {
  it('offers a real new-match create to a signed-in viewer of a finished live match', () => {
    expect(gameoverPanelMode(base)).toBe('new-match')
  })

  it('offers only the fresh-link hint to a guest (token is scoped to this one match)', () => {
    expect(gameoverPanelMode({...base, isGuest: true})).toBe('guest-hint')
  })

  it('shows nothing while the match is still running', () => {
    expect(gameoverPanelMode({...base, gameover: false})).toBe('none')
  })

  it('shows nothing before the first authoritative state frame', () => {
    expect(gameoverPanelMode({...base, hasState: false})).toBe('none')
  })

  it('shows nothing in mock rooms — those have a real local reset already', () => {
    expect(gameoverPanelMode({...base, live: false})).toBe('none')
  })

  it('shows nothing in story mode — the scene pane owns its endgame flow', () => {
    expect(gameoverPanelMode({...base, storyMode: true})).toBe('none')
  })
})
