import EventEmitter from 'events';
import { Logger } from './logger';

interface MarketConfig {
    symbol: string;
    tradeIntervals: string[];
}

/**
 * WebSocketListener оборачивает WebSocket подключения,
 * управляет подписками и эмитит события для менеджера и индикаторов.
 */
export class WebsocketListener extends EventEmitter {
    private wsPrivate: any; // Приватное WebSocket подключение
    private wsPublic: any;  // Публичное WebSocket подключение
    private marketsConfig: MarketConfig[]; // Конфигурация рынков для подписок

    /**
     * Конструктор принимает объекты WebSocket и конфигурацию рынков
     * Инициализирует слушатели событий WebSocket.
     */
    constructor(wsPrivate: any, wsPublic: any, marketsConfig: MarketConfig[]) {
        super();
        this.wsPrivate = wsPrivate;
        this.wsPublic = wsPublic;
        this.marketsConfig = marketsConfig;
        this.setupListeners();
    }

    /**
     * Устанавливает обработчики на события открытия, получения обновлений,
     * закрытия и ошибок WebSocket, как для приватного, так и публичного WS.
     */
    private setupListeners() {
        this.wsPrivate.on('open', async () => {
            Logger.info('Private WS connected');
            await this.subscribePrivate();
            this.emit('privateConnected');
        });

        this.wsPrivate.on('update', (data: any) => {
            this.emit('privateUpdate', data);
        });

        this.wsPrivate.on('close', async () => {
            Logger.warn('Private WS disconnected. Trying to reconnect...');
            setTimeout(() => this.wsPrivate.connect('v5Private'), 3000);
        });

        this.wsPrivate.on('exception', (err: Error) => {
            Logger.error('Private WS exception:', err);
        });

        this.wsPublic.on('open', async () => {
            Logger.info('Public WS connected');
            await this.subscribePublic();
            this.emit('publicConnected');
        });

        this.wsPublic.on('update', (data: any) => {
            if (data.topic.startsWith('kline.')) {
                const [_, interval, symbol] = data.topic.split('.');
                this.emit('candleUpdate', { symbol, interval, candle: data.data[0] });
            }
            if (data.topic.startsWith('ticker.')) {
                this.emit('tickerUpdate', data);
            }
            this.emit('publicUpdate', data);
        });

        this.wsPublic.on('close', async () => {
            Logger.warn('Public WS disconnected. Trying to reconnect...');
            setTimeout(() => this.wsPublic.connect('v5LinearPublic'), 3000);
        });

        this.wsPublic.on('exception', (err: Error) => {
            Logger.error('Public WS exception:', err);
        });
    }

    /**
     * Подписка на приватные WebSocket каналы
     */
    private async subscribePrivate() {
        await this.wsPrivate.subscribeV5(['position', 'order'], 'linear');
    }

    /**
     * Подписка на публичные WebSocket каналы рынков и интервалов
     */
    private async subscribePublic() {
        const subscriptions = this.marketsConfig.flatMap((cfg: MarketConfig) => [
            `tickers.${cfg.symbol}`,
            ...cfg.tradeIntervals.map((i: string) => `kline.${i}.${cfg.symbol}`),
        ]);
        await this.wsPublic.subscribeV5(subscriptions, 'linear');
    }

    /**
     * Запускает подключение к приватному и публичному WebSocket
     */
    async connect() {
        await this.wsPrivate.connect('v5Private');
        await this.wsPublic.connect('v5LinearPublic');
    }
}
