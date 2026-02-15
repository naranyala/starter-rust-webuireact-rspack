import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import App from './views/App';
import { ErrorProvider, ErrorPanel, useError } from './utils/ErrorProvider';

const ErrorHandler: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { addErrorFromException } = useError();

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      addErrorFromException(event.error || event.message, 'uncaught');
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      addErrorFromException(event.reason, 'unhandled-rejection');
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, [addErrorFromException]);

  return <>{children}</>;
};

console.log('=== React Application Starting ===');
console.log('Current URL:', window.location.href);
console.log('Document readyState:', document.readyState);

try {
  const rootElement = document.getElementById('app');
  console.log('Root element found:', rootElement);
  
  if (rootElement) {
    const root = ReactDOM.createRoot(rootElement);
    console.log('React root created');
    
    root.render(
      <React.StrictMode>
        <ErrorProvider>
          <ErrorHandler>
            <App />
          </ErrorHandler>
        </ErrorProvider>
      </React.StrictMode>
    );
    console.log('React render called');
  } else {
    console.error('Root element #app not found!');
    document.body.innerHTML = `
      <div style="
        padding: 40px; 
        font-family: system-ui, -apple-system, sans-serif;
        background: #fef2f2;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="
          background: white;
          padding: 30px;
          border-radius: 12px;
          box-shadow: 0 10px 40px rgba(0,0,0,0.1);
          border: 2px solid #dc2626;
          max-width: 400px;
          text-align: center;
        ">
          <div style="font-size: 48px; margin-bottom: 16px;">🚨</div>
          <h2 style="color: #dc2626; margin: 0 0 12px 0;">Root Element Missing</h2>
          <p style="color: #6b7280; margin: 0;">
            Could not find the #app element. Please check your HTML structure.
          </p>
        </div>
      </div>
    `;
  }
} catch (error) {
  console.error('Fatal error mounting React:', error);
  document.body.innerHTML = `
    <div style="
      padding: 40px; 
      font-family: system-ui, -apple-system, sans-serif;
      background: #fef2f2;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      <div style="
        background: white;
        padding: 30px;
        border-radius: 12px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.1);
        border: 2px solid #dc2626;
        max-width: 500px;
        text-align: center;
      ">
        <div style="font-size: 48px; margin-bottom: 16px;">💥</div>
        <h2 style="color: #dc2626; margin: 0 0 12px 0;">Application Error</h2>
        <pre style="
          background: #1f2937;
          color: #e5e7eb;
          padding: 16px;
          border-radius: 8px;
          overflow: auto;
          text-align: left;
          font-size: 12px;
        ">${error instanceof Error ? error.message : String(error)}</pre>
        <button 
          onclick="window.location.reload()"
          style="
            margin-top: 20px;
            padding: 12px 24px;
            background: #2563eb;
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
          "
        >
          Reload Page
        </button>
      </div>
    </div>
  `;
}
