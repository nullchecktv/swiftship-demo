import React, { useEffect, useMemo, useRef, useState } from 'react'

const DEFAULT_DIAGRAMS = [
  {
    name: 'Production system',
    code: `graph LR
    %% --- Human Interaction ---
    subgraph "Human Inputs"
        DriverUI[🚚 Driver Portal]
        CustomerUI[📦 Customer Portal]
    end

    %% --- API and Validation ---
    subgraph "API Layer"
        API[REST API Gateway<br/>🧾 Input Validation + Auth]
    end

    %% --- Deterministic Service Logic ---
    subgraph "Service Layer"
        BusinessLogic[Business Logic Service<br/>Order Exception Handler<br/>🧠 Deterministic Rules]
    end

    %% --- Event System (Async Boundary) ---
    subgraph "Event Processing"
        Queue[Event Queue<br/>SQS / Kafka]
        EventRouter["Event Router<br/>(Classify & Route Exceptions)"]
    end

    %% --- Probabilistic Agent Runtime ---
    subgraph "AI Agent Runtime"
        Agent[Triage Agent<br/>Claude Sonnet 4.5]
        Guardrails[Guardrail System<br/>Input Validation + Output Shaping<br/>🔒 Topic Policy / PII Filter]
        Tools[Tool Executor<br/>Shipping APIs / Notifications]
    end

    %% --- Data & Observability ---
    subgraph "Data & State"
        DB[(Database<br/>Order / Customer Data)]
        AuditLog[(Audit Log<br/>Decision Trail)]
    end

    %% --- Flow Connections ---
    DriverUI -->|POST /exceptions| API
    CustomerUI -->|POST /comments| API
    API -->|Validated Request| BusinessLogic
    BusinessLogic -->|Publish Event| Queue
    Queue -->|Consume| EventRouter
    EventRouter -->|Trigger with Context| Agent
    Agent <-->|Check Policies| Guardrails
    Guardrails -->|Validated Input| Agent
    Agent <-->|Query / Act| Tools
    Tools <-->|CRUD Ops| DB
    Agent -->|Log Decision| AuditLog
    Agent -->|Execute Action| Tools
    Tools -->|Update Status| DB
    AuditLog -->|Feedback & Retraining Signals| EventRouter

    %% --- Styling & Highlights ---
    style API fill:#fef3c7,stroke:#f59e0b,color:#000
    style BusinessLogic fill:#d1fae5,stroke:#059669,color:#000
    style Queue fill:#fcd34d,stroke:#b45309,color:#000
    style Agent fill:#2563eb,stroke:#1e40af,color:#fff
    style Guardrails fill:#dc2626,stroke:#7f1d1d,color:#fff
    style Tools fill:#93c5fd,stroke:#1e3a8a,color:#000
    style DB fill:#e5e7eb,stroke:#6b7280,color:#000
    style AuditLog fill:#f3f4f6,stroke:#6b7280,color:#000

    %% --- Deterministic / Probabilistic Boundary ---
    classDef boundary stroke-dasharray:5 5,stroke:#6b7280;
    BusinessLogic:::boundary
    Queue:::boundary
    %% Label
    BusinessLogic -. "Async Event Boundary<br/>(Deterministic → Probabilistic)" .-> Agent
`,
  },
  {
    name: 'Driver Workflow',
    code: `sequenceDiagram
    participant Driver as 🚚 Driver Portal
    participant API as API Gateway
    participant Queue as Event Queue
    participant Guard as Guardrails Layer
    participant Agent as Triage Agent<br/>(Claude Sonnet 4.5)
    participant Tools as Shipping Tools
    participant DB as Database
    participant Audit as Audit Log

    %% --- Human initiates ---
    Driver->>API: POST /exception<br/>{orderId: "B456", notes: "box warm..."}

    Note right of API: 🧾 Schema Validation<br/>- UUID format<br/>- Required fields<br/>- Auth check

    API->>API: Validate Schema<br/>(Reject malformed or incomplete requests)
    API->>Queue: Enqueue Event<br/>type: DELIVERY_EXCEPTION

    Note right of API: Async Boundary → Event-Driven Handoff

    %% --- Event-driven world ---
    Queue->>Guard: Trigger Agent<br/>with Exception Context

    Note right of Guard: 🔒 Semantic Guardrails<br/>- Topic Policy ✓<br/>- Content Filter ✓<br/>- PII Scan ✓

    Guard->>Agent: Validated Input<br/>"ORDER B456 EXCEPTION..."

    %% --- Context gathering ---
    Agent->>Tools: getPackageContents(B456)
    Tools->>DB: Query package data
    DB-->>Tools: {perishable: true, temp_control: "refrigerated"}
    Tools-->>Agent: Package is perishable

    Agent->>Tools: getCustomerTier(B456)
    Tools->>DB: Query customer data
    DB-->>Tools: {tier: "VIP", lifetime_value: 8450}
    Tools-->>Agent: Customer is VIP

    Agent->>Tools: getSLA(B456)
    Tools->>DB: Query SLA promise
    DB-->>Tools: {delivery_by: "2025-10-23", penalty: 500}
    Tools-->>Agent: SLA at risk

    Note right of Agent: 🤖 Decision Framework<br/>(Perishable ∧ VIP ∧ SLA Risk) = EXPEDITE

    Agent->>Tools: expediteShipment(B456, "overnight")
    Tools->>DB: Update order status
    Tools->>DB: Create shipping label
    Tools->>DB: Log audit trail
    Tools-->>Agent: ✓ Expedited

    Agent->>Audit: Emit event<br/>"expedited_order"
    Agent->>DB: Log Decision<br/>"Expedited B456 due to cold chain failure"

    Note over Agent,DB: Total processing time: 3–5 seconds
`,
  },
  {
    name: 'Customer Workflow',
    code: `sequenceDiagram
    participant Customer as 📦 Customer Portal
    participant API as API Gateway
    participant Service as Business Logic Service<br/>(Comment Processor)
    participant Queue as Event Queue
    participant Guard as Guardrails Layer
    participant Agent as Triage Agent<br/>(Claude Sonnet 4.5)
    participant Tools as Shipping Tools
    participant Human as 👤 Manager Queue
    participant DB as Database
    participant Audit as Audit Log

    %% --- Human initiates ---
    Customer->>API: POST /comment<br/>{orderId: "C789", comment: "THIRD TIME..."}

    Note right of API: 🧾 Schema Validation<br/>- Required fields<br/>- Order ID format

    API->>Service: Forward Request<br/>for enrichment + pre-processing

    %% --- Deterministic preprocessing ---
    Note right of Service: 🧠 Business Logic Layer<br/>- Sentiment Analysis (Comprehend / heuristic)<br/>- PII / profanity screening<br/>- Priority assignment

    Service->>Service: Determine Sentiment → HIGH_FRUSTRATION
    Service->>Service: Enrich Event Payload<br/>{ sentiment, pii_status, profanity, priority }

    Service->>Queue: Publish Event<br/>type: CUSTOMER_COMPLAINT<br/>priority: HIGH<br/>sentiment: HIGH_FRUSTRATION

    Note right of Service: Async Boundary → Event-Driven Handoff

    %% --- Event-driven world ---
    Queue->>Guard: Trigger Agent<br/>with Enriched Comment Context

    Note right of Guard: 🔒 Semantic Guardrails<br/>- Deep content policy<br/>- PII Anonymization ✓<br/>- Topic Policy ✓<br/>- Injection Detection ✓

    Guard->>Agent: Sanitized Input<br/>(Policy-compliant, redacted text)

    %% --- Context gathering ---
    Agent->>Tools: getCarrierStatus(C789)
    Tools->>DB: Query delivery history
    DB-->>Tools: {attempts: 3, last_exception: "customer_not_home"}
    Tools-->>Agent: 3 failed delivery attempts

    Agent->>Tools: getCustomerTier(C789)
    Tools->>DB: Query customer data
    DB-->>Tools: {tier: "VIP_PLATINUM", satisfaction: "at_risk"}
    Tools-->>Agent: VIP Platinum, satisfaction at risk

    Agent->>Tools: getSLA(C789)
    Tools->>DB: Query delivery promise
    DB-->>Tools: {promised: "tomorrow", event: "birthday"}
    Tools-->>Agent: Time-sensitive event

    Note right of Agent: 🤖 Decision Framework<br/>(3 Failures ∧ VIP ∧ High Emotion) = ESCALATE_TO_HUMAN

    %% --- Escalation path ---
    Agent->>Tools: escalateToManager(C789, urgency="high")
    Tools->>Human: Create Manager Ticket<br/>Context: VIP, 3 failures, emotional tone
    Tools->>DB: Log escalation
    Tools-->>Agent: ✓ Escalated

    Agent->>Audit: Emit event<br/>"escalated_to_manager"
    Agent->>DB: Log Decision<br/>"Escalated C789 - requires human judgment"

    Note over Agent,Human: Manager notified within ~30 seconds
`,
  }
]

export default function Diagrams() {
  const [items] = useState(DEFAULT_DIAGRAMS)
  const [activeIndex, setActiveIndex] = useState(0)
  const containerRef = useRef(null)
  const svgRef = useRef(null)
  const baseWidthRef = useRef(0)
  const zoomRef = useRef(1)
  const [status, setStatus] = useState('')

  const active = useMemo(() => items[activeIndex] ?? items[0], [items, activeIndex])

  useEffect(() => {
    let cancelled = false
    async function render() {
      const el = containerRef.current
      if (!el) return
      el.innerHTML = ''
      setStatus('')
      const m = window.mermaid
      if (!m || typeof m.render !== 'function') {
        setStatus('Mermaid not loaded. Ensure the CDN script is included in index.html.')
        const pre = document.createElement('pre')
        pre.textContent = active.code
        el.appendChild(pre)
        return
      }
      try {
        const id = `mmd-${activeIndex}-${Date.now()}`
        const out = await m.render(id, active.code)
        if (cancelled) return
        el.innerHTML = out.svg
        out.bindFunctions?.(el)

        // Setup zoomable, pannable SVG
        const svg = el.querySelector('svg')
        if (svg) {
          svgRef.current = svg
          // Make SVG layout flexible and allow container scrolling
          svg.style.maxWidth = 'none'
          svg.style.height = 'auto'
          svg.style.display = 'block'

          // Measure base width in pixels for zoom calculations
          const rect = svg.getBoundingClientRect()
          baseWidthRef.current = rect.width || (svg.viewBox?.baseVal?.width ?? 1000)
          // Initialize scale to fit container width
          const containerWidth = el.clientWidth || baseWidthRef.current
          const initialZoom = containerWidth / baseWidthRef.current
          zoomRef.current = initialZoom
          svg.style.width = `${Math.max(1, Math.round(baseWidthRef.current * initialZoom))}px`

          // Enable Ctrl + wheel zoom and click-drag panning (scrolling)
          const onWheel = (e) => {
            if (!e.ctrlKey && !e.metaKey) return
            e.preventDefault()
            const factor = e.deltaY < 0 ? 1.1 : 0.9
            const oldZoom = zoomRef.current
            const newZoom = Math.min(4, Math.max(0.25, oldZoom * factor))
            if (newZoom === oldZoom) return

            const prevW = svg.getBoundingClientRect().width || 1
            const prevH = svg.getBoundingClientRect().height || 1
            const rectEl = el.getBoundingClientRect()
            const pointerX = e.clientX - rectEl.left
            const pointerY = e.clientY - rectEl.top
            const ratioX = (el.scrollLeft + pointerX) / prevW
            const ratioY = (el.scrollTop + pointerY) / prevH

            zoomRef.current = newZoom
            const nextW = Math.max(1, Math.round(baseWidthRef.current * newZoom))
            svg.style.width = `${nextW}px`
            // After width change, compute new height via layout
            // Adjust scroll to keep pointer position stable
            const nextRect = svg.getBoundingClientRect()
            const nextWpx = nextRect.width || nextW
            const nextHpx = nextRect.height || prevH * (newZoom / oldZoom)
            el.scrollLeft = Math.max(0, ratioX * nextWpx - pointerX)
            el.scrollTop = Math.max(0, ratioY * nextHpx - pointerY)
          }

          let isPanning = false
          let lastX = 0, lastY = 0
          const onMouseDown = (e) => {
            if (e.button !== 0) return
            isPanning = true
            lastX = e.clientX
            lastY = e.clientY
            el.style.cursor = 'grabbing'
            e.preventDefault()
          }
          const onMouseMove = (e) => {
            if (!isPanning) return
            const dx = e.clientX - lastX
            const dy = e.clientY - lastY
            lastX = e.clientX
            lastY = e.clientY
            el.scrollLeft -= dx
            el.scrollTop -= dy
            e.preventDefault()
          }
          const onMouseUp = () => {
            isPanning = false
            el.style.cursor = ''
            el.style.userSelect = ''
          }
          const onMouseLeave = onMouseUp

          el.addEventListener('wheel', onWheel, { passive: false })
          el.addEventListener('mousedown', (e) => {
            onMouseDown(e)
            // While panning, avoid selecting text/content
            el.style.userSelect = 'none'
          })
          window.addEventListener('mousemove', onMouseMove)
          window.addEventListener('mouseup', onMouseUp)
          el.addEventListener('mouseleave', onMouseLeave)

          // Cleanup listeners on re-render/unmount
          const cleanupZoom = () => {
            el.removeEventListener('wheel', onWheel)
            el.removeEventListener('mousedown', onMouseDown)
            window.removeEventListener('mousemove', onMouseMove)
            window.removeEventListener('mouseup', onMouseUp)
            el.removeEventListener('mouseleave', onMouseLeave)
          }
          // Attach to element for later disposal if effect re-runs early
          el._cleanupZoom?.()
          el._cleanupZoom = cleanupZoom
        }
      } catch (err) {
        setStatus('Failed to render diagram. Showing source.')
        const pre = document.createElement('pre')
        pre.textContent = active.code
        el.appendChild(pre)
      }
    }
    render()
    return () => {
      cancelled = true
      const el = containerRef.current
      if (el && el._cleanupZoom) {
        el._cleanupZoom()
        delete el._cleanupZoom
      }
    }
  }, [activeIndex, active])

  function zoomIn() {
    const el = containerRef.current
    const svg = svgRef.current
    if (!el || !svg) return
    const factor = 1.2
    const newZoom = Math.min(4, zoomRef.current * factor)
    const oldZoom = zoomRef.current
    if (newZoom === oldZoom) return
    const rectEl = el.getBoundingClientRect()
    const centerX = rectEl.width / 2
    const centerY = rectEl.height / 2
    // simulate centered zoom
    const evt = { ctrlKey: true, metaKey: true, deltaY: -1, clientX: rectEl.left + centerX, clientY: rectEl.top + centerY, preventDefault(){} }
    // Reuse wheel logic via dispatching manually isn't straightforward here; replicate core
    const prevW = svg.getBoundingClientRect().width || 1
    const prevH = svg.getBoundingClientRect().height || 1
    const ratioX = (el.scrollLeft + centerX) / prevW
    const ratioY = (el.scrollTop + centerY) / prevH
    zoomRef.current = newZoom
    const nextW = Math.max(1, Math.round(baseWidthRef.current * newZoom))
    svg.style.width = `${nextW}px`
    const nextRect = svg.getBoundingClientRect()
    const nextWpx = nextRect.width || nextW
    const nextHpx = nextRect.height || prevH * (newZoom / oldZoom)
    el.scrollLeft = Math.max(0, ratioX * nextWpx - centerX)
    el.scrollTop = Math.max(0, ratioY * nextHpx - centerY)
  }

  function zoomOut() {
    const el = containerRef.current
    const svg = svgRef.current
    if (!el || !svg) return
    const factor = 1/1.2
    const newZoom = Math.max(0.25, zoomRef.current * factor)
    const oldZoom = zoomRef.current
    if (newZoom === oldZoom) return
    const rectEl = el.getBoundingClientRect()
    const centerX = rectEl.width / 2
    const centerY = rectEl.height / 2
    const prevW = svg.getBoundingClientRect().width || 1
    const prevH = svg.getBoundingClientRect().height || 1
    const ratioX = (el.scrollLeft + centerX) / prevW
    const ratioY = (el.scrollTop + centerY) / prevH
    zoomRef.current = newZoom
    const nextW = Math.max(1, Math.round(baseWidthRef.current * newZoom))
    svg.style.width = `${nextW}px`
    const nextRect = svg.getBoundingClientRect()
    const nextWpx = nextRect.width || nextW
    const nextHpx = nextRect.height || prevH * (newZoom / oldZoom)
    el.scrollLeft = Math.max(0, ratioX * nextWpx - centerX)
    el.scrollTop = Math.max(0, ratioY * nextHpx - centerY)
  }

  function fitToWidth() {
    const el = containerRef.current
    const svg = svgRef.current
    if (!el || !svg) return
    const containerWidth = el.clientWidth || baseWidthRef.current
    const newZoom = Math.max(0.1, Math.min(4, containerWidth / (baseWidthRef.current || containerWidth)))
    zoomRef.current = newZoom
    const nextW = Math.max(1, Math.round((baseWidthRef.current || containerWidth) * newZoom))
    svg.style.width = `${nextW}px`
    el.scrollLeft = 0
    el.scrollTop = 0
  }

  return (
    <section className="card tracking-card diagram-card" aria-labelledby="diagrams-title">
      <h1 id="diagrams-title" className="card-title">Mermaid Diagrams</h1>
      <div className="diagram-layout">
        <aside className="diagram-sidebar" aria-label="Diagram list">
          <ul className="diagram-list" role="listbox" aria-activedescendant={`diagram-opt-${activeIndex}`}>
            {items.map((d, i) => (
              <li key={d.name} id={`diagram-opt-${i}`} className={i === activeIndex ? 'diagram-item active' : 'diagram-item'}>
                <button
                  type="button"
                  className="diagram-btn"
                  aria-selected={i === activeIndex}
                  onClick={() => setActiveIndex(i)}
                >
                  {d.name}
                </button>
              </li>
            ))}
          </ul>
        </aside>
        <section className="diagram-main" aria-label="Diagram viewer">
          <div className="diagram-toolbar">
            <div className="diagram-title">{active.name}</div>
            <div className="diagram-actions">
              <button type="button" className="copy-btn" onClick={zoomOut}>-</button>
              <button type="button" className="copy-btn" onClick={zoomIn}>+</button>
              <button type="button" className="copy-btn" onClick={fitToWidth}>Fit</button>
              <button
                type="button"
                className="copy-btn"
                onClick={() => {
                  try {
                    navigator.clipboard?.writeText(active.code)
                  } catch {}
                }}
              >Copy Source</button>
              <button
                type="button"
                className="copy-btn"
                onClick={() => {
                  try { window.mermaid?.initialize?.({ startOnLoad: false }) } catch {}
                }}
              >Re-init Mermaid</button>
            </div>
          </div>
          {status && <div className="help" role="status" aria-live="polite">{status}</div>}
          <div ref={containerRef} className="diagram-view" />
        </section>
      </div>
    </section>
  )
}
