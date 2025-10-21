const winston = require('winston');

var myFormat = winston.format.combine(
    winston.format.timestamp({format: 'YYYY-MM-DD HH:mm:ss.SSS'}),
    winston.format.printf((info: any) => {
        return JSON.stringify({timestamp: info.timestamp,
            level: info.level,
            message: info.message});
    }));

export const log = winston.createLogger({
    //level: 'info',
    //format: winston.format.json(),
    format: myFormat,
    transports: [
        new winston.transports.Console({
            level: 'info'
        }),

        new winston.transports.File({
            filename: 'logs/info.log',
            level: 'info'
        }),
        new winston.transports.File({
            filename: 'logs/trading.log',
            level: 'warn'
        }),
        new winston.transports.File({
            filename: 'logs/errors.log',
            level: 'error'
        })
    ]
});