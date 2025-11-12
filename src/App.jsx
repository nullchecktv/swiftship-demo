import React, { useEffect, useState } from 'react'
import DriverPortal from './pages/DriverPortal.jsx'
import CustomerPortal from './pages/CustomerPortal.jsx'
import Diagrams from './pages/Diagrams.jsx'
import { demoResetService } from './services/demoResetService.js'

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

  const [isDark, setIsDark] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [notification, setNotification] = useState(null)

  useEffect(() => {
    const hasDark = document.documentElement.classList.contains('theme-dark')
    setIsDark(hasDark)
  }, [])

  const showNotification = (message, type = 'info') => {
    setNotification({ message, type })
    setTimeout(() => setNotification(null), 5000)
  }

  const handleLogoClick = async () => {
    if (isResetting) return

    const confirmed = window.confirm(
      'This will reset all demo data to the default scenario. Are you sure you want to continue?'
    )

    if (!confirmed) return

    setIsResetting(true)

    try {
      const result = await demoResetService.resetDemo('full')

      if (result.success) {
        showNotification(
          `Demo data reset successfully! Created ${result.data.dataCreated?.customers || 0} customers, ${result.data.dataCreated?.orders || 0} orders.`,
          'success'
        )

        // Refresh the page after a short delay to show the new data
        setTimeout(() => {
          window.location.reload()
        }, 2000)
      } else {
        showNotification('Demo reset completed with warnings. Please check the console for details.', 'warning')
      }
    } catch (error) {
      console.error('Demo reset failed:', error)
      showNotification(
        error.message || 'Failed to reset demo data. Please try again.',
        'error'
      )
    } finally {
      setIsResetting(false)
    }
  }

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
          <span
            className={`logo ${isResetting ? 'resetting' : 'clickable'}`}
            aria-hidden
            onClick={handleLogoClick}
            title={isResetting ? 'Resetting demo data...' : 'Click to reset demo data'}
            style={{
              cursor: isResetting ? 'wait' : 'pointer',
              opacity: isResetting ? 0.6 : 1,
              transform: isResetting ? 'scale(0.9)' : 'scale(1)',
              transition: 'all 0.2s ease'
            }}
          >
            {isResetting ? '⏳' : '🚚'}
          </span>
          <span className="brand">SwiftShip Logistics</span>
          {isResetting && (
            <span className="reset-status" style={{
              marginLeft: '10px',
              fontSize: '0.9em',
              color: '#666',
              fontStyle: 'italic'
            }}>
              Resetting demo data...
            </span>
          )}
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

      <main className={isDiagrams ? 'page page-diagrams' : 'page'} role="main">
        {isDriver && <DriverPortal />}
        {isCustomer && <CustomerPortal />}
        {isDiagrams && <Diagrams />}
      </main>

      <footer className="footer" role="contentinfo">
        {isDriver
          ? 'SwiftShip Logistics Driver Portal v2.1'
          : isCustomer
            ? 'SwiftShip © 2025 - Customer Support'
            : 'SwiftShip • Diagrams Demo'}
      </footer>

      {notification && (
        <div
          className={`notification notification-${notification.type}`}
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '12px 20px',
            borderRadius: '6px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: 1000,
            maxWidth: '400px',
            fontSize: '14px',
            fontWeight: '500',
            backgroundColor: notification.type === 'success' ? '#10b981' :
                           notification.type === 'error' ? '#ef4444' :
                           notification.type === 'warning' ? '#f59e0b' : '#3b82f6',
            color: 'white',
            animation: 'slideIn 0.3s ease-out'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>
              {notification.type === 'success' ? '✅' :
               notification.type === 'error' ? '❌' :
               notification.type === 'warning' ? '⚠️' : 'ℹ️'}
            </span>
            <span>{notification.message}</span>
            <button
              onClick={() => setNotification(null)}
              style={{
                background: 'none',
                border: 'none',
                color: 'white',
                cursor: 'pointer',
                fontSize: '16px',
                marginLeft: 'auto',
                padding: '0 4px'
              }}
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
