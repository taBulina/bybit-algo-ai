// import dotenv from 'dotenv';
// dotenv.config();
//
// import { BybitRestSingleton, BybitWsSingleton } from './singleton-clients';
// import { MarketManager } from './market-manager';
// import { Logger } from './logger';
// import { MarketsConfig, StatisticsIntervalMinutes } from './config';
// import { BybitApiClient } from './bybit-api-client';
// import { TradingBot } from './trading-bot';
//
// async function main() {
//     const apiClient = new BybitApiClient(BybitRestSingleton.getInstance());
//     const marketManager = MarketManager.getInstance(apiClient);
//     const wsPrivate = BybitWsSingleton.getPrivateInstance();
//     const wsPublic = BybitWsSingleton.getPublicInstance();
//
//     // Загрузка свечей через REST
//     async function loadAllCandles() {
//         for (const config of MarketsConfig) {
//             const market = marketManager.getMarket(config.symbol);
//             for (const interval of config.tradeIntervals) {
//                 let fetchCandles = apiClient.fetchCandles;
//                 if (typeof apiClient.fetchCandles === 'function') {
//                     await market.loadCandlesFromRest(interval, apiClient.fetchCandles.bind(apiClient));
//                 }
//             }
//         }
//     }
//
//     // Подписка на события WebSocket после загрузки
//     async function subscribeAfterReload() {
//         wsPrivate.subscribeV5('position', 'order', 'linear');
//         const subscriptions = MarketsConfig.flatMap(cfg =>
//             [ `ticker.${cfg.symbol}`, ...cfg.tradeIntervals.map(i => `kline.${i}.${cfg.symbol}`) ]
//         );
//         wsPublic.subscribeV5(subscriptions, 'linear');
//     }
//
//     wsPrivate.onopen(async () => {
//         Logger.info('Private WS connected');
//         try {
//             await marketManager.reloadAllMarketsData();
//             await loadAllCandles();
//             await subscribeAfterReload();
//         } catch (err) {
//             Logger.error('Error during initial reload or subscribe', err);
//         }
//     });
//
//     wsPrivate.onclose(async evt => {
//         Logger.warn(`Private WS closed. Reconnecting... Event: ${JSON.stringify(evt)}`);
//         setTimeout(async () => {
//             try {
//                 await wsPrivate.connectv5Private();
//             } catch (err) {
//                 Logger.error('Failed to reconnect private WS', err);
//             }
//         }, 3000);
//     });
//
//     wsPrivate.onexception(err => Logger.error('Private WS exception', err));
//
//     wsPrivate.onupdate(data => marketManager.handlePrivateWsUpdate(data));
//
//     wsPublic.onopen(async () => {
//         Logger.info('Public WS connected');
//         try {
//             await subscribeAfterReload();
//         } catch (err) {
//             Logger.error('Error during subscribe public WS', err);
//         }
//     });
//
//     wsPublic.onclose(async evt => {
//         Logger.warn(`Public WS closed. Reconnecting... Event: ${JSON.stringify(evt)}`);
//         setTimeout(async () => {
//             try {
//                 await wsPublic.connectv5LinearPublic();
//             } catch (err) {
//                 Logger.error('Failed to reconnect public WS', err);
//             }
//         }, 3000);
//     });
//
//     wsPublic.onexception(err => Logger.error('Public WS exception', err));
//
//     wsPublic.onupdate(async data => {
//         if (data.topic.startsWith('kline.')) {
//             const parts = data.topic.split('.');
//             if (parts.length === 3) {
//                 const interval = parts[1];
//                 const symbol = parts[2];
//                 const market = marketManager.getMarket(symbol);
//                 if (market) {
//                     market.updateCandleFromWs(interval, data.data);
//                 }
//             }
//         }
//
//         if (data.topic.startsWith('ticker.')) {
//             Logger.info(`Ticker update: ${JSON.stringify(data.data)}`);
//         }
//     });
//
//     marketManager.setStatisticsInterval(StatisticsIntervalMinutes);
//     marketManager.startPeriodicStatsPrint();
//
//     const market = marketManager.getMarket('BTCUSDT');
//     const tradingBot = new TradingBot(market, apiClient);
//
//     wsPrivate.on('indicatorsUpdate', async (indicatorsByInterval, macdChangesByInterval, lastPrice) => {
//         try {
//             await tradingBot.checkAndPlaceOrder(indicatorsByInterval, macdChangesByInterval, lastPrice);
//         } catch (err) {
//             console.error('Error in trading bot', err);
//         }
//     });
//
//     await wsPrivate.connectv5Private();
//     await wsPublic.connectv5LinearPublic();
// }
//
// main().catch(err => Logger.error(err));
