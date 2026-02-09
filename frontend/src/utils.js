// frontend/src/utils.js
// Consolidated frontend utilities

// Enhanced logging service
class Logger {
  constructor() {
    this.logs = [];
    this.maxLogEntries = 1000; // Limit log entries to prevent memory issues
    this.logLevel = 'INFO'; // Default log level
    this.logLevels = {
      'DEBUG': 0,
      'INFO': 1,
      'WARN': 2,
      'ERROR': 3
    };
  }

  // Check if a log level should be logged based on current level
  shouldLog(level) {
    return this.logLevels[level] >= this.logLevels[this.logLevel];
  }

  // Add a log entry
  addLog(level, message, meta = {}) {
    if (!this.shouldLog(level)) return;

    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      meta,
      id: Date.now() + Math.random() // Unique ID for the log entry
    };

    this.logs.push(logEntry);

    // Maintain max log count
    if (this.logs.length > this.maxLogEntries) {
      this.logs = this.logs.slice(-this.maxLogEntries);
    }

    // Output to console
    this.outputToConsole(logEntry);

    // Emit event for React components to react to
    this.emitLogEvent(logEntry);
  }

  // Output log to console with proper formatting
  outputToConsole(entry) {
    const { level, message, timestamp } = entry;
    const formattedMessage = `[${timestamp}] ${level} - ${message}`;

    switch (level) {
      case 'ERROR':
        console.error(formattedMessage);
        break;
      case 'WARN':
        console.warn(formattedMessage);
        break;
      case 'INFO':
        console.info(formattedMessage);
        break;
      case 'DEBUG':
        console.debug(formattedMessage);
        break;
      default:
        console.log(formattedMessage);
    }
  }

  // Emit custom event for React components
  emitLogEvent(entry) {
    const event = new CustomEvent('logEntryAdded', { detail: entry });
    window.dispatchEvent(event);
  }

  // Log methods
  debug(message, meta = {}) {
    this.addLog('DEBUG', message, meta);
  }

  info(message, meta = {}) {
    this.addLog('INFO', message, meta);
  }

  warn(message, meta = {}) {
    this.addLog('WARN', message, meta);
  }

  error(message, meta = {}) {
    this.addLog('ERROR', message, meta);
  }

  // Get all logs
  getLogs() {
    return [...this.logs]; // Return a copy
  }

  // Clear logs
  clearLogs() {
    this.logs = [];
    window.dispatchEvent(new CustomEvent('logsCleared'));
  }

  // Set log level
  setLogLevel(level) {
    if (this.logLevels.hasOwnProperty(level.toUpperCase())) {
      this.logLevel = level.toUpperCase();
      this.info(`Log level set to ${this.logLevel}`);
    } else {
      console.warn(`Invalid log level: ${level}. Valid levels: DEBUG, INFO, WARN, ERROR`);
    }
  }

  // Get current log level
  getLogLevel() {
    return this.logLevel;
  }
}

// WebUI Bridge - provides the bridge between React frontend and Rust backend
class WebUIBridge {
  constructor() {
    this.callbacks = new Map();
    this.nextId = 1;
    this.logger = window.Logger || new Logger();
  }

  // Call a Rust function
  callRustFunction(funcName, data = null) {
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      this.callbacks.set(id, { resolve, reject });

      // Log the function call
      this.logger.info(`Calling Rust function: ${funcName}`, {
        functionName: funcName,
        data: data,
        callId: id
      });

      try {
        // Actual WebUI call to Rust backend
        if (window.__webui__) {
          // Call the Rust function using WebUI
          window.__webui__.call(funcName, JSON.stringify(data || {})).then(result => {
            this.logger.info(`Successfully called Rust function: ${funcName}`, {
              result: result,
              functionName: funcName
            });
            resolve(JSON.parse(result));
          }).catch(error => {
            this.logger.error(`Error calling Rust function ${funcName}: ${error.message}`, {
              functionName: funcName,
              error: error,
              data: data
            });
            reject(error);
          });
        } else {
          // Fallback to simulated behavior if WebUI is not available
          this.logger.warn('WebUI not available, using simulated call', {
            functionName: funcName
          });

          // Simulate different responses based on function name
          switch(funcName) {
            case 'open_folder':
              this.logger.info('Open folder operation completed successfully');
              resolve({
                success: true,
                path: '/home/user/images',
                images: [
                  { path: '/sample/image1.jpg', name: 'image1.jpg' },
                  { path: '/sample/image2.jpg', name: 'image2.jpg' },
                  { path: '/sample/image3.jpg', name: 'image3.jpg' },
                ]
              });
              break;
            case 'organize_images':
              this.logger.info('Images organized successfully');
              resolve({ success: true, message: 'Images organized successfully!' });
              break;
            case 'increment_counter':
              this.logger.debug(`Counter incremented to ${data?.value || 'unknown'}`, {
                value: data?.value,
                functionName: funcName
              });
              resolve({ success: true, value: data?.value || 0 });
              break;
            case 'reset_counter':
              this.logger.debug(`Counter reset to ${data?.value || 'unknown'}`, {
                value: data?.value,
                functionName: funcName
              });
              resolve({ success: true, value: data?.value || 0 });
              break;
            default:
              this.logger.warn(`Unknown function called: ${funcName}`);
              resolve({ success: true });
          }
        }
      } catch (error) {
        this.logger.error(`Error in Rust function call: ${error.message}`, {
          functionName: funcName,
          error: error,
          data: data
        });
        reject(error);
      }
    });
  }

  // Handle responses from Rust (this would be called by the actual webui library)
  handleResponse(response) {
    // This method would be called when Rust sends a response back to the frontend
    this.logger.info('Received response from Rust backend', { response });
  }
}

// Create global instances
window.Logger = new Logger();
window.WebUIBridge = new WebUIBridge();

// Export for use in React components
export { Logger, WebUIBridge };