import { BybitRestSingleton, BybitWsSingleton } from './singleton-clients';
import { MarketManager } from './market-manager';
import { Logger } from './logger';
import { MarketsConfig, StatisticsIntervalMinutes } from './config';
import { BybitApiClient } from './bybit-api-client';
import { TradingBot } from './trading-bot';
import { WebsocketListener } from './websocket-listener';

async function main() {
    const apiClient = new BybitApiClient(BybitRestSingleton.getInstance());
    const wsPrivate = BybitWsSingleton.getPrivateInstance();
    const wsPublic = BybitWsSingleton.getPublicInstance();

    // Инициируем и настраиваем WebSocketListener
    const wsListener = new WebsocketListener(wsPrivate, wsPublic, MarketsConfig);
    const marketManager = MarketManager.getInstance(apiClient, wsListener);

    // Запускаем подключения к WebSocket
    await wsListener.connect();

    // Загружаем все данные по маркету
    marketManager.reloadAllMarketsData();

    // Регистрируем wsListener в MarketManager для работы с данными
    //marketManager.registerWebSocketListener(wsListener);



    marketManager.setStatisticsInterval(StatisticsIntervalMinutes);
    marketManager.startPeriodicStatsPrint();

    // Например для старта бота
    const market = marketManager.getMarket('XRPUSDT');
    const tradingBot = new TradingBot(market, apiClient, wsListener);
}

main().catch(Logger.error);
