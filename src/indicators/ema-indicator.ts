import { EMA } from 'technicalindicators';
import { Indicator } from '../dto/indicator';

export interface EmaConfig {
    period: number;
    maxSize: number;
}

export class MultiPeriodEma implements Indicator {
    private priceHistory: Array<{ timestamp: number; price: number; confirmed: boolean }> = [];
    private emaValues: Map<number, number> = new Map();  // Хранение EMA по timestamp
    private emaPeriod: number;
    private maxSize: number;

    constructor(config: EmaConfig) {
        this.emaPeriod = config.period;
        this.maxSize = config.maxSize;
    }

    update(timestamp: number, price: number, confirmed: boolean = false): void {
        const idx = this.priceHistory.findIndex(p => p.timestamp === timestamp);
        if (idx !== -1) {
            // Обновляем существующую запись
            this.priceHistory[idx].price = price;
            this.priceHistory[idx].confirmed = confirmed;
        } else {
            // Добавляем новую запись в начало массива
            this.priceHistory.unshift({ timestamp, price, confirmed });
            if (this.priceHistory.length > this.maxSize) {
                this.priceHistory.pop();
            }
        }

        // Создаём новый EMA с текущим периодом и инициализируем массивом значений
        const ema = new EMA({ period: this.emaPeriod, values: [] });
        this.emaValues.clear();

        // Пересчитываем EMA по истории цен от самых старых к новым
        for (const p of [...this.priceHistory].reverse()) {
            const val = ema.nextValue(p.price);
            if (val !== undefined && !isNaN(val)) {
                this.emaValues.set(p.timestamp, val);
            }
        }
    }

    getValue(): number | null {
        if (this.priceHistory.length === 0) return null;
        const latestTimestamp = this.priceHistory[0].timestamp;
        return this.emaValues.get(latestTimestamp) ?? null;
    }

    getValueByTimestamp(timestamp: number): number | null {
        return this.emaValues.get(timestamp) ?? null;
    }
}
