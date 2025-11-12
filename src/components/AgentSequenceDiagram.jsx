import { useState, useEffect, useRef } from 'react';
import mermaid from 'mermaid';

const AGENT_COLORS = {
  triage: '#3b82f6',
  order: '#10b981',
  warehouse: '#f59e0b',
  payment: '#ef4444'
};

const FADE_IN_KEYFRAMES = `
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes shimmer {
  0% {
    background-position: -1000px 0;
  }
  100% {
    background-position: 1000px 0;
  }
}
`;

const AgentSequenceDiagram = ({ events = [], onClear }) => {
  const [participants, setParticipants] = useState(new Map());
  const [sequences, setSequences] = useState([]);
  const [mermaidSyntax, setMermaidSyntax] = useState('');
  const [isRendering, setIsRendering] = useState(false);
  const [error, setError] = useState(null);
  const [processedEvents, setProcessedEvents] = useState([]);
  const [expandedEvents, setExpandedEvents] = useState(new Set());
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const diagramRef = useRef(null);
  const containerRef = useRef(null);
  const renderTimeoutRef = useRef(null);
  const eventsListRef = useRef(null);

  const toggleEventExpanded = (eventId) => {
    setExpandedEvents(prev => {
      const newSet = new Set(prev);
      if (newSet.has(eventId)) {
        newSet.delete(eventId);
      } else {
        newSet.add(eventId);
      }
      return newSet;
    });
  };

  const processTaskMessage = (message) => {
    try {
      if (!message || message.kind !== 'task') {
        return null;
      }

      const agentId = message.metadata?.agentId || 'unknown_agent';
      const agentName = message.metadata?.agentName || agentId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

      const status = message.status?.state || 'unknown';
      const statusMessage = message.status?.message;
      const timestamp = message.status?.timestamp || new Date().toISOString();

      let messageText = '';
      let role = 'assistant';

      if (statusMessage?.parts) {
        const textParts = statusMessage.parts
          .filter(part => part.kind === 'text' && part.text)
          .map(part => part.text);
        messageText = textParts.join(' ').trim();
        role = statusMessage.role || 'assistant';
      }

      if (!messageText && message.history && message.history.length > 0) {
        const lastMessage = message.history[message.history.length - 1];
        if (lastMessage?.parts) {
          const textParts = lastMessage.parts
            .filter(part => part.kind === 'text' && part.text)
            .map(part => part.text);
          messageText = textParts.join(' ').trim();
          role = lastMessage.role || 'assistant';
        }
      }

      if (!messageText) {
        messageText = `Status: ${status}`;
      }

      return {
        agentId,
        agentName,
        messageText,
        status,
        role,
        timestamp
      };
    } catch (err) {
      console.error('Error processing task message:', err);
      return null;
    }
  };

  useEffect(() => {
    if (eventsListRef.current && processedEvents.length > 0) {
      eventsListRef.current.scrollTop = eventsListRef.current.scrollHeight;
    }
  }, [processedEvents]);

  useEffect(() => {
    if (events.length === 0) {
      setParticipants(new Map());
      setSequences([]);
      setMermaidSyntax('');
      setError(null);
      setProcessedEvents([]);
      if (diagramRef.current) {
        diagramRef.current.innerHTML = '';
      }
      if (renderTimeoutRef.current) {
        clearTimeout(renderTimeoutRef.current);
        renderTimeoutRef.current = null;
      }
      return;
    }

    const newParticipants = new Map();
    const newSequences = [];
    const newProcessedEvents = [];
    let previousAgent = null;

    newParticipants.set('User', 'User');

    events.forEach((event, index) => {
      const processed = processTaskMessage(event);
      if (!processed) return;

      const { agentId, agentName, messageText, status, role, timestamp } = processed;

      if (!newParticipants.has(agentId)) {
        newParticipants.set(agentId, agentName);
      }

      let from = 'User';
      let to = agentId;

      if (index === 0) {
        from = 'User';
        to = agentId;
      } else if (role === 'user' && previousAgent) {
        from = previousAgent;
        to = agentId;
      } else if (role === 'assistant') {
        from = agentId;
        to = previousAgent || 'User';
      } else {
        from = previousAgent || 'User';
        to = agentId;
      }

      const truncatedMessage = messageText.length > 80
        ? messageText.substring(0, 77) + '...'
        : messageText;

      const rolePrefix = role === 'user' ? '[user] ' : '';
      const formattedMessage = `${rolePrefix}[${status}] ${truncatedMessage}`;

      newSequences.push({
        from,
        to,
        message: formattedMessage,
        timestamp
      });

      newProcessedEvents.push({
        id: `event-${index}`,
        agentId,
        agentName,
        messageText,
        status,
        role,
        timestamp,
        from,
        to,
        rawEvent: event
      });

      previousAgent = agentId;
    });

    setParticipants(newParticipants);
    setSequences(newSequences);
    setProcessedEvents(newProcessedEvents);
  }, [events]);

  const getAgentColor = (agentId) => {
    const lowerAgentId = agentId.toLowerCase();
    for (const [key, color] of Object.entries(AGENT_COLORS)) {
      if (lowerAgentId.includes(key)) {
        return color;
      }
    }
    return '#6b7280';
  };

  const buildMermaidSyntax = () => {
    if (participants.size === 0 || sequences.length === 0) {
      return '';
    }

    const participantArray = Array.from(participants.entries());
    const isDark = document.documentElement.classList.contains('theme-dark');

    let syntax = '%%{init: {"theme": "base", "themeVariables": {';

    if (isDark) {
      syntax += '"primaryColor":"#1e293b",';
      syntax += '"primaryTextColor":"#e5e7eb",';
      syntax += '"primaryBorderColor":"#60a5fa",';
      syntax += '"lineColor":"#475569",';
      syntax += '"secondaryColor":"#0f172a",';
      syntax += '"tertiaryColor":"#1e293b",';
      syntax += '"noteBkgColor":"#1e293b",';
      syntax += '"noteTextColor":"#e5e7eb",';
      syntax += '"noteBorderColor":"#475569",';
      syntax += '"signalColor":"#e5e7eb",';
      syntax += '"signalTextColor":"#e5e7eb",';
      syntax += '"labelBoxBkgColor":"#1e293b",';
      syntax += '"labelBoxBorderColor":"#475569",';
      syntax += '"labelTextColor":"#e5e7eb",';
      syntax += '"loopTextColor":"#e5e7eb",';
      syntax += '"activationBorderColor":"#60a5fa",';
      syntax += '"activationBkgColor":"#1e3a5f",';
      syntax += '"sequenceNumberColor":"#e5e7eb",';
    } else {
      syntax += '"primaryColor":"#f0f9ff",';
      syntax += '"primaryTextColor":"#1e293b",';
      syntax += '"primaryBorderColor":"#3b82f6",';
      syntax += '"lineColor":"#94a3b8",';
      syntax += '"secondaryColor":"#e0f2fe",';
      syntax += '"tertiaryColor":"#dbeafe",';
      syntax += '"noteBkgColor":"#f0f9ff",';
      syntax += '"noteTextColor":"#1e293b",';
      syntax += '"noteBorderColor":"#94a3b8",';
      syntax += '"signalColor":"#1e293b",';
      syntax += '"signalTextColor":"#1e293b",';
      syntax += '"labelBoxBkgColor":"#f0f9ff",';
      syntax += '"labelBoxBorderColor":"#94a3b8",';
      syntax += '"labelTextColor":"#1e293b",';
      syntax += '"loopTextColor":"#1e293b",';
      syntax += '"activationBorderColor":"#3b82f6",';
      syntax += '"activationBkgColor":"#dbeafe",';
      syntax += '"sequenceNumberColor":"#1e293b",';
    }

    participantArray.forEach(([id], index) => {
      const color = getAgentColor(id);
      syntax += `"actor${index}":"${color}",`;
      syntax += `"actor${index}Border":"${color}",`;
      syntax += `"actor${index}LineColor":"${color}",`;
    });

    syntax = syntax.slice(0, -1);
    syntax += '}}}%%\n';
    syntax += 'sequenceDiagram\n';

    participants.forEach((name, id) => {
      syntax += `    participant ${id} as ${name}\n`;
    });

    syntax += '\n';

    sequences.forEach(seq => {
      const message = seq.message.replace(/"/g, '\\"');
      syntax += `    ${seq.from}->>${seq.to}: ${message}\n`;
    });

    return syntax;
  };

  useEffect(() => {
    const syntax = buildMermaidSyntax();
    setMermaidSyntax(syntax);
  }, [participants, sequences]);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      const syntax = buildMermaidSyntax();
      setMermaidSyntax(syntax);
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });

    return () => observer.disconnect();
  }, [participants, sequences]);

  const renderDiagram = async () => {
    if (!mermaidSyntax || !diagramRef.current) {
      return;
    }

    try {
      setIsRendering(true);
      setError(null);

      const id = `mermaid-${Date.now()}`;
      const { svg } = await mermaid.render(id, mermaidSyntax);

      if (diagramRef.current) {
        diagramRef.current.innerHTML = svg;
      }
    } catch (err) {
      console.error('Mermaid rendering error:', err, { syntax: mermaidSyntax });
      setError('Failed to render diagram');
    } finally {
      setIsRendering(false);
    }
  };

  const handleRetry = () => {
    setError(null);
    renderDiagram();
  };

  const handleZoomIn = () => {
    setScale(prev => Math.min(prev + 0.2, 3));
  };

  const handleZoomOut = () => {
    setScale(prev => Math.max(prev - 0.2, 0.5));
  };

  const handleResetZoom = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleMouseDown = (e) => {
    if (e.button === 0) {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y
      });
    }
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setScale(prev => Math.max(0.5, Math.min(3, prev + delta)));
    }
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragStart]);

  useEffect(() => {
    if (renderTimeoutRef.current) {
      clearTimeout(renderTimeoutRef.current);
    }

    if (mermaidSyntax) {
      renderTimeoutRef.current = setTimeout(() => {
        renderDiagram();
      }, 500);
    }

    return () => {
      if (renderTimeoutRef.current) {
        clearTimeout(renderTimeoutRef.current);
      }
    };
  }, [mermaidSyntax]);

  if (events.length === 0) {
    return null;
  }

  return (
    <>
      <style>{FADE_IN_KEYFRAMES}</style>
      <section className="agent-diagram-section">
        <div className="agent-diagram-header">
          <h2 className="agent-diagram-title">
            <span style={{ marginRight: '8px' }}>📊</span>
            Agent Sequence Diagram
          </h2>
          {onClear && (
            <button
              onClick={onClear}
              className="primary-btn"
              style={{ width: 'auto', padding: '8px 16px', fontSize: '14px' }}
            >
              Clear Diagram
            </button>
          )}
        </div>

        {error && (
          <div className="agent-diagram-error">
            <div className="agent-diagram-error-content">
              <div className="agent-diagram-error-message">
                <strong>Error:</strong> {error}
              </div>
              <button
                onClick={handleRetry}
                className="agent-diagram-retry-btn"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        <div className="agent-diagram-layout">
          <div className="agent-timeline-panel">
            <div className="agent-timeline-header">
              <h3 className="agent-timeline-title">
                <span style={{ marginRight: '6px' }}>📋</span>
                Event Timeline ({processedEvents.length})
              </h3>
            </div>
            <div ref={eventsListRef} className="agent-timeline-list">
              {processedEvents.map((event, index) => {
                const isExpanded = expandedEvents.has(event.id);
                return (
                  <div
                    key={event.id}
                    className="agent-timeline-event"
                    style={{
                      borderLeft: `4px solid ${getAgentColor(event.agentId)}`,
                      animation: 'fadeInUp 0.3s ease-out',
                      animationDelay: `${Math.min(index * 0.03, 0.5)}s`,
                      animationFillMode: 'both'
                    }}
                  >
                    <button
                      onClick={() => toggleEventExpanded(event.id)}
                      className="agent-timeline-event-btn"
                    >
                      <div className="agent-timeline-event-header">
                        <div className="agent-timeline-event-meta">
                          <span className="agent-timeline-event-number">#{index + 1}</span>
                          <span
                            className="agent-timeline-event-badge"
                            style={{ backgroundColor: getAgentColor(event.agentId) }}
                          >
                            {event.agentName}
                          </span>
                          <span className="agent-timeline-event-arrow" style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                            ▶
                          </span>
                        </div>
                        <span className="agent-timeline-event-time">
                          {new Date(event.timestamp).toLocaleTimeString('en-US', {
                            hour12: false,
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit'
                          })}
                        </span>
                      </div>
                      <div className="agent-timeline-event-message" style={{
                        WebkitLineClamp: isExpanded ? 'unset' : 4,
                      }}>
                        {event.messageText}
                      </div>
                    </button>
                    {isExpanded && (
                      <div className="agent-timeline-event-details">
                        <details className="agent-timeline-event-raw">
                          <summary className="agent-timeline-event-raw-summary">
                            Raw Event Data
                          </summary>
                          <pre className="agent-timeline-event-raw-data">
                            {JSON.stringify(event.rawEvent, null, 2)}
                          </pre>
                        </details>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="agent-diagram-panel">
            <div className="agent-diagram-panel-header">
              <h3 className="agent-diagram-panel-title">
                <span>🔄</span>
                Sequence Diagram
                {isRendering && (
                  <span className="agent-diagram-rendering">Rendering...</span>
                )}
              </h3>
              <div className="diagram-zoom-controls">
                <button
                  onClick={handleZoomOut}
                  className="zoom-btn"
                  title="Zoom Out"
                  disabled={scale <= 0.5}
                >
                  −
                </button>
                <span className="zoom-level">{Math.round(scale * 100)}%</span>
                <button
                  onClick={handleZoomIn}
                  className="zoom-btn"
                  title="Zoom In"
                  disabled={scale >= 3}
                >
                  +
                </button>
                <button
                  onClick={handleResetZoom}
                  className="zoom-btn reset-zoom-btn"
                  title="Reset Zoom"
                >
                  ⟲
                </button>
              </div>
            </div>
            <div
              ref={containerRef}
              className="agent-diagram-content"
              onWheel={handleWheel}
              onMouseDown={handleMouseDown}
              style={{
                cursor: isDragging ? 'grabbing' : 'grab',
                overflow: 'hidden'
              }}
            >
              {isRendering && (
                <div className="agent-diagram-loading">
                  <div className="agent-diagram-loading-inner">
                    <div className="agent-diagram-spinner"></div>
                    <p className="agent-diagram-loading-text">Rendering...</p>
                  </div>
                </div>
              )}
              <div
                ref={diagramRef}
                className="agent-diagram-svg"
                style={{
                  opacity: isRendering ? 0.3 : 1,
                  transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                  transformOrigin: 'top left',
                  transition: isDragging ? 'none' : 'transform 0.1s ease-out'
                }}
              >
                {/* Mermaid diagram will be rendered here */}
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

export default AgentSequenceDiagram;
