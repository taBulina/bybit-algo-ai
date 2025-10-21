// src/dto/interval.ts
export enum Interval {
    Min1 = '1',
    Min3 = '3',
    Min5 = '5',
    Min15 = '15',
    Min30 = '30',
    Min60 = '60',
    Min120 = '120',
    Min240 = '240',
    Day1 = 'D',
    Week1 = 'W',
    Month1 = 'M',
}

// Функция для поиска ключа enum по значению
export function toIntervalByValue(value: string): Interval | undefined {
    const entry = Object.entries(Interval).find(([key, val]) => val === value);
    return entry ? entry[1] as Interval : undefined;
}

/**
 * Преобразует массив строковых значений в массив элементов enum Interval.
 * @param values - Массив строковых значений, соответствующих элементам enum Interval.
 * @returns Массив элементов enum Interval, соответствующих входным строкам.
 * @throws Ошибка, если хотя бы одно значение не найдено в enum Interval.
 */
export function toIntervalArray(values: string[]): Interval[] {
    return values.map(value => {
        const interval = Object.values(Interval).find(val => val === value);
        if (!interval) {
            throw new Error(`Значение '${value}' не входит в enum Interval`);
        }
        return interval as Interval;
    });
}