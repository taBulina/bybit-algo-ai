// src/main.ts

import { BybitApiClient } from './bybit-api-client';
import { MarketManager } from './market-manager';
import { Logger } from './logger';
import {BybitRestSingleton} from "./singleton-clients";

async function main() {
    try {
        // Создаем экземпляр клиента Bybit API
        const apiClient = new BybitApiClient(BybitRestSingleton.getInstance());

        // Получаем синглтон менеджера рынков
        const marketManager = MarketManager.getInstance(apiClient);

        // Загружаем информацию по инструментам
        await marketManager.loadInstrumentInfoForAllMarkets();

        // Перезагружаем данные о позициях и ордерах
        await marketManager.reloadAllMarketsData();
        await marketManager.reloadAllOrdersData();

        // Настраиваем вывод статистики каждые 10 минут
        marketManager.setStatisticsInterval(10);
        marketManager.startPeriodicStatsPrint();

        Logger.info('Инициализация завершена, бот запущен.');
    } catch (error) {
        Logger.error('Ошибка инициализации проекта:', error);
        process.exit(1); // Завершение приложения с ошибкой
    }
}

// Запуск основной функции
main();
