type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: any;
}

class Logger {
  private static instance: Logger;
  private readonly maxLogs = 100;
  private logs: LogEntry[] = [];
  private isProduction: boolean;

  private constructor() {
    // Detect production environment
    this.isProduction = typeof process !== 'undefined' 
      ? process.env?.NODE_ENV === 'production'
      : false;
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private log(level: LogLevel, message: string, data?: any) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data,
    };

    // In production, suppress debug logs to reduce noise
    if (this.isProduction && level === 'debug') {
      return;
    }

    // Console output for development
    const consoleMethod = level === 'debug' ? 'log' : level;
    if (data) {
      console[consoleMethod](`[${entry.timestamp}] [${level.toUpperCase()}] ${message}`, data);
    } else {
      console[consoleMethod](`[${entry.timestamp}] [${level.toUpperCase()}] ${message}`);
    }

    this.logs.unshift(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.pop();
    }
  }

  public info(message: string, data?: any) {
    this.log('info', message, data);
  }

  public warn(message: string, data?: any) {
    this.log('warn', message, data);
  }

  public error(message: string, data?: any) {
    this.log('error', message, data);
  }

  public debug(message: string, data?: any) {
    this.log('debug', message, data);
  }

  public getLogs(): LogEntry[] {
    return [...this.logs];
  }

  public clearLogs() {
    this.logs = [];
  }
  
  /**
   * Manually set production mode (useful for testing)
   */
  public setProductionMode(isProduction: boolean) {
    this.isProduction = isProduction;
  }
}

export const logger = Logger.getInstance();
