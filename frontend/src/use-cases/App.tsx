import React, { useState, useEffect, useCallback } from 'react';

declare global {
  interface Window {
    WinBox: any;
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

// Use window.Logger or create a fallback
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
  const [activeWindows, setActiveWindows] = useState<WindowInfo[]>([]);
  const [dbUsers, setDbUsers] = useState<User[]>([]);
  const [dbStats, setDbStats] = useState({ users: 0, tables: [] as string[] });
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  const generateSystemInfoHTML = (): string => {
    const now = new Date();
    return `
      <div style="padding: 20px; color: white; font-family: 'Segoe UI', sans-serif; max-height: 100%; overflow-y: auto;">
        <h2 style="margin-bottom: 20px; color: #4f46e5;">💻 System Information</h2>
        
        <div style="margin-bottom: 20px;">
          <h3 style="color: #94a3b8; font-size: 0.9rem; margin-bottom: 10px;">Operating System</h3>
          <div style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 8px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
              <span style="color: #64748b;">Platform:</span>
              <span>${navigator.platform}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
              <span style="color: #64748b;">User Agent:</span>
              <span style="font-size: 0.8rem; max-width: 200px; overflow: hidden; text-overflow: ellipsis;">${navigator.userAgent}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #64748b;">Language:</span>
              <span>${navigator.language}</span>
            </div>
          </div>
        </div>

        <div style="margin-bottom: 20px;">
          <h3 style="color: #94a3b8; font-size: 0.9rem; margin-bottom: 10px;">Display & Screen</h3>
          <div style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 8px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
              <span style="color: #64748b;">Screen Resolution:</span>
              <span>${screen.width} × ${screen.height}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
              <span style="color: #64748b;">Available Resolution:</span>
              <span>${screen.availWidth} × ${screen.availHeight}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
              <span style="color: #64748b;">Color Depth:</span>
              <span>${screen.colorDepth}-bit</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #64748b;">Pixel Ratio:</span>
              <span>${window.devicePixelRatio}x</span>
            </div>
          </div>
        </div>

        <div style="margin-bottom: 20px;">
          <h3 style="color: #94a3b8; font-size: 0.9rem; margin-bottom: 10px;">Browser Information</h3>
          <div style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 8px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
              <span style="color: #64748b;">Online Status:</span>
              <span style="color: ${navigator.onLine ? '#10b981' : '#ef4444'}">${navigator.onLine ? '🟢 Online' : '🔴 Offline'}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
              <span style="color: #64748b;">Cookies Enabled:</span>
              <span>${navigator.cookieEnabled ? 'Yes' : 'No'}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
              <span style="color: #64748b;">Cores:</span>
              <span>${navigator.hardwareConcurrency || 'Unknown'}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #64748b;">Memory:</span>
              <span>${navigator.deviceMemory || 'Unknown'} GB</span>
            </div>
          </div>
        </div>

        <div>
          <h3 style="color: #94a3b8; font-size: 0.9rem; margin-bottom: 10px;">Current Time</h3>
          <div style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 8px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
              <span style="color: #64748b;">Local Time:</span>
              <span>${now.toLocaleString()}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
              <span style="color: #64748b;">Timezone:</span>
              <span>${Intl.DateTimeFormat().resolvedOptions().timeZone}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #64748b;">Timezone Offset:</span>
              <span>UTC${now.getTimezoneOffset() > 0 ? '-' : '+'}${Math.abs(now.getTimezoneOffset() / 60)}</span>
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
      { id: 3, name: 'Bob Johnson', email: 'bob@example.com', role: 'User', status: 'Inactive' },
      { id: 4, name: 'Alice Brown', email: 'alice@example.com', role: 'Editor', status: 'Active' },
      { id: 5, name: 'Charlie Wilson', email: 'charlie@example.com', role: 'User', status: 'Pending' },
    ];

    const rows = users.map((row: User) => `
      <tr style="border-bottom: 1px solid #334155;">
        <td style="padding: 10px; color: #e2e8f0;">${row.id}</td>
        <td style="padding: 10px; color: #e2e8f0;">${row.name}</td>
        <td style="padding: 10px; color: #94a3b8;">${row.email}</td>
        <td style="padding: 10px;"><span style="background: ${row.role === 'Admin' ? '#dc2626' : row.role === 'Editor' ? '#f59e0b' : '#3b82f6'}; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem;">${row.role}</span></td>
        <td style="padding: 10px;"><span style="color: ${row.status === 'Active' ? '#10b981' : row.status === 'Inactive' ? '#ef4444' : '#f59e0b'}">● ${row.status}</span></td>
      </tr>
    `).join('');

    return `
      <div style="padding: 20px; color: white; font-family: 'Segoe UI', sans-serif; height: 100%; display: flex; flex-direction: column;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <h2 style="color: #4f46e5;">🗄️ SQLite Database Viewer</h2>
          <span style="background: #10b981; padding: 5px 12px; border-radius: 20px; font-size: 0.8rem;">Live Data</span>
        </div>

        <div style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 8px; margin-bottom: 15px;">
          <div style="display: flex; gap: 10px; margin-bottom: 15px;">
            <input type="text" id="db-search" placeholder="Search records..." style="flex: 1; padding: 8px 12px; background: rgba(0,0,0,0.3); border: 1px solid #334155; border-radius: 6px; color: white; font-size: 0.9rem;">
            <button onclick="searchUsers()" style="padding: 8px 16px; background: #4f46e5; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 0.9rem;">Search</button>
            <button onclick="refreshUsers()" style="padding: 8px 16px; background: #f59e0b; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 0.9rem;">↻</button>
          </div>

          <div style="display: flex; gap: 15px; font-size: 0.8rem; color: #94a3b8;">
            <span>📊 Table: <strong style="color: white;">users</strong></span>
            <span>📋 Records: <strong style="color: white;">${users.length}</strong></span>
            <span>💾 Source: <strong style="color: white;">Rust SQLite</strong></span>
          </div>
        </div>

        <div style="flex: 1; overflow: auto; background: rgba(0,0,0,0.2); border-radius: 8px;">
          <table style="width: 100%; border-collapse: collapse;">
            <thead style="background: rgba(255,255,255,0.1); position: sticky; top: 0;">
              <tr>
                <th style="padding: 12px 10px; text-align: left; color: #94a3b8; font-weight: 600; font-size: 0.85rem;">ID</th>
                <th style="padding: 12px 10px; text-align: left; color: #94a3b8; font-weight: 600; font-size: 0.85rem;">Name</th>
                <th style="padding: 12px 10px; text-align: left; color: #94a3b8; font-weight: 600; font-size: 0.85rem;">Email</th>
                <th style="padding: 12px 10px; text-align: left; color: #94a3b8; font-weight: 600; font-size: 0.85rem;">Role</th>
                <th style="padding: 12px 10px; text-align: left; color: #94a3b8; font-weight: 600; font-size: 0.85rem;">Status</th>
              </tr>
            </thead>
            <tbody id="users-table-body">
              ${rows}
            </tbody>
          </table>
        </div>

        <div style="margin-top: 15px; padding: 10px; background: rgba(255,255,255,0.05); border-radius: 8px; display: flex; justify-content: space-between; align-items: center;">
          <span style="color: #64748b; font-size: 0.8rem;">Showing ${users.length} record${users.length !== 1 ? 's' : ''}</span>
          <div style="display: flex; gap: 5px;">
            <button style="padding: 5px 12px; background: rgba(255,255,255,0.1); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.8rem;" disabled>Previous</button>
            <button style="padding: 5px 12px; background: rgba(255,255,255,0.1); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.8rem;" disabled>Next</button>
          </div>
        </div>
      </div>
    `;
  };

  const openSystemInfoWindow = () => {
    openWindow('System Information', generateSystemInfoHTML(), '💻');
  };

  const openSQLiteWindow = () => {
    setIsLoadingUsers(true);
    Logger.info('Opening SQLite window, fetching users from backend...');

    if (window.getUsers) {
      Logger.info('Calling Rust backend get_users function');
      window.getUsers();
    } else {
      Logger.warn('Rust backend get_users not available');
      setIsLoadingUsers(false);
    }

    if (window.getDbStats) {
      window.getDbStats();
    }

    openWindow('SQLite Database', generateSQLiteHTML(), '🗄️');
  };

  const updateSQLiteTable = useCallback(() => {
    const tableBody = document.getElementById('users-table-body');
    if (!tableBody || dbUsers.length === 0) return;

    const rows = dbUsers.map((row: User) => `
      <tr style="border-bottom: 1px solid #334155;">
        <td style="padding: 10px; color: #e2e8f0;">${row.id}</td>
        <td style="padding: 10px; color: #e2e8f0;">${row.name}</td>
        <td style="padding: 10px; color: #94a3b8;">${row.email}</td>
        <td style="padding: 10px;"><span style="background: ${row.role === 'Admin' ? '#dc2626' : row.role === 'Editor' ? '#f59e0b' : '#3b82f6'}; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem;">${row.role}</span></td>
        <td style="padding: 10px;"><span style="color: ${row.status === 'Active' ? '#10b981' : row.status === 'Inactive' ? '#ef4444' : '#f59e0b'}">● ${row.status}</span></td>
      </tr>
    `).join('');

    tableBody.innerHTML = rows;
  }, [dbUsers]);

  const openWindow = (title: string, content: string, icon: string) => {
    if (!window.WinBox) {
      Logger.error('WinBox is not loaded yet. Please try again in a moment.');
      return;
    }

    setActiveWindows(prev => {
      const existingWindow = prev.find(w => w.title === title);
      if (existingWindow) {
        if (existingWindow.minimized) {
          existingWindow.winboxInstance.restore();
          existingWindow.minimized = false;
        }
        existingWindow.winboxInstance.focus();
        return prev;
      }

      Logger.info('Opening window', { windowTitle: title });

      const windowId = 'win-' + Date.now();
      let winboxInstance: any;

      winboxInstance = new window.WinBox({
        title: title,
        background: '#1e293b',
        border: 4,
        width: 'calc(100% - 200px)',
        height: '100%',
        x: '200px',
        y: '0',
        minwidth: '300px',
        minheight: '300px',
        max: true,
        min: true,
        mount: document.createElement('div'),
        oncreate: function() {
          this.body.innerHTML = content;
        },
        onminimize: function() {
          setActiveWindows(prev => prev.map(w => 
            w.id === windowId ? { ...w, minimized: true } : w
          ));
        },
        onrestore: function() {
          setActiveWindows(prev => prev.map(w => 
            w.id === windowId ? { ...w, minimized: false, maximized: false } : w
          ));
        },
        onmaximize: function() {
          const availableWidth = window.innerWidth - 200;
          const availableHeight = window.innerHeight;
          
          this.resize(availableWidth, availableHeight);
          this.move(200, 0);
          
          setActiveWindows(prev => prev.map(w => 
            w.id === windowId ? { ...w, maximized: true } : w
          ));
        },
        onclose: function() {
          setActiveWindows(prev => prev.filter(w => w.id !== windowId));
        }
      });

      const windowInfo: WindowInfo = {
        id: windowId,
        title: title,
        minimized: false,
        maximized: false,
        winboxInstance: winboxInstance
      };
      
      return [...prev, windowInfo];
    });
  };

  const focusWindow = (windowInfo: WindowInfo) => {
    if (windowInfo.minimized) {
      windowInfo.winboxInstance.restore();
      setActiveWindows(prev => prev.map(w => 
        w.id === windowInfo.id ? { ...w, minimized: false } : w
      ));
    }
    windowInfo.winboxInstance.focus();
  };

  const closeWindow = (windowInfo: WindowInfo) => {
    windowInfo.winboxInstance.close();
    setActiveWindows(prev => prev.filter(w => w.id !== windowInfo.id));
  };

  const closeAllWindows = () => {
    activeWindows.forEach(windowInfo => {
      windowInfo.winboxInstance.close();
    });
    setActiveWindows([]);
  };

  const hideAllWindows = () => {
    setActiveWindows(prev => prev.map(w => {
      if (!w.minimized) {
        w.winboxInstance.minimize();
        return { ...w, minimized: true, maximized: false };
      }
      return w;
    }));
    Logger.info('All windows minimized - showing main view');
  };

  const handleWindowResize = () => {
    setActiveWindows(prev => prev.map(w => {
      if (w.maximized && !w.minimized) {
        const availableWidth = window.innerWidth - 200;
        const availableHeight = window.innerHeight;
        
        w.winboxInstance.resize(availableWidth, availableHeight);
        w.winboxInstance.move(200, 0);
      }
      return w;
    }));
  };

  useEffect(() => {
    Logger.info('Application initialized');

    window.refreshUsers = () => {
      Logger.info('Refreshing users from database');
      setIsLoadingUsers(true);
      if (window.getUsers) {
        window.getUsers();
      }
    };

    window.searchUsers = () => {
      const searchInput = document.getElementById('db-search') as HTMLInputElement;
      const searchTerm = searchInput?.value.toLowerCase() || '';
      Logger.info('Searching users', { term: searchTerm });

      const tableBody = document.getElementById('users-table-body');
      if (tableBody) {
        const rows = tableBody.querySelectorAll('tr');
        rows.forEach((row: any) => {
          const text = row.textContent?.toLowerCase() || '';
          row.style.display = text.includes(searchTerm) ? '' : 'none';
        });
      }
    };

    const handleDbResponse = ((event: CustomEvent) => {
      const response = event.detail;
      if (response.success) {
        setDbUsers(response.data || []);
        Logger.info('Users loaded from database', { count: response.data?.length || 0 });
        updateSQLiteTable();
      } else {
        Logger.error('Failed to load users', { error: response.error });
      }
      setIsLoadingUsers(false);
    }) as EventListener;

    const handleStatsResponse = ((event: CustomEvent) => {
      const response = event.detail;
      if (response.success) {
        setDbStats(response.stats);
        Logger.info('Database stats loaded', response.stats);
      }
    }) as EventListener;

    window.addEventListener('db_response', handleDbResponse);
    window.addEventListener('stats_response', handleStatsResponse);
    window.addEventListener('resize', handleWindowResize);

    return () => {
      window.removeEventListener('db_response', handleDbResponse);
      window.removeEventListener('stats_response', handleStatsResponse);
      window.removeEventListener('resize', handleWindowResize);
    };
  }, [updateSQLiteTable]);

  return (
    <>
      <style>{`
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background-color: #f5f7fa;
          color: #333;
          font-size: 14px;
        }

        .app {
          min-height: 100vh;
          display: flex;
          flex-direction: row;
        }

        .sidebar {
          width: 200px;
          background: linear-gradient(180deg, #1e293b 0%, #0f172a 100%);
          color: white;
          display: flex;
          flex-direction: column;
          border-right: 1px solid #334155;
        }

        .home-button-container {
          padding: 0.75rem;
          background: rgba(79, 70, 229, 0.2);
          border-bottom: 1px solid #334155;
        }

        .home-btn {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 0.5rem 0.75rem;
          background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .home-btn:hover {
          background: linear-gradient(135deg, #4338ca 0%, #6d28d9 100%);
          transform: translateY(-1px);
          box-shadow: 0 2px 8px rgba(79, 70, 229, 0.4);
        }

        .home-icon {
          font-size: 1rem;
        }

        .home-text {
          font-size: 0.85rem;
        }

        .sidebar-header {
          padding: 0.75rem;
          background: rgba(255, 255, 255, 0.05);
          border-bottom: 1px solid #334155;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .sidebar-header h2 {
          font-size: 0.9rem;
          font-weight: 600;
        }

        .window-count {
          background: #4f46e5;
          color: white;
          padding: 0.15rem 0.5rem;
          border-radius: 12px;
          font-size: 0.75rem;
          font-weight: 600;
        }

        .window-list {
          flex: 1;
          overflow-y: auto;
          padding: 0.5rem;
        }

        .window-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem;
          margin-bottom: 0.25rem;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s ease;
          border: 1px solid transparent;
        }

        .window-item:hover {
          background: rgba(255, 255, 255, 0.15);
          border-color: #4f46e5;
          transform: translateX(4px);
        }

        .window-item.minimized {
          opacity: 0.6;
          background: rgba(255, 255, 255, 0.02);
        }

        .window-item.minimized:hover {
          opacity: 0.9;
          background: rgba(255, 255, 255, 0.1);
        }

        .window-icon {
          font-size: 1rem;
        }

        .window-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-width: 0;
        }

        .window-title {
          font-size: 0.75rem;
          font-weight: 500;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .window-status {
          font-size: 0.65rem;
          color: #94a3b8;
        }

        .window-close {
          background: transparent;
          border: none;
          color: #94a3b8;
          font-size: 1.1rem;
          cursor: pointer;
          padding: 0.15rem;
          line-height: 1;
          border-radius: 3px;
          transition: all 0.2s ease;
        }

        .window-close:hover {
          background: #dc3545;
          color: white;
        }

        .no-windows {
          text-align: center;
          padding: 1rem;
          color: #64748b;
          font-size: 0.8rem;
          font-style: italic;
        }

        .sidebar-footer {
          padding: 0.75rem;
          border-top: 1px solid #334155;
        }

        .close-all-btn {
          width: 100%;
          padding: 0.5rem;
          background: #dc3545;
          color: white;
          border: none;
          border-radius: 4px;
          font-size: 0.75rem;
          cursor: pointer;
          transition: background 0.2s ease;
        }

        .close-all-btn:hover {
          background: #c82333;
        }

        .main-container {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .header {
          background: linear-gradient(135deg, #6a11cb 0%, #2575fc 100%);
          color: white;
          padding: 0.5rem 1rem;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }

        .header h1 {
          font-size: 1.2rem;
          font-weight: 600;
        }

        .main-content {
          flex: 1;
          padding: 1rem;
          overflow-y: auto;
        }

        .cards-section {
          margin-bottom: 1rem;
        }

        .cards-grid {
          display: grid;
          gap: 1.5rem;
        }

        .cards-grid.two-cards {
          grid-template-columns: repeat(2, 1fr);
          max-width: 800px;
          margin: 0 auto;
        }

        .feature-card {
          background: white;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 6px rgba(0,0,0,0.05);
          transition: transform 0.3s ease, box-shadow 0.3s ease;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          min-height: 200px;
        }

        .feature-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 12px 24px rgba(0,0,0,0.1);
        }

        .card-icon {
          font-size: 3rem;
          text-align: center;
          padding: 1.5rem;
          background: linear-gradient(135deg, #f5f7fa 0%, #e4e7ec 100%);
        }

        .card-content {
          padding: 1.25rem;
          flex: 1;
          display: flex;
          flex-direction: column;
        }

        .card-title {
          font-size: 1.1rem;
          font-weight: 600;
          margin-bottom: 0.5rem;
          color: #1e293b;
        }

        .card-description {
          font-size: 0.85rem;
          color: #64748b;
          margin-bottom: 1rem;
          line-height: 1.5;
          flex: 1;
        }

        .card-tags {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
        }

        .tag {
          background: #e0e7ff;
          color: #4f46e5;
          padding: 0.25rem 0.75rem;
          border-radius: 20px;
          font-size: 0.75rem;
          font-weight: 500;
        }

        .wb-dock,
        .wb-taskbar,
        .winbox-dock,
        .winbox-taskbar,
        .winbox-dock-container,
        .wb-dock-container,
        .winbox.minimized ~ .wb-dock,
        .winbox.min ~ .wb-dock,
        .winbox.minimized ~ .wb-taskbar,
        .winbox.min ~ .wb-taskbar {
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
          height: 0 !important;
          width: 0 !important;
          position: absolute !important;
          bottom: -9999px !important;
        }

        .winbox.min,
        .winbox.minimized {
          opacity: 0 !important;
          pointer-events: none !important;
          top: -9999px !important;
          left: -9999px !important;
        }

        @media (max-width: 768px) {
          .app {
            flex-direction: column;
          }

          .sidebar {
            width: 100%;
            max-height: 150px;
          }

          .window-list {
            display: flex;
            flex-direction: row;
            gap: 0.5rem;
            overflow-x: auto;
            padding: 0.5rem;
          }

          .window-item {
            min-width: 150px;
            margin-bottom: 0;
          }

          .cards-grid.two-cards {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="app">
        <aside className="sidebar">
          <div className="home-button-container">
            <button onClick={hideAllWindows} className="home-btn" title="Show Main View">
              <span className="home-icon">🏠</span>
              <span className="home-text">Home</span>
            </button>
          </div>

          <div className="sidebar-header">
            <h2>Windows</h2>
            <span className="window-count">{activeWindows.length}</span>
          </div>

          <div className="window-list">
            {activeWindows.map((window) => (
              <div
                key={window.id}
                className={`window-item ${window.minimized ? 'minimized' : ''}`}
                onClick={() => focusWindow(window)}
              >
                <div className="window-icon">📷</div>
                <div className="window-info">
                  <span className="window-title">{window.title}</span>
                  <span className="window-status">{window.minimized ? 'Minimized' : 'Active'}</span>
                </div>
                <button
                  className="window-close"
                  onClick={(e) => { e.stopPropagation(); closeWindow(window); }}
                  title="Close window"
                >
                  ×
                </button>
              </div>
            ))}

            {activeWindows.length === 0 && (
              <div className="no-windows">
                No open windows
              </div>
            )}
          </div>

          <div className="sidebar-footer">
            {activeWindows.length > 0 && (
              <button onClick={closeAllWindows} className="close-all-btn">
                Close All
              </button>
            )}
          </div>
        </aside>

        <div className="main-container">
          <header className="header">
            <h1>System Dashboard</h1>
          </header>

          <main className="main-content">
            <section className="cards-section">
              <div className="cards-grid two-cards">
                <div className="feature-card" onClick={openSystemInfoWindow}>
                  <div className="card-icon">💻</div>
                  <div className="card-content">
                    <h3 className="card-title">System Information</h3>
                    <p className="card-description">
                      View detailed system information including OS, memory, CPU, and runtime statistics.
                    </p>
                    <div className="card-tags">
                      <span className="tag">Hardware</span>
                      <span className="tag">Stats</span>
                    </div>
                  </div>
                </div>

                <div className="feature-card" onClick={openSQLiteWindow}>
                  <div className="card-icon">🗄️</div>
                  <div className="card-content">
                    <h3 className="card-title">SQLite Database</h3>
                    <p className="card-description">
                      Interactive database viewer with sample data. Connects to backend SQLite integration.
                    </p>
                    <div className="card-tags">
                      <span className="tag">Database</span>
                      <span className="tag">Mockup</span>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </main>
        </div>
      </div>
    </>
  );
};

export default App;
