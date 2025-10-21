// src/candles.ts
import { Candle } from '../dto/candle';

export interface Indicator {
    /**
     * Обновляет или добавляет данные индикатора.
     * @param timestamp Временная метка (например, начало свечи) в миллисекундах.
     * @param candleData Полный объект свечи с обязательными полями.
     * @throws {Error} Если данным не хватает обязательных параметров.
     */
    update(timestamp: number, candleData: Candle): void;

    /**
     * Возвращает текущие данные индикатора.
     * @returns Массив свечей с полной историей.
     */
    getValue(): Candle[];

    /**
     * Возвращает последние N значений индикатора.
     * @param count Количество последних элементов истории.
     * @returns Массив свечей длиной не более count.
     */
    getHistory?(count: number): Candle[];
}

export class CandlesIndicator implements Indicator {
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
    update(timestamp: number, candleData: Candle) {
        if (
            candleData.open === undefined || candleData.high === undefined || candleData.low === undefined ||
            candleData.close === undefined || candleData.volume === undefined || candleData.turnover === undefined ||
            candleData.confirm === undefined || candleData.rate === undefined || candleData.time !== timestamp
        ) {
            throw new Error('Свеча неполная или неконсистентная для обновления');
        }

        const idx = this.candles.findIndex(c => c.time === timestamp);

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
        candles.forEach(candle => this.update(candle.time, candle));
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
}
