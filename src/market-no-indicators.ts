// src/market.ts
import {Logger} from './logger';
import {toNumberOrUndefined, toBooleanOrUndefined} from './utils';

import {PositionData} from './dto/position';
import {OrderData} from './dto/order';
import {InstrumentInfo} from './dto/instrument';
import {Candle} from "./dto/candle";
import {MarketsConfig} from "./config";

export function mapPositionV5ToPositionData(positionDataRaw: any): PositionData {
    return {
        positionId: positionDataRaw.positionId ?? `${positionDataRaw.symbol ?? ''}_${positionDataRaw.side ?? ''}_${positionDataRaw.positionIdx ?? ''}`,
        positionIdx: toNumberOrUndefined(positionDataRaw.positionIdx),
        tradeMode: toNumberOrUndefined(positionDataRaw.tradeMode),
        riskId: toNumberOrUndefined(positionDataRaw.riskId),
        riskLimitValue: toNumberOrUndefined(positionDataRaw.riskLimitValue),
        symbol: positionDataRaw.symbol ?? '',
        side: ['Buy', 'Sell'].includes(positionDataRaw.side) ? positionDataRaw.side : 'None',
        size: toNumberOrUndefined(positionDataRaw.size),
        entryPrice: positionDataRaw.entryPrice !== undefined && positionDataRaw.entryPrice !== null
            ? Number(positionDataRaw.entryPrice)
            : toNumberOrUndefined(positionDataRaw.avgPrice),
        sessionAvgPrice: toNumberOrUndefined(positionDataRaw.sessionAvgPrice),
        leverage: toNumberOrUndefined(positionDataRaw.leverage),
        positionValue: toNumberOrUndefined(positionDataRaw.positionValue),
        positionBalance: toNumberOrUndefined(positionDataRaw.positionBalance),
        markPrice: toNumberOrUndefined(positionDataRaw.markPrice),
        positionIM: toNumberOrUndefined(positionDataRaw.positionIM),
        positionMM: toNumberOrUndefined(positionDataRaw.positionMM),
        positionIMByMp: toNumberOrUndefined(positionDataRaw.positionIMByMp),
        positionMMByMp: toNumberOrUndefined(positionDataRaw.positionMMByMp),
        takeProfit: toNumberOrUndefined(positionDataRaw.takeProfit),
        stopLoss: toNumberOrUndefined(positionDataRaw.stopLoss),
        trailingStop: toNumberOrUndefined(positionDataRaw.trailingStop),
        unrealisedPnl: toNumberOrUndefined(positionDataRaw.unrealisedPnl),
        cumRealisedPnl: toNumberOrUndefined(positionDataRaw.cumRealisedPnl),
        curRealisedPnl: toNumberOrUndefined(positionDataRaw.curRealisedPnl),
        createdTime: positionDataRaw.createdTime ?? '',
        updatedTime: positionDataRaw.updatedTime ?? '',
        tpslMode: positionDataRaw.tpslMode ?? '',
        liqPrice: toNumberOrUndefined(positionDataRaw.liqPrice),
        bustPrice: toNumberOrUndefined(positionDataRaw.bustPrice),
        category: positionDataRaw.category ?? '',
        positionStatus: positionDataRaw.positionStatus ?? '',
        adlRankIndicator: toNumberOrUndefined(positionDataRaw.adlRankIndicator),
        autoAddMargin: toNumberOrUndefined(positionDataRaw.autoAddMargin),
        leverageSysUpdatedTime: positionDataRaw.leverageSysUpdatedTime ?? '',
        mmrSysUpdatedTime: positionDataRaw.mmrSysUpdatedTime ?? '',
        seq: toNumberOrUndefined(positionDataRaw.seq),
        isReduceOnly: toBooleanOrUndefined(positionDataRaw.isReduceOnly),
    };
}

export class Market {
    readonly symbol: string;

    private positions: Map<string, PositionData> = new Map();
    private orders: Map<string, OrderData> = new Map();

    private candles: Map<string, Candle[]> = new Map();
    private maxCandles;

    private instrumentInfo: InstrumentInfo | null = null;


    constructor(symbol: string) {
        this.symbol = symbol;
        const intervals = MarketsConfig.find(market => market.symbol === symbol)?.tradeIntervals;
        intervals?.forEach(interval => this.candles.set(interval, []));
        this.maxCandles = MarketsConfig.find(market => market.symbol === symbol)?.candleHistoryLimit || 100;
    }

    setInstrumentInfo(info: InstrumentInfo) {
        this.instrumentInfo = info;
        Logger.info(`[${this.symbol}] Instrument info updated:`, {
            contractType: info.contractType,
            status: info.status,
            baseCurrency: info.baseCurrency,
            quoteCurrency: info.quoteCurrency,
            tickSize: info.priceFilter.tickSize,
            maxOrderQty: info.lotSizeFilter.maxOrderQty,
        });
    }

    getInstrumentInfo(): InstrumentInfo | null {
        return this.instrumentInfo;
    }

    updatePositionFromWs(data: PositionData) {
        if (!data || !data.symbol || data.symbol !== this.symbol) return;
        if (!data.positionId) {
            data.positionId = `${data.symbol}_${data.side}`;
        }

        if (data.size !== undefined && data.size > 0) {
            if (data.side === 'Sell') {
                this.positions.set('Sell', data);
            }
            if (data.side === 'Buy') {
                this.positions.set('Buy', data);
            }
            Logger.info(`[${this.symbol}] Position added / updated!, side = ${data.side}, size = ${data.size}`);
        }
        if (data.side === 'None') {
            if (data.positionIdx == 1) {
                this.positions.clear();
            }
            // Buy in hedge mode
            if (data.positionIdx == 1) {
                this.positions.delete('Buy');
            }
            // Sell in hedge mode
            if (data.positionIdx == 2) {
                this.positions.delete('Sell');
            }
            Logger.info(`[${this.symbol}] Position removed / ignored due to side/size`);

        }
    }

    getPositions(): PositionData[] {
        return Array.from(this.positions.values());
    }

    removePosition(positionId: string) {
        this.positions.delete(positionId);
    }

    updateOrderFromWs(data: any) {
        if (!data || !data.symbol || data.symbol !== this.symbol) return;

        const order: OrderData = {
            orderId: data.orderId,
            side: data.side,
            price: Number(data.price),
            qty: Number(data.qty),
            status: data.orderStatus,
            symbol: data.symbol,
            createdTime: Number(data.createdTime),
            updatedTime: Number(data.updatedTime),
        };

        if (order.status === 'Created' || order.status === 'New' || order.status === 'PartiallyFilled' || order.status === 'Untriggered' || order.status === 'Active') {
            this.orders.set(order.orderId, order);
            //Logger.info(`[${this.symbol}] Order ${order.orderId} updated:`, order);
            Logger.info(`[${this.symbol}] Order ${order.orderId} updated,. status ${order.status}`);
        } else {
            this.orders.delete(order.orderId);
            //Logger.info(`[${this.symbol}] Order ${order.orderId} removed or ignored due to tye status = ${order.status}`, order);
            Logger.info(`[${this.symbol}] Order ${order.orderId} removed / ignored due to tye status = ${order.status}`);
        }
    }

    updateOrderFromRest(data: OrderData) {
        if (!data || !data.symbol || data.symbol !== this.symbol) return;
        if (!data.orderId) {
            Logger.warn(`[${this.symbol}] Received order data without orderId`);
            return;
        }
        this.orders.set(data.orderId, data);
        Logger.info(`[${this.symbol}] Order (ID: ${data.orderId}) updated from REST:`, data);
    }

    getOrders(): OrderData[] {
        return Array.from(this.orders.values());
    }

    getActiveOrders(): OrderData[] {
        return this.getOrders().filter(o => o.status === 'New' || o.status === 'PartiallyFilled');
    }

    async loadCandlesFromRest(interval: string, fetchCandles: (symbol: string, interval: string, limit: number) => Promise<Candle[]>) {
        try {
            const recentCandles = await fetchCandles(this.symbol, interval, this.maxCandles);
            const cappedCandles = recentCandles.slice(-this.maxCandles);
            this.candles.set(interval, cappedCandles);
            Logger.info(`[${this.symbol}] Loaded ${cappedCandles.length} candles for interval ${interval} from REST API`);
        } catch (err) {
            Logger.error(`[${this.symbol}] Failed to load candles for interval ${interval}:`, err);
        }
    }

    updateCandleFromWs(interval: string, candleData: any) {
        if (!this.candles.has(interval)) {
            this.candles.set(interval, []);
        }
        const candles = this.candles.get(interval)!;

        const wsCandle: Candle = {
            time: parseInt(candleData.start),
            open: Number(candleData.open),
            high: Number(candleData.high),
            low: Number(candleData.low),
            close: Number(candleData.close),
            volume: Number(candleData.volume),
            turnover: Number(candleData.turnover),
            confirm: candleData.confirm,
            rate: (Number(candleData.close) - Number(candleData.open)) / Number(candleData.open),
        };


        if (candles.length > 0 && candles[0].time === wsCandle.time) {
            candles[0] = wsCandle;
        } else {
            candles.unshift(wsCandle);
            if (candles.length > this.maxCandles) candles.pop();
        }
        this.candles.set(interval, candles);

        Logger.info(`[${this.symbol}] Candle updated for interval ${interval} at ${new Date(wsCandle.time).toISOString()}, closed: ${wsCandle.confirm}`);
    }

    getCandles(interval: string): Candle[] {
        return this.candles.get(interval) ?? [];
    }

    getTickSize(): number | null {
        if (this.instrumentInfo && this.instrumentInfo.priceFilter) {
            return this.instrumentInfo.priceFilter.tickSize;
        }
        return null;
    }

    roundPrice(price: number): number | null {
        const tickSize = this.getTickSize();
        if (!tickSize || tickSize === 0) return null;
        return Math.round(price / tickSize) * tickSize;
    }

    getQtyDecimalPlaces(): number {
        if (!this.instrumentInfo?.lotSizeFilter?.qtyStep) {
            return 0;
        }

        const qtyStep = this.instrumentInfo.lotSizeFilter.qtyStep;

        if (qtyStep <= 0) return 0;

        const qtyStepStr = qtyStep.toFixed(0);

        return qtyStepStr.length;
    }

    roundQty(qty: number): number {
        const decimals = this.getQtyDecimalPlaces();
        if (decimals === 0) return Math.round(qty);
        const factor = Math.pow(10, decimals);
        return Math.floor(qty * factor) / factor;
    }

    printPositionsSummary() {
        const positions = this.getPositions();
        if (positions.length === 0) {
            Logger.info(`[${this.symbol}] Нет открытых позиций для статистики`);
            return;
        }

        const green = '\x1b[32m';
        const red = '\x1b[31m';
        const reset = '\x1b[0m';

        let longPnL = 0;
        let shortPnL = 0;
        let totalPnL = 0;

        Logger.info(`[${this.symbol}] Позиции:`);

        positions.forEach(pos => {
            const pnl = pos.unrealisedPnl ?? 0;

            let pnlStr = pnl.toFixed(2);
            if (pnl > 0) pnlStr = `${green}${pnlStr}${reset}`;
            else if (pnl < 0) pnlStr = `${red}${pnlStr}${reset}`;

            Logger.info(`Символ: ${pos.symbol}, Сторона: ${pos.side}, Размер: ${pos.size}, PnL: ${pnlStr}`);

            if (pos.side === 'Buy') {
                longPnL += pnl;
            } else if (pos.side === 'Sell') {
                shortPnL += pnl;
            }
            totalPnL += pnl;
        });

        function colorize(value: number) {
            if (value > 0) return `${green}${value.toFixed(4)}${reset}`;
            if (value < 0) return `${red}${value.toFixed(4)}${reset}`;
            return value.toFixed(4);
        }

        Logger.info(`Общий uPnL по LONG: ${colorize(longPnL)}`);
        Logger.info(`Общий uPnL по SHORT: ${colorize(shortPnL)}`);
        Logger.info(`ОБщий uPnL: ${colorize(totalPnL)}`);
    }
}
