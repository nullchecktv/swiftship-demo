# SwiftShip Logistics Demo

A small Vite + React demo that showcases two simple portals (Driver and Customer), interactive Mermaid diagrams, and a lightweight code viewer for TypeScript snippets. It’s frontend‑only and intended for demos and discussion.

## Features
- Hash router with four views: `#/driver`, `#/customer`, `#/diagrams`, `#/code`
- Dark/light theme toggle with persisted preference
- Driver Exception form that generates a “prompt” preview (with copy‑to‑clipboard)
- Customer tracking view with timeline, comment form, and generated prompt overlay
- Mermaid diagrams (from CDN) with a simple, zoom‑friendly viewer
- TypeScript code viewer powered by Vite’s `import.meta.glob(..., { as: 'raw', eager: true })`
- Accessibility touches (ARIA landmarks/labels, focus handling, live regions)

## Quick Start
- Prereqs: Node.js 18+ and npm
- Install: `npm install`
- Dev: `npm run dev` then open the printed local URL
- Build: `npm run build`
- Preview build: `npm run preview`

## Scripts
- `npm run dev` – Start Vite dev server
- `npm run build` – Production build
- `npm run preview` – Preview the build locally

## Routes
- `#/driver` – Driver Exception Reporting portal
- `#/customer` – Customer Order Tracking portal
- `#/diagrams` – Architecture and workflow diagrams (Mermaid)
- `#/code` – Code viewer for TypeScript snippets in `src/data`

## Mermaid Diagrams
- Mermaid is loaded via CDN in `index.html` and initialized with `securityLevel: 'loose'` for convenience. If you are offline, the diagrams fallback to showing the source text.
- To add or edit diagrams, modify the entries in `src/pages/Diagrams.jsx` (look for `DEFAULT_DIAGRAMS`). Each item has a `name` and `code` (Mermaid syntax).

## Code Viewer (TypeScript)
- The viewer pulls `.ts`/`.tsx` files from `src/data/**` at build time using Vite’s glob import.
- Add new snippets by creating files under `src/data` (e.g., `src/data/new-tool.ts`). They will appear automatically in the `#/code` view.

## Serverless Handlers (Reference Only)
- Files under `src/data/driver-handler.ts` and `src/data/customer-handler.ts` illustrate patterns for:
  - Bedrock Guardrails (input validation/safety)
  - Simple deterministic short‑circuit business logic
  - Agent invocation with Bedrock `Converse`
  - DynamoDB audit logging
- These files are not executed by the frontend; they are for reading/demo only. If you choose to deploy them, provision AWS resources and set env vars such as:
  - `MODEL_ID`, `GUARDRAIL_ID`, `GUARDRAIL_VERSION`
  - `ORDERS_TABLE`, `AUDIT_LOG_TABLE`, `AWS_REGION`

## Project Structure
- `index.html` – Root HTML, theme bootstrapping, Mermaid CDN
- `src/main.jsx` – React entry
- `src/App.jsx` – Simple hash router and layout
- `src/pages/DriverPortal.jsx` – Driver exception form + prompt overlay
- `src/pages/CustomerPortal.jsx` – Tracking timeline + comment form + prompt overlay
- `src/pages/Diagrams.jsx` – Mermaid diagrams and viewer
- `src/pages/CodeViewer.jsx` – TS code viewer using glob import
- `src/data/*.ts` – Example serverless code and domain snippets displayed in the viewer
- `src/styles.css` – App styles

## Notes & Tips
- Clipboard: Some actions use the browser Clipboard API with a fallback; your browser may prompt for permission.
- Node version: Vite 5 requires Node 18+. If startup fails, check your Node version.
- Offline use: Without the Mermaid CDN, diagrams show raw text; reconnect or vendor the library locally if needed.

## License
This repository is provided for demonstration purposes. No license is specified.

