import { API_CONFIG, DEMO_SCENARIOS, A2A_EVENT_TYPES, AGENT_TYPES } from '../config.js'

// Demo notification data model
export class DemoNotification {
  constructor(orderId, exceptionType, notes, timestamp, driverInfo, contextId) {
    this.eventType = 'delivery_exception'
    this.tenantId = API_CONFIG.DEMO_TENANT_ID
    this.eventId = `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    this.timestamp = timestamp || new Date().toISOString()
    this.contextId = contextId // Add contextId for Momento topic subscription
    this.payload = {
      orderId: orderId.toUpperCase(),
      exceptionType,
      driverNotes: notes,
      driverInfo: driverInfo || {
        name: 'Dave M.',
        route: '847',
        timestamp: this.timestamp
      },
      attachments: ['IMG_2847.jpg'], // Mock attachment
      location: {
        lat: 40.7128,
        lng: -74.0060,
        address: 'Customer delivery address'
      }
    }
    this.metadata = {
      source: 'driver_portal',
      priority: this.determinePriority(exceptionType, notes),
      scenarioType: this.determineScenarioType(exceptionType, notes)
    }
  }

  determinePriority(exceptionType, notes) {
    const highPriorityKeywords = ['damaged', 'broken', 'urgent', 'complaint']
    const notesLower = notes.toLowerCase()

    if (exceptionType === 'Damaged/Unusual Package' ||
        highPriorityKeywords.some(keyword => notesLower.includes(keyword))) {
      return 'high'
    }
    return 'normal'
  }

  determineScenarioType(exceptionType, notes) {
    const notesLower = notes.toLowerCase()
    const complexKeywords = DEMO_SCENARIOS.complex.keywords

    if (complexKeywords.some(keyword => notesLower.includes(keyword))) {
      return 'complex'
    }
    return 'simple'
  }

  validate() {
    const errors = []

    if (!this.payload.orderId || !/^[A-Za-z][0-9]{3,6}$/.test(this.payload.orderId)) {
      errors.push('Invalid order ID format')
    }

    if (!this.payload.exceptionType) {
      errors.push('Exception type is required')
    }

    if (!this.payload.driverNotes || this.payload.driverNotes.length < 5) {
      errors.push('Driver notes must be at least 5 characters')
    }

    if (this.payload.driverNotes && this.payload.driverNotes.length > 500) {
      errors.push('Driver notes must be under 500 characters')
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }
}

// A2A Event model for real-time monitoring
export class A2AEvent {
  constructor(type, agent, message, data, timestamp) {
    this.id = `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    this.type = type
    this.agent = agent
    this.timestamp = timestamp || new Date().toISOString()
    this.message = message
    this.data = data || {}
  }

  static validate(event) {
    const errors = []

    if (!event.type || !Object.values(A2A_EVENT_TYPES).includes(event.type)) {
      errors.push('Invalid event type')
    }

    if (!event.agent || !Object.values(AGENT_TYPES).includes(event.agent)) {
      errors.push('Invalid agent type')
    }

    if (!event.message || typeof event.message !== 'string') {
      errors.push('Event message is required')
    }

    if (!event.timestamp) {
      errors.push('Event timestamp is required')
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }
}

// Triage Service for API communication
export class TriageService {
  constructor() {
    this.baseUrl = API_CONFIG.BASE_URL
    this.timeout = API_CONFIG.REQUEST_TIMEOUT
    this.maxRetries = API_CONFIG.MAX_RETRIES
    this.retryDelay = API_CONFIG.RETRY_DELAY
  }

  async submitException(orderId, exceptionType, notes, contextId, onEventReceived) {
    // Generate a delivery ID from the order ID
    const deliveryId = `DEL-${orderId}`

    // Create delivery status payload
    const statusPayload = {
      orderId: orderId.toUpperCase(),
      status: 'exception',
      timestamp: new Date().toISOString(),
      location: 'Customer delivery address',
      driverId: 'DRV-847',
      reason: `${exceptionType}: ${notes}`
    }

    // Validate payload
    if (!orderId || !/^[A-Za-z][0-9]{3,6}$/.test(orderId)) {
      throw new Error('Invalid order ID format')
    }

    if (!notes || notes.length < 5) {
      throw new Error('Driver notes must be at least 5 characters')
    }

    if (notes.length > 500) {
      throw new Error('Driver notes must be under 500 characters')
    }

    // Submit to delivery status endpoint with retry logic
    let lastError
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await this.makeRequest(deliveryId, statusPayload, contextId, onEventReceived)
        return response
      } catch (error) {
        lastError = error
        console.warn(`Attempt ${attempt + 1} failed:`, error.message)

        if (attempt < this.maxRetries) {
          await this.delay(this.retryDelay * (attempt + 1))
        }
      }
    }

    throw lastError
  }

  async makeRequest(deliveryId, statusPayload, contextId, onEventReceived) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)

    try {
      // Emit initial event
      if (onEventReceived) {
        const startEvent = new A2AEvent(
          A2A_EVENT_TYPES.START,
          AGENT_TYPES.TRIAGE,
          'Submitting delivery status update',
          {
            orderId: statusPayload.orderId,
            deliveryId,
            status: statusPayload.status
          }
        )
        onEventReceived(startEvent)
      }

      const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }

      // Add context ID header if provided
      if (contextId) {
        headers['X-Context-Id'] = contextId
      }

      const response = await fetch(`${this.baseUrl}/deliveries/${deliveryId}/statuses`, {
        method: 'POST',
        headers,
        body: JSON.stringify(statusPayload),
        signal: controller.signal
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(`HTTP ${response.status}: ${errorData.error?.message || errorData.message || 'Request failed'}`)
      }

      const result = await response.json()

      // Emit completion event
      if (onEventReceived) {
        const completeEvent = new A2AEvent(
          A2A_EVENT_TYPES.COMPLETE,
          AGENT_TYPES.TRIAGE,
          'Delivery status update accepted for processing',
          {
            orderId: statusPayload.orderId,
            deliveryId,
            contextId: result.notifications?.contextId
          }
        )
        onEventReceived(completeEvent)
      }

      return result

    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('Request timed out')
      }

      // Emit error event
      if (onEventReceived) {
        const errorEvent = new A2AEvent(
          A2A_EVENT_TYPES.ERROR,
          AGENT_TYPES.TRIAGE,
          `Processing failed: ${error.message}`,
          { error: error.message, orderId: statusPayload.orderId }
        )
        onEventReceived(errorEvent)
      }

      throw error
    } finally {
      clearTimeout(timeoutId)
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// Create singleton instance
export const triageService = new TriageService()
