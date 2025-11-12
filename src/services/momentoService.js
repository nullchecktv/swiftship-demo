import { TopicClient, Configurations, CredentialProvider } from '@gomomento/sdk-web'
import { MOMENTO_CONFIG } from '../config.js'

export class MomentoService {
  constructor() {
    this.client = null
    this.activeSubscriptions = new Map()
    this.isInitialized = false
  }

  async initialize() {
    if (this.isInitialized) {
      return
    }

    if (!MOMENTO_CONFIG.API_KEY) {
      console.warn('Momento API key not configured. A2A events will use mock data.')
      this.isInitialized = true
      return
    }

    try {
      this.client = new TopicClient({
        configuration: Configurations.Browser.v1(),
        credentialProvider: CredentialProvider.fromString(MOMENTO_CONFIG.API_KEY)
      })
      this.isInitialized = true
      console.log('Momento client initialized successfully')
    } catch (error) {
      console.error('Failed to initialize Momento client:', error)
      throw new Error('Failed to connect to Momento service')
    }
  }

  async subscribeToTopic(contextId, onEventReceived, onError, customAuthToken = null) {
    let clientToUse = this.client

    if (customAuthToken) {
      try {
        clientToUse = new TopicClient({
          configuration: Configurations.Browser.v1(),
          credentialProvider: CredentialProvider.fromString(customAuthToken)
        })
        console.log('Using custom auth token for subscription')
      } catch (error) {
        console.error('Failed to create client with custom auth token:', error)
        throw error
      }
    } else {
      await this.initialize()
      if (!this.client) {
        console.warn('Momento client not available, using mock subscription')
        return this.createMockSubscription(contextId, onEventReceived)
      }
    }

    try {
      const topicName = contextId

      const subscription = await clientToUse.subscribe(
        'mcp',
        topicName,
        {
          onItem: (item) => {
            try {
              console.log(item);
              const eventData = JSON.parse(item.valueString())
              onEventReceived(eventData)
            } catch (error) {
              console.error('Failed to parse A2A event:', error)
              if (onError) {
                onError(error)
              }
            }
          },
          onError: (error) => {
            console.error('Momento subscription error:', error)
            if (onError) {
              onError(error)
            }
          }
        }
      )

      this.activeSubscriptions.set(contextId, subscription)

      console.log(`Subscribed to Momento topic: ${topicName}`)
      return subscription

    } catch (error) {
      console.error('Failed to subscribe to Momento topic:', error)
      if (onError) {
        onError(error)
      }
      throw error
    }
  }

  async unsubscribe(contextId) {
    const subscription = this.activeSubscriptions.get(contextId)
    if (subscription) {
      try {
        subscription.unsubscribe()
        this.activeSubscriptions.delete(contextId)
        console.log(`Unsubscribed from topic: ${contextId}`)
      } catch (error) {
        console.error('Failed to unsubscribe from topic:', error)
      }
    }
  }

  async unsubscribeAll() {
    const promises = Array.from(this.activeSubscriptions.keys()).map(
      contextId => this.unsubscribe(contextId)
    )
    await Promise.allSettled(promises)
  }

  // Mock subscription for development/testing when Momento is not configured
  createMockSubscription(contextId, onEventReceived) {
    console.log(`Creating mock subscription for topic: ${contextId}`)

    return {
      unsubscribe: () => {
        console.log(`Mock unsubscribe for topic: ${contextId}`)
      }
    }
  }

  // Generate a unique context ID for this session
  generateContextId() {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  // Check if Momento is properly configured
  isConfigured() {
    return !!MOMENTO_CONFIG.API_KEY
  }
}

// Create singleton instance
export const momentoService = new MomentoService()
