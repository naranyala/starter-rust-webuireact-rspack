/**
 * Enhanced logging utility for frontend build pipeline
 * Provides structured logging with timestamps, levels, and context
 */

class BuildLogger {
  constructor(options = {}) {
    this.level = options.level || 'info';
    this.format = options.format || 'text'; // 'text' or 'json'
    this.includeTimestamp = options.includeTimestamp !== false;
    this.includeLevel = options.includeLevel !== false;
    this.includeModule = options.includeModule !== false;
    
    // Map log levels to numbers for comparison
    this.levelMap = {
      'trace': 0,
      'debug': 1,
      'info': 2,
      'warn': 3,
      'error': 4,
      'silent': 5
    };
    
    this.currentLogLevel = this.levelMap[this.level.toLowerCase()] || 2;
  }

  /**
   * Check if a log level should be printed based on current level
   */
  shouldLog(level) {
    const levelNum = this.levelMap[level.toLowerCase()];
    return levelNum !== undefined && levelNum >= this.currentLogLevel;
  }

  /**
   * Create a log entry object
   */
  createLogEntry(level, message, context = {}, module = '') {
    const entry = {
      timestamp: this.includeTimestamp ? new Date().toISOString() : null,
      level: this.includeLevel ? level.toUpperCase() : null,
      module: this.includeModule && module ? module : null,
      message: typeof message === 'object' ? JSON.stringify(message) : message,
      context: Object.keys(context).length > 0 ? context : undefined,
      pid: process.pid,
      hostname: typeof process.env.HOSTNAME !== 'undefined' ? process.env.HOSTNAME : 'unknown'
    };

    // Remove null values if not included
    if (!this.includeTimestamp) delete entry.timestamp;
    if (!this.includeLevel) delete entry.level;
    if (!this.includeModule || !module) delete entry.module;

    return entry;
  }

  /**
   * Format log entry based on selected format
   */
  formatLog(entry) {
    if (this.format === 'json') {
      return JSON.stringify(entry);
    } else {
      // Text format
      let parts = [];
      
      if (entry.timestamp) {
        parts.push(`[${new Date(entry.timestamp).toLocaleString()}]`);
      }
      
      if (entry.level) {
        parts.push(`[${entry.level.padEnd(5)}]`);
      }
      
      if (entry.module) {
        parts.push(`[${entry.module}]`);
      }
      
      parts.push(entry.message);
      
      if (entry.context) {
        const contextStr = Object.entries(entry.context)
          .map(([key, value]) => `${key}=${typeof value === 'object' ? JSON.stringify(value) : value}`)
          .join(' ');
        parts.push(contextStr);
      }
      
      return parts.join(' ');
    }
  }

  /**
   * Log a message with specified level
   */
  log(level, message, context = {}, module = '') {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry = this.createLogEntry(level, message, context, module);
    const formatted = this.formatLog(entry);
    
    if (level.toLowerCase() === 'error' || level.toLowerCase() === 'warn') {
      console.error(formatted);
    } else {
      console.log(formatted);
    }
  }

  /**
   * Trace level logging
   */
  trace(message, context = {}, module = '') {
    this.log('trace', message, context, module);
  }

  /**
   * Debug level logging
   */
  debug(message, context = {}, module = '') {
    this.log('debug', message, context, module);
  }

  /**
   * Info level logging
   */
  info(message, context = {}, module = '') {
    this.log('info', message, context, module);
  }

  /**
   * Warning level logging
   */
  warn(message, context = {}, module = '') {
    this.log('warn', message, context, module);
  }

  /**
   * Error level logging
   */
  error(message, context = {}, module = '') {
    this.log('error', message, context, module);
  }

  /**
   * Set log level
   */
  setLevel(level) {
    this.level = level.toLowerCase();
    this.currentLogLevel = this.levelMap[this.level] || 2;
  }

  /**
   * Set format (text or json)
   */
  setFormat(format) {
    this.format = format.toLowerCase();
  }

  /**
   * Create a child logger with additional context
   */
  child(context, module = '') {
    const childLogger = new BuildLogger({
      level: this.level,
      format: this.format,
      includeTimestamp: this.includeTimestamp,
      includeLevel: this.includeLevel,
      includeModule: this.includeModule
    });
    
    // Override log method to merge parent context
    const parentLog = childLogger.log.bind(childLogger);
    childLogger.log = (level, message, additionalContext = {}, childModule = '') => {
      const mergedContext = { ...context, ...additionalContext };
      const finalModule = childModule || module;
      parentLog(level, message, mergedContext, finalModule);
    };
    
    return childLogger;
  }
}

/**
 * Timer utility for measuring build step durations
 */
class BuildTimer {
  constructor(name, logger) {
    this.name = name;
    this.logger = logger;
    this.startTime = process.hrtime.bigint();
    this.stopped = false;
  }

  stop(level = 'info', message = '', context = {}) {
    if (this.stopped) return;
    
    this.stopped = true;
    const endTime = process.hrtime.bigint();
    const durationNs = endTime - this.startTime;
    const durationMs = Number(durationNs) / 1_000_000;
    
    const logMessage = message || `Completed ${this.name}`;
    const logContext = {
      ...context,
      duration_ms: durationMs.toFixed(2),
      duration_ns: durationNs.toString()
    };
    
    this.logger.log(level, logMessage, logContext, this.name);
  }

  async measure(asyncFn, level = 'info', message = '', context = {}) {
    try {
      const result = await asyncFn();
      this.stop(level, message, context);
      return result;
    } catch (error) {
      this.stop('error', `Error in ${this.name}: ${error.message}`, { error: error.message });
      throw error;
    }
  }
}

/**
 * Enhanced build logger with timer support
 */
class EnhancedBuildLogger extends BuildLogger {
  startTimer(name) {
    return new BuildTimer(name, this);
  }

  async timedOperation(name, operation, level = 'info', context = {}) {
    const timer = this.startTimer(name);
    try {
      const result = await operation();
      timer.stop(level, `Completed ${name}`, context);
      return result;
    } catch (error) {
      timer.stop('error', `Failed ${name}: ${error.message}`, { error: error.message });
      throw error;
    }
  }
}

// Export the logger classes
module.exports = {
  BuildLogger,
  EnhancedBuildLogger,
  BuildTimer
};

// Create a default instance
const defaultLogger = new EnhancedBuildLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: process.env.LOG_FORMAT || 'text'
});

module.exports.defaultLogger = defaultLogger;
module.exports.buildLog = defaultLogger;