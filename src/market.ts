import {PositionData} from './dto/position';
import {OrderData} from './dto/order';
import {InstrumentInfo} from './dto/instrument';
import {Candle} from './dto/candle';

import {MarketConfig, MarketsConfig} from './config';

import {MacdIndicator} from './indicators/macd-indicator';
import {MultiPeriodEma} from './indicators/ema-indicator';
import {MultiPeriodMaCross} from './indicators/ma-cross-indicator';
import {CandlesIndicator} from './indicators/candles';
import {IndicatorsManager} from './indicators-manager';
import {Interval, toIntervalArray} from './dto/interval';
import {Logger} from "./logger";
import {config} from "winston";


/**
 * Преобразует данные позиции из Bybit API в локальную модель PositionData
 * с обязательными проверками.
 */
export function mapPositionV5ToPositionData(rawPos: any): PositionData {
    const requiredFields = [
        'positionIdx', 'tradeMode', 'riskId', 'riskLimitValue', 'symbol', 'side', 'size',
        'sessionAvgPrice', 'leverage', 'positionValue', 'positionBalance', 'markPrice', 'positionIM', 'positionMM',
        'positionIMByMp', 'positionMMByMp', 'takeProfit', 'stopLoss', 'trailingStop', 'unrealisedPnl', 'cumRealisedPnl',
        'curRealisedPnl', 'createdTime', 'updatedTime', 'tpslMode', 'liqPrice', 'bustPrice', 'positionStatus',
        'adlRankIndicator', 'autoAddMargin', 'leverageSysUpdatedTime', 'mmrSysUpdatedTime', 'seq', 'isReduceOnly'
    ];

    for (const field of requiredFields) {
        if (!(field in rawPos)) {
            throw new Error(`Неполное поле данных позиции: ${field}`);
        }
    }

    return {
        positionId: String(rawPos.positionId),
        positionIdx: Number(rawPos.positionIdx),
        tradeMode: Number(rawPos.tradeMode),
        riskId: Number(rawPos.riskId),
        riskLimitValue: Number(rawPos.riskLimitValue),
        symbol: String(rawPos.symbol),
        side: rawPos.side as 'Buy' | 'Sell' | 'None',
        size: Number(rawPos.size),
        entryPrice: Number(rawPos.entryPrice),
        sessionAvgPrice: Number(rawPos.sessionAvgPrice),
        leverage: Number(rawPos.leverage),
        positionValue: Number(rawPos.positionValue),
        positionBalance: Number(rawPos.positionBalance),
        markPrice: Number(rawPos.markPrice),
        positionIM: Number(rawPos.positionIM),
        positionMM: Number(rawPos.positionMM),
        positionIMByMp: Number(rawPos.positionIMByMp),
        positionMMByMp: Number(rawPos.positionMMByMp),
        takeProfit: Number(rawPos.takeProfit),
        stopLoss: Number(rawPos.stopLoss),
        trailingStop: Number(rawPos.trailingStop),
        unrealisedPnl: Number(rawPos.unrealisedPnl),
        cumRealisedPnl: Number(rawPos.cumRealisedPnl),
        curRealisedPnl: Number(rawPos.curRealisedPnl),
        createdTime: String(rawPos.createdTime),
        updatedTime: String(rawPos.updatedTime),
        tpslMode: String(rawPos.tpslMode),
        liqPrice: Number(rawPos.liqPrice),
        bustPrice: Number(rawPos.bustPrice),
        category: String(rawPos.category),
        positionStatus: String(rawPos.positionStatus),
        adlRankIndicator: Number(rawPos.adlRankIndicator),
        autoAddMargin: Number(rawPos.autoAddMargin),
        leverageSysUpdatedTime: String(rawPos.leverageSysUpdatedTime),
        mmrSysUpdatedTime: String(rawPos.mmrSysUpdatedTime),
        seq: Number(rawPos.seq),
        isReduceOnly: Boolean(rawPos.isReduceOnly),
    };
}

/**
 * Основной класс рынка с управлением свечами, позициями, ордерами и индикаторами.
 */

export class Market {
    readonly symbol: string;
    private instrumentInfo: InstrumentInfo | undefined = undefined;

    private positions: Map<string, PositionData> = new Map();

    private orders: Map<string, OrderData> = new Map();

    // Индикаторный менеджер для всех индикаторов и периодов
    private indicatorsManager = new IndicatorsManager();

    private candlesIndicators: Map<string, CandlesIndicator> = new Map();

    private intervals: Interval[];

    private candleHistoryLimit: number;

    private candleInitLimit: number;

    constructor(config: MarketConfig) {
        if (!config) throw new Error(`No config for market initialization`);

        this.symbol = config.symbol;

        this.intervals = toIntervalArray(config.tradeIntervals);

        if (!this.intervals || this.intervals.length == 0) {
            throw new Error('Входной массив интервалов не может быть пустым');
        }

        this.candleHistoryLimit = config.candleHistoryLimit;
        if (!this.candleHistoryLimit || this.candleHistoryLimit < 0) {
            throw new Error('Количество хранящихся свечей не может быть меньше 0');
        }

        this.candleInitLimit = config.candleInitLimit;
        if (!this.candleInitLimit || this.candleInitLimit < 0) {
            throw new Error('Количество свечей для загрузке через REST не может быть меньше 0');
        }

        this.intervals.forEach(interval => {
            this.candlesIndicators.set(interval, new CandlesIndicator(config.candleHistoryLimit));
            this.indicatorsManager.registerIndicator(interval, 'macd', new MacdIndicator(config.macdConfig));
            this.indicatorsManager.registerIndicator(interval, 'ema14', new MultiPeriodEma(config.emaConfig));
            this.indicatorsManager.registerIndicator(interval, 'maCross', new MultiPeriodMaCross(config.maCrossConfig));
        });
    }


    /**
     * Загружает свечи для указанных интервалов рынка.
     * Для каждого интервала вызывает loadCandlesFromRest.
     * Обрабатывает ошибки загрузки по каждому интервалу отдельно.
     *
     * @param fetchCandles - функция загрузки свечей
     * @param intervals - список интервалов, для которых нужно загрузить свечи
     */
    async loadAllIntervalsCandles(
        fetchCandles: (symbol: string, interval: Interval, limit: number) => Promise<Candle[]>
    ): Promise<void> {
        if (!this.intervals || this.intervals.length === 0) {
            throw new Error(`[${this.symbol}] Ошибка: список интервалов пуст`);
        }

        // Создаем массив промисов загрузки свечей для каждого интервала
        const promises = this.intervals.map(interval =>
            this.loadCandlesFromRest(interval, fetchCandles).catch(err => {
                Logger.error(`[${this.symbol}] Ошибка загрузки свечей для интервала ${interval}:`, err);
            })
        );

        // Ждем завершения всех загрузок параллельно
        await Promise.all(promises);
    }

    async loadCandlesFromRest(
        interval: Interval,
        fetchCandles: (symbol: string, interval: Interval, limit: number) => Promise<Candle[]>
    ) {
        try {
            const recentCandles = await fetchCandles(this.symbol, interval, this.candleInitLimit);
            const cappedCandles = recentCandles.slice(-this.candleHistoryLimit);

            this.candlesIndicators.get(interval)?.bulkUpdate(cappedCandles);

            cappedCandles.forEach(candle => {
                const timestamp = candle.open;
                const price = candle.close;
                const confirmed = candle.confirm ?? true;

                this.indicatorsManager.update(interval, timestamp, price, confirmed);
            });

            //Logger.info(`[${this.symbol}] Loaded ${cappedCandles.length} candles for interval ${interval} from REST API and updated indicators`);
        } catch (err) {
            Logger.error(`[${this.symbol}] Failed to load candles for interval ${interval}:`, err);
            throw err;  // Пробрасываем дальше для реакции менеджера
        }
    }

    updateCandle(interval: Interval, candleData: any) {
        const candlesIndicator = this.candlesIndicators.get(interval);

        if (candlesIndicator) {
            candlesIndicator.update({
                startTime: Number(candleData.start),
                open: Number(candleData.open),
                high: Number(candleData.high),
                low: Number(candleData.low),
                close: Number(candleData.close),
                volume: Number(candleData.volume),
                turnover: Number(candleData.turnover),
                confirm: candleData.confirm,
                rate: (Number(candleData.close) - Number(candleData.open)) / Number(candleData.open),
            });
        }

        this.indicatorsManager.update(interval, candleData.start, Number(candleData.close), candleData.confirm);
    }

    getCandles(interval: string): Candle[] {
        return this.candlesIndicators.get(interval)?.getValue() ?? [];
    }

    getLastClosedCandle(interval: string): Candle | null {
        return this.candlesIndicators.get(interval)?.getLastClosedCandle() ?? null;
    }

    getMacd(interval: Interval) {
        return this.indicatorsManager.getValue(interval, 'macd');
    }

    getEma(interval: Interval) {
        return this.indicatorsManager.getValue(interval, 'ema14');
    }

    getMaCrossState(interval: Interval) {
        return this.indicatorsManager.getValue(interval, 'maCross');
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

    /**
     * Обновляет или добавляет ордер в Map по orderId.
     */
    public updateOrderFromRest(order: OrderData) {
        this.orders.set(order.orderId, order);
    }

    /**
     * Возвращает массив всех ордеров.
     */
    public getOrders(): OrderData[] {
        return Array.from(this.orders.values());
    }

    /**
     * Получает информацию об инструменте.
     */
    getInstrumentInfo(): InstrumentInfo | undefined {
        return this.instrumentInfo;
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

    getPositions(): PositionData[] {
        return Array.from(this.positions.values());
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

    public printCandles(interval: Interval, count?: number): void {
        console.log(`Печать свечей для рынка ${this.symbol}:`);
        this.candlesIndicators.get(interval)?.print(interval, count);
    }
}
