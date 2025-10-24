import React, { useEffect, useState } from 'react'
import DriverPortal from './pages/DriverPortal.jsx'
import CustomerPortal from './pages/CustomerPortal.jsx'
import Diagrams from './pages/Diagrams.jsx'
import CodeViewer from './pages/CodeViewer.jsx'

// Tiny hash-based router (no dependencies)
function useHashRoute() {
  const [route, setRoute] = useState(() => window.location.hash.replace('#', '') || '/driver')
  useEffect(() => {
    const onHash = () => setRoute(window.location.hash.replace('#', '') || '/driver')
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  return [route, (r) => { window.location.hash = r }]
}

export default function App() {
  const [route, navigate] = useHashRoute()
  const isDriver = route === '/driver'
  const isCustomer = route === '/customer'
  const isDiagrams = route === '/diagrams'
  const isCode = route === '/code'

  const [isDark, setIsDark] = useState(false)
  useEffect(() => {
    const hasDark = document.documentElement.classList.contains('theme-dark')
    setIsDark(hasDark)
  }, [])

  const toggleTheme = () => {
    const next = !isDark
    setIsDark(next)
    const root = document.documentElement
    if (next) {
      root.classList.add('theme-dark')
      try { localStorage.setItem('theme', 'dark') } catch {}
    } else {
      root.classList.remove('theme-dark')
      try { localStorage.setItem('theme', 'light') } catch {}
    }
  }

  return (
    <div className="app-root">
      <header className="topbar" role="banner">
        <div className="topbar-left">
          <span className="logo" aria-hidden>🚚</span>
          <span className="brand">SwiftShip Logistics</span>
        </div>
        <nav className="topnav" aria-label="Primary">
          <a
            href="#/driver"
            className={isDriver ? 'navlink active' : 'navlink'}
            onClick={(e) => { e.preventDefault(); navigate('/driver') }}
          >Driver</a>
          <a
            href="#/customer"
            className={isCustomer ? 'navlink active' : 'navlink'}
            onClick={(e) => { e.preventDefault(); navigate('/customer') }}
          >Customer</a>
          <a
            href="#/diagrams"
            className={isDiagrams ? 'navlink active' : 'navlink'}
            onClick={(e) => { e.preventDefault(); navigate('/diagrams') }}
          >Diagrams</a>
          <a
            href="#/code"
            className={isCode ? 'navlink active' : 'navlink'}
            onClick={(e) => { e.preventDefault(); navigate('/code') }}
          >Code</a>
          <button
            className="theme-toggle"
            onClick={toggleTheme}
            aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
            title={isDark ? 'Light theme' : 'Dark theme'}
          >
            <span aria-hidden>{isDark ? '☀️' : '🌙'}</span>
          </button>
        </nav>
        {isDriver && (
          <div className="driver-badge" aria-label="Driver badge">Driver: Dave M. - Route 847</div>
        )}
      </header>

      <main className={(isDiagrams || isCode) ? 'page page-diagrams' : 'page'} role="main">
        {isDriver && <DriverPortal />}
        {isCustomer && <CustomerPortal />}
        {isDiagrams && <Diagrams />}
        {isCode && <CodeViewer />}
      </main>

      <footer className="footer" role="contentinfo">
        {isDriver
          ? 'SwiftShip Logistics Driver Portal v2.1'
          : isCustomer
            ? 'SwiftShip © 2025 - Customer Support'
            : 'SwiftShip • Mermaid Diagrams Demo'}
      </footer>
    </div>
  )
}
