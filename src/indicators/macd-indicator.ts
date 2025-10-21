import { MACD } from 'technicalindicators';
import { Indicator } from '../dto/indicator';
import { Interval } from '../dto/interval';

export interface MacdConfig {
    fastPeriod: number;
    slowPeriod: number;
    signalPeriod: number;
    simpleMA: boolean;
    maxSize: number;
}

interface PriceEntry {
    timestamp: number;
    price: number;
    confirmed: boolean;
}

export class MacdIndicator implements Indicator {
    private fastPeriod: number;
    private slowPeriod: number;
    private signalPeriod: number;
    private simpleMA: boolean;
    private maxSize: number;

    private priceHistory: PriceEntry[] = [];
    private macdValue: number | null = null;
    private signalValue: number | null = null;
    private histogramValue: number | null = null;

    constructor(config: MacdConfig) {
        this.fastPeriod = config.fastPeriod;
        this.slowPeriod = config.slowPeriod;
        this.signalPeriod = config.signalPeriod;
        this.simpleMA = config.simpleMA;
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

        const macdInput = {
            values: this.priceHistory.map(p => p.price).slice().reverse(),
            fastPeriod: this.fastPeriod,
            slowPeriod: this.slowPeriod,
            signalPeriod: this.signalPeriod,
            SimpleMAOscillator: this.simpleMA,
            SimpleMASignal: this.simpleMA,
        };

        const results = MACD.calculate(macdInput);
        const result = results.length > 0 ? results[results.length - 1] : null;

        if (result) {
            this.macdValue = result.MACD ?? null;
            this.signalValue = result.signal ?? null;
            this.histogramValue = result.histogram ?? null;
        } else {
            this.macdValue = null;
            this.signalValue = null;
            this.histogramValue = null;
        }
    }

    getValue(): { macd: number | null; signal: number | null; histogram: number | null } {
        return {
            macd: this.macdValue,
            signal: this.signalValue,
            histogram: this.histogramValue,
        };
    }
}
