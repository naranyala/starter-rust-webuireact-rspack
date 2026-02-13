/**
 * Enhanced logging utility for frontend build pipeline
 * Provides structured logging with timestamps, levels, context, colors, and file output
 */

const fs = require('fs');
const path = require('path');

class Colors {
  static reset = '\x1b[0m';
  static bright = '\x1b[1m';
  static dim = '\x1b[2m';
  
  static red = '\x1b[31m';
  static green = '\x1b[32m';
  static yellow = '\x1b[33m';
  static blue = '\x1b[34m';
  static magenta = '\x1b[35m';
  static cyan = '\x1b[36m';
  static white = '\x1b[37m';
  static gray = '\x1b[90m';
  
  static bgRed = '\x1b[41m';
  static bgGreen = '\x1b[42m';
  static bgYellow = '\x1b[43m';
  
  static getLevelColor(level) {
    const colors = {
      trace: Colors.gray,
      debug: Colors.cyan,
      info: Colors.green,
      warn: Colors.yellow,
      error: Colors.red,
    };
    return colors[level.toLowerCase()] || Colors.white;
  }
}

class ProgressBar {
  constructor(total, label = '', width = 30) {
    this.total = total;
    this.current = 0;
    this.label = label;
    this.width = width;
    this.startTime = process.hrtime.bigint();
  }

  update(current, customLabel) {
    this.current = current;
    if (customLabel) this.label = customLabel;
    this.render();
  }

  increment(amount = 1, customLabel) {
    this.current += amount;
    if (customLabel) this.label = customLabel;
    this.render();
  }

  render() {
    const percent = this.total > 0 ? (this.current / this.total) * 100 : 0;
    const filled = Math.round((this.width * this.current) / this.total) || 0;
    const empty = this.width - filled;
    
    const filledStr = '█'.repeat(filled);
    const emptyStr = '░'.repeat(empty);
    
    const elapsed = (Number(process.hrtime.bigint() - this.startTime) / 1e9).toFixed(1);
    const rate = this.current > 0 ? (this.current / elapsed).toFixed(1) : '0';
    
    process.stdout.write(`\r${Colors.cyan}${this.label}${Colors.reset} [${Colors.green}${filledStr}${Colors.gray}${emptyStr}${Colors.reset}] ${Colors.white}${percent.toFixed(1)}%${Colors.reset} (${this.current}/${this.total}) ${Colors.gray}${rate} items/s${Colors.reset}`);
    
    if (this.current >= this.total) {
      process.stdout.write('\n');
    }
  }

  complete(customLabel) {
    this.current = this.total;
    if (customLabel) this.label = customLabel;
    this.render();
  }
}

class BuildLogger {
  constructor(options = {}) {
    this.level = options.level || 'info';
    this.format = options.format || 'text';
    this.includeTimestamp = options.includeTimestamp !== false;
    this.includeLevel = options.includeLevel !== false;
    this.includeModule = options.includeModule !== false;
    this.useColors = options.useColors !== false;
    this.logFile = options.logFile || null;
    this.enableProgressBars = options.enableProgressBars !== false;
    
    this.stats = {
      total: 0,
      errors: 0,
      warnings: 0,
      info: 0,
      debug: 0,
    };
    
    this.levelMap = {
      'trace': 0,
      'debug': 1,
      'info': 2,
      'warn': 3,
      'error': 4,
      'silent': 5
    };
    
    this.currentLogLevel = this.levelMap[this.level.toLowerCase()] || 2;
    
    if (this.logFile) {
      this.initFileLogging();
    }
  }

  initFileLogging() {
    try {
      const logDir = path.dirname(this.logFile);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
    } catch (e) {
      console.error('Failed to initialize log file:', e.message);
    }
  }

  shouldLog(level) {
    const levelNum = this.levelMap[level.toLowerCase()];
    return levelNum !== undefined && levelNum >= this.currentLogLevel;
  }

  createLogEntry(level, message, context = {}, module = '') {
    const entry = {
      timestamp: this.includeTimestamp ? new Date().toISOString() : null,
      level: this.includeLevel ? level.toUpperCase() : null,
      module: this.includeModule && module ? module : null,
      message: typeof message === 'object' ? JSON.stringify(message) : message,
      context: Object.keys(context).length > 0 ? context : undefined,
      pid: process.pid,
      hostname: process.env.HOSTNAME || 'unknown'
    };

    if (!this.includeTimestamp) delete entry.timestamp;
    if (!this.includeLevel) delete entry.level;
    if (!this.includeModule || !module) delete entry.module;

    return entry;
  }

  formatLog(entry) {
    if (this.format === 'json') {
      return JSON.stringify(entry);
    }

    let parts = [];
    
    if (entry.timestamp && this.useColors) {
      parts.push(`${Colors.gray}[${new Date(entry.timestamp).toLocaleString()}]${Colors.reset}`);
    } else if (entry.timestamp) {
      parts.push(`[${new Date(entry.timestamp).toLocaleString()}]`);
    }
    
    if (entry.level) {
      const levelColor = this.useColors ? Colors.getLevelColor(entry.level) : '';
      const levelReset = this.useColors ? Colors.reset : '';
      parts.push(`${levelColor}[${entry.level.padEnd(5)}]${levelReset}`);
    }
    
    if (entry.module) {
      const moduleColor = this.useColors ? Colors.cyan : '';
      const moduleReset = this.useColors ? Colors.reset : '';
      parts.push(`${moduleColor}[${entry.module}]${moduleReset}`);
    }
    
    const msgColor = this.useColors && entry.level === 'ERROR' ? Colors.red : 
                     this.useColors && entry.level === 'WARN' ? Colors.yellow : '';
    const msgReset = msgColor ? Colors.reset : '';
    parts.push(`${msgColor}${entry.message}${msgReset}`);
    
    if (entry.context) {
      const contextStr = Object.entries(entry.context)
        .map(([key, value]) => `${key}=${typeof value === 'object' ? JSON.stringify(value) : value}`)
        .join(' ');
      const ctxColor = this.useColors ? Colors.dim : '';
      const ctxReset = this.useColors ? Colors.reset : '';
      parts.push(`${ctxColor}${contextStr}${ctxReset}`);
    }
    
    return parts.join(' ');
  }

  writeToFile(formatted) {
    if (!this.logFile) return;
    
    try {
      const timestamp = new Date().toISOString();
      fs.appendFileSync(this.logFile, `[${timestamp}] ${formatted}\n`);
    } catch (e) {
      console.error('Failed to write to log file:', e.message);
    }
  }

  log(level, message, context = {}, module = '') {
    if (!this.shouldLog(level)) {
      return;
    }

    this.stats.total++;
    if (level.toLowerCase() === 'error') this.stats.errors++;
    if (level.toLowerCase() === 'warn') this.stats.warnings++;
    if (level.toLowerCase() === 'info') this.stats.info++;
    if (level.toLowerCase() === 'debug') this.stats.debug++;

    const entry = this.createLogEntry(level, message, context, module);
    const formatted = this.formatLog(entry);
    
    this.writeToFile(formatted);
    
    if (level.toLowerCase() === 'error' || level.toLowerCase() === 'warn') {
      console.error(formatted);
    } else {
      console.log(formatted);
    }
  }

  trace(message, context = {}, module = '') {
    this.log('trace', message, context, module);
  }

  debug(message, context = {}, module = '') {
    this.log('debug', message, context, module);
  }

  info(message, context = {}, module = '') {
    this.log('info', message, context, module);
  }

  warn(message, context = {}, module = '') {
    this.log('warn', message, context, module);
  }

  error(message, context = {}, module = '') {
    this.log('error', message, context, module);
  }

  setLevel(level) {
    this.level = level.toLowerCase();
    this.currentLogLevel = this.levelMap[this.level] || 2;
  }

  setFormat(format) {
    this.format = format.toLowerCase();
  }

  child(context, module = '') {
    const childLogger = new BuildLogger({
      level: this.level,
      format: this.format,
      includeTimestamp: this.includeTimestamp,
      includeLevel: this.includeLevel,
      includeModule: this.includeModule,
      useColors: this.useColors,
      logFile: this.logFile,
      enableProgressBars: this.enableProgressBars
    });
    
    const parentLog = childLogger.log.bind(childLogger);
    childLogger.log = (level, message, additionalContext = {}, childModule = '') => {
      const mergedContext = { ...context, ...additionalContext };
      const finalModule = childModule || module;
      parentLog(level, message, mergedContext, finalModule);
    };
    
    return childLogger;
  }

  createProgressBar(total, label) {
    if (!this.enableProgressBars) {
      return {
        update: () => {},
        increment: () => {},
        complete: () => {},
        render: () => {}
      };
    }
    return new ProgressBar(total, label);
  }

  getStats() {
    return { ...this.stats };
  }

  printSummary() {
    const headerColor = this.useColors ? Colors.bright + Colors.white : '';
    const reset = this.useColors ? Colors.reset : '';
    
    console.log('\n' + headerColor + '═'.repeat(50) + reset);
    console.log(headerColor + '  Build Logger Summary' + reset);
    console.log(headerColor + '═'.repeat(50) + reset);
    console.log(`${this.useColors ? Colors.cyan : ''}  Total logs:${reset}    ${this.stats.total}`);
    console.log(`${this.useColors ? Colors.green : ''}  Info:${reset}         ${this.stats.info}`);
    console.log(`${this.useColors ? Colors.yellow : ''}  Warnings:${reset}      ${this.stats.warnings}`);
    console.log(`${this.useColors ? Colors.red : ''}  Errors:${reset}        ${this.stats.errors}`);
    console.log(`${this.useColors ? Colors.gray : ''}  Debug:${reset}        ${this.stats.debug}`);
    console.log(headerColor + '═'.repeat(50) + reset + '\n');
  }
}

class BuildTimer {
  constructor(name, logger) {
    this.name = name;
    this.logger = logger;
    this.startTime = process.hrtime.bigint();
    this.stopped = false;
    this.checkpoints = [];
  }

  checkpoint(label) {
    const now = process.hrtime.bigint();
    const elapsed = Number(now - this.startTime) / 1_000_000;
    this.checkpoints.push({ label, time: elapsed });
    return elapsed;
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
    
    if (this.checkpoints.length > 0) {
      logContext.checkpoints = this.checkpoints;
    }
    
    this.logger.log(level, logMessage, logContext, this.name);
    
    return {
      durationMs,
      checkpoints: this.checkpoints
    };
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

  withContext(context, module = '') {
    return this.child(context, module);
  }

  section(name, callback) {
    const logger = this.child({}, name);
    logger.info(`Starting ${name}`);
    const startTime = process.hrtime.bigint();
    
    try {
      const result = callback(logger);
      const elapsed = (Number(process.hrtime.bigint() - startTime) / 1e6).toFixed(2);
      logger.info(`Completed ${name}`, { duration_ms: elapsed });
      return result;
    } catch (error) {
      const elapsed = (Number(process.hrtime.bigint() - startTime) / 1e6).toFixed(2);
      logger.error(`Failed ${name}`, { error: error.message, duration_ms: elapsed });
      throw error;
    }
  }
}

module.exports = {
  BuildLogger,
  EnhancedBuildLogger,
  BuildTimer,
  ProgressBar,
  Colors
};

const defaultLogger = new EnhancedBuildLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: process.env.LOG_FORMAT || 'text',
  logFile: process.env.LOG_FILE || null,
  useColors: process.env.NO_COLOR ? false : true
});

module.exports.defaultLogger = defaultLogger;
module.exports.buildLog = defaultLogger;
