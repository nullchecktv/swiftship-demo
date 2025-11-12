import { useEffect, useState } from 'react'
import { deliveryService } from '../services/deliveryService.js'
import AgentSequenceDiagram from '../components/AgentSequenceDiagram.jsx'

export default function ProcessingView({ deliveryData, onBack }) {
  const [diagramEvents, setDiagramEvents] = useState([])
  const [processingTime, setProcessingTime] = useState(0)
  const [error, setError] = useState(null)
  const [isProcessing, setIsProcessing] = useState(true)

  useEffect(() => {
    if (!deliveryData) {
      onBack()
      return
    }

    let cancelled = false
    const startTime = Date.now()

    const processDelivery = async () => {
      try {
        await deliveryService.updateDeliveryStatus(
          deliveryData.deliveryId,
          deliveryData.payload,
          (notification) => {
            if (!cancelled && notification.kind === 'task') {
              setDiagramEvents(prev => [...prev, notification])
            }
          }
        )

        if (!cancelled) {
          const endTime = Date.now()
          setProcessingTime(endTime - startTime)
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Delivery status update error:', err)
          const endTime = Date.now()
          setProcessingTime(endTime - startTime)
          setError({
            message: err.message || 'Failed to update delivery status',
            details: 'Please try again or contact support if the problem persists.'
          })
        }
      } finally {
        if (!cancelled) {
          setIsProcessing(false)
        }
      }
    }

    processDelivery()

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="processing-view">
      <div className="processing-header">
        <button
          onClick={onBack}
          className="back-btn"
          disabled={isProcessing}
        >
          ← Back to Form
        </button>
        <div className="processing-title">
          <h1>AI Agent Processing</h1>
        </div>
      </div>

      {error && (
        <div className="error-display">
          <div className="error-header">
            <div className="error-status">❌ Processing Failed</div>
          </div>
          <div className="error-content">
            <div className="error-message">{error.message}</div>
            <div className="error-details">{error.details}</div>
          </div>
          <div className="error-actions">
            <button
              type="button"
              className="reset-btn"
              onClick={onBack}
            >
              Return to Form
            </button>
          </div>
        </div>
      )}

      {isProcessing && diagramEvents.length === 0 && (
        <section className="agent-diagram-section">
          <div className="agent-diagram-header">
            <h2 className="agent-diagram-title">
              <span style={{ marginRight: '8px' }}>📊</span>
              Agent Sequence Diagram
            </h2>
          </div>
          <div className="agent-diagram-waiting">
            <div className="agent-diagram-waiting-content">
              <div className="spinner" style={{ width: '32px', height: '32px' }}></div>
              <p className="agent-diagram-waiting-text">Sending to supervisor agent...</p>
            </div>
          </div>
        </section>
      )}

      <AgentSequenceDiagram
        events={diagramEvents}
        onClear={() => setDiagramEvents([])}
      />
    </div>
  )
}
