import {describe, expect, it, jest} from '@jest/globals'
import {render} from '@testing-library/react-native'

// The real #/alf barrel drags in Layout -> Dialog -> the native bottom-sheet
// module, which cannot load under jest. The grid only reads style atoms and
// theme colors, so proxy stubs are faithful enough.
jest.mock('#/alf', () => {
  const styleProxy: Record<string, object> = new Proxy({}, {get: () => ({})})
  return {
    atoms: styleProxy,
    useTheme: () => ({
      atoms: styleProxy,
      palette: new Proxy({}, {get: () => '#000000'}),
    }),
  }
})

jest.mock('#/components/Typography', () => {
  const {Text} = require('react-native')
  return {Text}
})

// The real UserAvatar pulls in image/moderation machinery irrelevant here.
jest.mock('#/view/com/util/UserAvatar', () => {
  const {View} = require('react-native')
  return {
    UserAvatar: ({size}: {size: number}) => {
      return <View testID="userAvatarImage" style={{width: size}} />
    },
  }
})

jest.mock('../useAgentDirectory', () => ({
  useAgentDirectory: jest.fn(),
}))

import {AgentAvatar} from '../AgentAvatar'
import {AgentGrid} from '../AgentGrid'
import {useAgentDirectory} from '../useAgentDirectory'
import {type AgentGridEntry} from '../util'

const mockDirectory = useAgentDirectory as jest.Mock

function entry(overrides: Partial<AgentGridEntry>): AgentGridEntry {
  return {
    key: 'ada.pds.authority-one.com',
    handle: 'ada.pds.authority-one.com',
    displayName: 'Ada',
    owned: true,
    live: false,
    paused: false,
    unread: 0,
    ...overrides,
  }
}

describe('AgentAvatar', () => {
  it('renders the real photo when an avatar url exists', () => {
    const r = render(
      <AgentAvatar
        handle="ada.pds.authority-one.com"
        displayName="Ada"
        avatar="https://cdn.example/ada.jpg"
        size={60}
      />,
    )
    expect(r.getByTestId('userAvatarImage')).toBeTruthy()
    expect(r.queryByTestId('agentInitialsAvatar')).toBeNull()
  })

  it('falls back to initials without an avatar, and shows the live dot', () => {
    const r = render(
      <AgentAvatar
        handle="dorothy.pds.authority-one.com"
        displayName="Dorothy Vale"
        size={60}
        live
      />,
    )
    expect(r.getByTestId('agentInitialsAvatar')).toBeTruthy()
    expect(r.getByText('DV')).toBeTruthy()
    expect(r.getByTestId('agentLiveDot')).toBeTruthy()
  })

  it('shows no live dot by default', () => {
    const r = render(
      <AgentAvatar handle="opie.pds.authority-one.com" size={60} />,
    )
    expect(r.queryByTestId('agentLiveDot')).toBeNull()
  })

  it('shows an unread count bubble, capped at 99+', () => {
    const r = render(
      <AgentAvatar
        handle="ada.pds.authority-one.com"
        size={60}
        unreadCount={4}
      />,
    )
    expect(r.getByTestId('agentUnreadBadge')).toBeTruthy()
    expect(r.getByText('4')).toBeTruthy()
    const capped = render(
      <AgentAvatar
        handle="ada.pds.authority-one.com"
        size={60}
        unreadCount={250}
      />,
    )
    expect(capped.getByText('99+')).toBeTruthy()
  })

  it('shows no unread bubble at zero', () => {
    const r = render(
      <AgentAvatar
        handle="ada.pds.authority-one.com"
        size={60}
        unreadCount={0}
      />,
    )
    expect(r.queryByTestId('agentUnreadBadge')).toBeNull()
  })
})

describe('AgentGrid', () => {
  it('renders both labeled sections with one tile per agent', () => {
    mockDirectory.mockReturnValue({
      owned: [
        entry({}),
        entry({
          key: 'bull.pds.authority-one.com',
          handle: 'bull.pds.authority-one.com',
          displayName: 'Bull',
          live: true,
        }),
      ],
      chattingWith: [
        entry({
          key: 'bob.pds.authority-one.com',
          handle: 'bob.pds.authority-one.com',
          displayName: 'Bob',
          owned: false,
        }),
      ],
      isLoading: false,
      isEmpty: false,
    })
    const r = render(<AgentGrid onPressAgent={() => {}} />)
    expect(r.getByText('Your agents')).toBeTruthy()
    expect(r.getByText('Chatting with')).toBeTruthy()
    expect(r.getByText('Ada')).toBeTruthy()
    expect(r.getByText('Bull')).toBeTruthy()
    expect(r.getByText('Bob')).toBeTruthy()
    // Bull is in a live room -> exactly one live dot in the grid.
    expect(r.getAllByTestId('agentLiveDot')).toHaveLength(1)
  })

  it('hides the "Chatting with" section when there are no non-owned agents', () => {
    mockDirectory.mockReturnValue({
      owned: [entry({})],
      chattingWith: [],
      isLoading: false,
      isEmpty: false,
    })
    const r = render(<AgentGrid onPressAgent={() => {}} />)
    expect(r.queryByText('Chatting with')).toBeNull()
  })

  it('renders the fallback when there are no agents at all', () => {
    const {Text} = require('react-native')
    mockDirectory.mockReturnValue({
      owned: [],
      chattingWith: [],
      isLoading: false,
      isEmpty: true,
    })
    const r = render(
      <AgentGrid onPressAgent={() => {}} fallback={<Text>none yet</Text>} />,
    )
    expect(r.getByText('none yet')).toBeTruthy()
  })
})
