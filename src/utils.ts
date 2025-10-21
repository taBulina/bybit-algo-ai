// src/utils.ts

export type KlineIntervalV3 =
    | '1' | '3' | '5' | '15' | '30'
    | '60' | '120' | '240' | '360' | '720'
    | 'D' | 'W' | 'M';

/**
 * Преобразует биржевой интервал Kline в миллисекунды.
 * @param interval Интервал, например '1', '5', '60', 'D', 'W', 'M'
 * @returns количество миллисекунд, соответствующее интервалу
 */
export const intervalToMs = (interval: KlineIntervalV3): number => {
    const minute = 60 * 1000;
    switch (interval) {
        case '1':   return 1 * minute;
        case '3':   return 3 * minute;
        case '5':   return 5 * minute;
        case '15':  return 15 * minute;
        case '30':  return 30 * minute;
        case '60':  return 60 * minute;
        case '120': return 120 * minute;
        case '240': return 240 * minute;
        case '360': return 360 * minute;
        case '720': return 720 * minute;
        case 'D':   return 24 * 60 * minute;
        case 'W':   return 7 * 24 * 60 * minute;
        case 'M':   return 30 * 24 * 60 * minute; // Условно месяц = 30 дней
        default: throw new Error(`Unknown interval: ${interval}`);
    }
};


// Вспомогательная функция для безопасного преобразования числовых полей
export function toNumberOrUndefined(value: any): number | undefined {
    if (value === undefined || value === null) return undefined;
    const num = Number(value);
    return isNaN(num) ? undefined : num;
}

// Вспомогательная функция для безопасного преобразования boolean полей
export function toBooleanOrUndefined(value: any): boolean | undefined {
    if (value === undefined || value === null) return undefined;
    return Boolean(value);
}

// src/utils.ts
export function roundToStep(value: number, step: number): number {
    return Math.round(value / step) * step;
}

export function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}
