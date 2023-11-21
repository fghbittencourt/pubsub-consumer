import * as pino from 'pino';

const logger = pino.default({
  name: process.env.APP_ID ?? 'pubSubConsumer',
  level: process.env.LOG_LEVEL ?? 'debug'
});

export default logger;
