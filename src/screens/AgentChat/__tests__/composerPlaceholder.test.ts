/**
 * Regression test for the garbled composer placeholders on the AgentChat screen.
 *
 * SYMPTOM (live, in-app): a placeholder rendered as a raw Lingui message ID (e.g.
 * "ZVCRHy") because its `msg`…`` macro ID was missing from the compiled catalog.
 * The IDLE composer placeholder ("Message <agent>…") was already fixed to a plain
 * literal; the VOICE "Listening…" state placeholder was a SEPARATE string still
 * using the macro, so it kept rendering the raw ID while the mic was active.
 *
 * FIX: every user-visible string and label on this screen is now a PLAIN LITERAL,
 * so they render the same regardless of compiled-catalog state.
 *
 * Like ApprovalCard.test.tsx, a full render test is impractical (the `#/alf` →
 * Layout → native chain can't be evaluated under jest-expo), so this is a
 * SOURCE-LEVEL guard pinning exactly the thing that regresses.
 */
/* eslint-disable import-x/no-nodejs-modules -- Node-side source-reading test */
import {readFileSync} from 'fs'
import {join} from 'path'

const SRC = readFileSync(join(__dirname, '..', 'index.tsx'), 'utf8')

describe('AgentChat composer/voice placeholders are plain literals (no catalog dependency)', () => {
  it('renders the voice "Listening…" placeholder as a plain literal, not a Lingui macro', () => {
    // The exact regression: `_(msg`Listening…`)` standing in for the literal.
    expect(SRC).not.toMatch(/_\(msg`Listening/)
    expect(SRC).toMatch(/'Listening…'/)
  })

  it('keeps the idle composer placeholder a plain literal', () => {
    expect(SRC).toMatch(/placeholder=\{`Message \$\{agentName\}…`\}/)
  })

  it('has NO remaining Lingui macro labels anywhere on the screen', () => {
    // No macro import, no `_(msg`…`)` call, no <Trans> element — every label is literal.
    expect(SRC).not.toMatch(/@lingui\/(react|core)\/macro/)
    expect(SRC).not.toMatch(/useLingui/)
    expect(SRC).not.toMatch(/_\(msg`/)
    expect(SRC).not.toMatch(/<Trans[\s>]/)
  })
})
