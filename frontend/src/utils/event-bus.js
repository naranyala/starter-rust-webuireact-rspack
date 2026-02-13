/**
 * Frontend Event Bus System
 * Provides publish/subscribe functionality for the React frontend
 * Integrates with WebUI for backend communication
 */

class EventBus {
  constructor() {
    this.listeners = new Map(); // Map of event names to array of callbacks
    this.middleware = []; // Middleware functions to process events
    this.history = []; // Store event history
    this.maxHistorySize = 100; // Maximum number of events to keep in history
    this.backendListeners = new Map(); // Track backend event listeners
    this.webuiAvailable = typeof window.webui !== 'undefined';
  }

  /**
   * Subscribe to an event
   * @param {string} eventName - Name of the event to subscribe to
   * @param {Function} callback - Function to call when event is emitted
   * @param {Object} options - Subscription options
   * @returns {Function} Unsubscribe function
   */
  subscribe(eventName, callback, options = {}) {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, []);
    }

    const subscription = {
      callback,
      id: this.generateId(),
      once: options.once || false,
      filter: options.filter || null,
      priority: options.priority || 0, // Higher priority executes first
      context: options.context || null
    };

    this.listeners.get(eventName).push(subscription);
    
    // Sort by priority (higher first)
    this.sortListenersByPriority(eventName);
    
    console.debug(`Subscribed to event: ${eventName}`, { subscriptionId: subscription.id });

    // Return unsubscribe function
    return () => {
      this.unsubscribe(eventName, subscription.id);
    };
  }

  /**
   * Subscribe to an event only once
   * @param {string} eventName - Name of the event to subscribe to
   * @param {Function} callback - Function to call when event is emitted
   * @returns {Function} Unsubscribe function
   */
  subscribeOnce(eventName, callback, options = {}) {
    return this.subscribe(eventName, callback, { ...options, once: true });
  }

  /**
   * Unsubscribe from an event
   * @param {string} eventName - Name of the event
   * @param {string} subscriptionId - ID of the subscription to remove
   */
  unsubscribe(eventName, subscriptionId) {
    if (this.listeners.has(eventName)) {
      const listeners = this.listeners.get(eventName);
      const index = listeners.findIndex(sub => sub.id === subscriptionId);
      if (index !== -1) {
        listeners.splice(index, 1);
        console.debug(`Unsubscribed from event: ${eventName}`, { subscriptionId });
      }
    }
  }

  /**
   * Emit an event
   * @param {string|Object} eventOrName - Either event name string or event object
   * @param {*} data - Data to pass with the event (if eventOrName is string)
   * @param {Object} metadata - Additional metadata for the event
   */
  async emit(eventOrName, data = null, metadata = {}) {
    let event;
    
    if (typeof eventOrName === 'string') {
      // Create event object from name and data
      event = {
        id: this.generateId(),
        name: eventOrName,
        data,
        timestamp: Date.now(),
        source: 'frontend',
        metadata: { ...metadata, source: 'frontend' }
      };
    } else {
      // Assume it's already an event object
      event = {
        id: this.generateId(),
        timestamp: Date.now(),
        source: 'frontend',
        ...eventOrName,
        metadata: { ...eventOrName.metadata, source: 'frontend' }
      };
    }

    console.debug(`Emitting event: ${event.name}`, { eventId: event.id, data: event.data });

    // Add to history
    this.addToHistory(event);

    // Apply middleware
    for (const middleware of this.middleware) {
      try {
        const result = await Promise.resolve(middleware(event));
        if (result === false) {
          console.debug(`Middleware cancelled event: ${event.name}`);
          return; // Cancel event emission
        }
      } catch (error) {
        console.error('Error in event middleware:', error);
      }
    }

    // Get listeners for this event
    const listeners = this.listeners.get(event.name) || [];

    // Process listeners
    const remainingListeners = [];
    for (const subscription of listeners) {
      try {
        // Apply filter if present
        if (subscription.filter && !subscription.filter(event)) {
          remainingListeners.push(subscription);
          continue;
        }

        // Call the callback with proper context
        const context = subscription.context || this;
        const result = await Promise.resolve(
          subscription.callback.call(context, event)
        );

        // If it's a once subscription, don't keep it
        if (!subscription.once) {
          remainingListeners.push(subscription);
        }

        // If callback returns false, stop propagation
        if (result === false) {
          console.debug(`Event propagation stopped by listener: ${event.name}`);
          break;
        }
      } catch (error) {
        console.error(`Error in event listener for ${event.name}:`, error);
      }
    }

    // Update listeners (remove once subscriptions)
    if (remainingListeners.length !== listeners.length) {
      this.listeners.set(event.name, remainingListeners);
    }

    // Also emit as DOM custom event for compatibility with existing code
    this.emitAsDOMEvent(event);
  }

  /**
   * Emit event as DOM custom event for compatibility
   * @param {Object} event - The event object
   */
  emitAsDOMEvent(event) {
    const domEvent = new CustomEvent(event.name, {
      detail: {
        id: event.id,
        name: event.name,
        data: event.data,
        timestamp: event.timestamp,
        source: event.source,
        metadata: event.metadata
      }
    });
    
    window.dispatchEvent(domEvent);
  }

  /**
   * Add middleware function to process events
   * @param {Function} middleware - Middleware function
   * @returns {Function} Function to remove middleware
   */
  use(middleware) {
    this.middleware.push(middleware);
    
    return () => {
      const index = this.middleware.indexOf(middleware);
      if (index !== -1) {
        this.middleware.splice(index, 1);
      }
    };
  }

  /**
   * Add event to history
   * @param {Object} event - The event to add
   */
  addToHistory(event) {
    this.history.push(event);
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }
  }

  /**
   * Get event history
   * @param {string} eventName - Optional event name to filter by
   * @returns {Array} Array of events
   */
  getHistory(eventName = null) {
    if (eventName) {
      return this.history.filter(event => event.name === eventName);
    }
    return [...this.history];
  }

  /**
   * Clear event history
   */
  clearHistory() {
    this.history = [];
  }

  /**
   * Get all event names that have listeners
   * @returns {Array} Array of event names
   */
  getEventNames() {
    return Array.from(this.listeners.keys());
  }

  /**
   * Get count of listeners for an event
   * @param {string} eventName - Name of the event
   * @returns {number} Count of listeners
   */
  getListenerCount(eventName) {
    return this.listeners.has(eventName) 
      ? this.listeners.get(eventName).length 
      : 0;
  }

  /**
   * Generate unique ID
   * @returns {string} Unique ID
   */
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  }

  /**
   * Sort listeners by priority (higher first)
   * @param {string} eventName - Name of the event
   */
  sortListenersByPriority(eventName) {
    if (this.listeners.has(eventName)) {
      this.listeners.get(eventName).sort((a, b) => b.priority - a.priority);
    }
  }

  /**
   * Wait for an event to be emitted
   * @param {string} eventName - Name of the event to wait for
   * @param {number} timeout - Timeout in milliseconds (optional)
   * @returns {Promise} Promise that resolves with event data
   */
  waitFor(eventName, timeout = null) {
    return new Promise((resolve, reject) => {
      const unsubscribe = this.subscribeOnce(eventName, (event) => {
        resolve(event);
      });

      if (timeout) {
        setTimeout(() => {
          unsubscribe();
          reject(new Error(`Timeout waiting for event: ${eventName}`));
        }, timeout);
      }
    });
  }

  /**
   * Forward events to backend via WebUI
   * @param {string} eventName - Name of the event
   * @param {*} data - Data to send to backend
   */
  forwardToBackend(eventName, data) {
    // Check if WebUI is available and send event to backend
    if (this.webuiAvailable && typeof window.webui !== 'undefined') {
      try {
        // Create a JSON payload for the event
        const payload = JSON.stringify({
          event: eventName,
          data: data,
          timestamp: Date.now(),
          source: 'frontend'
        });
        
        // Send to backend via WebUI
        window.webui.run(`handleFrontendEvent('${payload}')`);
        console.log(`Forwarded event to backend: ${eventName}`, { data });
      } catch (error) {
        console.error(`Error forwarding event to backend: ${eventName}`, error);
      }
    } else {
      console.warn(`WebUI not available, cannot forward event: ${eventName}`);
    }
  }

  /**
   * Listen for events from backend
   * @param {string} eventName - Name of the event to listen for from backend
   * @param {Function} callback - Callback to handle the event
   * @returns {Function} Unsubscribe function
   */
  listenFromBackend(eventName, callback) {
    // Create a unique handler function
    const handler = (event) => {
      // Extract the detail from the custom event
      const eventData = event.detail || event;
      callback(eventData);
    };

    // Store the handler to allow for proper cleanup
    const listenerId = this.generateId();
    this.backendListeners.set(listenerId, { eventName, handler });

    // Add event listener to window
    window.addEventListener(eventName, handler);
    
    // Return unsubscribe function
    return () => {
      window.removeEventListener(eventName, handler);
      this.backendListeners.delete(listenerId);
    };
  }

  /**
   * Initialize WebUI event handlers
   * Sets up communication channel with backend
   */
  initWebUIHandlers() {
    if (!this.webuiAvailable) {
      console.warn('WebUI not available, skipping WebUI handlers initialization');
      return;
    }

    // Define a global function that can be called from backend
    window.handleBackendEvent = (eventJson) => {
      try {
        const event = JSON.parse(eventJson);
        console.log('Received event from backend:', event);
        
        // Emit the event through our event bus
        this.emit(event.event || 'backend.event', event.data, {
          source: 'backend',
          originalEvent: event
        });
      } catch (error) {
        console.error('Error handling backend event:', error);
      }
    };

    console.log('WebUI event handlers initialized');
  }

  /**
   * Send event to backend with promise-based response
   * @param {string} eventName - Name of the event to send
   * @param {*} data - Data to send to backend
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise} Promise that resolves with backend response
   */
  async sendToBackendWithResponse(eventName, data, timeout = 5000) {
    return new Promise((resolve, reject) => {
      // Create a unique response event name
      const responseEventName = `${eventName}.response`;
      let timeoutId;

      // Set up response listener
      const responseHandler = (event) => {
        clearTimeout(timeoutId);
        // Clean up the response listener
        window.removeEventListener(responseEventName, responseHandler);
        resolve(event.detail || event);
      };

      // Listen for the response
      window.addEventListener(responseEventName, responseHandler);

      // Set timeout
      timeoutId = setTimeout(() => {
        window.removeEventListener(responseEventName, responseHandler);
        reject(new Error(`Timeout waiting for response to ${eventName}`));
      }, timeout);

      // Send the event to backend
      this.forwardToBackend(eventName, data);
    });
  }
}

// Create global event bus instance
const globalEventBus = new EventBus();

// Add some useful middleware
globalEventBus.use((event) => {
  // Log all events
  console.log(`[EVENT BUS] Event emitted: ${event.name}`, {
    id: event.id,
    timestamp: new Date(event.timestamp).toISOString(),
    data: event.data,
    metadata: event.metadata
  });
});

// Initialize WebUI handlers if available
globalEventBus.initWebUIHandlers();

// Export the event bus
export default globalEventBus;

// Also export as individual functions for convenience
export const { 
  subscribe, 
  subscribeOnce, 
  unsubscribe, 
  emit, 
  use, 
  getHistory, 
  clearHistory, 
  getEventNames, 
  getListenerCount, 
  waitFor,
  forwardToBackend,
  listenFromBackend,
  sendToBackendWithResponse
} = globalEventBus;

// Export types/constants if needed
export const EVENT_TYPES = {
  COUNTER_INCREMENT: 'counter.increment',
  COUNTER_RESET: 'counter.reset',
  COUNTER_VALUE_CHANGED: 'counter.value_changed',
  DATABASE_CONNECTED: 'database.connected',
  DATABASE_DISCONNECTED: 'database.disconnected',
  USERS_FETCHED: 'database.users_fetched',
  USER_ADDED: 'database.user_added',
  USER_UPDATED: 'database.user_updated',
  USER_DELETED: 'database.user_deleted',
  SYSTEM_INFO_REQUESTED: 'system.info_requested',
  SYSTEM_INFO_RECEIVED: 'system.info_received',
  WEBUI_CONNECTED: 'webui.connected',
  WEBUI_READY: 'webui.ready',
  WEBUI_DISCONNECTED: 'webui.disconnected',
  CUSTOM: 'custom'
};

// Export event bus instance for direct access
export { globalEventBus };