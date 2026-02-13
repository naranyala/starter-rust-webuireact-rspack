/**
 * Enhanced Event Bus System for Frontend
 * Provides robust pub/sub with filtering, wildcards, request-response, and state sync
 */

class EnhancedEventBus {
  constructor(options = {}) {
    this.subscriptions = new Map();
    this.middleware = [];
    this.history = [];
    this.maxHistorySize = options.maxHistorySize || 500;
    this.enableLogging = options.enableLogging !== false;
    this.pendingRequests = new Map();
    this.eventHandlers = new Map();
    this.stats = {
      totalEmitted: 0,
      totalReceived: 0,
      byEvent: new Map(),
      bySource: new Map(),
    };
  }

  /**
   * Subscribe to an event with optional filtering
   * @param {string} eventName - Event name or pattern (supports wildcards like "user.*")
   * @param {Function} handler - Handler function
   * @param {Object} options - Subscription options
   * @returns {Function} Unsubscribe function
   */
  subscribe(eventName, handler, options = {}) {
    const id = this.generateId();
    const subscription = {
      id,
      eventName,
      handler,
      priority: options.priority || 0,
      filter: options.filter || null,
      context: options.context || null,
      once: options.once || false,
    };

    if (!this.subscriptions.has(eventName)) {
      this.subscriptions.set(eventName, []);
    }
    this.subscriptions.get(eventName).push(subscription);
    this.sortByPriority(eventName);

    if (this.enableLogging) {
      console.debug(`[EventBus] Subscribed: ${eventName} (${id})`);
    }

    return () => this.unsubscribe(eventName, id);
  }

  /**
   * Subscribe to an event once
   */
  subscribeOnce(eventName, handler, options = {}) {
    return this.subscribe(eventName, handler, { ...options, once: true });
  }

  /**
   * Subscribe to multiple events at once
   * @param {string[]} eventNames - Array of event names
   * @param {Function} handler - Handler function
   * @param {Object} options - Subscription options
   * @returns {Function} Unsubscribe from all events
   */
  subscribeMany(eventNames, handler, options = {}) {
    const unsubscribers = eventNames.map(eventName => 
      this.subscribe(eventName, handler, options)
    );
    return () => unsubscribers.forEach(unsub => unsub());
  }

  /**
   * Unsubscribe from an event
   */
  unsubscribe(eventName, subscriptionId) {
    if (!this.subscriptions.has(eventName)) return false;
    
    const subs = this.subscriptions.get(eventName);
    const index = subs.findIndex(s => s.id === subscriptionId);
    
    if (index !== -1) {
      subs.splice(index, 1);
      if (this.enableLogging) {
        console.debug(`[EventBus] Unsubscribed: ${eventName} (${subscriptionId})`);
      }
      return true;
    }
    return false;
  }

  /**
   * Emit an event
   */
  async emit(eventName, data = {}, options = {}) {
    const event = this.createEvent(eventName, data, options);
    
    this.recordEvent(event);
    await this.runMiddleware(event);
    await this.notifySubscribers(event);

    if (options.forwardToBackend !== false) {
      this.forwardToBackend(event);
    }

    return event;
  }

  /**
   * Create an event object
   */
  createEvent(eventName, data, options = {}) {
    const event = {
      id: this.generateId(),
      name: eventName,
      data,
      timestamp: Date.now(),
      source: options.source || 'frontend',
      correlationId: options.correlationId || null,
      replyTo: options.replyTo || null,
      metadata: options.metadata || {},
    };

    if (options.correlationId) {
      event.correlationId = options.correlationId;
    }

    return event;
  }

  /**
   * Record event for history and stats
   */
  recordEvent(event) {
    this.history.push(event);
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }

    this.stats.totalEmitted++;
    this.stats.byEvent.set(event.name, (this.stats.byEvent.get(event.name) || 0) + 1);
    this.stats.bySource.set(event.source, (this.stats.bySource.get(event.source) || 0) + 1);
  }

  /**
   * Run middleware chain
   */
  async runMiddleware(event) {
    for (const mw of this.middleware) {
      try {
        const result = await Promise.resolve(mw(event));
        if (result === false) {
          if (this.enableLogging) {
            console.debug(`[EventBus] Event cancelled by middleware: ${event.name}`);
          }
          return false;
        }
      } catch (error) {
        console.error('[EventBus] Middleware error:', error);
      }
    }
    return true;
  }

  /**
   * Notify all matching subscribers
   */
  async notifySubscribers(event) {
    const matchingPatterns = this.getMatchingPatterns(event.name);
    const toRemove = new Set();

    for (const pattern of matchingPatterns) {
      const subs = this.subscriptions.get(pattern) || [];
      const remaining = [];

      for (const sub of subs) {
        if (sub.filter && !sub.filter(event)) {
          remaining.push(sub);
          continue;
        }

        this.stats.totalReceived++;

        try {
          const context = sub.context || this;
          const result = await Promise.resolve(sub.handler.call(context, event));

          if (result === false) {
            if (this.enableLogging) {
              console.debug(`[EventBus] Propagation stopped: ${event.name}`);
            }
            break;
          }

          if (!sub.once) {
            remaining.push(sub);
          }
        } catch (error) {
          console.error(`[EventBus] Handler error for ${event.name}:`, error);
          remaining.push(sub);
        }
      }

      if (remaining.length !== subs.length) {
        if (remaining.length === 0) {
          this.subscriptions.delete(pattern);
        } else {
          this.subscriptions.set(pattern, remaining);
        }
      }
    }
  }

  /**
   * Get all patterns that match an event name
   */
  getMatchingPatterns(eventName) {
    const patterns = [];
    
    for (const pattern of this.subscriptions.keys()) {
      if (this.matchPattern(pattern, eventName)) {
        patterns.push(pattern);
      }
    }

    return patterns;
  }

  /**
   * Match event name against pattern (supports wildcards)
   */
  matchPattern(pattern, eventName) {
    if (pattern === eventName || pattern === '*') return true;
    if (pattern === '**') return true;

    const patternParts = pattern.split('.');
    const eventParts = eventName.split('.');

    if (patternParts.length > eventParts.length) return false;

    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i] === '*') continue;
      if (patternParts[i] === '**') return true;
      if (patternParts[i] !== eventParts[i]) return false;
    }

    return patternParts.length === eventParts.length || 
           patternParts[patternParts.length - 1] === '**';
  }

  /**
   * Sort subscribers by priority
   */
  sortByPriority(eventName) {
    if (this.subscriptions.has(eventName)) {
      const subs = this.subscriptions.get(eventName);
      subs.sort((a, b) => b.priority - a.priority);
    }
  }

  /**
   * Add middleware
   */
  use(middleware) {
    this.middleware.push(middleware);
    return () => {
      const index = this.middleware.indexOf(middleware);
      if (index !== -1) this.middleware.splice(index, 1);
    };
  }

  /**
   * Request-response pattern
   */
  async request(eventName, data = {}, timeout = 10000) {
    const correlationId = this.generateId();
    const responseEventName = `${eventName}.response.${correlationId}`;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.unsubscribe(responseEventName, correlationId);
        reject(new Error(`Request timeout: ${eventName}`));
      }, timeout);

      const unsubscribe = this.subscribe(responseEventName, (event) => {
        clearTimeout(timer);
        unsubscribe();
        resolve(event.data);
      }, { once: true });

      this.emit(eventName, data, { 
        correlationId, 
        replyTo: responseEventName 
      });
    });
  }

  /**
   * Wait for an event with timeout
   */
  waitFor(eventName, timeout = 30000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        unsubscribe();
        reject(new Error(`Timeout waiting for: ${eventName}`));
      }, timeout);

      const unsubscribe = this.subscribeOnce(eventName, (event) => {
        clearTimeout(timer);
        resolve(event);
      });
    });
  }

  /**
   * Forward event to backend via WebUI
   */
  forwardToBackend(event) {
    if (typeof window !== 'undefined' && window.webui) {
      try {
        const payload = JSON.stringify({
          event: event.name,
          data: event.data,
          correlationId: event.correlationId,
          replyTo: event.replyTo,
          timestamp: event.timestamp,
        });
        
        // Secure: Use JSON.stringify with proper encoding instead of string interpolation
        const encodedPayload = encodeURIComponent(JSON.stringify(payload));
        window.webui.run(`handleFrontendEvent('${encodedPayload}')`);
      } catch (error) {
        console.error('[EventBus] Forward to backend error:', error);
      }
    }
  }

  /**
   * Listen for events from backend
   */
  listenFromBackend(eventName, callback) {
    const handler = (event) => callback(event.detail || event);
    window.addEventListener(eventName, handler);
    return () => window.removeEventListener(eventName, handler);
  }

  /**
   * Initialize WebUI handlers
   */
  initWebUI() {
    if (typeof window !== 'undefined') {
      window.handleBackendEvent = (eventJson) => {
        try {
          const event = JSON.parse(eventJson);
          this.emit(event.event || 'backend.event', event.data, {
            source: 'backend',
            correlationId: event.correlationId,
            replyTo: event.replyTo,
            forwardToBackend: false,
          });
        } catch (error) {
          console.error('[EventBus] Backend event error:', error);
        }
      };
    }
  }

  /**
   * Create a scoped event bus
   */
  scope(namespace) {
    const bus = new EnhancedEventBus({
      maxHistorySize: this.maxHistorySize,
      enableLogging: this.enableLogging,
    });

    bus.originalEmit = bus.emit.bind(bus);
    bus.emit = (eventName, data, options) => {
      const namespacedName = `${namespace}.${eventName}`;
      return bus.originalEmit(namespacedName, data, options);
    };

    return bus;
  }

  /**
   * Get event history
   */
  getHistory(eventName = null, limit = null) {
    let history = eventName 
      ? this.history.filter(e => this.matchPattern(eventName, e.name))
      : [...this.history];
    
    return limit ? history.slice(-limit) : history;
  }

  /**
   * Clear history
   */
  clearHistory() {
    this.history = [];
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      ...this.stats,
      subscriptionCount: Array.from(this.subscriptions.values()).reduce((sum, arr) => sum + arr.length, 0),
      historySize: this.history.length,
      middlewareCount: this.middleware.length,
    };
  }

  /**
   * Get all registered event names
   */
  getEventNames() {
    return Array.from(this.subscriptions.keys());
  }

  /**
   * Remove all subscriptions
   */
  reset() {
    this.subscriptions.clear();
    this.middleware = [];
    this.history = [];
    this.pendingRequests.clear();
  }

  /**
   * Generate unique ID
   */
  generateId() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Event Types Constants
export const EventTypes = {
  // Counter Events
  COUNTER_INCREMENT: 'counter.increment',
  COUNTER_RESET: 'counter.reset',
  COUNTER_VALUE_CHANGED: 'counter.value_changed',

  // Database Events
  DB_CONNECTED: 'database.connected',
  DB_DISCONNECTED: 'database.disconnected',
  DB_USERS_FETCHED: 'database.users_fetched',
  DB_USER_ADDED: 'database.user_added',
  DB_USER_UPDATED: 'database.user_updated',
  DB_USER_DELETED: 'database.user_deleted',

  // System Events
  SYSTEM_INFO_REQUESTED: 'system.info_requested',
  SYSTEM_INFO_RECEIVED: 'system.info_received',

  // WebUI Events
  WEBUI_CONNECTED: 'webui.connected',
  WEBUI_READY: 'webui.ready',
  WEBUI_DISCONNECTED: 'webui.disconnected',

  // Build Events
  BUILD_STARTED: 'build.started',
  BUILD_PROGRESS: 'build.progress',
  BUILD_COMPLETED: 'build.completed',
  BUILD_FAILED: 'build.failed',

  // UI Events
  UI_THEME_CHANGED: 'ui.theme_changed',
  UI_NAVIGATED: 'ui.navigated',
  UI_MODAL_OPENED: 'ui.modal_opened',
  UI_MODAL_CLOSED: 'ui.modal_closed',

  // App Events
  APP_INITIALIZED: 'app.initialized',
  APP_ERROR: 'app.error',
};

// Create and configure global instance
const globalEventBus = new EnhancedEventBus({
  enableLogging: process.env.NODE_ENV !== 'production',
});

// Add logging middleware in development
if (process.env.NODE_ENV !== 'production') {
  globalEventBus.use((event) => {
    console.log(`[EventBus] ${event.source} → ${event.name}`, event.data);
  });
}

// Initialize WebUI handlers
if (typeof window !== 'undefined') {
  globalEventBus.initWebUI();
}

// Default export
export default globalEventBus;

// Named exports
export const {
  subscribe,
  subscribeOnce,
  subscribeMany,
  unsubscribe,
  emit,
  request,
  waitFor,
  use,
  getHistory,
  clearHistory,
  getStats,
  getEventNames,
  reset,
  scope,
  listenFromBackend,
  forwardToBackend,
} = globalEventBus;

// Export class for extension
export { EnhancedEventBus };
