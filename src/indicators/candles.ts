// src/candles.ts
import {Candle} from '../dto/candle';
import {Interval} from "../dto/interval";

export class CandlesIndicator {
    private candles: Candle[] = [];
    private maxSize: number;

    /**
     * Конструктор
     * @param maxSize Максимальное количество свечей для хранения.
     */
    constructor(maxSize: number = 1000) {
        this.maxSize = maxSize;
    }

    /**
     * Обновляет или добавляет свечу по времени.
     * Если свеча с таким временем уже существует — обновляет ее.
     * @param timestamp Временная метка свечи, обязательна и должна совпадать с candleData.time.
     * @param candleData Объект свечи с обязательными полями:
     *  time, open, high, low, close, volume, turnover, confirm, rate
     * @throws {Error} Если отсутствует хотя бы одно обязательное поле.
     */
    update(candleData: Candle) {
        if (
            candleData.open === undefined || candleData.high === undefined || candleData.low === undefined ||
            candleData.close === undefined || candleData.volume === undefined || candleData.turnover === undefined ||
            candleData.confirm === undefined || candleData.rate === undefined || candleData.startTime == undefined
        ) {
            throw new Error('Свеча неполная или неконсистентная для обновления');
        }

        const idx = this.candles.findIndex(c => c.startTime === candleData.startTime);

        if (idx >= 0) {
            this.candles[idx] = candleData;
        } else {
            this.candles.unshift(candleData);
            if (this.candles.length > this.maxSize) {
                this.candles.pop();
            }
        }
    }

    /**
     * Обновляет сразу несколько свечей.
     * @param candles Массив свечей с обязательными полями.
     */
    bulkUpdate(candles: Candle[]) {
        candles.forEach(candle => this.update(candle));
    }

    /**
     * Возвращает последнюю закрытую свечу
     * (обычно вторая свеча в массиве, первая - формируется).
     * @returns Последняя закрытая свеча либо null, если исторических свечей меньше двух.
     */
    getLastClosedCandle(): Candle | null {
        if (this.candles.length < 2) return null;
        return this.candles[1];
    }

    /**
     * Возвращает текущую копию массива свечей.
     * @returns Массив всех свечей, отсортированный по времени.
     */
    getValue(): Candle[] {
        return this.candles.slice();
    }

    /**
     * Возвращает ограниченный по количеству массив последних свечей.
     * @param count Максимальное количество возвращаемых свечей.
     * @returns Массив свечей размером не более count.
     */
    getHistory(count: number): Candle[] {
        return this.candles.slice(0, count);
    }

    /**
     * Печатает свечи для указанного интервала.
     * @param interval Интервал свечей.
     * @param count Количество свечей для печати (по умолчанию все).
     */
    public print(interval: Interval, count?: number): void {
        const candles = this.candles;
        if (!candles || candles.length === 0) {
            console.log(`Свечи для интервала ${interval} отсутствуют.`);
            return;
        }

        const candlesToPrint = count ? candles.slice(-count) : candles;

        console.log(`Свечи для интервала ${interval} (всего: ${candles.length}):`);

        candlesToPrint.forEach(candle => {
            const dateUTC = new Date(candle.startTime);
            const moscowOffsetMs = 3 * 60 * 60 * 1000; // +3 часа в мс
            const moscowTime = new Date(dateUTC.getTime() + moscowOffsetMs);

            const moscowTimeStr = moscowTime.toISOString().replace('T', ' ').slice(0, 19);

            console.log(
                `Start time: ${moscowTimeStr}, ` +
                `O: ${candle.open}, H: ${candle.high}, L: ${candle.low}, C: ${candle.close}, ` +
                `R: ${candle.rate.toFixed(4)}, Vol: ${candle.volume}`
            );
        });
    }

}
