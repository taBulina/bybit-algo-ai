// src/indicators/ma-cross-indicator.ts
import { EMA } from 'technicalindicators';
import { Indicator } from '../dto/indicator';
import { Interval } from '../dto/interval';

export interface MaCrossConfig {
    shortPeriod: number;
    longPeriod: number;
    maxSize: number;
}

interface PriceEntry {
    timestamp: number;
    price: number;
    confirmed: boolean;
}

export class MultiPeriodMaCross implements Indicator {
    private shortPeriod: number;
    private longPeriod: number;
    private maxSize: number;

    private emaMap: Map<Interval, {
        shortEma: EMA;
        longEma: EMA;
        priceHistory: PriceEntry[];
        shortValue: number | null;
        longValue: number | null;
        maxSize: number;
    }> = new Map();

    constructor(config: MaCrossConfig) {
        this.shortPeriod = config.shortPeriod;
        this.longPeriod = config.longPeriod;
        this.maxSize = config.maxSize;
    }

    initInterval(interval: Interval) {
        if (!this.emaMap.has(interval)) {
            this.emaMap.set(interval, {
                shortEma: new EMA({ period: this.shortPeriod, values: [] }),
                longEma: new EMA({ period: this.longPeriod, values: [] }),
                priceHistory: [],
                shortValue: null,
                longValue: null,
                maxSize: this.maxSize,
            });
        }
    }

    update(timestamp: number, price: number, confirmed: boolean = false): void {
        // Обновляем данные для всех интервалов, или можно ограничить нужными интервалами
        this.emaMap.forEach((entry, interval) => {
            this.updateInterval(interval, timestamp, price, confirmed);
        });
    }

    private updateInterval(interval: Interval, timestamp: number, price: number, confirmed: boolean) {
        this.initInterval(interval);

        const entry = this.emaMap.get(interval)!;

        const idx = entry.priceHistory.findIndex(p => p.timestamp === timestamp);
        if (idx !== -1) {
            entry.priceHistory[idx].price = price;
            entry.priceHistory[idx].confirmed = confirmed;
        } else {
            entry.priceHistory.unshift({ timestamp, price, confirmed });
            if (entry.priceHistory.length > entry.maxSize) {
                entry.priceHistory.pop();
            }
        }

        // Пересчёт EMA для shortEma
        entry.shortEma = new EMA({ period: this.shortPeriod, values: [] });
        entry.longEma = new EMA({ period: this.longPeriod, values: [] });

        let shortVal: number | undefined;
        let longVal: number | undefined;

        for (const p of [...entry.priceHistory].reverse()) {
            shortVal = entry.shortEma.nextValue(p.price);
            longVal = entry.longEma.nextValue(p.price);
        }

        entry.shortValue = shortVal === undefined ? null : shortVal;
        entry.longValue = longVal === undefined ? null : longVal;
    }

    getValue(): { shortValue: number | null; longValue: number | null } | null {
        // Для интерфейса вернём null — без параметра возвращать null
        // Для получения значений по конкретному интервалу нужно делать отдельный метод
        return null;
    }

    getValueForInterval(interval: Interval): { shortValue: number | null; longValue: number | null } | null {
        if (!this.emaMap.has(interval)) return null;
        const entry = this.emaMap.get(interval)!;
        return { shortValue: entry.shortValue, longValue: entry.longValue };
    }
}
