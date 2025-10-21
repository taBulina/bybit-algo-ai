import { BybitRestSingleton } from "../singleton-clients";

const green = (text: string) => `\x1b[32m${text}\x1b[0m`;
const red = (text: string) => `\x1b[31m${text}\x1b[0m`;

interface StatsParams {
    hours?: number;
    minutes?: number;
    startMskTime?: string; // формат "YYYY-MM-DD HH:mm"
}

// Корректное преобразование московского времени (UTC+3) в UTC
function moscowToUTC(moscowDate: Date): Date {
    // Смещение МСК относительно UTC составляет +3 часа (UTC+3)
    const moscowOffsetMinutes = -new Date().toLocaleString("en-US", {
        timeZone: "Europe/Moscow"
    });
    // Но правильнее воспользоваться getTimezoneOffset для конкретного TZ:
    const utcTimestamp = moscowDate.getTime(); // - (3 * 60 * 60 * 1000);
    return new Date(utcTimestamp);
}

async function main(params: StatsParams) {
    const { hours = 0, minutes = 0, startMskTime } = params;
    const client = BybitRestSingleton.getInstance();

    const endTime = Date.now();
    let startTime: number;

    if (startMskTime) {
        const parsedLocal = new Date(startMskTime.replace(' ', 'T') + ':00');
        const utcDate = moscowToUTC(parsedLocal);
        startTime = utcDate.getTime();
        console.log(`Время начала (MSK): ${parsedLocal.toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}`);
        console.log(`Конвертировано в UTC: ${utcDate.toISOString()}`);
    } else {
        startTime = endTime - ((hours * 60 + minutes) * 60 * 1000);
    }

    let cursor: string | undefined = undefined;
    const statsBySymbol: Record<string, { profit: number; loss: number; winCount: number; lossCount: number }> = {};
    let totalLongProfit = 0, totalLongLoss = 0;
    let totalShortProfit = 0, totalShortLoss = 0;

    try {
        do {
            const response = await client.getClosedPnL({
                category: 'linear',
                startTime,
                endTime,
                limit: 200,
                cursor,
            });

            const list = response.result?.list || [];

            list.forEach((trade) => {
                const symbol = trade.symbol;
                if (!symbol) return;

                const pnl = parseFloat(trade.closedPnl);
                if (isNaN(pnl)) return;

                if (!statsBySymbol[symbol]) {
                    statsBySymbol[symbol] = { profit: 0, loss: 0, winCount: 0, lossCount: 0 };
                }

                if (pnl > 0) {
                    statsBySymbol[symbol].winCount++;
                    statsBySymbol[symbol].profit += pnl;
                    if (trade.side === 'Buy' || trade.side.toLowerCase() === 'long') totalLongProfit += pnl;
                    else if (trade.side === 'Sell' || trade.side.toLowerCase() === 'short') totalShortProfit += pnl;
                } else if (pnl < 0) {
                    statsBySymbol[symbol].lossCount++;
                    statsBySymbol[symbol].loss += pnl;
                    if (trade.side === 'Buy' || trade.side.toLowerCase() === 'long') totalLongLoss += pnl;
                    else if (trade.side === 'Sell' || trade.side.toLowerCase() === 'short') totalShortLoss += pnl;
                }
            });

            cursor = response.result?.nextPageCursor;
        } while (cursor);

        const sortedSymbols = Object.entries(statsBySymbol).sort(
            ([, a], [, b]) => (a.profit + a.loss) - (b.profit + b.loss)
        );

        console.log(`\nИнструменты (с ${new Date(startTime).toISOString()} UTC):`);
        for (const [symbol, { profit, loss, winCount, lossCount }] of sortedSymbols) {
            const net = profit + loss;
            const profitStr = profit > 0 ? green(profit.toFixed(4)) : profit.toFixed(4);
            const lossStr = loss < 0 ? red(loss.toFixed(4)) : loss.toFixed(4);
            const netStr = net > 0 ? green(net.toFixed(4)) : net < 0 ? red(net.toFixed(4)) : net.toFixed(4);
            console.log(`${symbol} — Прибыль: ${profitStr}, Убыток: ${lossStr}. W/L: ${winCount}/${lossCount}. Доход: ${netStr}`);
        }

        const totalLongNet = totalLongProfit + totalLongLoss;
        const totalShortNet = totalShortProfit + totalShortLoss;
        const overallNet = totalLongNet + totalShortNet;

        console.log('\nОбщая статистика по позициям:');
        console.log(`Лонг: Прибыль = ${green(totalLongProfit.toFixed(4))}, Убыток = ${red(totalLongLoss.toFixed(4))}, Доход = ${(totalLongNet >= 0 ? green(totalLongNet.toFixed(4)) : red(totalLongNet.toFixed(4)))}`);
        console.log(`Шорт: Прибыль = ${green(totalShortProfit.toFixed(4))}, Убыток = ${red(totalShortLoss.toFixed(4))}, Доход = ${(totalShortNet >= 0 ? green(totalShortNet.toFixed(4)) : red(totalShortNet.toFixed(4)))}`);
        console.log(`Общий доход: ${overallNet >= 0 ? green(overallNet.toFixed(4)) : red(overallNet.toFixed(4))}`);
    } catch (error) {
        console.error('Ошибка при получении данных:', error);
    }
}

// Примеры использования:
// main({ hours: 6 });                             // за последние 6 часов
// main({ hours: 1, minutes: 30 });                // за последние 1.5 часа
main({ startMskTime: '2025-10-21 11:00' });     // от конкретного МСК времени
