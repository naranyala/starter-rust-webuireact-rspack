import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './use-cases/App';

// Add error handling for debugging
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
        <App />
      </React.StrictMode>
    );
    console.log('React render called');
  } else {
    console.error('Root element #app not found!');
    document.body.innerHTML = '<div style="padding: 20px; color: red;">Error: Root element #app not found</div>';
  }
} catch (error) {
  console.error('Fatal error mounting React:', error);
  document.body.innerHTML = `<div style="padding: 20px; color: red;">Error: ${error.message}</div>`;
}

// Global error handler
window.onerror = function(msg, url, lineNo, columnNo, error) {
  console.error('Global error:', msg, 'at', url, lineNo, columnNo, error);
  return false;
};

window.addEventListener('unhandledrejection', function(event) {
  console.error('Unhandled promise rejection:', event.reason);
});
