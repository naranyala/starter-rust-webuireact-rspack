export interface CounterState {
  value: number;
  lastUpdated: Date | null;
}

export class CounterPlugin {
  private state: CounterState = { value: 0, lastUpdated: null };
  private listeners: Array<(state: CounterState) => void> = [];

  increment(): void {
    this.state = { value: this.state.value + 1, lastUpdated: new Date() };
    this.notifyListeners();
  }

  reset(): void {
    this.state = { value: 0, lastUpdated: new Date() };
    this.notifyListeners();
  }

  getValue(): number {
    return this.state.value;
  }

  subscribe(listener: (state: CounterState) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  static pluginName = 'counter';
}

export const counterPlugin = new CounterPlugin();
