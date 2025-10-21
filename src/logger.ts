// src/logger.ts
import { createLogger, format, transports } from 'winston';
import path from 'path';

const logFile = path.join(process.cwd(), 'trading.log');

const logger = createLogger({
    level: 'info',
    format: format.combine(
        format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        format.printf(({ timestamp, level, message, ...meta }) => {
            const metaString = Object.keys(meta).length ? JSON.stringify(meta) : '';
            return `${timestamp} [${level.toUpperCase()}]: ${message} ${metaString}`;
        })
    ),
    transports: [
        new transports.Console(),
        new transports.File({ filename: logFile, maxsize: 10485760 }),
    ],
});

export const Logger = {
    info: (msg: string, ...args: any[]) => logger.info(msg, ...args),
    warn: (msg: string, ...args: any[]) => logger.warn(msg, ...args),
    error: (msg: string, ...args: any[]) => logger.error(msg, ...args),
};
