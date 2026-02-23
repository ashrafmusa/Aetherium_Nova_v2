import winston from 'winston';
import fs from 'fs';

const { combine, timestamp, printf, colorize } = winston.format;

const myFormat = printf(({ level, message, timestamp }) => {
  return `${timestamp} ${level}: ${message}`;
});

let logger: winston.Logger;

export function initializeLogger() {
  const logDir = 'logs';
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir);
  }

  logger = winston.createLogger({
    level: 'info',
    format: combine(
      colorize(),
      timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      myFormat
    ),
    transports: [
      new winston.transports.Console(),
      new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
      new winston.transports.File({ filename: 'logs/combined.log' }),
    ],
  });
  return logger;
}

const getLogger = () => {
  if (!logger) {
    return initializeLogger();
  }
  return logger;
};

export { getLogger };