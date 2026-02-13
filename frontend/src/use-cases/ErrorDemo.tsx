import React, { useState } from 'react';
import { useError } from '../utils/ErrorProvider';

export const ErrorDemo: React.FC = () => {
  const { addError, addErrorFromException } = useError();
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSimpleError = () => {
    addError('This is a simple error message', 'error');
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2000);
  };

  const handleWarning = () => {
    addError('This is a warning - please be aware', 'warning');
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2000);
  };

  const handleInfo = () => {
    addError('This is an informational message', 'info');
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2000);
  };

  const handleException = () => {
    try {
      throw new Error('This is a thrown error with stack trace!\n    at ErrorDemo.handleException (App.tsx:42)\n    at ReactDOM.render (main.tsx:25)');
    } catch (error) {
      addErrorFromException(error, 'component');
    }
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2000);
  };

  const handlePromiseRejection = () => {
    Promise.reject(new Error('Simulated unhandled promise rejection'));
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2000);
  };

  const handleCritical = () => {
    addError('This is a critical error!', 'critical');
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2000);
  };

  return (
    <div style={{ 
      padding: '40px', 
      maxWidth: '600px', 
      margin: '0 auto',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <h1 style={{ color: '#1f2937', marginBottom: '24px' }}>Error Handling Demo</h1>
      
      <p style={{ color: '#4b5563', marginBottom: '24px' }}>
        Click the buttons below to trigger different types of errors and see the modal in action.
      </p>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(2, 1fr)', 
        gap: '12px',
        marginBottom: '24px',
      }}>
        <button
          onClick={handleSimpleError}
          style={{
            padding: '16px 20px',
            background: '#ef4444',
            color: 'white',
            border: 'none',
            borderRadius: '10px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            justifyContent: 'center',
          }}
        >
          ⚠️ Simple Error
        </button>

        <button
          onClick={handleWarning}
          style={{
            padding: '16px 20px',
            background: '#f59e0b',
            color: 'white',
            border: 'none',
            borderRadius: '10px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            justifyContent: 'center',
          }}
        >
          ⚡ Warning
        </button>

        <button
          onClick={handleInfo}
          style={{
            padding: '16px 20px',
            background: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '10px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            justifyContent: 'center',
          }}
        >
          ℹ️ Info
        </button>

        <button
          onClick={handleException}
          style={{
            padding: '16px 20px',
            background: '#dc2626',
            color: 'white',
            border: 'none',
            borderRadius: '10px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            justifyContent: 'center',
          }}
        >
          💥 Exception with Stack
        </button>

        <button
          onClick={handlePromiseRejection}
          style={{
            padding: '16px 20px',
            background: '#7c3aed',
            color: 'white',
            border: 'none',
            borderRadius: '10px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            justifyContent: 'center',
          }}
        >
          🔴 Promise Rejection
        </button>

        <button
          onClick={handleCritical}
          style={{
            padding: '16px 20px',
            background: '#991b1b',
            color: 'white',
            border: 'none',
            borderRadius: '10px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            justifyContent: 'center',
          }}
        >
          🔴 Critical Error
        </button>
      </div>

      {showSuccess && (
        <div style={{
          padding: '16px',
          background: '#d1fae5',
          border: '2px solid #10b981',
          borderRadius: '10px',
          color: '#065f46',
          textAlign: 'center',
          fontWeight: 500,
          animation: 'fadeIn 0.3s ease-out',
        }}>
          ✅ Error triggered! Check the modal above.
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default ErrorDemo;
