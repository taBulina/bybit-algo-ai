export interface Candle {
    open: number;       // Цена открытия
    high: number;       // Максимальная цена
    low: number;        // Минимальная цена
    close: number;      // Цена закрытия
    volume: number;     // Объем свечи
    turnover: number;   // Суммарный оборот сделки в денежном выражении
    confirm: boolean;   // Флаг подтверждения, что свеча завершена
    rate: number;       // Относительное изменение цены (например, (close - open) / open)
}