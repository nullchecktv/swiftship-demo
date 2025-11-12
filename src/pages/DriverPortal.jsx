import { useEffect, useMemo, useRef, useState } from 'react'
import ProcessingView from './ProcessingView.jsx'

const EXCEPTION_TYPES = [
  'Customer Not Home',
  'Address Issue',
  'Damaged/Unusual Package',
  'Access Restricted',
  'Other',
]

const DEMO_SCENARIOS = {
  simple: {
    exceptionType: 'Customer Not Home',
    notes: 'Customer not available for delivery. Left notice in mailbox. Will attempt redelivery tomorrow.',
    description: 'Simple scenario - Direct triage processing'
  },
  complex: {
    exceptionType: 'Damaged/Unusual Package',
    notes: 'Package severely damaged during transit. Contents appear compromised. Customer requires immediate replacement and refund processing.',
    description: 'Complex scenario - A2A orchestration with multiple agents'
  }
}

function formatUtcTimestamp(d) {
  const month = d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })
  const day = d.toLocaleString('en-US', { day: '2-digit', timeZone: 'UTC' })
  const year = d.toLocaleString('en-US', { year: 'numeric', timeZone: 'UTC' })
  const hour = d.toLocaleString('en-US', { hour: '2-digit', hour12: false, timeZone: 'UTC' })
  const minute = d.toLocaleString('en-US', { minute: '2-digit', timeZone: 'UTC' })
  return `${month} ${day}, ${year} - ${hour}:${minute} UTC`
}

export default function DriverPortal() {
  const [exceptionType, setExceptionType] = useState('Damaged/Unusual Package')
  const [notes, setNotes] = useState(
    'idk man, box was making weird noises. also smelled funny. left it at depot. customer wasnt home anyway 🤷'
  )
  const [now, setNow] = useState(() => new Date())
  const [deliveryData, setDeliveryData] = useState(null)
  const submitBtnRef = useRef(null)

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])



  const timestamp = useMemo(() => formatUtcTimestamp(now), [now])
  const charCount = notes.length



  function handleSubmit(e) {
    e.preventDefault()

    const deliveryId = `DEL-${Date.now()}`
    const statusMap = {
      'Customer Not Home': 'failed',
      'Address Issue': 'failed',
      'Damaged/Unusual Package': 'exception',
      'Access Restricted': 'failed',
      'Other': 'exception'
    }

    setDeliveryData({
      deliveryId,
      payload: {
        orderId: 'ORD-DEMO-001',
        status: statusMap[exceptionType] || 'exception',
        location: '123 Demo Street, Las Vegas, NV',
        driverId: 'DRV-DEMO-001',
        reason: notes
      }
    })
  }

  function handleBackToForm() {
    setDeliveryData(null)
  }

  if (deliveryData) {
    return <ProcessingView deliveryData={deliveryData} onBack={handleBackToForm} />
  }

  return (
    <div className="driver-layout">
      <div className="driver-main">
        <section aria-labelledby="driver-form-title" className="card">
          <h1 id="driver-form-title" className="card-title">Driver Exception Reporting</h1>

          <div className="demo-presets">
            <div className="preset-header">
              <span className="preset-title">Quick Scenarios</span>
            </div>
            <div className="preset-buttons">
              <button
                type="button"
                className="preset-btn"
                onClick={() => {
                  setExceptionType(DEMO_SCENARIOS.simple.exceptionType)
                  setNotes(DEMO_SCENARIOS.simple.notes)
                }}
              >
                <div className="preset-btn-content">
                  <div className="preset-name">Simple Scenario</div>
                  <div className="preset-desc">{DEMO_SCENARIOS.simple.description}</div>
                </div>
              </button>
              <button
                type="button"
                className="preset-btn"
                onClick={() => {
                  setExceptionType(DEMO_SCENARIOS.complex.exceptionType)
                  setNotes(DEMO_SCENARIOS.complex.notes)
                }}
              >
                <div className="preset-btn-content">
                  <div className="preset-name">Complex Scenario</div>
                  <div className="preset-desc">{DEMO_SCENARIOS.complex.description}</div>
                </div>
              </button>
            </div>
          </div>

          <form className="form" onSubmit={handleSubmit} noValidate>
            <div className="form-row">
              <label htmlFor="orderId" className="label">Order ID</label>
              <div className="input-group">
                <input
                  id="orderId"
                  name="orderId"
                  type="text"
                  className="input"
                  value="ORD-DEMO-001"
                  disabled
                />
                <button
                  type="button"
                  className="icon-btn"
                  title="Search"
                  aria-label="Search order (decorative)"
                  disabled
                >🔍</button>
              </div>
            </div>

            <fieldset className="form-row">
              <legend className="label">Exception Type</legend>
              <div className="radio-list">
                {EXCEPTION_TYPES.map((t) => (
                  <label key={t} className="radio-item">
                    <input
                      type="radio"
                      name="exceptionType"
                      value={t}
                      checked={exceptionType === t}
                      onChange={() => setExceptionType(t)}
                    />
                    <span>{t}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="form-row">
              <label htmlFor="notes" className="label">Notes</label>
              <textarea
                id="notes"
                name="notes"
                rows={7}
                className="textarea"
                placeholder="Describe the exception..."
                maxLength={500}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
              <div className="counter" aria-live="polite">{charCount} / 500 characters</div>
            </div>

            <div className="form-row">
              <div className="file-pill" aria-label="Uploaded photo">📷 IMG_2847.jpg</div>
            </div>

            <div className="form-row time-row">
              <span className="label">Timestamp</span>
              <div className="timestamp" aria-live="polite">{timestamp}</div>
            </div>

            <div className="form-row">
              <button
                ref={submitBtnRef}
                type="submit"
                className="primary-btn"
              >
                Submit Exception Report
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  )
}
