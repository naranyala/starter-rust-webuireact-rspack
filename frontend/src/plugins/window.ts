export interface WindowState {
  id: string;
  title: string;
  minimized: boolean;
  maximized: boolean;
}

export class WindowPlugin {
  private windows: Map<string, WindowState> = new Map();
  private listeners: Array<(windows: WindowState[]) => void> = [];

  registerWindow(id: string, title: string): void {
    this.windows.set(id, { id, title, minimized: false, maximized: false });
    this.notifyListeners();
  }

  unregisterWindow(id: string): void {
    this.windows.delete(id);
    this.notifyListeners();
  }

  minimizeWindow(id: string): void {
    const win = this.windows.get(id);
    if (win) {
      win.minimized = true;
      this.notifyListeners();
    }
  }

  restoreWindow(id: string): void {
    const win = this.windows.get(id);
    if (win) {
      win.minimized = false;
      this.notifyListeners();
    }
  }

  maximizeWindow(id: string): void {
    const win = this.windows.get(id);
    if (win) {
      win.maximized = true;
      this.notifyListeners();
    }
  }

  unmaximizeWindow(id: string): void {
    const win = this.windows.get(id);
    if (win) {
      win.maximized = false;
      this.notifyListeners();
    }
  }

  getWindows(): WindowState[] {
    return Array.from(this.windows.values());
  }

  subscribe(listener: (windows: WindowState[]) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener(this.getWindows());
    }
  }

  static pluginName = 'window';
}

export const windowPlugin = new WindowPlugin();
