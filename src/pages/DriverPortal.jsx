import React, { useEffect, useMemo, useRef, useState } from 'react'

// Clipboard helper with fallback (mirrors Customer page behavior)
async function copyToClipboard(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch (err) {
    // continue to fallback
    // eslint-disable-next-line no-console
    console.error('Clipboard API failed:', err)
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'absolute'
    ta.style.left = '-9999px'
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
    return true
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Fallback clipboard failed:', err)
    return false
  }
}

// Exception radio options
const EXCEPTION_TYPES = [
  'Customer Not Home',
  'Address Issue',
  'Damaged/Unusual Package',
  'Access Restricted',
  'Other',
]

// Format like: "Oct 23, 2025 - 14:23 UTC"
function formatUtcTimestamp(d) {
  const month = d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })
  const day = d.toLocaleString('en-US', { day: '2-digit', timeZone: 'UTC' })
  const year = d.toLocaleString('en-US', { year: 'numeric', timeZone: 'UTC' })
  const hour = d.toLocaleString('en-US', { hour: '2-digit', hour12: false, timeZone: 'UTC' })
  const minute = d.toLocaleString('en-US', { minute: '2-digit', timeZone: 'UTC' })
  return `${month} ${day}, ${year} - ${hour}:${minute} UTC`
}

export default function DriverPortal() {
  const [orderId, setOrderId] = useState('')
  const [orderError, setOrderError] = useState('')
  const [exceptionType, setExceptionType] = useState('Damaged/Unusual Package')
  const [notes, setNotes] = useState(
    'idk man, box was making weird noises. also smelled funny. left it at depot. customer wasnt home anyway 🤷'
  )
  const [submitting, setSubmitting] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')
  const [generatedPrompt, setGeneratedPrompt] = useState('')
  const [now, setNow] = useState(() => new Date())
  const submitBtnRef = useRef(null)
  const promptBlockRef = useRef(null)

  // When a prompt is created, ensure the overlay is visible
  useEffect(() => {
    if (!generatedPrompt) return
    const id = setTimeout(() => {
      try { promptBlockRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) } catch {}
    }, 50)
    return () => clearTimeout(id)
  }, [generatedPrompt])

  // Live timestamp updater
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const timestamp = useMemo(() => formatUtcTimestamp(now), [now])
  const charCount = notes.length

  // One letter + 3-6 digits
  function validateOrderId(value) {
    const re = /^[A-Za-z][0-9]{3,6}$/
    return re.test(value)
  }

  // Submit flow: validate -> show loading -> generate prompt -> clipboard -> show success
  async function handleSubmit(e) {
    e.preventDefault()
    setOrderError('')
    setStatusMsg('')

    if (!validateOrderId(orderId)) {
      setOrderError('Order ID must be 1 letter followed by 3–6 digits (e.g., B456).')
      return
    }

    setSubmitting(true)
    setGeneratedPrompt('')

    const start = new Date()
    const ts = formatUtcTimestamp(start)

    const prompt = [
      'DELIVERY EXCEPTION REPORT - DRIVER PORTAL',
      '',
      `Order ID: ${orderId.toUpperCase()}`,
      'Driver: Dave M. (Route 847)',
      `Exception Type: ${exceptionType}`,
      `Timestamp: ${ts}`,
      '',
      'Driver Notes:',
      `"${notes}"`,
      '',
      'Execute appropriate triage action.'
    ].join('\n')

    // Simulate API latency
    await new Promise(r => setTimeout(r, 500))

    setGeneratedPrompt(prompt)
    setSubmitting(false)
    // Return focus to submit for accessibility
    submitBtnRef.current?.focus()
  }

  return (
    <section aria-labelledby="driver-form-title" className="card">
      <h1 id="driver-form-title" className="card-title">Driver Exception Reporting</h1>

      <form className="form" onSubmit={handleSubmit} noValidate>
        <div className="form-row">
          <label htmlFor="orderId" className="label">Order ID</label>
          <div className="input-group">
            <input
              id="orderId"
              name="orderId"
              type="text"
              inputMode="text"
              className={`input ${orderError ? 'input-error' : ''}`}
              placeholder="Enter order ID (e.g., B456)"
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              pattern="[A-Za-z][0-9]{3,6}"
              aria-describedby="orderHelp"
              aria-invalid={orderError ? 'true' : 'false'}
              disabled={submitting}
            />
            <button
              type="button"
              className="icon-btn"
              title="Search"
              aria-label="Search order (decorative)"
              disabled={submitting}
            >🔍</button>
          </div>
          <div id="orderHelp" className="help">One letter followed by 3–6 digits.</div>
          {orderError && <div role="alert" className="error">{orderError}</div>}
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
                  disabled={submitting}
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
            disabled={submitting}
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
            disabled={submitting}
          >
            {submitting ? (
              <span className="btn-content">
                <span className="spinner" aria-hidden></span>
                Submitting to logistics AI...
              </span>
            ) : (
              'Submit Exception Report'
            )}
          </button>
        </div>

        <div className="status" role="status" aria-live="polite">{statusMsg}</div>
      </form>

      {generatedPrompt && (
        <div
          ref={promptBlockRef}
          className="demo-overlay"
          role="complementary"
          aria-label="Demo overlay: Generated prompt (not visible to end users)"
        >
          <div className="demo-overlay-head">
            <span className="demo-badge" aria-hidden>Demo</span>
            <span className="demo-title">Generated Prompt</span>
            <div className="spacer" />
            <button
              type="button"
              className="copy-btn"
              onClick={() => copyToClipboard(generatedPrompt)}
            >Copy</button>
          </div>
          <div className="code-block light">
            <pre>{generatedPrompt}</pre>
          </div>
        </div>
      )}
    </section>
  )
}
