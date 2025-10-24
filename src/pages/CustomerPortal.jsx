import React, { useMemo, useRef, useState } from 'react'

// Utility: format timestamp as YYYY-MM-DD HH:mm:ss UTC
function formatIsoUtc(date) {
  const pad = (n) => String(n).padStart(2, '0')
  const y = date.getUTCFullYear()
  const m = pad(date.getUTCMonth() + 1)
  const d = pad(date.getUTCDate())
  const hh = pad(date.getUTCHours())
  const mm = pad(date.getUTCMinutes())
  const ss = pad(date.getUTCSeconds())
  return `${y}-${m}-${d} ${hh}:${mm}:${ss} UTC`
}

// Clipboard helper with fallback
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

export default function CustomerPortal() {
  // Content state
  const DEFAULT_COMMENT = `This is the THIRD time delivery failed. I work from home, I was here ALL DAY. Your driver is lying. I have security cameras and NOBODY came to my door. I need this package for my daughter's birthday TOMORROW and if you can't deliver it I want a full refund, a formal apology, and free shipping for a year.`

  const [comment, setComment] = useState(DEFAULT_COMMENT)
  const [charCount, setCharCount] = useState(DEFAULT_COMMENT.length)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [generatedPrompt, setGeneratedPrompt] = useState('')
  const [shake, setShake] = useState(false)
  const promptBlockRef = useRef(null)
  const submitBtnRef = useRef(null)

  const nearLimit = charCount > 450

  function handleInput(e) {
    let v = e.target.value
    if (v.length > 500) v = v.slice(0, 500)
    setComment(v)
    setCharCount(v.length)
    if (error && v.length >= 10) setError('')
  }

  function buildPrompt(text) {
    const ts = formatIsoUtc(new Date())
    const lines = [
      'CUSTOMER SUPPORT TICKET - ORDER TRACKING',
      '',
      'Order ID: C789',
      'Customer Tier: VIP Platinum',
      'Issue Type: Delivery Failure',
      `Timestamp: ${ts}`,
      '',
      'Customer Comment:',
      `"${text}"`,
      '',
      'Previous Delivery Attempts: 3',
      'Account History: Member since 2019, $8,450 lifetime value',
      '',
      'Execute appropriate triage action.'
    ]
    return lines.join('\n')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSuccessMsg('')
    setGeneratedPrompt('')

    if (!comment || comment.trim().length < 10) {
      setError('Please enter at least 10 characters')
      setShake(true)
      setTimeout(() => setShake(false), 500)
      return
    }

    setSubmitting(true)
    const prompt = buildPrompt(comment.trim())

    // Simulate network latency
    await new Promise((r) => setTimeout(r, 1500))

    await copyToClipboard(prompt)

    setSubmitting(false)
    setGeneratedPrompt(prompt)
    setSuccessMsg('✓ Comment submitted. Prompt copied to clipboard! Our AI agent will review your case.')
    // focus for a11y
    submitBtnRef.current?.focus()
    // scroll prompt into view if present
    setTimeout(() => promptBlockRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }

  // Derived timeline items
  const timeline = useMemo(() => ([
    { status: 'done', date: 'Oct 20', title: 'Order Placed' },
    { status: 'done', date: 'Oct 21', title: 'Shipped from warehouse' },
    { status: 'done', date: 'Oct 22', title: 'Out for delivery' },
    { status: 'warn', date: 'Oct 23', title: 'Delivery Failed', sub: 'Carrier note: Customer not available' },
  ]), [])

  return (
    <>
    <section className="card tracking-card" aria-labelledby="tracking-title">
      {/* Header */}
      <div className="portal-header" role="banner">
        <div className="portal-header-row">
          <div className="brand-left">
            <span className="portal-logo" aria-hidden>📦</span>
            <span className="portal-brand" aria-label="SwiftShip">SwiftShip</span>
          </div>
          <a href="#" className="portal-help" onClick={(e) => e.preventDefault()}>Help</a>
        </div>
        <div className="portal-subtitle">Track Your Order</div>
      </div>

      {/* Order Header */}
      <header className="order-header">
        <h2 id="tracking-title" className="order-title">Order #C789</h2>
        <span className="status-badge status-amber" aria-label="Delivery Exception">⚠️ Delivery Exception</span>
      </header>

      {/* Timeline */}
      <section className="timeline" aria-label="Delivery timeline">
        <ol className="timeline-list">
          {timeline.map((item, idx) => (
            <li
              key={`${item.date}-${item.title}`}
              className={`timeline-item ${item.status}`}
              style={{ animationDelay: `${idx * 100}ms` }}
            >
              <div className="timeline-marker">
                <span className={`timeline-icon ${item.status}`} aria-hidden>
                  {item.status === 'warn' ? '⚠️' : '✓'}
                </span>
                {idx < timeline.length - 1 && <span className="timeline-line" aria-hidden></span>}
              </div>
              <div className="timeline-content">
                <div className="timeline-date" aria-label={`Date ${item.date}`}>{item.date}</div>
                <div className="timeline-title">{item.title}</div>
                {item.sub && <div className="timeline-sub">{item.sub}</div>}
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* VIP Badge */}
      <div className="vip-badge" role="note" aria-label="VIP Platinum Member">👑 VIP Platinum Member</div>

      {/* Metadata */}
      <section className="meta-grid" aria-label="Account details">
        <div className="meta-item" title="Previous delivery attempts"><span className="meta-ico">🔄</span> Previous delivery attempts: 3</div>
        <div className="meta-item" title="Member since"><span className="meta-ico">📅</span> Member since: 2019</div>
        <div className="meta-item" title="Account value"><span className="meta-ico">💎</span> Account value: $8,450</div>
      </section>

      {/* Comment Section */}
      <form className={`comment-form ${shake ? 'shake' : ''}`} onSubmit={handleSubmit} noValidate>
        <h3 className="comment-title">💬 Need help? Leave a comment:</h3>
        <label htmlFor="comment" className="sr-only">Describe your issue</label>
        <textarea
          id="comment"
          name="comment"
          rows={8}
          className="comment-textarea"
          placeholder="Describe your issue and we'll help resolve it..."
          value={comment}
          onChange={handleInput}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby="counter"
          disabled={submitting}
        />
        {error && <div className="error" role="alert" aria-live="polite">{error}</div>}
        <div id="counter" className={`char-counter ${nearLimit ? 'warn' : ''}`} role="status" aria-live="polite">
          {charCount} / 500 characters
        </div>

        <button
          ref={submitBtnRef}
          type="submit"
          className="btn-primary"
          aria-label="Submit comment"
          disabled={submitting || !comment.trim()}
        >
          {submitting ? (
            <span className="btn-content"><span className="spinner" aria-hidden></span>Submitting...</span>
          ) : 'Submit Comment'}
        </button>

        {successMsg && (
          <div className="success-msg" role="status" aria-live="polite">{successMsg}</div>
        )}
      </form>

    </section>
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
    </>
  )
}
