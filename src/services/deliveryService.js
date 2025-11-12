import { momentoService } from './momentoService.js'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

export class DeliveryService {
  async updateDeliveryStatus(deliveryId, statusData, onNotification) {
    try {
      const response = await fetch(`${API_BASE_URL}/deliveries/${deliveryId}/statuses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(statusData)
      })

      if (!response.ok) {
        throw new Error(`Failed to update delivery status: ${response.statusText}`)
      }

      const result = await response.json()

      if (result.notifications?.authToken && result.notifications?.contextId) {
        await this.subscribeToNotifications(
          result.notifications.authToken,
          result.notifications.contextId,
          onNotification
        )
      }

      return result
    } catch (error) {
      console.error('Delivery status update error:', error)
      throw error
    }
  }

  async subscribeToNotifications(authToken, contextId, onNotification) {
    try {
      await momentoService.subscribeToTopic(
        contextId,
        (eventData) => {
          if (onNotification) {
            onNotification(eventData)
          }
        },
        (error) => {
          console.error('Notification subscription error:', error)
        },
        authToken
      )

      console.log(`Subscribed to delivery notifications for context: ${contextId}`)
    } catch (error) {
      console.error('Failed to subscribe to notifications:', error)
      throw error
    }
  }
}

export const deliveryService = new DeliveryService()
