// src/market-manager.ts

import {Market, mapPositionV5ToPositionData} from './market';
import {BybitApiClient} from './bybit-api-client';
import {Logger} from './logger';
import {LinearInverseInstrumentInfoV5} from 'bybit-api';
import {MarketsConfig, StatisticsIntervalMinutes} from './config';
import {OrderData} from './dto/order';
import {InstrumentInfo} from './dto/instrument';
import {Interval, toIntervalByValue} from "./dto/interval";
import {WebsocketListener} from "./websocket-listener";

export class MarketManager {
    private static instance: MarketManager;
    private markets: Map<string, Market> = new Map();
    private apiClient: BybitApiClient;
    private statisticsIntervalMs: number = StatisticsIntervalMinutes * 60 * 1000;
    private statisticsIntervalId: NodeJS.Timeout | null = null;
    private websocketListener: WebsocketListener;

    constructor(apiClient: BybitApiClient, websocketListener: WebsocketListener) {
        this.apiClient = apiClient;
        this.websocketListener = websocketListener;

        for (const marketConfig of MarketsConfig) {
            const market = new Market(marketConfig);
            this.markets.set(marketConfig.symbol, market);
        }
    }

    public static getInstance(apiClient?: BybitApiClient, websocketListener?: WebsocketListener): MarketManager {
        if (!MarketManager.instance) {
            if (!apiClient) throw new Error('MarketManager requires apiClient at first initialization');
            if (!websocketListener) throw new Error('MarketManager requires websocketListener at first initialization');

            MarketManager.instance = new MarketManager(apiClient, websocketListener);
        }
        return MarketManager.instance;
    }

    public getMarket(symbol: string): Market {
        if (!this.markets.has(symbol)) {
            throw new Error(`Маркет не найден ${symbol}`);
        }
        return this.markets.get(symbol)!;
    }

    public handlePrivateWsUpdate(data: any) {
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
            updates.forEach((orderDataRaw: any) => {
                const orderData: OrderData = {
                    orderId: orderDataRaw.orderId,
                    side: orderDataRaw.side,
                    price: Number(orderDataRaw.price),
                    qty: Number(orderDataRaw.qty),
                    status: orderDataRaw.orderStatus,
                    symbol: orderDataRaw.symbol,
                    createdTime: Number(orderDataRaw.createdTime ?? Date.now()),
                    updatedTime: Number(orderDataRaw.updatedTime ?? Date.now()),
                };
                this.getMarket(orderData.symbol).updateOrderFromRest(orderData);
            });
        }

        // TODO add storing ticker info
    }

    private mapApiInfoToInstrumentInfo(apiInfo: LinearInverseInstrumentInfoV5): InstrumentInfo {
        return {
            symbol: apiInfo.symbol,
            contractType: apiInfo.contractType,
            status: apiInfo.status,
            baseCurrency: apiInfo.baseCoin ?? '',
            quoteCurrency: apiInfo.quoteCoin ?? '',
            priceFilter: {
                minPrice: Number(apiInfo.priceFilter?.minPrice ?? 0),
                maxPrice: Number(apiInfo.priceFilter?.maxPrice ?? 0),
                tickSize: Number(apiInfo.priceFilter?.tickSize ?? 0),
            },
            lotSizeFilter: {
                maxOrderQty: Number(apiInfo.lotSizeFilter?.maxOrderQty ?? 0),
                minOrderQty: Number(apiInfo.lotSizeFilter?.minOrderQty ?? 0),
                qtyStep: Number(apiInfo.lotSizeFilter?.qtyStep ?? 0),
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

            Logger.info(`Loaded instrument info for ${linearInstruments.length} linear markets`);
        } catch (err) {
            Logger.error('Error loading instruments info:', err);
        }
    }

    async reloadAllMarketsData() {
        Logger.info('Reloading all market data from REST API...');
        const markets = this.getAllMarkets();

        for (const market of markets) {
            try {
                // const positionDataRaw = await this.apiClient.getPositionsInfo(market.symbol);
                // if (positionDataRaw) {
                //     const positionData = mapPositionV5ToPositionData(positionDataRaw);
                //     market.updatePositionFromWs(positionData);
                // }
                const apiFetchCandles = this.apiClient.fetchCandles.bind(this.apiClient);
                await market.loadAllIntervalsCandles(apiFetchCandles);

            } catch (err) {
                Logger.error(`Error loading position data for market ${market.symbol}:`, err);
            }
        }

        this.registerWebSocketListener();
        Logger.info('Reloading market data completed.');
    }

    async reloadAllOrdersData() {
        Logger.info('Reloading all orders data from REST API...');
        const markets = this.getAllMarkets();
        for (const market of markets) {
            try {
                const ordersResp = await this.apiClient.getActiveOrders('linear', market.symbol);
                ordersResp.forEach((orderDataRaw: any) => {
                    const orderData: OrderData = {
                        orderId: orderDataRaw.orderId,
                        side: orderDataRaw.side,
                        price: Number(orderDataRaw.price),
                        qty: Number(orderDataRaw.qty),
                        status: orderDataRaw.orderStatus,
                        symbol: orderDataRaw.symbol,
                        createdTime: Number(orderDataRaw.createdTime ?? Date.now()),
                        updatedTime: Number(orderDataRaw.updatedTime ?? Date.now()),
                    };
                    market.updateOrderFromRest(orderData);
                });
            } catch (err) {
                Logger.error(`Error loading orders for market ${market.symbol}:`, err);
            }
        }
        Logger.info('Reloading orders data completed.');
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
            Logger.info('--- Статистика позиций по всем рынкам ---');
            for (const market of this.getAllMarkets()) {
                market.printPositionsSummary();
            }
        }, this.statisticsIntervalMs);
    }

    public registerWebSocketListener() {
        this.websocketListener.on('candleUpdate', ({symbol, interval, candle}: {
            symbol: string;
            interval: string;
            candle: any
        }) => {
            const market = this.getMarket(symbol);
            if (market) {
                // Преобразуем строковый интервал в Interval тип
                const typedInterval = interval as Interval;
                market.updateCandle(typedInterval, candle);
            }
        });
    }
}
