// src/indicators-manager.ts

import { Indicator } from './dto/indicator';
import { Interval } from './dto/interval';

/**
 * Менеджер для управления множественными индикаторами по таймфреймам.
 */
export class IndicatorsManager {
    private indicatorsMap: Map<Interval, Map<string, Indicator>> = new Map();

    /**
     * Регистрирует индикатор по ключу и интервалу
     * @param interval Интервал свечей, Enum Interval
     * @param key Уникальный ключ индикатора, например "macd", "ema14"
     * @param indicator Экземпляр индикатора
     */
    registerIndicator(interval: Interval, key: string, indicator: Indicator) {
        if (!this.indicatorsMap.has(interval)) {
            this.indicatorsMap.set(interval, new Map());
        }
        this.indicatorsMap.get(interval)!.set(key, indicator);
    }

    /**
     * Обновляет все индикаторы для заданного интервала новыми данными
     * @param interval Интервал свечей, Enum Interval
     * @param timestamp Время свечи в unix ms
     * @param price Цена закрытия свечи
     * @param confirmed Флаг подтверждённой свечи (optional)
     */
    update(interval: Interval, timestamp: number, price: number, confirmed = false) {
        const indicators = this.indicatorsMap.get(interval);
        if (!indicators) return;

        for (const indicator of indicators.values()) {
            indicator.update(timestamp, price, confirmed);
        }
    }

    /**
     * Получить индикатор по интервалу и ключу
     * @param interval Интервал свечей, Enum Interval
     * @param key Уникальный ключ индикатора, например "macd", "ema14"
     * @returns Экземпляр индикатора или undefined
     */
    getIndicator(interval: Interval, key: string): Indicator | undefined {
        return this.indicatorsMap.get(interval)?.get(key);
    }

    /**
     * Получить текущее значение индикатора
     * @param interval Интервал свечей, Enum Interval
     * @param key Уникальный ключ индикатора
     * @returns Текущее значение индикатора или undefined
     */
    getValue(interval: Interval, key: string): any {
        return this.getIndicator(interval, key)?.getValue();
    }

    /**
     * Получить историю значений индикатора
     * @param interval Интервал свечей, Enum Interval
     * @param key Уникальный ключ индикатора
     * @param count Количество записей истории
     * @returns Массив значений истории индикатора или null, если нет поддержки
     */
    getHistory(interval: Interval, key: string, count: number): any[] | null {
        const indicator = this.getIndicator(interval, key);
        if (indicator?.getHistory) {
            return indicator.getHistory(count);
        }
        return null;
    }
}
