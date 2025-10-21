import {WebsocketClient, WsKey} from 'bybit-api';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
    const API_KEY = process.env.API_KEY || '';
    const API_SECRET = process.env.API_SECRET || '';
    const symbol = 'XRPUSDT';

    if (!API_KEY || !API_SECRET) {
        console.error('API credentials missing');
        return;
    }


    // Приватный WebSocket клиент
    const wsPrivate = new WebsocketClient({
        key: API_KEY,
        secret: API_SECRET,
        testnet: false,
        market: 'v5',
    });

    wsPrivate.on('open', () => {
        console.log('Private WS connected');
        //wsPrivate.subscribeV5([`position.${symbol}`], 'linear'); // подписка только на приватный топик
        wsPrivate.subscribeV5(['position', 'order'], 'linear');

    });

    wsPrivate.on('update', (data) => {
        console.log('Message received');
        console.log(data.data);
        if (data.topic === `position.${symbol}`) {
            console.log('Private position update:', data.data);
        }
    });

    wsPrivate.on('exception', (err) => {
        console.error('Private WS exception:', err);
    });

    wsPrivate.on('close', () => console.log('Private WS closed'));

    await wsPrivate.connect('v5Private' as WsKey);

    // Публичный WebSocket клиент
    const wsPublic = new WebsocketClient({
        testnet: false,
        market: 'v5',
    });

    wsPublic.on('open', () => {
        console.log('Public WS connected');
        wsPublic.subscribeV5([`kline.1.${symbol}`], 'linear'); // подписка только на публичный топик
    });

    wsPublic.on('update', (data) => {
        if (data.topic.startsWith('kline.')) {
            console.log('Public kline update:', data.data);
        }
    });

    wsPublic.on('exception', (err) => {
        console.error('Public WS exception:', err);
    });

    wsPublic.on('close', () => console.log('Public WS closed'));

    await wsPublic.connect('v5LinearPublic' as WsKey);
}

main().catch(console.error);