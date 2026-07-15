/**
 * Pure helpers for the agent grid (headshot tiles). Kept side-effect free and
 * unit-tested — the initials fallback and its deterministic color ramp must be
 * stable across renders and platforms.
 */

/** One agent as the grid renders it, merged from the runtime roster + atproto profile. */
export interface AgentGridEntry {
  /** Stable identity key: the handle, lowercased. */
  key: string
  handle: string
  did?: string
  displayName?: string
  avatar?: string
  /** True when the signed-in user owns this agent (it is in their /app/agents roster). */
  owned: boolean
  /** True when the agent has an active live room (a live thread it is a member of). */
  live: boolean
  paused: boolean
  /** Rolled-up unread across this agent's in-app group threads (0 = none). */
  unread: number
}

/**
 * Initials for the no-avatar fallback tile: first letters of the first two words
 * of the display name, else the first two letters of the handle's first segment.
 */
export function initialsFor(displayName?: string, handle?: string): string {
  const name = displayName?.trim()
  if (name) {
    const words = name.split(/\s+/).filter(Boolean)
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase()
    }
    if (words.length === 1) {
      return words[0].slice(0, 2).toUpperCase()
    }
  }
  const seg = handle?.trim().split('.')[0] ?? ''
  return seg.slice(0, 2).toUpperCase() || '?'
}

/**
 * Fixed color ramps for initials tiles — dark-enough backgrounds with bright
 * foregrounds so the same pair reads in light AND dark themes (self-contained
 * colors, not theme atoms, so an agent keeps its color everywhere).
 */
export const AVATAR_RAMPS: ReadonlyArray<{bg: string; fg: string}> = [
  {bg: '#123a30', fg: '#5dcaa5'},
  {bg: '#2a2452', fg: '#afa9ec'},
  {bg: '#3d1626', fg: '#ed93b1'},
  {bg: '#3a2a0c', fg: '#ef9f27'},
  {bg: '#0c2b45', fg: '#85b7eb'},
  {bg: '#3a1a10', fg: '#f0997b'},
  {bg: '#233a10', fg: '#97c459'},
  {bg: '#2a2a26', fg: '#b4b2a9'},
]

/** Deterministic ramp pick for a key (handle) — same agent, same color, always. */
export function rampFor(key: string): {bg: string; fg: string} {
  let hash = 0
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0
  }
  return AVATAR_RAMPS[hash % AVATAR_RAMPS.length]
}
