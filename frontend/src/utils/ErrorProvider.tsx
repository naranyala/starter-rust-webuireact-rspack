import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';

export interface ErrorInfo {
  id: string;
  message: string;
  type: 'error' | 'warning' | 'info' | 'critical';
  timestamp: Date;
  details?: string;
  stack?: string;
  source?: 'uncaught' | 'unhandled-rejection' | 'component' | 'api';
}

interface ErrorContextType {
  errors: ErrorInfo[];
  hasCriticalErrors: boolean;
  addError: (message: string, type?: ErrorInfo['type'], details?: string) => void;
  addErrorFromException: (error: Error | unknown, source?: ErrorInfo['source']) => void;
  removeError: (id: string) => void;
  clearErrors: () => void;
}

const ErrorContext = createContext<ErrorContextType | undefined>(undefined);

export const useError = (): ErrorContextType => {
  const context = useContext(ErrorContext);
  if (!context) {
    throw new Error('useError must be used within an ErrorProvider');
  }
  return context;
};

interface ErrorProviderProps {
  children: ReactNode;
}

export const ErrorProvider: React.FC<ErrorProviderProps> = ({ children }) => {
  const [errors, setErrors] = useState<ErrorInfo[]>([]);

  const addError = useCallback((message: string, type: ErrorInfo['type'] = 'error', details?: string) => {
    const error: ErrorInfo = {
      id: `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      message,
      type,
      timestamp: new Date(),
      details,
    };
    setErrors(prev => [...prev, error]);
  }, []);

  const addErrorFromException = useCallback((error: Error | unknown, source: ErrorInfo['source'] = 'uncaught') => {
    const err = error as Error;
    const errorInfo: ErrorInfo = {
      id: `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      message: err?.message || 'An unknown error occurred',
      type: 'error',
      timestamp: new Date(),
      details: err?.stack || String(error),
      stack: err?.stack,
      source,
    };
    setErrors(prev => [...prev, errorInfo]);
  }, []);

  const removeError = useCallback((id: string) => {
    setErrors(prev => prev.filter(e => e.id !== id));
  }, []);

  const clearErrors = useCallback(() => {
    setErrors([]);
  }, []);

  const hasCriticalErrors = errors.some(e => e.type === 'critical');

  useEffect(() => {
    const handleGlobalError: OnErrorEventHandler = (msg, url, lineNo, columnNo, error) => {
      const errorMessage = typeof msg === 'string' ? msg : 'Unknown error';
      const errorInfo: ErrorInfo = {
        id: `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        message: errorMessage,
        type: 'critical',
        timestamp: new Date(),
        details: `URL: ${url}\nLine: ${lineNo}\nColumn: ${columnNo}\n\n${error?.stack || ''}`,
        stack: error?.stack,
        source: 'uncaught',
      };
      setErrors(prev => [...prev, errorInfo]);
      return false;
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const errorInfo: ErrorInfo = {
        id: `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        message: event.reason?.message || 'Unhandled Promise Rejection',
        type: 'error',
        timestamp: new Date(),
        details: event.reason?.stack || String(event.reason),
        stack: event.reason?.stack,
        source: 'unhandled-rejection',
      };
      setErrors(prev => [...prev, errorInfo]);
    };

    window.onerror = handleGlobalError;
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.onerror = null;
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  return (
    <ErrorContext.Provider value={{ 
      errors, 
      hasCriticalErrors,
      addError, 
      addErrorFromException, 
      removeError, 
      clearErrors 
    }}>
      {children}
    </ErrorContext.Provider>
  );
};

export const ErrorPanel: React.FC = () => {
  const { errors, removeError, clearErrors, hasCriticalErrors } = useError();

  if (errors.length === 0) return null;

  const getTypeStyles = (type: ErrorInfo['type']) => {
    switch (type) {
      case 'critical':
        return { bg: '#fef2f2', border: '#dc2626', icon: '🔴', text: '#dc2626', headerBg: '#991b1b' };
      case 'error':
        return { bg: '#fef2f2', border: '#ef4444', icon: '⚠️', text: '#dc2626', headerBg: '#dc2626' };
      case 'warning':
        return { bg: '#fffbeb', border: '#f59e0b', icon: '⚡', text: '#d97706', headerBg: '#f59e0b' };
      case 'info':
        return { bg: '#eff6ff', border: '#3b82f6', icon: 'ℹ️', text: '#2563eb', headerBg: '#3b82f6' };
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString();
  };

  const getSourceLabel = (source?: ErrorInfo['source']) => {
    switch (source) {
      case 'uncaught': return 'Uncaught Error';
      case 'unhandled-rejection': return 'Promise Rejection';
      case 'component': return 'React Component';
      case 'api': return 'API Error';
      default: return 'Error';
    }
  };

  return (
    <>
      <style>{`
        @keyframes errorModalSlideIn {
          from { opacity: 0; transform: scale(0.95) translateY(-10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes backdropPulse {
          0%, 100% { background-color: rgba(0, 0, 0, 0.5); }
          50% { background-color: rgba(0, 0, 0, 0.7); }
        }
        .error-modal-backdrop {
          animation: backdropPulse 2s ease-in-out infinite;
        }
        .error-modal-content {
          animation: errorModalSlideIn 0.3s ease-out;
        }
      `}</style>

      <div
        className="error-modal-backdrop"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
        }}
      >
        <div
          className="error-modal-content"
          style={{
            background: '#ffffff',
            borderRadius: '16px',
            boxShadow: '0 25px 80px rgba(0, 0, 0, 0.4)',
            maxWidth: '600px',
            width: '90%',
            maxHeight: '85vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            border: hasCriticalErrors ? '2px solid #dc2626' : '1px solid #e5e7eb',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '20px 24px',
              background: hasCriticalErrors 
                ? 'linear-gradient(135deg, #991b1b 0%, #dc2626 100%)' 
                : 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
              color: 'white',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '28px' }}>🚨</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: '20px' }}>
                  {errors.length} {errors.length === 1 ? 'Issue' : 'Issues'} Detected
                </div>
                <div style={{ fontSize: '12px', opacity: 0.9, marginTop: '2px' }}>
                  {hasCriticalErrors ? 'Critical error requires attention' : 'Click outside or dismiss to continue'}
                </div>
              </div>
            </div>
            <button
              onClick={clearErrors}
              style={{
                background: 'rgba(255, 255, 255, 0.2)',
                color: 'white',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                padding: '8px 16px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 600,
                transition: 'background 0.2s',
              }}
              onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)'}
              onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
            >
              Dismiss All
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
            {errors.map((error, index) => {
              const styles = getTypeStyles(error.type);
              return (
                <div
                  key={error.id}
                  style={{
                    padding: '18px',
                    marginBottom: index < errors.length - 1 ? '16px' : 0,
                    borderRadius: '12px',
                    background: styles.bg,
                    border: `2px solid ${styles.border}`,
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                        <span style={{ fontSize: '20px' }}>{styles.icon}</span>
                        <span style={{ fontWeight: 700, color: styles.text, fontSize: '16px' }}>
                          {error.message}
                        </span>
                      </div>
                      
                      <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                        <span style={{ 
                          background: styles.headerBg, 
                          color: 'white', 
                          padding: '2px 8px', 
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 600,
                        }}>
                          {getSourceLabel(error.source)}
                        </span>
                        <span style={{ 
                          color: '#6b7280', 
                          fontSize: '11px',
                          fontWeight: 500,
                        }}>
                          {formatTime(error.timestamp)}
                        </span>
                      </div>

                      {error.details && (
                        <details>
                          <summary style={{ 
                            cursor: 'pointer', 
                            color: '#4b5563', 
                            fontSize: '13px', 
                            marginTop: '6px', 
                            fontWeight: 500 
                          }}>
                            View technical details
                          </summary>
                          <pre
                            style={{
                              marginTop: '12px',
                              padding: '14px',
                              background: '#1f2937',
                              color: '#e5e7eb',
                              borderRadius: '8px',
                              fontSize: '11px',
                              overflow: 'auto',
                              maxHeight: '150px',
                              fontFamily: '"Fira Code", monospace',
                              lineHeight: 1.6,
                            }}
                          >
                            {error.details}
                          </pre>
                        </details>
                      )}
                    </div>
                    <button
                      onClick={() => removeError(error.id)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#9ca3af',
                        cursor: 'pointer',
                        fontSize: '24px',
                        padding: '0 6px',
                        lineHeight: 1,
                        marginLeft: '12px',
                      }}
                      title="Dismiss"
                    >
                      ×
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div
            style={{
              padding: '16px 24px',
              borderTop: '1px solid #e5e7eb',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: '#f9fafb',
            }}
          >
            <div style={{ fontSize: '12px', color: '#6b7280' }}>
              {errors.length} error{errors.length !== 1 ? 's' : ''} • {hasCriticalErrors ? 'Requires attention' : 'May affect functionality'}
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => window.location.reload()}
                style={{
                  background: '#4b5563',
                  color: 'white',
                  border: 'none',
                  padding: '10px 18px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 500,
                }}
              >
                Reload Page
              </button>
              <button
                onClick={clearErrors}
                style={{
                  background: '#2563eb',
                  color: 'white',
                  border: 'none',
                  padding: '10px 18px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 500,
                }}
              >
                Continue Anyway
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ErrorProvider;
