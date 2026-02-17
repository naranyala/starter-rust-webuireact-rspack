import React from 'react';
import { getEnhancedWebSocket } from '../utils/enhanced-websocket';
import { useError } from '../utils/ErrorProvider';

interface StatusBarProps {
  wsConnected: boolean;
  wsStatus: string;
  wsMetrics: {
    messagesSent: number;
    messagesReceived: number;
    errors: number;
    reconnectAttempts: number;
  };
  errors: Array<{ id: string; message: string; type: string; timestamp: Date; source: string }>;
  showErrorPanel: boolean;
  setShowErrorPanel: (show: boolean) => void;
  hideAllWindows: () => void;
  closeAllWindows: () => void;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  wsConnected,
  wsStatus,
  wsMetrics,
  errors,
  showErrorPanel,
  setShowErrorPanel,
  hideAllWindows,
  closeAllWindows,
}) => {
  const { clearErrors, addError } = useError();
  const [statusBarExpanded, setStatusBarExpanded] = React.useState(false);

  const handleDebugState = () => {
    const enhancedWs = getEnhancedWebSocket();
    if (enhancedWs) {
      const state = enhancedWs.getCurrentState();
      console.log('WebSocket State:', JSON.stringify(state, null, 2));
      alert('State logged to console');
    }
  };

  const handleTestError = () => {
    addError('Test error from status panel', 'error');
  };

  const handleTestWarning = () => {
    addError('Test warning from status panel', 'warning');
  };

  return (
    <div
      className={`status-bar ${statusBarExpanded ? 'expanded' : 'collapsed'}`}
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 10000,
        background: 'linear-gradient(90deg, #1e293b 0%, #0f172a 100%)',
        borderTop: '1px solid #334155',
        transition: 'height 0.3s ease',
        overflow: 'hidden',
      }}
    >
      {/* Collapsed Bar */}
      <div
        style={{
          height: '28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: wsConnected ? '#10b981' : '#ef4444',
              boxShadow: wsConnected ? '0 0 6px #10b981' : '0 0 6px #ef4444',
            }}
          />
          <span style={{ color: 'white', fontSize: '11px' }}>
            {wsConnected ? 'Connected' : 'Disconnected'}
            {wsConnected && wsStatus !== 'unknown' && ` (${wsStatus})`}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            onClick={() => setStatusBarExpanded(!statusBarExpanded)}
            style={{
              background: 'rgba(79, 70, 229, 0.8)',
              color: 'white',
              border: 'none',
              padding: '2px 8px',
              borderRadius: '3px',
              cursor: 'pointer',
              fontSize: '10px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            {statusBarExpanded ? '▼' : '▲'} Status
          </button>
          <Button onClick={hideAllWindows}>Hide</Button>
          <Button onClick={closeAllWindows}>Close</Button>
          <Button
            onClick={() => {
              if (typeof window.webui !== 'undefined') {
                window.webui.run('test_handler()');
              }
            }}
            style={{ background: '#10b981' }}
          >
            Test
          </Button>
          {errors.length > 0 && (
            <Button
              onClick={() => setShowErrorPanel(!showErrorPanel)}
              style={{
                background: errors.some((e: any) => e.type === 'critical') ? '#dc2626' : '#f59e0b',
                fontWeight: 'bold',
              }}
            >
              {errors.length}
            </Button>
          )}
        </div>
      </div>

      {/* Expanded Panel */}
      {statusBarExpanded && (
        <div style={{ padding: '12px 16px', borderTop: '1px solid #334155', color: '#e2e8f0', fontSize: '11px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
            <StatusSection title="Transport">
              <div><span style={{ color: '#4f46e5' }}>●</span> WebUI Bridge</div>
              <div style={{ color: '#64748b', fontSize: '10px', marginTop: '4px' }}>Primary</div>
            </StatusSection>

            <StatusSection title="Serialization">
              <div><span style={{ color: '#10b981' }}>●</span> JSON</div>
              <div style={{ color: '#64748b', fontSize: '10px', marginTop: '4px' }}>serde_json</div>
            </StatusSection>

            <StatusSection title="Connection">
              <div>
                Status:{' '}
                <span style={{ color: wsConnected ? '#10b981' : '#ef4444' }}>
                  {wsConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
              <div>
                Quality:{' '}
                <span
                  style={{
                    color:
                      wsStatus === 'excellent'
                        ? '#10b981'
                        : wsStatus === 'good'
                        ? '#f59e0b'
                        : '#ef4444',
                  }}
                >
                  {wsStatus}
                </span>
              </div>
              <div>Reconnects: {wsMetrics.reconnectAttempts}</div>
            </StatusSection>

            <StatusSection title="Messages">
              <div>Sent: <span style={{ color: '#60a5fa' }}>{wsMetrics.messagesSent}</span></div>
              <div>Received: <span style={{ color: '#a78bfa' }}>{wsMetrics.messagesReceived}</span></div>
              <div>
                Errors:{' '}
                <span style={{ color: wsMetrics.errors > 0 ? '#ef4444' : '#10b981' }}>
                  {wsMetrics.errors}
                </span>
              </div>
            </StatusSection>
          </div>

          <div
            style={{
              marginTop: '12px',
              paddingTop: '8px',
              borderTop: '1px solid #334155',
              display: 'flex',
              gap: '8px',
            }}
          >
            <SmallButton onClick={handleDebugState}>Debug State</SmallButton>
            <SmallButton onClick={handleTestError} style={{ background: 'rgba(239,68,68,0.3)' }}>
              Test Error
            </SmallButton>
            <SmallButton onClick={handleTestWarning} style={{ background: 'rgba(245,158,11,0.3)' }}>
              Test Warning
            </SmallButton>
            <span style={{ flex: 1 }} />
            <span style={{ color: '#64748b', fontSize: '10px' }}>Rust WebUI v1.0.0</span>
          </div>
        </div>
      )}
    </div>
  );
};

const StatusSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div>
    <div style={{ color: '#94a3b8', marginBottom: '6px', fontWeight: '600' }}>{title}</div>
    <div
      style={{
        background: 'rgba(255,255,255,0.05)',
        padding: '8px',
        borderRadius: '4px',
      }}
    >
      {children}
    </div>
  </div>
);

const Button: React.FC<{ children: React.ReactNode; onClick: () => void; style?: React.CSSProperties }> = ({
  children,
  onClick,
  style,
}) => (
  <button
    onClick={(e) => {
      e.stopPropagation();
      onClick();
    }}
    style={{
      background: 'rgba(255,255,255,0.1)',
      color: 'white',
      border: 'none',
      padding: '2px 8px',
      borderRadius: '3px',
      cursor: 'pointer',
      fontSize: '10px',
      ...style,
    }}
  >
    {children}
  </button>
);

const SmallButton: React.FC<{ children: React.ReactNode; onClick: () => void; style?: React.CSSProperties }> = ({
  children,
  onClick,
  style,
}) => (
  <button
    onClick={onClick}
    style={{
      background: 'rgba(255,255,255,0.1)',
      color: 'white',
      border: 'none',
      padding: '4px 10px',
      borderRadius: '3px',
      cursor: 'pointer',
      fontSize: '10px',
      ...style,
    }}
  >
    {children}
  </button>
);

export default StatusBar;
