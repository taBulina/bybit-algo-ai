// src/config.ts

export interface MacdConfig {
    fastPeriod: number;
    slowPeriod: number;
    signalPeriod: number;
    simpleMA: boolean;
    maxSize: number;
}

export interface EmaConfig {
    period: number;
    maxSize: number;
}

export interface MaCrossConfig {
    shortPeriod: number;
    longPeriod: number;
    maxSize: number;
}

export interface MarketConfig {
    symbol: string;
    orderQuantity: number;
    stopLossPercent: number;
    trailingStopPercent: number;
    takeProfitPercents: number[];
    tradeIntervals: string[];
    candleHistoryLimit: number;
    candleInitLimit: number;
    maxRetries: number;
    retryDelayMs: number;
    limitOrderPriceTickOffset: number;
    takeProfitPortions: number[];

    macdConfig: MacdConfig;
    emaConfig: EmaConfig;
    maCrossConfig: MaCrossConfig;
}


export const MarketsConfig: MarketConfig[] = [
    {
        symbol: 'XRPUSDT',
        orderQuantity: 1,
        stopLossPercent: 0.01,
        trailingStopPercent: 0.015,
        takeProfitPercents: [0.01, 0.02, 0.03],
        tradeIntervals: ['1', '5', '15'],
        candleHistoryLimit: 20,
        candleInitLimit: 20,
        maxRetries: 10,
        retryDelayMs: 5000,
        limitOrderPriceTickOffset: 2,
        takeProfitPortions: [0.33, 0.33, 0.34],

        macdConfig: {
            fastPeriod: 12,
            slowPeriod: 26,
            signalPeriod: 9,
            simpleMA: false,
            maxSize: 1000,
        },
        emaConfig: {
            period: 14,
            maxSize: 1000,
        },
        maCrossConfig: {
            shortPeriod: 7,
            longPeriod: 21,
            maxSize: 1000,
        }
    }
];


// src/config.ts
export const Config = {
    stopLossPct: 0.01,        // 1%
    trailingStopPct: 0.015,   // 1.5%
    takeProfitsPct: [0.01, 0.02, 0.03], // 1%, 2%, 3%
    orderTimeoutMs: 5000,     // время ожидания исполнения ордера в мс
    orderRetryCount: 10,      // кол-во попыток переставить ордер
    maxPositionValueByMarket: {
        'XRPUSDT': 10,
        'WIFUSDT': 10,
    }
};


// Новый параметр - интервал вывода статистики в минутах
export const StatisticsIntervalMinutes = 1;

export const RestClientTestnet = false;
export const WsClientTestnet = false;
