// src/singleton-clients.ts
import { RestClientV5, WebsocketClient } from 'bybit-api';
import { RestClientTestnet, WsClientTestnet } from './config';
import dotenv from 'dotenv';
dotenv.config();

export class BybitRestSingleton {
    private static instance: RestClientV5;

    private constructor() {}

    public static getInstance(): RestClientV5 {
        if (!BybitRestSingleton.instance) {
            BybitRestSingleton.instance = new RestClientV5({
                key: process.env.API_KEY || '',
                secret: process.env.API_SECRET || '',
                testnet: RestClientTestnet,
            });
        }
        return BybitRestSingleton.instance;
    }
}

export class BybitWsSingleton {
    private static privateClient: WebsocketClient;
    private static publicClient: WebsocketClient;

    private constructor() {}

    public static getPrivateInstance(): WebsocketClient {
        if (!BybitWsSingleton.privateClient) {
            BybitWsSingleton.privateClient = new WebsocketClient({
                key: process.env.API_KEY || '',
                secret: process.env.API_SECRET || '',
                market: 'v5',
                testnet: WsClientTestnet,
            });
        }
        return BybitWsSingleton.privateClient;
    }

    public static getPublicInstance(): WebsocketClient {
        if (!BybitWsSingleton.publicClient) {
            BybitWsSingleton.publicClient = new WebsocketClient({
                market: 'v5',
                testnet: WsClientTestnet,
            });
        }
        return BybitWsSingleton.publicClient;
    }
}
