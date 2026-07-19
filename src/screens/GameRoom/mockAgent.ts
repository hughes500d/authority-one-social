/** The agent commentator's identity on the MOCK transports' chat lane. The
 *  live match carries `from: 'agent'` for the real commentator. In its own
 *  module so every mock can import it without cycling through gameClient.ts. */
export const MOCK_AGENT_ID = 'agent:bob'
export const MOCK_AGENT_NAME = 'Bob'
