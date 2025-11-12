import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './styles.css'
import mermaid from 'mermaid'

mermaid.initialize({
  startOnLoad: false,
  theme: 'base',
  themeVariables: {
    primaryColor: '#3b82f6',
    primaryTextColor: '#1e293b',
    primaryBorderColor: '#2563eb',
    lineColor: '#64748b',
    secondaryColor: '#8b5cf6',
    tertiaryColor: '#10b981',
    background: '#ffffff',
    mainBkg: '#f1f5f9',
    secondBkg: '#e0e7ff',
    tertiaryBkg: '#d1fae5',
    actorBorder: '#2563eb',
    actorBkg: '#dbeafe',
    actorTextColor: '#1e40af',
    actorLineColor: '#3b82f6',
    signalColor: '#1e293b',
    signalTextColor: '#1e293b',
    labelBoxBkgColor: '#f1f5f9',
    labelBoxBorderColor: '#94a3b8',
    labelTextColor: '#0f172a',
    loopTextColor: '#1e293b',
    noteBorderColor: '#a78bfa',
    noteBkgColor: '#ede9fe',
    noteTextColor: '#5b21b6',
    activationBorderColor: '#2563eb',
    activationBkgColor: '#dbeafe',
    sequenceNumberColor: '#ffffff'
  },
  sequence: {
    diagramMarginX: 20,
    diagramMarginY: 20,
    actorMargin: 80,
    width: 180,
    height: 65,
    boxMargin: 10,
    boxTextMargin: 5,
    noteMargin: 10,
    messageMargin: 40,
    mirrorActors: true,
    useMaxWidth: true,
    rightAngles: false,
    showSequenceNumbers: false
  }
})

const container = document.getElementById('root')
const root = createRoot(container)
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

