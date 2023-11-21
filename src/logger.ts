import winston from 'winston';

const commomConfig = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:SSS' }),
  winston.format.metadata({
    fillExcept: ['message', 'level', 'timestamp', 'label']
  })
);

const consoleMessageFormatter = (info: winston.LogEntry): string => {
  let meta = '';

  if (Object.keys(info.metadata).length > 0) {
    meta = ` => ${JSON.stringify(info.metadata)}`;
  }

  return `[pubsub-consumer] ${info.timestamp} -> ${info.message}${meta}`;
};

const consoleConfig = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.printf(consoleMessageFormatter)
);

winston.addColors({
  debug: 'magenta'
});

const transports: winston.transport[] = [
  new winston.transports.Console({
    format: consoleConfig
  })
];

const Logger = winston.createLogger({
  level: 'debug',
  format: commomConfig,
  transports
});

export default Logger;
