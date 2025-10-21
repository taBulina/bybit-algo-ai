// src/trading-bot.ts
import { Market } from './market';
import { BybitApiClient } from './bybit-api-client';
import { Logger } from './logger';
import { roundToStep, sleep } from './utils';
import { Config } from './config';

export interface IndicatorValues {
    EMA: 'up' | 'down' | 'neutral';
    MACD: 'up' | 'down' | 'neutral';
}

export interface MacdTrendChange {
    hasChanged: boolean;
    newTrend: 'up' | 'down' | 'neutral';
}

export class TradingBot {
    private apiClient: BybitApiClient;
    private market: Market;
    private instrumentInfo: any;

    constructor(market: Market, apiClient: BybitApiClient) {
        this.market = market;
        this.apiClient = apiClient;
        this.instrumentInfo = market.getInstrumentInfo();
        if (!this.instrumentInfo) throw new Error('Instrument info required for TradingBot');
    }

    private computeOrderQty(lastPrice: number): number {
        // Максимальное значение позиции для этого символа

        //const maxPosValue = Config.maxPositionValueByMarket[this.market.symbol] || 0;
        const maxPosValue = 10;
        if (maxPosValue <= 0) throw new Error(`Max position value not set for symbol ${this.market.symbol}`);

        // Вычисляем максимально допустимый размер позиции, не превышающий maxPosValue
        const maxQty = maxPosValue / lastPrice;

        // Округляем до шага qty (qtyStep)
        const qtyStep = this.instrumentInfo.lotSizeFilter.qtyStep;
        if (!qtyStep) throw new Error('qtyStep required for order qty rounding');

        const qtyRounded = roundToStep(maxQty, qtyStep);
        if (qtyRounded <= 0) throw new Error('Calculated order qty <= 0 after rounding');

        return qtyRounded;
    }

    allIntervalsSameTrend(indicatorsByInterval: Record<string, IndicatorValues>): boolean {
        let emaTrend: 'up' | 'down' | 'neutral' | null = null;
        let macdTrend: 'up' | 'down' | 'neutral' | null = null;

        for (const interval in indicatorsByInterval) {
            const indicators = indicatorsByInterval[interval];
            if (emaTrend === null) emaTrend = indicators.EMA;
            else if (emaTrend !== indicators.EMA) return false;

            if (macdTrend === null) macdTrend = indicators.MACD;
            else if (macdTrend !== indicators.MACD) return false;
        }
        return true;
    }

    macdTrendChanged(macdChangesByInterval: Record<string, MacdTrendChange>): boolean {
        const m1Change = macdChangesByInterval['1m'] || { hasChanged: false, newTrend: 'neutral' };
        return m1Change.hasChanged && (m1Change.newTrend === 'up' || m1Change.newTrend === 'down');
    }

    // src/trading-bot.ts (фрагмент метода placeEntryOrder с return)
    async placeEntryOrder(
        direction: 'Buy' | 'Sell',
        lastPrice: number,
        qty: number
    ): Promise<string> {
        const tickSize = this.instrumentInfo.priceFilter.tickSize;
        const qtyStep = this.instrumentInfo.lotSizeFilter.qtyStep;
        if (!tickSize || !qtyStep) throw new Error('tickSize and qtyStep required');

        let price: number;
        if (direction === 'Buy') {
            price = lastPrice - 2 * tickSize;
        } else {
            price = lastPrice + 2 * tickSize;
        }
        price = roundToStep(price, tickSize);
        qty = roundToStep(qty, qtyStep);

        const stopLossPct = Config.stopLossPct;
        const trailingStopPct = Config.trailingStopPct;
        const takeProfitsPct = Config.takeProfitsPct;

        const stopLossPrice = direction === 'Buy'
            ? roundToStep(price * (1 - stopLossPct), tickSize)
            : roundToStep(price * (1 + stopLossPct), tickSize);

        const takeProfitPrices = takeProfitsPct.map(pct => (
            direction === 'Buy'
                ? roundToStep(price * (1 + pct), tickSize)
                : roundToStep(price * (1 - pct), tickSize)
        ));

        const trailingStop = trailingStopPct;

        Logger.info(`Placing ${direction} limit postOnly order with price ${price}, qty ${qty}`);

        const timeoutMs = Config.orderTimeoutMs;
        const maxRetries = Config.orderRetryCount;

        let remainingQty = qty;
        let orderId: string | null = null;

        for (let attempt = 1; attempt <= maxRetries && remainingQty > 0; attempt++) {
            try {
                const result = await this.apiClient.placeLimitOrder({
                    symbol: this.market.symbol,
                    side: direction,
                    price: price.toFixed(8),
                    qty: remainingQty.toFixed(8),
                    timeInForce: 'PostOnly',
                });

                orderId = result.orderId;

                Logger.info(`Order placed: ${orderId}, waiting for execution...`);

                let executedQty = 0;
                const start = Date.now();
                while ((Date.now() - start) < timeoutMs) {
                    const orders = this.market.getOrders().filter(o => o.orderId === orderId);
                    if (!orders.length) break;
                    const order = orders[0];
                    executedQty = qty - Number(order.qty);
                    if (executedQty >= remainingQty) break;
                    await sleep(500);
                }

                remainingQty -= executedQty;

                Logger.info(`Order ${orderId} executed qty: ${executedQty}, remaining qty: ${remainingQty}`);

                if (remainingQty > 0) {
                    if (remainingQty < qtyStep) {
                        Logger.info(`Remaining qty ${remainingQty} below minimum qtyStep ${qtyStep}, stopping retries`);
                        break;
                    }
                    Logger.info(`Retry #${attempt}: re-placing order with remaining qty ${remainingQty}`);
                }
            } catch (error) {
                Logger.error(`Order attempt #${attempt} failed`, error);
            }
        }

        if (!orderId) throw new Error('Failed to place order after retries');

        return orderId;
    }


    async checkAndPlaceOrder(
        indicatorsByInterval: Record<string, IndicatorValues>,
        macdChangesByInterval: Record<string, MacdTrendChange>,
        lastPrice: number,
    ) {
        if(!this.allIntervalsSameTrend(indicatorsByInterval)) {
            Logger.info('Indicators EMA and MACD differ between intervals, no order placed');
            return;
        }
        if(!this.macdTrendChanged(macdChangesByInterval)) {
            Logger.info('MACD trend for 1-minute interval did not change, no order placed');
            return;
        }

        const direction = macdChangesByInterval['1m'].newTrend === 'up' ? 'Buy' : 'Sell';

        const qty = this.computeOrderQty(lastPrice);

        Logger.info(`Detected trend change on MACD for 1m: placing a ${direction} order with qty ${qty}`);

        await this.placeEntryOrder(direction, lastPrice, qty);
    }
}
