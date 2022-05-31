const { addColors, createLogger, format, transports } = require('winston');
require('winston-logstash');
import { getConfigFromEnv } from '../util/config';
import { levels, colors } from './';

export interface LogFn {
  (...args: any[]): void;
}

export interface Logger {
  fatal: LogFn;
  error: LogFn;
  warn: LogFn;
  info: LogFn;
  verbose: LogFn;
  debug: LogFn;
  trace: LogFn;
  log: LogFn;
}

addColors(colors);

export const logger = createLogger({
  exitOnError: false,
  levels,
  format: format.combine(
    format.colorize(),
    format.splat(),
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.printf(
      ({ timestamp, level, message }) => `[${timestamp}] [${level}]: ${message}`
    )
  ),
  transports: [
    new transports.Console({
      level: getConfigFromEnv('LOGGING_LEVEL', 'trace'),
      colorize: true,
      timestamp: true,
      handleExceptions: true
    })
    // new winston.transports.Logstash({
    //   level: 'silly',
    //   port: 28777,
    //   host: 'logs2logs-db',
    //   timeout_connect_retries: 1000, // if we loose connection to logstash, retry in 1 sec
    //   max_connect_retries: 100000, // retry to connect to logstash for 100'000 times
    //   node_name: packageName,
    // }),
  ]
});
