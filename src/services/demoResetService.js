import { API_CONFIG } from '../config.js'

/**
 * Demo Reset Service
 * Handles API calls to reset demo data
 */
export class DemoResetService {
  constructor() {
    this.baseUrl = API_CONFIG.BASE_URL
    this.tenantId = API_CONFIG.DEMO_TENANT_ID
  }

  /**
   * Reset demo data to predefined scenario
   * @param {string} scenarioType - Type of scenario ('full' or 'minimal')
   * @returns {Promise<Object>} Reset operation result
   */
  async resetDemo(scenarioType = 'full') {
    try {
      const response = await fetch(`${this.baseUrl}/demo/reset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tenantId: this.tenantId,
          scenarioType
        }),
        signal: AbortSignal.timeout(API_CONFIG.REQUEST_TIMEOUT)
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || `Reset failed with status ${response.status}`)
      }

      const result = await response.json()
      return {
        success: true,
        data: result
      }
    } catch (error) {
      console.error('Demo reset error:', error)

      if (error.name === 'AbortError') {
        throw new Error('Reset operation timed out. Please try again.')
      }

      if (error.message.includes('fetch')) {
        throw new Error('Unable to connect to demo reset service. Please check your connection.')
      }

      throw error
    }
  }

  /**
   * Check if demo reset service is available
   * @returns {Promise<boolean>} Service availability status
   */
  async checkServiceHealth() {
    try {
      const response = await fetch(`${this.baseUrl}/demo/reset`, {
        method: 'OPTIONS',
        signal: AbortSignal.timeout(5000)
      })
      return response.ok
    } catch (error) {
      console.error('Demo reset service health check failed:', error)
      return false
    }
  }
}

// Export singleton instance
export const demoResetService = new DemoResetService()
