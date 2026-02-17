import React, { useState, useEffect, useCallback } from 'react';
import { useError } from '../utils/ErrorProvider';
import { getEnhancedWebSocket } from '../utils/enhanced-websocket';
import { StatusBar } from '../components/StatusBar';
import { appStyles, errorPanelStyles } from '../styles/app';
import { initializePlugins } from '../plugins';
import { SIDEBAR_WIDTH, STATUS_BAR_HEIGHT, HEADER_HEIGHT } from '../core';

declare global {
  interface Window {
    WinBox: any;
    webui?: any;
    getUsers?: () => void;
    getDbStats?: () => void;
    refreshUsers?: () => void;
    searchUsers?: () => void;
    Logger?: {
      info: (message: string, meta?: Record<string, any>) => void;
      warn: (message: string, meta?: Record<string, any>) => void;
      error: (message: string, meta?: Record<string, any>) => void;
      debug: (message: string, meta?: Record<string, any>) => void;
    };
  }
}

const Logger = window.Logger || {
  info: (msg: string, meta?: any) => console.log('[INFO]', msg, meta),
  warn: (msg: string, meta?: any) => console.warn('[WARN]', msg, meta),
  error: (msg: string, meta?: any) => console.error('[ERROR]', msg, meta),
  debug: (msg: string, meta?: any) => console.debug('[DEBUG]', msg, meta),
};

interface WindowInfo {
  id: string;
  title: string;
  minimized: boolean;
  maximized?: boolean;
  winboxInstance: any;
}

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
}

const App: React.FC = () => {
  const { addError, addErrorFromException, errors, removeError, clearErrors } = useError();
  const [activeWindows, setActiveWindows] = useState<WindowInfo[]>([]);
  const [dbUsers, setDbUsers] = useState<User[]>([]);
  const [dbStats, setDbStats] = useState({ users: 0, tables: [] as string[] });
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [showErrorPanel, setShowErrorPanel] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [wsStatus, setWsStatus] = useState('disconnected');
  const [wsMetrics, setWsMetrics] = useState({
    messagesSent: 0,
    messagesReceived: 0,
    errors: 0,
    reconnectAttempts: 0,
  });

  const generateSystemInfoHTML = (): string => {
    const now = new Date();
    return `
      <div style="padding: 20px; color: white; font-family: 'Segoe UI', sans-serif; max-height: 100%; overflow-y: auto;">
        <h2 style="margin-bottom: 20px; color: #4f46e5;">💻 System Information</h2>
        <div style="margin-bottom: 20px;">
          <h3 style="color: #94a3b8; font-size: 0.9rem; margin-bottom: 10px;">Operating System</h3>
          <div style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 8px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
              <span style="color: #64748b;">Platform:</span><span>${navigator.platform}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
              <span style="color: #64748b;">User Agent:</span>
              <span style="font-size: 0.8rem; max-width: 200px; overflow: hidden; text-overflow: ellipsis;">${navigator.userAgent}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #64748b;">Language:</span><span>${navigator.language}</span>
            </div>
          </div>
        </div>
        <div>
          <h3 style="color: #94a3b8; font-size: 0.9rem; margin-bottom: 10px;">Current Time</h3>
          <div style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 8px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
              <span style="color: #64748b;">Local Time:</span><span>${now.toLocaleString()}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #64748b;">Timezone:</span><span>${Intl.DateTimeFormat().resolvedOptions().timeZone}</span>
            </div>
          </div>
        </div>
      </div>
    `;
  };

  const generateSQLiteHTML = (): string => {
    const users = dbUsers.length > 0 ? dbUsers : [
      { id: 1, name: 'John Doe', email: 'john@example.com', role: 'Admin', status: 'Active' },
      { id: 2, name: 'Jane Smith', email: 'jane@example.com', role: 'User', status: 'Active' },
    ];
    const rows = users.map((row: User) => `
      <tr style="border-bottom: 1px solid #334155;">
        <td style="padding: 10px; color: #e2e8f0;">${row.id}</td>
        <td style="padding: 10px; color: #e2e8f0;">${row.name}</td>
        <td style="padding: 10px; color: #94a3b8;">${row.email}</td>
        <td style="padding: 10px;"><span style="background: ${row.role === 'Admin' ? '#dc2626' : '#3b82f6'}; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem;">${row.role}</span></td>
        <td style="padding: 10px;"><span style="color: ${row.status === 'Active' ? '#10b981' : '#ef4444'}">● ${row.status}</span></td>
      </tr>
    `).join('');
    return `
      <div style="padding: 20px; color: white; font-family: 'Segoe UI', sans-serif; height: 100%; display: flex; flex-direction: column;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <h2 style="color: #4f46e5;">🗄️ SQLite Database</h2>
          <span style="background: #10b981; padding: 5px 12px; border-radius: 20px; font-size: 0.8rem;">Live Data</span>
        </div>
        <div style="flex: 1; overflow: auto; background: rgba(0,0,0,0.2); border-radius: 8px;">
          <table style="width: 100%; border-collapse: collapse;">
            <thead style="background: rgba(255,255,255,0.1); position: sticky; top: 0;">
              <tr><th style="padding: 12px; text-align: left; color: #94a3b8;">ID</th><th style="padding: 12px; text-align: left; color: #94a3b8;">Name</th><th style="padding: 12px; text-align: left; color: #94a3b8;">Email</th><th style="padding: 12px; text-align: left; color: #94a3b8;">Role</th><th style="padding: 12px; text-align: left; color: #94a3b8;">Status</th></tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
    `;
  };

  const openWindow = (title: string, content: string, icon: string) => {
    if (!window.WinBox) {
      Logger.error('WinBox is not loaded yet');
      return;
    }
    setActiveWindows((prev) => {
      const existing = prev.find((w) => w.title === title);
      if (existing) {
        if (existing.minimized) {
          existing.winboxInstance.restore();
        }
        existing.minimized = false;
        existing.winboxInstance.focus();
        return prev;
      }
      const windowId = 'win-' + Date.now();
      const mainContentWidth = () => {
        const mainEl = document.querySelector('.main-content') as HTMLElement;
        return mainEl ? mainEl.offsetWidth - 20 : window.innerWidth - SIDEBAR_WIDTH - 40;
      };
      const mainContentHeight = () => {
        return window.innerHeight - HEADER_HEIGHT - STATUS_BAR_HEIGHT - 40;
      };
      const winboxInstance = new window.WinBox({
        title,
        background: '#1e293b',
        border: 4,
        width: mainContentWidth(),
        height: mainContentHeight(),
        x: SIDEBAR_WIDTH + 10,
        y: HEADER_HEIGHT + 20,
        minwidth: 400,
        minheight: 300,
        max: true,
        min: true,
        index: 1,
        mount: document.createElement('div'),
        oncreate: function() { 
          this.body.innerHTML = content;
          this.body.style.overflow = 'auto';
          setTimeout(() => {
            this.x = SIDEBAR_WIDTH + 10;
            this.width = mainContentWidth();
            this.height = mainContentHeight();
          }, 100);
        },
        onmaximize: function() {
          setTimeout(() => {
            this.x = SIDEBAR_WIDTH + 10;
            this.width = mainContentWidth();
            this.height = mainContentHeight();
          }, 50);
          setActiveWindows((w) => w.map((wi) => wi.id === windowId ? { ...wi, maximized: true } : wi));
        },
        onunmaximize: function() {
          setTimeout(() => {
            this.x = SIDEBAR_WIDTH + 10;
            this.y = HEADER_HEIGHT + 20;
            this.width = mainContentWidth();
            this.height = mainContentHeight();
          }, 50);
          setActiveWindows((w) => w.map((wi) => wi.id === windowId ? { ...wi, maximized: false } : wi));
        },
        onresize: function() {
          if (this.x < SIDEBAR_WIDTH + 20) {
            this.x = SIDEBAR_WIDTH + 10;
          }
          this.width = mainContentWidth();
          this.height = mainContentHeight();
        },
        onclose: () => setActiveWindows((w) => w.filter((wi) => wi.id !== windowId)),
        onminimize: function() {
          setActiveWindows((w) => w.map((wi) => wi.id === windowId ? { ...wi, minimized: true } : wi));
        },
        onrestore: function() {
          setTimeout(() => {
            if (this.x < SIDEBAR_WIDTH + 20) {
              this.x = SIDEBAR_WIDTH + 10;
            }
            this.width = mainContentWidth();
            this.height = mainContentHeight();
          }, 50);
          setActiveWindows((w) => w.map((wi) => wi.id === windowId ? { ...wi, minimized: false } : wi));
        },
      });
      return [...prev, { id: windowId, title, minimized: false, maximized: false, winboxInstance }];
    });
  };

  const openSystemInfoWindow = () => openWindow('System Information', generateSystemInfoHTML(), '💻');
  const openSQLiteWindow = () => {
    setIsLoadingUsers(true);
    if (window.getUsers) window.getUsers();
    openWindow('SQLite Database', generateSQLiteHTML(), '🗄️');
  };

  const hideAllWindows = () => {
    setActiveWindows((prev) => prev.map((w) => {
      if (!w.minimized) {
        w.winboxInstance.minimize();
        return { ...w, minimized: true, maximized: false };
      }
      return w;
    }));
  };

  const closeAllWindows = () => {
    activeWindows.forEach((w) => w.winboxInstance.close());
    setActiveWindows([]);
  };

  useEffect(() => {
    Logger.info('Application initialized');
    initializePlugins();
    if (window.webui) {
      const enhancedWs = getEnhancedWebSocket();
      const updateWsStatus = () => {
        if (enhancedWs) {
          const state = enhancedWs.getCurrentState();
          setWsConnected(state.isConnected);
          setWsStatus(state.connectionQuality);
          setWsMetrics({
            messagesSent: state.messageCount || 0,
            messagesReceived: state.messageCount || 0,
            errors: state.errorCount || 0,
            reconnectAttempts: state.reconnectAttempts || 0,
          });
        }
      };
      updateWsStatus();
      const interval = setInterval(updateWsStatus, 2000);
      return () => clearInterval(interval);
    }
  }, []);

  useEffect(() => {
    window.refreshUsers = () => {
      setIsLoadingUsers(true);
      if (window.getUsers) window.getUsers();
    };
    window.searchUsers = () => {
      const searchInput = document.getElementById('db-search') as HTMLInputElement;
      const term = searchInput?.value.toLowerCase() || '';
      const tableBody = document.getElementById('users-table-body');
      if (tableBody) {
        tableBody.querySelectorAll('tr').forEach((row: any) => {
          row.style.display = row.textContent?.toLowerCase().includes(term) ? '' : 'none';
        });
      }
    };
    const handleDbResponse = ((event: CustomEvent) => {
      const response = event.detail;
      if (response.success) {
        setDbUsers(response.data || []);
        // Update table directly
        const tb = document.getElementById('users-table-body');
        if (tb && response.data) {
          tb.innerHTML = response.data.map((row: User) => `
            <tr style="border-bottom: 1px solid #334155;">
              <td style="padding: 10px; color: #e2e8f0;">${row.id}</td>
              <td style="padding: 10px; color: #e2e8f0;">${row.name}</td>
              <td style="padding: 10px; color: #94a3b8;">${row.email}</td>
              <td style="padding: 10px;"><span style="background: ${row.role === 'Admin' ? '#dc2626' : '#3b82f6'}; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem;">${row.role}</span></td>
              <td style="padding: 10px;"><span style="color: ${row.status === 'Active' ? '#10b981' : '#ef4444'}">● ${row.status}</span></td>
            </tr>
          `).join('');
        }
      }
      setIsLoadingUsers(false);
    }) as EventListener;
    window.addEventListener('db_response', handleDbResponse);
    return () => window.removeEventListener('db_response', handleDbResponse);
  }, []);

  return (
    <>
      <style>{appStyles}</style>
      <style>{errorPanelStyles}</style>
      <div className="app">
        <aside className="sidebar">
          <div className="home-button-container">
            <button onClick={hideAllWindows} className="home-btn">
              <span className="home-icon">🏠</span>
              <span className="home-text">Home</span>
            </button>
          </div>
          <div className="sidebar-header">
            <h2>Windows</h2>
            <span className="window-count">{activeWindows.length}</span>
          </div>
          <div className="window-list">
            {activeWindows.map((w) => (
              <div key={w.id} className={`window-item ${w.minimized ? 'minimized' : ''}`} onClick={() => {
                w.minimized ? w.winboxInstance.restore() : w.winboxInstance.focus();
                setActiveWindows((prev) => prev.map((wi) => wi.id === w.id ? { ...wi, minimized: false } : wi));
              }}>
                <div className="window-icon">📷</div>
                <div className="window-info">
                  <span className="window-title">{w.title}</span>
                  <span className="window-status">{w.minimized ? 'Minimized' : 'Active'}</span>
                </div>
                <button className="window-close" onClick={(e) => {
                  e.stopPropagation();
                  w.winboxInstance.close();
                  setActiveWindows((prev) => prev.filter((wi) => wi.id !== w.id));
                }}>×</button>
              </div>
            ))}
            {activeWindows.length === 0 && <div className="no-windows">No open windows</div>}
          </div>
          <div className="sidebar-footer">
            {activeWindows.length > 0 && <button onClick={closeAllWindows} className="close-all-btn">Close All</button>}
          </div>
        </aside>
        <div className="main-container">
          <header className="header"><h1>System Dashboard</h1></header>
          <main className="main-content">
            <section className="cards-section">
              <div className="cards-grid two-cards">
                <div className="feature-card" onClick={() => openSystemInfoWindow()}>
                  <div className="card-icon">💻</div>
                  <div className="card-content">
                    <h3 className="card-title">System Information</h3>
                    <p className="card-description">View detailed system information including OS, memory, CPU, and runtime statistics.</p>
                    <div className="card-tags"><span className="tag">Hardware</span><span className="tag">Stats</span></div>
                  </div>
                </div>
                <div className="feature-card" onClick={() => openSQLiteWindow()}>
                  <div className="card-icon">🗄️</div>
                  <div className="card-content">
                    <h3 className="card-title">SQLite Database</h3>
                    <p className="card-description">Interactive database viewer with sample data.</p>
                    <div className="card-tags"><span className="tag">Database</span><span className="tag">Data</span></div>
                  </div>
                </div>
              </div>
            </section>
          </main>
        </div>
      </div>

      {showErrorPanel && errors.length > 0 && (
        <div className="error-panel">
          <div className="error-panel-header">
            <span style={{ fontWeight: 'bold' }}>Errors ({errors.length})</span>
            <div>
              <button onClick={clearErrors} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', marginRight: '10px' }}>Clear All</button>
              <button onClick={() => setShowErrorPanel(false)} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', fontSize: '18px' }}>×</button>
            </div>
          </div>
          <div className="error-panel-content">
            {errors.map((error) => (
              <div key={error.id} className={`error-item ${error.type}`}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: '500', fontSize: '13px' }}>{error.message}</span>
                  <button onClick={() => removeError(error.id)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#999' }}>×</button>
                </div>
                <span style={{ fontSize: '10px', color: '#999' }}>{error.timestamp.toLocaleTimeString()} - {error.source}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <StatusBar
        wsConnected={wsConnected}
        wsStatus={wsStatus}
        wsMetrics={wsMetrics}
        errors={errors}
        showErrorPanel={showErrorPanel}
        setShowErrorPanel={setShowErrorPanel}
        hideAllWindows={hideAllWindows}
        closeAllWindows={closeAllWindows}
      />
    </>
  );
};

export default App;
