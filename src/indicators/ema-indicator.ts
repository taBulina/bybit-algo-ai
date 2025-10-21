// src/indicators/ema-indicator.ts
import { EMA } from 'technicalindicators';
import { Indicator } from '../dto/indicator';

export interface EmaConfig {
    period: number;
    maxSize: number;
}

/**
 * Класс мультипериодного EMA индикатора.
 * Внутри хранит историю цен по умолчанию для одной серии (без интервалов).
 * Соответствует интерфейсу Indicator с update(timestamp, price, confirmed).
 */
export class MultiPeriodEma implements Indicator {
    private ema: EMA;
    private priceHistory: Array<{ timestamp: number; price: number; confirmed: boolean }> = [];
    private emaValue: number | null = null;
    private maxSize: number;

    constructor(config: EmaConfig) {
        this.ema = new EMA({ period: config.period, values: [] });
        this.maxSize = config.maxSize;
    }

    update(timestamp: number, price: number, confirmed: boolean = false): void {
        const idx = this.priceHistory.findIndex(p => p.timestamp === timestamp);
        if (idx !== -1) {
            this.priceHistory[idx].price = price;
            this.priceHistory[idx].confirmed = confirmed;
        } else {
            this.priceHistory.unshift({ timestamp, price, confirmed });
            if (this.priceHistory.length > this.maxSize) {
                this.priceHistory.pop();
            }
        }

        // Создаём новый экземпляр EMA с пустыми значениями для пересчёта
        this.ema = new EMA({ period: this.ema.period, values: [] });

        let val: number | undefined;
        // Подаём значения цен в EMA по порядку, начиная с самых старых
        for (const p of [...this.priceHistory].reverse()) {
            val = this.ema.nextValue(p.price);
        }
        if (val !== undefined) {
            this.emaValue = val;
        }
    }

    getValue(): number | null {
        return this.emaValue;
    }
}
