type LogLevel = "debug" | "info" | "warn" | "error";

const logMethod: Record<LogLevel, (...args: unknown[]) => void> = {
  debug: console.debug,
  info: console.info,
  warn: console.warn,
  error: console.error,
};

function formatMessage(category: string, message: string): string {
  return `[${new Date().toISOString()}] [${category}] ${message}`;
}

interface Logger {
  debug: (message: string, ...args: unknown[]) => void;
  info: (message: string, ...args: unknown[]) => void;
  warn: (message: string, ...args: unknown[]) => void;
  error: (message: string, ...args: unknown[]) => void;
}

export function createLogger(category: string): Logger {
  return {
    debug: (message: string, ...args: unknown[]) =>
      logMethod.debug(formatMessage(category, message), ...args),
    info: (message: string, ...args: unknown[]) =>
      logMethod.info(formatMessage(category, message), ...args),
    warn: (message: string, ...args: unknown[]) =>
      logMethod.warn(formatMessage(category, message), ...args),
    error: (message: string, ...args: unknown[]) =>
      logMethod.error(formatMessage(category, message), ...args),
  };
}
