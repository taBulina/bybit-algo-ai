// src/bybit-api-client-internal.ts
import {RestClientV5, OrderTimeInForceV5, KlineIntervalV3} from 'bybit-api';
import {Logger} from './logger';
import {LinearInverseInstrumentInfoV5, PositionV5} from 'bybit-api';
import {Candle} from "./dto/candle";
import {intervalToMs} from "./utils";

type OrderV5 = any;

interface PlaceLimitOrderParams {
    symbol: string;
    side: 'Buy' | 'Sell';
    price: string;
    qty: string;
    timeInForce: OrderTimeInForceV5;
}

export class BybitApiClientInternal {
    constructor(private client: RestClientV5) {
    }

    async getPositionsInfo(symbol: string): Promise<PositionV5[]> {
        const resp = await this.client.getPositionInfo({category: 'linear', symbol});
        if (resp.retCode !== 0) throw new Error(`API error: ${resp.retMsg}`);
        return resp.result?.list ?? null;
    }

    async placeLimitOrder(params: PlaceLimitOrderParams) {
        const resp: any = await this.client.submitOrder({
            category: 'linear',
            symbol: params.symbol,
            orderType: 'Limit',
            side: params.side,
            qty: params.qty,
            price: params.price,
            timeInForce: params.timeInForce,
            positionIdx: 0,
        });
        if (resp.retCode !== 0) throw new Error(resp.retMsg);
        Logger.info('Order accepted', resp.result);
        return resp.result;
    }

    async fetchCandles(symbol: string, interval: string, limit: number): Promise<Candle[]> {
        const validInterval = interval as KlineIntervalV3;

        try {
            const resp = await this.client.getKline({
                category: 'linear',
                symbol,
                interval: validInterval,
                limit,
            });

            if (resp.retCode !== 0) {
                throw new Error(`Bybit API error: ${resp.retMsg}`);
            }
            const now = new Date().getTime();
            // Logger.info(`Now: ${now}`);
            //
            // const intervalInMs = intervalToMs(validInterval);
            // Logger.info(`intervalInMs: ${intervalInMs}`);


            const result = resp.result.list.map((element: any) => ({

                time: parseInt(element[0]),
                open: parseFloat(element[1]),
                high: parseFloat(element[2]),
                low: parseFloat(element[3]),
                close: parseFloat(element[4]),
                volume: parseFloat(element[5]),
                turnover: parseFloat(element[6]),
                confirm: (parseInt(element[0]) + intervalToMs(validInterval)) < now,
                rate: (parseFloat(element[4]) - parseFloat(element[1])) / parseFloat(element[1]),   //( kline.close - kline.open) / kline.open;
            }));
            return result;
        } catch (error: any) {
            Logger.error(`Failed to fetch candles for ${symbol} ${interval}: ${error.message || error}`);
            return [];
        }
    }

    async getInstrumentsInfo(category: 'spot' | 'linear' | 'inverse' = 'linear'): Promise<any[]> {
        const resp = await this.client.getInstrumentsInfo({category});
        if (resp.retCode !== 0) {
            throw new Error(`getInstrumentsInfo error: ${resp.retMsg}`);
        }
        return resp.result?.list ?? [];
    }

    async getActiveOrders(category: 'spot' | 'linear' | 'inverse', symbol: string): Promise<OrderV5[]> {
        const resp = await this.client.getActiveOrders({category, symbol});
        if (resp.retCode !== 0) {
            throw new Error(`getActiveOrders error: ${resp.retMsg}`);
        }
        return resp.result?.list ?? [];
    }
}
