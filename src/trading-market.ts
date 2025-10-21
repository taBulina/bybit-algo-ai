// src/trading-market.ts
import { BybitApiClient } from './bybit-api-client';
import { Logger } from './logger';
import { MarketConfig, MarketConfig } from './config';
import { MACD, EMA } from 'technicalindicators';

export class TradingMarket {
    private indicators = new Map<string, { macd: MACD, emaFast: EMA, emaSlow: EMA }>();
    private lastPrice: number | null = null;
    private inTrade = false;
    private previousTrend: 'bullish' | 'bearish' | 'neutral' = 'neutral';
    private config: MarketConfig;

    constructor(private api: BybitApiClient, config: MarketConfig) {
        this.config = config;
        for (const interval of this.config.tradeIntervals) {
            this.indicators.set(interval, {
                macd: new MACD(),
                emaFast: new EMA(),
                emaSlow: new EMA(),
            });
        }
    }

    setLastPrice(price: number) {
        this.lastPrice = price;
    }

    handlePrivateWsUpdate(data: any) {
        if (data.topic.startsWith('order')) Logger.info('Order update:', data.data);
        if (data.topic.startsWith('position')) Logger.info('Position update:', data.data);
    }

    analyzeCandle(interval: string, close: number) {
        // Логика расчёта и торговли по индикаторам (MACD, EMA) в зависимости от таймфрейма и стратегии
    }
}
