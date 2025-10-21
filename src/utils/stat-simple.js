"use strict";
// Установите зависимости:
// npm install bybit-api
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const rest_client_1 = require("./algo/rest-client");
const green = (text) => `\x1b[32m${text}\x1b[0m`;
const red = (text) => `\x1b[31m${text}\x1b[0m`;
function main(hours, minutes) {
    var _a, _b;
    return __awaiter(this, void 0, void 0, function* () {
        const client = rest_client_1.REST_CLIENT;
        const endTime = Date.now();
        //const startTime = endTime - hours * 60 * 60 * 1000;
        const startTime = endTime - (hours * 60 + minutes) * 60 * 1000;
        let cursor = undefined;
        const statsBySymbol = {};
        let totalLongProfit = 0, totalLongLoss = 0;
        let totalShortProfit = 0, totalShortLoss = 0;
        try {
            do {
                const response = yield client.getClosedPnL({
                    category: 'linear',
                    startTime,
                    endTime,
                    limit: 200,
                    cursor,
                });
                const list = ((_a = response.result) === null || _a === void 0 ? void 0 : _a.list) || [];
                list.forEach((trade) => {
                    const symbol = trade.symbol;
                    if (!symbol)
                        return;
                    const pnl = parseFloat(trade.closedPnl);
                    if (isNaN(pnl))
                        return;
                    // Инициализация данных по инструменту
                    if (!statsBySymbol[symbol]) {
                        statsBySymbol[symbol] = { profit: 0, loss: 0, lossCount: 0, winCount: 0 };
                    }
                    if (pnl > 0) {
                        statsBySymbol[symbol].winCount++;
                        statsBySymbol[symbol].profit += pnl;
                        if (trade.side === 'Buy' || trade.side.toLowerCase() === 'long') {
                            totalLongProfit += pnl;
                        }
                        else if (trade.side === 'Sell' || trade.side.toLowerCase() === 'short') {
                            totalShortProfit += pnl;
                        }
                    }
                    else if (pnl < 0) {
                        statsBySymbol[symbol].lossCount++;
                        statsBySymbol[symbol].loss += pnl;
                        if (trade.side === 'Buy' || trade.side.toLowerCase() === 'long') {
                            totalLongLoss += pnl;
                        }
                        else if (trade.side === 'Sell' || trade.side.toLowerCase() === 'short') {
                            totalShortLoss += pnl;
                        }
                    }
                });
                cursor = (_b = response.result) === null || _b === void 0 ? void 0 : _b.nextPageCursor;
            } while (cursor);
            const sortedSymbols = Object.entries(statsBySymbol).sort(([, a], [, b]) => (a.profit + a.loss) - (b.profit + b.loss));
            console.log(`Инструменты за последние ${hours} часов/а, ${minutes} минут отсортированные по доходу:`);
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
            console.log(`Лонг: Прибыль = ${green(totalLongProfit.toFixed(4))}, Убыток = ${red(totalLongLoss.toFixed(4))}, Доход = ${totalLongNet >= 0 ? green(totalLongNet.toFixed(4)) : red(totalLongNet.toFixed(4))}`);
            console.log(`Шорт: Прибыль = ${green(totalShortProfit.toFixed(4))}, Убыток = ${red(totalShortLoss.toFixed(4))}, Доход = ${totalShortNet >= 0 ? green(totalShortNet.toFixed(4)) : red(totalShortNet.toFixed(4))}`);
            console.log(`Общий доход (Лонг + Шорт): ${overallNet >= 0 ? green(overallNet.toFixed(4)) : red(overallNet.toFixed(4))}`);
        }
        catch (error) {
            console.error('Ошибка при получении данных:', error);
        }
    });
}
main(1, 30);
