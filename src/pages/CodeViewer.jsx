import React, { useMemo, useState } from 'react'

// Very lightweight TypeScript syntax highlighter for demo purposes
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function highlightTS(code) {
  const src = code
  const tokens = []
  const re = /\/\*[\s\S]*?\*\/|\/\/[^\n]*|`(?:\\`|[\s\S])*?`|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g
  let last = 0
  let m
  while ((m = re.exec(src))) {
    if (m.index > last) tokens.push({ t: 'plain', v: src.slice(last, m.index) })
    const v = m[0]
    if (v.startsWith('/*') || v.startsWith('//')) tokens.push({ t: 'comment', v })
    else tokens.push({ t: 'str', v })
    last = re.lastIndex
  }
  if (last < src.length) tokens.push({ t: 'plain', v: src.slice(last) })

  const kw = ['abstract','any','as','asserts','async','await','bigint','boolean','break','case','catch','class','const','continue','declare','default','delete','do','else','enum','export','extends','false','finally','for','from','function','get','if','implements','import','in','infer','instanceof','interface','is','keyof','let','module','namespace','never','new','null','number','object','of','out','override','package','private','protected','public','readonly','require','return','satisfies','set','static','string','super','switch','symbol','this','throw','true','try','type','typeof','undefined','unique','unknown','using','var','void','while','with','yield']
  const kwRe = new RegExp('\\b(' + kw.join('|') + ')\\b', 'g')
  const typeRe = /\b(?:string|number|boolean|any|void|unknown|never|bigint|symbol|Record|Partial|Readonly|Required|Pick|Omit|Promise|Array|Map|Set|Date|Error)\b/g
  const numRe = /\b(?:0x[0-9a-fA-F]+|0b[01]+|0o[0-7]+|\d+(?:\.\d+)?(?:e[+-]?\d+)?)\b/g
  const fnRe = /\b([A-Za-z_\$][A-Za-z0-9_\$]*)\s*(?=\()/g

  function highlightPlain(txt) {
    // order: keywords/types/numbers/functions
    return escapeHtml(txt)
      .replace(kwRe, '<span class="tok-kw">$1</span>')
      .replace(typeRe, (m) => `<span class="tok-type">${m}</span>`) // eslint-disable-line no-shadow
      .replace(numRe, (m) => `<span class="tok-num">${m}</span>`)
      .replace(fnRe, '<span class="tok-fn">$1</span>')
  }

  let html = ''
  for (const tk of tokens) {
    if (tk.t === 'plain') html += highlightPlain(tk.v)
    else if (tk.t === 'str') html += `<span class="tok-str">${escapeHtml(tk.v)}</span>`
    else if (tk.t === 'comment') html += `<span class="tok-comment">${escapeHtml(tk.v)}</span>`
  }
  return html
}

// Load files from src/data via Vite's glob import as raw strings
// This eagerly pulls in .ts/.tsx files at build time for the demo viewer
const DATA_SNIPPETS = Object.entries(
  import.meta.glob('../data/**/*.{ts,tsx}', { as: 'raw', eager: true })
).map(([path, code]) => {
  // Create a human-friendly name like "data/driver-handler.ts"
  const pretty = path
    .replace(/^\.\/?/, '')
    .replace(/^src\//, '')
    .replace(/^pages\//, '')
    .replace(/^\.\.\//, '')
  return { name: pretty, code }
}).sort((a, b) => a.name.localeCompare(b.name))

const DEFAULT_SNIPPETS = [
  {
    name: 'Order types',
    code: `// Core order domain types\nexport type OrderId = string\n\nexport interface Address {\n  line1: string\n  line2?: string\n  city: string\n  state: string\n  postal: string\n  country: 'US' | 'CA' | 'MX'\n}\n\nexport interface Order {\n  id: OrderId\n  customerId: string\n  createdAt: Date\n  destination: Address\n  items: Array<{ sku: string; qty: number }>&\n    Readonly<{ perishable?: boolean }>;\n  status: 'NEW' | 'SHIPPED' | 'DELIVERED' | 'EXCEPTION'\n}`,
  },
  {
    name: 'Exception triage',
    code: `// Deterministic rule helper\nexport function triageException(input: {\n  perishable: boolean\n  vip: boolean\n  slaAtRisk: boolean\n}): 'ESCALATE' | 'EXPEDITE' | 'RETRY' {\n  if (input.perishable && input.slaAtRisk) return 'EXPEDITE'\n  if (input.vip && input.slaAtRisk) return 'ESCALATE'\n  return 'RETRY'\n}\n\n// Async action\nexport async function expediteShipment(orderId: string, speed: 'overnight'|'twoday'): Promise<void> {\n  await fetch('/api/ship', {\n    method: 'POST',\n    headers: { 'content-type': 'application/json' },\n    body: JSON.stringify({ orderId, speed })\n  })\n}`,
  },
  {
    name: 'Utility types',
    code: `type Nullable<T> = T | null\n\nexport type Result<T, E = Error> =\n  | { ok: true; value: T }\n  | { ok: false; error: E }\n\nexport function ok<T>(value: T): Result<T> { return { ok: true, value } }\nexport function err<E = Error>(error: E): Result<never, E> { return { ok: false, error } }`,
  },
]

export default function CodeViewer() {
  const [items] = useState(DATA_SNIPPETS.length ? DATA_SNIPPETS : DEFAULT_SNIPPETS)
  const [activeIndex, setActiveIndex] = useState(0)
  const [wrap, setWrap] = useState(true)
  const [fontSize, setFontSize] = useState(14)

  const active = useMemo(() => items[activeIndex] ?? items[0], [items, activeIndex])
  const html = useMemo(() => highlightTS(active.code), [active])

  const decFont = () => setFontSize((s) => Math.max(10, s - 1))
  const incFont = () => setFontSize((s) => Math.min(22, s + 1))

  return (
    <section className="card tracking-card diagram-card" aria-labelledby="code-title">
      <h1 id="code-title" className="card-title">TypeScript Viewer</h1>
      <div className="diagram-layout">
        <aside className="diagram-sidebar" aria-label="Snippet list">
          <ul className="diagram-list" role="listbox" aria-activedescendant={`code-opt-${activeIndex}`}>
            {items.map((d, i) => (
              <li key={d.name} id={`code-opt-${i}`} className={i === activeIndex ? 'diagram-item active' : 'diagram-item'}>
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
        <section className="diagram-main" aria-label="Code viewer">
          <div className="diagram-toolbar">
            <div className="diagram-title">{active.name}</div>
            <div className="diagram-actions">
              <button type="button" className="copy-btn" onClick={() => setWrap(w => !w)}>{wrap ? 'No Wrap' : 'Wrap'}</button>
              <button type="button" className="copy-btn" onClick={decFont}>A-</button>
              <button type="button" className="copy-btn" onClick={incFont}>A+</button>
              <button
                type="button"
                className="copy-btn"
                onClick={() => { try { navigator.clipboard?.writeText(active.code) } catch {} }}
              >Copy Source</button>
            </div>
          </div>
          <div className="diagram-view">
            <pre className={`code-view ${wrap ? 'wrap' : ''}`} style={{ fontSize: `${fontSize}px` }}>
              <code dangerouslySetInnerHTML={{ __html: html }} />
            </pre>
          </div>
        </section>
      </div>
    </section>
  )
}
