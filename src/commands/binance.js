import { Command } from "commander";
import chalk from "chalk";
import logger from "../utils/logger.js";
import { t } from "../utils/i18n.js";
import { fetchBinanceMovers, formatQuoteVolume } from "../utils/price-utils.js";
import {
    binancePublicGet,
    isBinancePublicEndpoint,
    normalizeBinanceMarket,
    normalizeBinanceSymbol,
    parseBinanceParams,
    resolveBinanceMarket
} from "../utils/binance-api.js";

const DEFAULT_LIMIT = "20";
const DEFAULT_KLINE_LIMIT = "100";
const DEFAULT_PERIOD = "5m";

function toNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

function fmt(value, digits = 2) {
    const n = toNumber(value);
    if (n === null) return value === undefined || value === null ? "--" : String(value);
    return Math.abs(n) >= 1000 ? n.toLocaleString("en-US", { maximumFractionDigits: digits }) : n.toFixed(digits);
}

function fmtPct(value) {
    const n = toNumber(value);
    if (n === null) return "--";
    return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

function fmtTime(value) {
    const n = toNumber(value);
    if (n === null) return "--";
    return new Date(n).toISOString().replace("T", " ").slice(0, 19);
}

function marketLabel(market) {
    return normalizeBinanceMarket(market) === "futures" ? "Futures" : "Spot";
}

function displaySymbol(symbol, market) {
    const normalized = normalizeBinanceSymbol(symbol);
    return market === "futures" ? `${normalized}.P` : normalized;
}

function printRows(rows, columns) {
    const widths = columns.map(col => Math.max(
        col.title.length,
        ...rows.map(row => String(col.value(row) ?? "").length)
    ));
    console.log(columns.map((col, i) => chalk.dim(col.title.padEnd(widths[i]))).join("  "));
    console.log(columns.map((_, i) => "─".repeat(widths[i])).join("  "));
    for (const row of rows) {
        console.log(columns.map((col, i) => String(col.value(row) ?? "").padEnd(widths[i])).join("  "));
    }
}

function withSymbolParams(symbol, extra = {}) {
    return { symbol: normalizeBinanceSymbol(symbol), ...extra };
}

async function getTicker(symbol, opts = {}) {
    const market = resolveBinanceMarket(symbol, opts.market);
    const data = await binancePublicGet("ticker/24hr", {
        market,
        params: symbol ? withSymbolParams(symbol) : {}
    });
    return { market, data };
}

function resolveCommandMarket(symbol, opts = {}) {
    return resolveBinanceMarket(symbol, opts.market || "auto");
}

async function getMarketData(path, symbol, opts = {}, extra = {}) {
    const market = resolveCommandMarket(symbol, opts);
    const data = await binancePublicGet(path, {
        market,
        params: withSymbolParams(symbol, extra)
    });
    return { market, data };
}

function handleError(e) {
    logger.error(e.message || String(e));
}

const binanceCmd = new Command("binance")
    .description(t("BINANCE_DESC"))
    .addHelpText("after", `\n${t("BINANCE_HELP_EXAMPLES")}`);

binanceCmd
    .command("price <symbol>")
    .description(t("BINANCE_PRICE_DESC"))
    .option("-m, --market <market>", "auto, spot, or futures", "auto")
    .option("--json", t("OPT_JSON_DESC"))
    .action(async (symbol, opts) => {
        try {
            const { market, data } = await getTicker(symbol, opts);
            const result = {
                market,
                symbol: data.symbol,
                price: data.lastPrice,
                changePercent: data.priceChangePercent,
                quoteVolume: data.quoteVolume,
                high: data.highPrice,
                low: data.lowPrice,
                closeTime: data.closeTime
            };
            if (opts.json) return logger.json(result);
            console.log(chalk.bold(`${marketLabel(market)} ${displaySymbol(data.symbol, market)}`));
            console.log(`Price: ${chalk.cyan(fmt(data.lastPrice, 8))}  24h: ${fmtPct(data.priceChangePercent)}  Vol: ${formatQuoteVolume(toNumber(data.quoteVolume))}`);
            console.log(chalk.dim(`High: ${fmt(data.highPrice, 8)}  Low: ${fmt(data.lowPrice, 8)}  Time: ${fmtTime(data.closeTime)}`));
        } catch (e) { handleError(e); }
    });

binanceCmd
    .command("ticker [symbol]")
    .description(t("BINANCE_TICKER_DESC"))
    .option("-m, --market <market>", "auto, spot, or futures", "auto")
    .option("-l, --limit <n>", "Limit rows when symbol is omitted", "20")
    .option("--json", t("OPT_JSON_DESC"))
    .action(async (symbol, opts) => {
        try {
            const market = symbol ? resolveCommandMarket(symbol, opts) : normalizeBinanceMarket(opts.market === "auto" ? "spot" : opts.market);
            const data = await binancePublicGet("ticker/24hr", {
                market,
                params: symbol ? withSymbolParams(symbol) : {}
            });
            if (opts.json) return logger.json(data);
            const rows = (Array.isArray(data) ? data : [data])
                .filter(item => String(item.symbol || "").endsWith("USDT"))
                .sort((a, b) => Number(b.quoteVolume || 0) - Number(a.quoteVolume || 0))
                .slice(0, Number(opts.limit) || 20);
            console.log(chalk.bold(`${marketLabel(market)} 24h Ticker${symbol ? `: ${displaySymbol(symbol, market)}` : ""}`));
            printRows(rows, [
                { title: "Symbol", value: r => r.symbol },
                { title: "Last", value: r => fmt(r.lastPrice, 8) },
                { title: "24h", value: r => fmtPct(r.priceChangePercent) },
                { title: "High", value: r => fmt(r.highPrice, 8) },
                { title: "Low", value: r => fmt(r.lowPrice, 8) },
                { title: "Quote Vol", value: r => formatQuoteVolume(toNumber(r.quoteVolume)) }
            ]);
        } catch (e) { handleError(e); }
    });

binanceCmd
    .command("movers")
    .description(t("BINANCE_MOVERS_DESC"))
    .option("-m, --market <market>", "spot or futures", "spot")
    .option("-l, --limit <n>", "Rows per side", "10")
    .option("--min-volume <n>", "Minimum quote volume", "1000000")
    .option("--json", t("OPT_JSON_DESC"))
    .action(async (opts) => {
        try {
            const data = await fetchBinanceMovers({
                market: opts.market,
                limit: Number(opts.limit) || 10,
                minQuoteVolume: Number(opts.minVolume) || 1000000
            });
            if (opts.json) return logger.json(data);
            console.log(chalk.bold(`${marketLabel(opts.market)} 24h Movers`));
            console.log(chalk.green("\nGainers"));
            printRows(data.gainers, [
                { title: "Symbol", value: r => r.symbol },
                { title: "24h", value: r => fmtPct(r.pctChange) },
                { title: "Price", value: r => r.price },
                { title: "Quote Vol", value: r => r.volumeLabel }
            ]);
            console.log(chalk.red("\nLosers"));
            printRows(data.losers, [
                { title: "Symbol", value: r => r.symbol },
                { title: "24h", value: r => fmtPct(r.pctChange) },
                { title: "Price", value: r => r.price },
                { title: "Quote Vol", value: r => r.volumeLabel }
            ]);
        } catch (e) { handleError(e); }
    });

binanceCmd
    .command("book <symbol>")
    .alias("depth")
    .description(t("BINANCE_BOOK_DESC"))
    .option("-m, --market <market>", "auto, spot, or futures", "auto")
    .option("-l, --limit <n>", "Depth limit", "20")
    .option("--json", t("OPT_JSON_DESC"))
    .action(async (symbol, opts) => {
        try {
            const { market, data } = await getMarketData("depth", symbol, opts, { limit: opts.limit });
            if (opts.json) return logger.json(data);
            console.log(chalk.bold(`${marketLabel(market)} Order Book: ${displaySymbol(symbol, market)}`));
            const size = Math.max(data.bids?.length || 0, data.asks?.length || 0);
            const rows = Array.from({ length: size }, (_, i) => ({
                bidPrice: data.bids?.[i]?.[0] || "",
                bidQty: data.bids?.[i]?.[1] || "",
                askPrice: data.asks?.[i]?.[0] || "",
                askQty: data.asks?.[i]?.[1] || ""
            }));
            printRows(rows, [
                { title: "Bid", value: r => r.bidPrice },
                { title: "Bid Qty", value: r => r.bidQty },
                { title: "Ask", value: r => r.askPrice },
                { title: "Ask Qty", value: r => r.askQty }
            ]);
        } catch (e) { handleError(e); }
    });

binanceCmd
    .command("trades <symbol>")
    .description(t("BINANCE_TRADES_DESC"))
    .option("-m, --market <market>", "auto, spot, or futures", "auto")
    .option("-l, --limit <n>", "Trade limit", DEFAULT_LIMIT)
    .option("--json", t("OPT_JSON_DESC"))
    .action(async (symbol, opts) => {
        try {
            const { market, data } = await getMarketData("trades", symbol, opts, { limit: opts.limit });
            if (opts.json) return logger.json(data);
            console.log(chalk.bold(`${marketLabel(market)} Recent Trades: ${displaySymbol(symbol, market)}`));
            printRows(data, [
                { title: "Time", value: r => fmtTime(r.time) },
                { title: "Price", value: r => r.price },
                { title: "Qty", value: r => r.qty },
                { title: "Side", value: r => r.isBuyerMaker ? "Sell" : "Buy" }
            ]);
        } catch (e) { handleError(e); }
    });

binanceCmd
    .command("klines <symbol>")
    .description(t("BINANCE_KLINES_DESC"))
    .option("-m, --market <market>", "auto, spot, or futures", "auto")
    .option("-i, --interval <interval>", "Kline interval", "1h")
    .option("-l, --limit <n>", "Kline limit", DEFAULT_KLINE_LIMIT)
    .option("--start-time <ms>", "Start time in milliseconds")
    .option("--end-time <ms>", "End time in milliseconds")
    .option("--json", t("OPT_JSON_DESC"))
    .action(async (symbol, opts) => {
        try {
            const { market, data } = await getMarketData("klines", symbol, opts, {
                interval: opts.interval,
                limit: opts.limit,
                startTime: opts.startTime,
                endTime: opts.endTime
            });
            if (opts.json) return logger.json(data);
            console.log(chalk.bold(`${marketLabel(market)} Klines: ${displaySymbol(symbol, market)} ${opts.interval}`));
            printRows(data, [
                { title: "Open Time", value: r => fmtTime(r[0]) },
                { title: "Open", value: r => r[1] },
                { title: "High", value: r => r[2] },
                { title: "Low", value: r => r[3] },
                { title: "Close", value: r => r[4] },
                { title: "Quote Vol", value: r => formatQuoteVolume(toNumber(r[7])) }
            ]);
        } catch (e) { handleError(e); }
    });

binanceCmd
    .command("funding <symbol>")
    .description(t("BINANCE_FUNDING_DESC"))
    .option("-l, --limit <n>", "Funding history rows", "8")
    .option("--json", t("OPT_JSON_DESC"))
    .action(async (symbol, opts) => {
        try {
            const params = withSymbolParams(symbol);
            const [premium, history] = await Promise.all([
                binancePublicGet("premiumIndex", { market: "futures", params }),
                binancePublicGet("fundingRate", { market: "futures", params: { ...params, limit: opts.limit } })
            ]);
            if (opts.json) return logger.json({ premium, history });
            console.log(chalk.bold(`Futures Funding: ${displaySymbol(symbol, "futures")}`));
            console.log(`Mark: ${fmt(premium.markPrice, 8)}  Index: ${fmt(premium.indexPrice, 8)}  Next: ${fmtPct(Number(premium.lastFundingRate) * 100)} @ ${fmtTime(premium.nextFundingTime)}`);
            printRows(history, [
                { title: "Time", value: r => fmtTime(r.fundingTime) },
                { title: "Rate", value: r => fmtPct(Number(r.fundingRate) * 100) },
                { title: "Mark", value: r => fmt(r.markPrice, 8) }
            ]);
        } catch (e) { handleError(e); }
    });

binanceCmd
    .command("oi <symbol>")
    .description(t("BINANCE_OI_DESC"))
    .option("-p, --period <period>", "5m, 15m, 30m, 1h, 2h, 4h, 6h, 12h, 1d", DEFAULT_PERIOD)
    .option("-l, --limit <n>", "History rows", "12")
    .option("--json", t("OPT_JSON_DESC"))
    .action(async (symbol, opts) => {
        try {
            const params = withSymbolParams(symbol);
            const [current, history] = await Promise.all([
                binancePublicGet("openInterest", { market: "futures", params }),
                binancePublicGet("openInterestHist", {
                    endpointGroup: "futuresData",
                    params: { ...params, period: opts.period, limit: opts.limit }
                })
            ]);
            if (opts.json) return logger.json({ current, history });
            console.log(chalk.bold(`Futures Open Interest: ${displaySymbol(symbol, "futures")}`));
            console.log(`Current OI: ${fmt(current.openInterest, 3)}  Time: ${fmtTime(current.time)}`);
            printRows(history, [
                { title: "Time", value: r => fmtTime(r.timestamp) },
                { title: "OI", value: r => fmt(r.sumOpenInterest, 3) },
                { title: "OI Value", value: r => formatQuoteVolume(toNumber(r.sumOpenInterestValue)) }
            ]);
        } catch (e) { handleError(e); }
    });

binanceCmd
    .command("sentiment <symbol>")
    .description(t("BINANCE_SENTIMENT_DESC"))
    .option("-p, --period <period>", "5m, 15m, 30m, 1h, 2h, 4h, 6h, 12h, 1d", DEFAULT_PERIOD)
    .option("-l, --limit <n>", "Rows", "12")
    .option("--json", t("OPT_JSON_DESC"))
    .action(async (symbol, opts) => {
        try {
            const params = withSymbolParams(symbol, { period: opts.period, limit: opts.limit });
            const [globalRatio, topAccount, topPosition, taker] = await Promise.all([
                binancePublicGet("globalLongShortAccountRatio", { endpointGroup: "futuresData", params }),
                binancePublicGet("topLongShortAccountRatio", { endpointGroup: "futuresData", params }),
                binancePublicGet("topLongShortPositionRatio", { endpointGroup: "futuresData", params }),
                binancePublicGet("takerlongshortRatio", { endpointGroup: "futuresData", params })
            ]);
            if (opts.json) return logger.json({ globalRatio, topAccount, topPosition, taker });
            console.log(chalk.bold(`Futures Sentiment: ${displaySymbol(symbol, "futures")} ${opts.period}`));
            const rows = globalRatio.map((item, i) => ({
                time: item.timestamp,
                global: item.longShortRatio,
                topAccount: topAccount[i]?.longShortRatio,
                topPosition: topPosition[i]?.longShortRatio,
                taker: taker[i]?.buySellRatio
            }));
            printRows(rows, [
                { title: "Time", value: r => fmtTime(r.time) },
                { title: "Global L/S", value: r => fmt(r.global, 3) },
                { title: "Top Acct", value: r => fmt(r.topAccount, 3) },
                { title: "Top Pos", value: r => fmt(r.topPosition, 3) },
                { title: "Taker B/S", value: r => fmt(r.taker, 3) }
            ]);
        } catch (e) { handleError(e); }
    });

binanceCmd
    .command("basis <symbol>")
    .description(t("BINANCE_BASIS_DESC"))
    .option("-p, --period <period>", "5m, 15m, 30m, 1h, 2h, 4h, 6h, 12h, 1d", DEFAULT_PERIOD)
    .option("-l, --limit <n>", "Rows", "12")
    .option("--json", t("OPT_JSON_DESC"))
    .action(async (symbol, opts) => {
        try {
            const data = await binancePublicGet("basis", {
                endpointGroup: "futuresData",
                params: { pair: normalizeBinanceSymbol(symbol), contractType: "PERPETUAL", period: opts.period, limit: opts.limit }
            });
            if (opts.json) return logger.json(data);
            console.log(chalk.bold(`Futures Basis: ${displaySymbol(symbol, "futures")} ${opts.period}`));
            printRows(data, [
                { title: "Time", value: r => fmtTime(r.timestamp) },
                { title: "Index", value: r => fmt(r.indexPrice, 8) },
                { title: "Contract", value: r => fmt(r.contractPrice ?? r.futuresPrice, 8) },
                { title: "Basis", value: r => fmt(r.basis, 8) },
                { title: "Rate", value: r => fmtPct(Number(r.basisRate) * 100) }
            ]);
        } catch (e) { handleError(e); }
    });

binanceCmd
    .command("exchange-info [symbol]")
    .description(t("BINANCE_EXCHANGE_INFO_DESC"))
    .option("-m, --market <market>", "auto, spot, or futures", "auto")
    .option("--json", t("OPT_JSON_DESC"))
    .action(async (symbol, opts) => {
        try {
            const market = symbol ? resolveCommandMarket(symbol, opts) : normalizeBinanceMarket(opts.market === "auto" ? "spot" : opts.market);
            const params = symbol ? withSymbolParams(symbol) : {};
            const data = await binancePublicGet("exchangeInfo", { market, params });
            if (opts.json) return logger.json(data);
            const symbols = symbol ? data.symbols || [] : (data.symbols || []).slice(0, 50);
            console.log(chalk.bold(`${marketLabel(market)} Exchange Info${symbol ? `: ${displaySymbol(symbol, market)}` : ""}`));
            printRows(symbols, [
                { title: "Symbol", value: r => r.symbol },
                { title: "Status", value: r => r.status },
                { title: "Base", value: r => r.baseAsset },
                { title: "Quote", value: r => r.quoteAsset },
                { title: "Order Types", value: r => (r.orderTypes || []).slice(0, 4).join(",") }
            ]);
            if (!symbol && (data.symbols || []).length > symbols.length) {
                console.log(chalk.dim(`... ${data.symbols.length - symbols.length} more symbols. Use --json for full output.`));
            }
        } catch (e) { handleError(e); }
    });

binanceCmd
    .command("raw <path>")
    .description(t("BINANCE_RAW_DESC"))
    .option("-m, --market <market>", "spot or futures", "spot")
    .option("-p, --param <pair...>", "Query parameter, e.g. symbol=BTCUSDT")
    .option("--json", t("OPT_JSON_DESC"))
    .action(async (path, opts) => {
        try {
            if (!isBinancePublicEndpoint(path, { market: opts.market })) {
                return logger.error(`Unsupported Binance public endpoint: ${path}`);
            }
            const data = await binancePublicGet(path, {
                market: opts.market,
                params: parseBinanceParams(opts.param || [])
            });
            logger.json(data);
        } catch (e) { handleError(e); }
    });

export default binanceCmd;
