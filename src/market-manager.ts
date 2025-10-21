// src/market-manager.ts

import { Market, mapPositionV5ToPositionData } from './market';
import { BybitApiClient } from './bybit-api-client';
import { Logger } from './logger';
import { LinearInverseInstrumentInfoV5 } from 'bybit-api';
import { StatisticsIntervalMinutes, MarketsConfig } from './config';
import { OrderData } from './dto/order';
import { InstrumentInfo } from './dto/instrument';

export class MarketManager {
    private static instance: MarketManager;
    private markets: Map<string, Market> = new Map();

    private apiClient: BybitApiClient;

    private statisticsIntervalMs: number = StatisticsIntervalMinutes * 60 * 1000;
    private statisticsIntervalId: NodeJS.Timeout | null = null;

    private constructor(apiClient: BybitApiClient) {
        this.apiClient = apiClient;
        MarketsConfig.forEach(config => {
            if (!this.markets.has(config.symbol)) {
                this.markets.set(config.symbol, new Market(config.symbol));
                Logger.info(`Market created from config: ${config.symbol}`);
            }
        });
    }

    public static getInstance(apiClient?: BybitApiClient): MarketManager {
        if (!MarketManager.instance) {
            if (!apiClient) throw new Error('MarketManager требует apiClient при первой инициализации');
            MarketManager.instance = new MarketManager(apiClient);
        }
        return MarketManager.instance;
    }

    getMarket(symbol: string): Market {
        if (!this.markets.has(symbol)) {
            this.markets.set(symbol, new Market(symbol));
            Logger.info(`Создан новый рынок: ${symbol}`);
        }
        return this.markets.get(symbol)!;
    }

    public handlePrivateWsUpdate(data: any) {
        Logger.info(`Cообщение из топика ${data?.topi}`);

        if (!data?.topic) return;

        if (data.topic.startsWith('position')) {
            const updatesRaw: any[] = Array.isArray(data.data) ? data.data : [data.data];
            updatesRaw.forEach((rawPos: any) => {
                const pos = mapPositionV5ToPositionData(rawPos);
                this.getMarket(pos.symbol).updatePositionFromWs(pos);
            });
        }

        if (data.topic.startsWith('order')) {
            const updates: OrderData[] = Array.isArray(data.data) ? data.data : [data.data];
            updates.forEach((order: OrderData) => this.getMarket(order.symbol).updateOrderFromWs(order));
        }
    }

    private mapApiInfoToInstrumentInfo(apiInfo: LinearInverseInstrumentInfoV5): InstrumentInfo {
        if (
            !apiInfo.symbol ||
            !apiInfo.contractType ||
            !apiInfo.status ||
            apiInfo.baseCoin === undefined ||
            apiInfo.quoteCoin === undefined ||
            !apiInfo.priceFilter ||
            apiInfo.priceFilter.minPrice === undefined ||
            apiInfo.priceFilter.maxPrice === undefined ||
            apiInfo.priceFilter.tickSize === undefined ||
            !apiInfo.lotSizeFilter ||
            apiInfo.lotSizeFilter.maxOrderQty === undefined ||
            apiInfo.lotSizeFilter.minOrderQty === undefined ||
            apiInfo.lotSizeFilter.qtyStep === undefined
        ) {
            throw new Error(`Отсутствуют необходимые поля данных инструмента для символа ${apiInfo.symbol}`);
        }

        return {
            symbol: apiInfo.symbol,
            contractType: apiInfo.contractType,
            status: apiInfo.status,
            baseCurrency: apiInfo.baseCoin,
            quoteCurrency: apiInfo.quoteCoin,
            priceFilter: {
                minPrice: Number(apiInfo.priceFilter.minPrice),
                maxPrice: Number(apiInfo.priceFilter.maxPrice),
                tickSize: Number(apiInfo.priceFilter.tickSize),
            },
            lotSizeFilter: {
                maxOrderQty: Number(apiInfo.lotSizeFilter.maxOrderQty),
                minOrderQty: Number(apiInfo.lotSizeFilter.minOrderQty),
                qtyStep: Number(apiInfo.lotSizeFilter.qtyStep),
            },
        };
    }

    async loadInstrumentInfoForAllMarkets() {
        try {
            const instruments = await this.apiClient.getInstrumentsInfo('linear');
            const linearInstruments = instruments.filter(
                (item: any): item is LinearInverseInstrumentInfoV5 => 'contractType' in item
            );

            linearInstruments.forEach((apiInfo: LinearInverseInstrumentInfoV5) => {
                const info = this.mapApiInfoToInstrumentInfo(apiInfo);
                const market = this.getMarket(info.symbol);
                market.setInstrumentInfo(info);
            });
            Logger.info(`Загружена информация по ${linearInstruments.length} линейным рынкам`);
        } catch (err) {
            Logger.error('Ошибка загрузки информации по инструментам:', err);
        }
    }

    async reloadAllMarketsData() {
        Logger.info('Перезагрузка данных о позициях всех рынков...');
        const markets = this.getAllMarkets();

        for (const market of markets) {
            try {
                const positionsRaw: any[] = await this.apiClient.getPositionsInfo(market.symbol);
                if (positionsRaw) {
                    for (const positionRaw of positionsRaw) {
                        const positionData = mapPositionV5ToPositionData(positionRaw);
                        if (
                            (positionData.side === 'Buy' || positionData.side === 'Sell') &&
                            positionData.size &&
                            positionData.size > 0
                        ) {
                            market.updatePositionFromWs(positionData);
                        }
                    }
                }
            } catch (err) {
                Logger.error(`Ошибка загрузки позиций для рынка ${market.symbol}:`, err);
            }
        }
        Logger.info('Перезагрузка данных позиций завершена.');
    }

    async reloadAllOrdersData() {
        Logger.info('Перезагрузка данных об ордерах всех рынков...');
        const markets = this.getAllMarkets();

        for (const market of markets) {
            try {
                const ordersResp = await this.apiClient.getActiveOrders('linear', market.symbol);
                ordersResp.forEach((orderDataRaw: any) => {
                    if (
                        orderDataRaw.orderId === undefined ||
                        orderDataRaw.side === undefined ||
                        orderDataRaw.price === undefined ||
                        orderDataRaw.qty === undefined ||
                        orderDataRaw.orderStatus === undefined ||
                        orderDataRaw.symbol === undefined ||
                        orderDataRaw.createdTime === undefined ||
                        orderDataRaw.updatedTime === undefined
                    ) {
                        throw new Error(`Неполные данные ордера для символа ${market.symbol}`);
                    }

                    const orderData: OrderData = {
                        orderId: orderDataRaw.orderId,
                        side: orderDataRaw.side,
                        price: Number(orderDataRaw.price),
                        qty: Number(orderDataRaw.qty),
                        status: orderDataRaw.orderStatus,
                        symbol: orderDataRaw.symbol,
                        createdTime: Number(orderDataRaw.createdTime),
                        updatedTime: Number(orderDataRaw.updatedTime),
                    };
                    market.updateOrderFromRest(orderData);
                });
            } catch (err) {
                Logger.error(`Ошибка загрузки ордеров для рынка ${market.symbol}:`, err);
            }
        }
        Logger.info('Перезагрузка данных ордеров завершена.');
    }

    getAllMarkets(): Market[] {
        return Array.from(this.markets.values());
    }

    setStatisticsInterval(minutes: number) {
        this.statisticsIntervalMs = minutes * 60 * 1000;
        if (this.statisticsIntervalId) {
            clearInterval(this.statisticsIntervalId);
            this.statisticsIntervalId = null;
        }
    }

    startPeriodicStatsPrint() {
        if (this.statisticsIntervalId) {
            clearInterval(this.statisticsIntervalId);
        }
        this.statisticsIntervalId = setInterval(() => {
            Logger.info('--- Статистика позиций всех рынков ---');
            for (const market of this.getAllMarkets()) {
                market.printPositionsSummary();
            }
        }, this.statisticsIntervalMs);
    }
}
