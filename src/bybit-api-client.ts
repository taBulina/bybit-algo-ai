// src/bybit-api-client.ts
import { RestClientV5, OrderTimeInForceV5, KlineIntervalV3 } from 'bybit-api';
import { Logger } from './logger';
import { LinearInverseInstrumentInfoV5, PositionV5 } from 'bybit-api';
import {Candle} from "./dto/candle";
import {BybitApiClientInternal} from "./bybit-api-client-internal";

type OrderV5 = any;

interface PlaceLimitOrderParams {
    symbol: string;
    side: 'Buy' | 'Sell';
    price: string;
    qty: string;
    timeInForce: OrderTimeInForceV5;
}

export class BybitApiClient {
    private apiClientInternal: BybitApiClientInternal;

    constructor(restClient: RestClientV5) {
        this.apiClientInternal = new BybitApiClientInternal(restClient);
    }

    private async logCall(methodName: string, func: (...args: any[]) => Promise<any>, ...args: any[]) {
        Logger.info(`[API Request] Calling ${methodName} with args:`, args);
        try {
            const result = await func(...args);
            Logger.info(`[API Response] ${methodName} returned:`, result);
            return result;
        } catch (error) {
            Logger.error(`[API Error] ${methodName} failed with error:`, error);
            throw error;
        }
    }

    async getPositionsInfo(symbol: string) {
        return this.logCall('getPositionsInfo', this.apiClientInternal.getPositionsInfo.bind(this.apiClientInternal), symbol);
    }

    async placeLimitOrder(params: Parameters<BybitApiClientInternal['placeLimitOrder']>[0]) {
        return this.logCall('placeLimitOrder', this.apiClientInternal.placeLimitOrder.bind(this.apiClientInternal), params);
    }

    async fetchCandles(symbol: string, interval: string, limit: number) {
        return this.logCall('fetchCandles', this.apiClientInternal.fetchCandles.bind(this.apiClientInternal), symbol, interval, limit);
    }

    async getInstrumentsInfo(category: 'spot' | 'linear' | 'inverse' = 'linear') {
        return this.logCall('getInstrumentsInfo', this.apiClientInternal.getInstrumentsInfo.bind(this.apiClientInternal), category);
    }

    async getActiveOrders(category: 'spot' | 'linear' | 'inverse', symbol: string) {
        return this.logCall('getActiveOrders', this.apiClientInternal.getActiveOrders.bind(this.apiClientInternal), category, symbol);
    }
}
