/**
 * Enhanced WebSocket Error Handler for WebUI
 * Provides comprehensive error handling, state tracking, and recovery mechanisms
 */

interface WebSocketState {
  isConnected: boolean;
  readyState: number;
  url: string | null;
  reconnectAttempts: number;
  lastError: string | null;
  wasEverConnected: boolean;
  connectionQuality: 'excellent' | 'good' | 'poor' | 'unknown';
  messageCount: number;
  errorCount: number;
  totalBytesSent: number;
  totalBytesReceived: number;
  lastPingTime: number;
  lastPongTime: number;
  stateHistory: Array<{
    state: number;
    timestamp: number;
    reason?: string;
  }>;
}

interface WebSocketMetrics {
  connectionAttempts: number;
  successfulConnections: number;
  failedConnections: number;
  messagesSent: number;
  messagesReceived: number;
  bytesSent: number;
  bytesReceived: number;
  errors: Array<{
    error: string;
    timestamp: number;
    context: string;
  }>;
}

class EnhancedWebSocketHandler {
  private webui: any;
  private state: WebSocketState;
  private metrics: WebSocketMetrics;
  private reconnectInterval: number = 5000; // 5 seconds
  private maxReconnectAttempts: number = 10;
  private currentReconnectAttempt: number = 0;
  private isReconnecting: boolean = false;
  private heartbeatInterval: number | null = null;
  private errorCallbacks: Array<(error: any) => void> = [];
  private stateChangeCallbacks: Array<(oldState: number, newState: number) => void> = [];
  private isMonitoring: boolean = false;

  constructor(webuiInstance: any) {
    this.webui = webuiInstance;
    this.state = this.initializeState();
    this.metrics = this.initializeMetrics();
    
    this.setupEnhancedErrorHandling();
    this.startMonitoring();
  }

  private initializeState(): WebSocketState {
    return {
      isConnected: false,
      readyState: WebSocket.CLOSED,
      url: null,
      reconnectAttempts: 0,
      lastError: null,
      wasEverConnected: false,
      connectionQuality: 'unknown',
      messageCount: 0,
      errorCount: 0,
      totalBytesSent: 0,
      totalBytesReceived: 0,
      lastPingTime: 0,
      lastPongTime: 0,
      stateHistory: []
    };
  }

  private initializeMetrics(): WebSocketMetrics {
    return {
      connectionAttempts: 0,
      successfulConnections: 0,
      failedConnections: 0,
      messagesSent: 0,
      messagesReceived: 0,
      bytesSent: 0,
      bytesReceived: 0,
      errors: []
    };
  }

  private setupEnhancedErrorHandling() {
    // Store original methods
    const originalSetEventCallback = this.webui.setEventCallback.bind(this.webui);
    
    // Override the event callback to intercept connection events
    this.webui.setEventCallback = (callback: (event: number) => void) => {
      const enhancedCallback = (event: number) => {
        if (event === this.webui.event.CONNECTED) {
          this.handleConnectionEstablished();
        } else if (event === this.webui.event.DISCONNECTED) {
          this.handleDisconnection();
        }
        callback(event);
      };
      originalSetEventCallback(enhancedCallback);
    };

    // Monitor connection status changes
    setInterval(() => {
      this.updateConnectionStatus();
    }, 1000);
  }

  private updateConnectionStatus() {
    const currentStatus = this.webui.getConnectionStatus();
    const oldState = this.state.isConnected;
    
    this.state.isConnected = currentStatus.isConnected;
    this.state.readyState = this.getReadyStateFromStatus(currentStatus);
    this.state.url = currentStatus.url;
    this.state.reconnectAttempts = currentStatus.reconnectAttempts;
    this.state.lastError = currentStatus.lastError;
    this.state.wasEverConnected = currentStatus.wasEverConnected;
    
    // Update state history
    this.addToStateHistory(this.state.readyState, `Status update: ${this.state.isConnected ? 'Connected' : 'Disconnected'}`);
    
    // Emit state change if it changed
    if (oldState !== this.state.isConnected) {
      this.emitStateChangeEvent(oldState ? 1 : 0, this.state.isConnected ? 1 : 0);
    }
  }

  private getReadyStateFromStatus(status: any): number {
    if (status.isConnected) return WebSocket.OPEN;
    // Since WebUI doesn't expose readyState directly, we infer it
    if (status.reconnectAttempts > 0) return WebSocket.CONNECTING;
    return WebSocket.CLOSED;
  }

  private addToStateHistory(state: number, reason?: string) {
    const entry = { 
      state, 
      timestamp: Date.now(), 
      reason 
    };
    this.state.stateHistory.push(entry);
    if (this.state.stateHistory.length > 50) {
      this.state.stateHistory.shift();
    }
  }

  private handleConnectionEstablished() {
    console.log('[EnhancedWebSocket] Connection established');
    this.state.isConnected = true;
    this.state.readyState = WebSocket.OPEN;
    this.state.wasEverConnected = true;
    this.state.reconnectAttempts = 0;
    this.currentReconnectAttempt = 0;
    this.isReconnecting = false;
    
    this.metrics.successfulConnections++;
    this.addToStateHistory(WebSocket.OPEN, 'Connected');
    
    // Start heartbeat
    this.startHeartbeat();
  }

  private handleDisconnection() {
    console.log('[EnhancedWebSocket] Disconnection detected');
    this.state.isConnected = false;
    this.state.readyState = WebSocket.CLOSED;
    
    this.metrics.failedConnections++;
    this.addToStateHistory(WebSocket.CLOSED, 'Disconnected');
    
    // Stop heartbeat
    this.stopHeartbeat();
    
    // Attempt reconnection if not manually disconnected
    this.attemptReconnection();
  }

  private startHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    this.heartbeatInterval = window.setInterval(() => {
      if (this.state.isConnected) {
        this.state.lastPingTime = Date.now();
        try {
          // Send a ping-like message to test connection
          this.webui.call('ping', 'heartbeat').catch(() => {
            console.warn('[EnhancedWebSocket] Heartbeat failed');
            this.handleDisconnection();
          });
        } catch (error) {
          console.error('[EnhancedWebSocket] Heartbeat error:', error);
          this.handleDisconnection();
        }
      }
    }, 15000); // Every 15 seconds
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private attemptReconnection() {
    if (this.isReconnecting || this.currentReconnectAttempt >= this.maxReconnectAttempts) {
      if (this.currentReconnectAttempt >= this.maxReconnectAttempts) {
        console.error('[EnhancedWebSocket] Maximum reconnection attempts reached');
        this.state.lastError = `Max reconnection attempts (${this.maxReconnectAttempts}) reached`;
        this.emitErrorEvent(new Error(`Failed to reconnect after ${this.maxReconnectAttempts} attempts`));
      }
      return;
    }

    this.isReconnecting = true;
    this.currentReconnectAttempt++;
    this.metrics.connectionAttempts++;
    
    console.log(`[EnhancedWebSocket] Attempting reconnection... (${this.currentReconnectAttempt}/${this.maxReconnectAttempts})`);
    
    setTimeout(() => {
      try {
        this.webui.reconnect();
      } catch (error) {
        console.error('[EnhancedWebSocket] Reconnection attempt failed:', error);
        this.isReconnecting = false;
        this.attemptReconnection(); // Try again
      }
    }, this.reconnectInterval);
  }

  public startMonitoring() {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    
    // Monitor connection quality
    setInterval(() => {
      this.updateConnectionQuality();
    }, 30000); // Every 30 seconds
    
    // Log periodic status
    setInterval(() => {
      if (this.isMonitoring) {
        console.debug('[EnhancedWebSocket] Status:', {
          state: this.getCurrentState(),
          metrics: this.getMetrics(),
          connectionQuality: this.state.connectionQuality
        });
      }
    }, 60000); // Every minute
  }

  public stopMonitoring() {
    this.isMonitoring = false;
    this.stopHeartbeat();
  }

  private updateConnectionQuality() {
    if (this.state.lastPingTime === 0 || this.state.lastPongTime === 0) {
      this.state.connectionQuality = 'unknown';
      return;
    }

    const latency = this.state.lastPongTime - this.state.lastPingTime;
    if (latency < 50) {
      this.state.connectionQuality = 'excellent';
    } else if (latency < 150) {
      this.state.connectionQuality = 'good';
    } else {
      this.state.connectionQuality = 'poor';
    }
  }

  public getCurrentState(): WebSocketState {
    return { ...this.state };
  }

  public getMetrics(): WebSocketMetrics {
    return { ...this.metrics };
  }

  public getHistory(): Array<{ state: number; timestamp: number; reason?: string }> {
    return [...this.state.stateHistory];
  }

  public onError(callback: (error: any) => void): () => void {
    this.errorCallbacks.push(callback);
    return () => {
      const index = this.errorCallbacks.indexOf(callback);
      if (index !== -1) {
        this.errorCallbacks.splice(index, 1);
      }
    };
  }

  public onStateChange(callback: (oldState: number, newState: number) => void): () => void {
    this.stateChangeCallbacks.push(callback);
    return () => {
      const index = this.stateChangeCallbacks.indexOf(callback);
      if (index !== -1) {
        this.stateChangeCallbacks.splice(index, 1);
      }
    };
  }

  private emitErrorEvent(error: any) {
    console.error('[EnhancedWebSocket] Error emitted:', error);
    this.state.errorCount++;
    this.metrics.errors.push({
      error: error.message || String(error),
      timestamp: Date.now(),
      context: 'WebSocket'
    });
    
    this.errorCallbacks.forEach(callback => {
      try {
        callback(error);
      } catch (cbError) {
        console.error('[EnhancedWebSocket] Error in error callback:', cbError);
      }
    });
  }

  private emitStateChangeEvent(oldState: number, newState: number) {
    console.log(`[EnhancedWebSocket] State changed: ${oldState} -> ${newState}`);
    this.stateChangeCallbacks.forEach(callback => {
      try {
        callback(oldState, newState);
      } catch (cbError) {
        console.error('[EnhancedWebSocket] Error in state change callback:', cbError);
      }
    });
  }

  public forceReconnect() {
    console.log('[EnhancedWebSocket] Forced reconnection initiated');
    this.currentReconnectAttempt = 0;
    this.isReconnecting = false;
    this.webui.reconnect();
  }

  public disconnect() {
    console.log('[EnhancedWebSocket] Disconnecting...');
    this.stopHeartbeat();
    this.isReconnecting = false;
    this.currentReconnectAttempt = this.maxReconnectAttempts; // Prevent auto-reconnect
    this.state.isConnected = false;
    this.state.readyState = WebSocket.CLOSED;
    this.addToStateHistory(WebSocket.CLOSED, 'Manually disconnected');
  }

  public getConnectionInfo() {
    return {
      state: this.getCurrentState(),
      metrics: this.getMetrics(),
      history: this.getHistory(),
      isMonitoring: this.isMonitoring
    };
  }
}

// Export the enhanced handler
export default EnhancedWebSocketHandler;

// Also provide a global instance if needed
let enhancedWebSocketHandler: EnhancedWebSocketHandler | null = null;

export const initEnhancedWebSocket = (webuiInstance: any) => {
  if (!enhancedWebSocketHandler) {
    enhancedWebSocketHandler = new EnhancedWebSocketHandler(webuiInstance);
  }
  return enhancedWebSocketHandler;
};

export const getEnhancedWebSocket = () => {
  return enhancedWebSocketHandler;
};