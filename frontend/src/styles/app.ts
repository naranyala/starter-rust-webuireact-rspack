export const appStyles = `
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  body {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
    color: #333;
    font-size: 14px;
  }

  .app {
    min-height: 100vh;
    display: flex;
    flex-direction: row;
    position: relative;
  }

  .sidebar {
    width: 200px;
    background: linear-gradient(180deg, #1e293b 0%, #0f172a 100%);
    color: white;
    display: flex;
    flex-direction: column;
    border-right: 1px solid #334155;
    z-index: 100;
    position: relative;
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

  .window-container {
    position: relative;
  }

  .main-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    z-index: 1;
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
`;

export const statusBarStyles = `
  .status-bar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 10000;
    background: linear-gradient(90deg, #1e293b 0%, #0f172a 100%);
    border-top: 1px solid #334155;
    transition: height 0.3s ease;
  }

  .status-bar.collapsed {
    height: 28px;
  }

  .status-bar.expanded {
    height: 180px;
  }

  .status-bar-collapsed {
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 12px;
  }

  .status-bar-expanded {
    padding: 12px 16px;
    border-top: 1px solid #334155;
    color: #e2e8f0;
    font-size: 11px;
  }

  .status-indicator {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .status-dot.connected {
    background-color: #10b981;
    box-shadow: 0 0 6px #10b981;
  }

  .status-dot.disconnected {
    background-color: #ef4444;
    box-shadow: 0 0 6px #ef4444;
  }

  .status-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
  }

  .status-section-title {
    color: #94a3b8;
    margin-bottom: 6px;
    font-weight: 600;
  }

  .status-box {
    background: rgba(255,255,255,0.05);
    padding: 8px;
    border-radius: 4px;
  }

  .status-actions {
    margin-top: 12px;
    padding-top: 8px;
    border-top: 1px solid #334155;
    display: flex;
    gap: 8px;
  }
`;

export const errorPanelStyles = `
  .error-panel {
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 400px;
    max-height: 300px;
    background: #fff;
    border-radius: 8px;
    box-shadow: 0 10px 40px rgba(0,0,0,0.3);
    z-index: 9999;
    overflow: hidden;
  }

  .error-panel-header {
    background: #dc2626;
    color: white;
    padding: 10px 15px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .error-panel-content {
    max-height: 250px;
    overflow-y: auto;
    padding: 10px;
  }

  .error-item {
    padding: 8px;
    margin-bottom: 8px;
    border-left: 3px solid;
    border-radius: 4px;
  }

  .error-item.error {
    background: #fef2f2;
    border-left-color: #ef4444;
  }

  .error-item.warning {
    background: #fffbeb;
    border-left-color: #f59e0b;
  }

  .error-item.critical {
    background: #fef2f2;
    border-left-color: #dc2626;
  }
`;
