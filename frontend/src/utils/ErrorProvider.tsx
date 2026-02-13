import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export interface ErrorInfo {
  id: string;
  message: string;
  type: 'error' | 'warning' | 'info';
  timestamp: Date;
  details?: string;
  stack?: string;
}

interface ErrorContextType {
  errors: ErrorInfo[];
  addError: (message: string, type?: ErrorInfo['type'], details?: string) => void;
  addErrorFromException: (error: Error | unknown) => void;
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

  const addErrorFromException = useCallback((error: Error | unknown) => {
    const err = error as Error;
    const errorInfo: ErrorInfo = {
      id: `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      message: err?.message || 'An unknown error occurred',
      type: 'error',
      timestamp: new Date(),
      details: err?.stack || String(error),
      stack: err?.stack,
    };
    setErrors(prev => [...prev, errorInfo]);
  }, []);

  const removeError = useCallback((id: string) => {
    setErrors(prev => prev.filter(e => e.id !== id));
  }, []);

  const clearErrors = useCallback(() => {
    setErrors([]);
  }, []);

  return (
    <ErrorContext.Provider value={{ errors, addError, addErrorFromException, removeError, clearErrors }}>
      {children}
    </ErrorContext.Provider>
  );
};

interface ErrorPanelProps {
  position?: 'top' | 'bottom';
}

export const ErrorPanel: React.FC<ErrorPanelProps> = () => {
  const { errors, removeError, clearErrors } = useError();

  if (errors.length === 0) return null;

  const getTypeStyles = (type: ErrorInfo['type']) => {
    switch (type) {
      case 'error':
        return {
          bg: '#fef2f2',
          border: '#ef4444',
          icon: '⚠️',
          text: '#dc2626',
          headerBg: '#dc2626',
        };
      case 'warning':
        return {
          bg: '#fffbeb',
          border: '#f59e0b',
          icon: '⚡',
          text: '#d97706',
          headerBg: '#f59e0b',
        };
      case 'info':
        return {
          bg: '#eff6ff',
          border: '#3b82f6',
          icon: 'ℹ️',
          text: '#2563eb',
          headerBg: '#3b82f6',
        };
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString();
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}
      onClick={handleBackdropClick}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: '12px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
          maxWidth: '500px',
          width: '90%',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'errorModalSlideIn 0.2s ease-out',
        }}
      >
        <style>{`
          @keyframes errorModalSlideIn {
            from {
              opacity: 0;
              transform: scale(0.95) translateY(-10px);
            }
            to {
              opacity: 1;
              transform: scale(1) translateY(0);
            }
          }
        `}</style>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px 20px',
            background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
            color: 'white',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '24px' }}>⚠️</span>
            <span style={{ fontWeight: 700, fontSize: '18px' }}>
              {errors.length} {errors.length === 1 ? 'Issue' : 'Issues'} Detected
            </span>
          </div>
          <button
            onClick={clearErrors}
            style={{
              background: 'rgba(255, 255, 255, 0.2)',
              color: 'white',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              padding: '6px 14px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 500,
              transition: 'background 0.2s',
            }}
            onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)'}
            onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
          >
            Dismiss All
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
          {errors.map((error, index) => {
            const styles = getTypeStyles(error.type);
            return (
              <div
                key={error.id}
                style={{
                  padding: '16px',
                  marginBottom: index < errors.length - 1 ? '12px' : 0,
                  borderRadius: '8px',
                  background: styles.bg,
                  border: `2px solid ${styles.border}`,
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <span style={{ fontSize: '18px' }}>{styles.icon}</span>
                      <span style={{ fontWeight: 600, color: styles.text, fontSize: '15px' }}>
                        {error.message}
                      </span>
                    </div>
                    {error.details && (
                      <details>
                        <summary style={{ cursor: 'pointer', color: '#6b7280', fontSize: '13px', marginTop: '4px', fontWeight: 500 }}>
                          View details
                        </summary>
                        <pre
                          style={{
                            marginTop: '10px',
                            padding: '12px',
                            background: '#1f2937',
                            color: '#f3f4f6',
                            borderRadius: '6px',
                            fontSize: '11px',
                            overflow: 'auto',
                            maxHeight: '120px',
                            fontFamily: 'monospace',
                            lineHeight: 1.5,
                          }}
                        >
                          {error.details}
                        </pre>
                      </details>
                    )}
                    <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '8px' }}>
                      {formatTime(error.timestamp)}
                    </div>
                  </div>
                  <button
                    onClick={() => removeError(error.id)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#9ca3af',
                      cursor: 'pointer',
                      fontSize: '20px',
                      padding: '0 4px',
                      lineHeight: 1,
                      marginLeft: '8px',
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
            padding: '12px 20px',
            borderTop: '1px solid #e5e7eb',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '10px',
            background: '#f9fafb',
          }}
        >
          <button
            onClick={clearErrors}
            style={{
              background: '#4b5563',
              color: 'white',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 500,
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ErrorProvider;
