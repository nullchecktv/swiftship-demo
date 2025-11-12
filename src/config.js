// API Configuration
export const API_CONFIG = {
  // Base URL for all API endpoints
  BASE_URL: import.meta.env.VITE_BASE_URL || 'http://localhost:3001',

  // Demo tenant ID for consistent testing
  DEMO_TENANT_ID: 'demo-tenant',

  // Request timeout in milliseconds
  REQUEST_TIMEOUT: 30000,

  // Retry configuration
  MAX_RETRIES: 2,
  RETRY_DELAY: 1000
}

// Momento Configuration
export const MOMENTO_CONFIG = {
  // Momento auth token from environment
  AUTH_TOKEN: import.meta.env.VITE_MOMENTO_AUTH_TOKEN,

  // Cache name for topic subscriptions
  CACHE_NAME: 'mcp',

  // Topic name pattern - uses contextId/sessionId
  getTopicName: (contextId, sessionId) => `${contextId}-${sessionId}`,

  // Default context and session for demo
  DEFAULT_CONTEXT_ID: 'demo-context',
  DEFAULT_SESSION_ID: 'demo-session'
}

// Demo scenario data models
export const DEMO_SCENARIOS = {
  simple: {
    keywords: ['not home', 'address', 'access', 'other'],
    expectedProcessingTime: 2000,
    expectedAgents: ['triage']
  },
  complex: {
    keywords: ['damaged', 'broken', 'unusual', 'smells', 'noises', 'replace', 'refund'],
    expectedProcessingTime: 6000,
    expectedAgents: ['triage', 'payment', 'warehouse', 'order']
  }
}

// A2A Event types for validation
export const A2A_EVENT_TYPES = {
  START: 'start',
  AGENT_CALL: 'agent_call',
  AGENT_RESPONSE: 'agent_response',
  COMPLETE: 'complete',
  ERROR: 'error'
}

// Agent types
export const AGENT_TYPES = {
  TRIAGE: 'triage',
  ORDER: 'order',
  PAYMENT: 'payment',
  WAREHOUSE: 'warehouse'
}
