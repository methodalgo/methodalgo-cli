import { Command } from "commander";
import chalk from "chalk";
import { signedRequest } from "../utils/api.js";
import logger from "../utils/logger.js";
import { t } from "../utils/i18n.js";
import { helpExample, helpList, helpSection } from "../utils/help-format.js";

const TOTALS_METRICS = [
    { command: "btc-dominance", metric: "btcDominance", key: "btcDominance", labelKey: "LABEL_BTC_DOMINANCE", format: value => formatPctValue(value) },
    { command: "eth-dominance", metric: "ethDominance", key: "ethDominance", labelKey: "LABEL_ETH_DOMINANCE", format: value => formatPctValue(value) },
    { command: "total-market-cap", metric: "totalMarketCap", key: "totalMarketCap", labelKey: "LABEL_TOTAL_MARKET_CAP", format: (value, data) => formatMoney(value, data.convert) },
    { command: "fear-greed", metric: "fearAndGreed", key: "fearAndGreed", labelKey: "LABEL_FEAR_GREED", format: value => value ? `${value.value} ${value.classification || ""}`.trim() : t("LABEL_NA") },
    { command: "altseason-index", metric: "altcoinSeason", key: "altcoinSeason", labelKey: "LABEL_ALTCOIN_SEASON", format: value => value ? String(value.value ?? t("LABEL_NA")) : t("LABEL_NA") }
];

async function requestMacro(type, params = {}, options = {}) {
    try {
        const res = await signedRequest("/cli/macro", { type, ...params });
        const { status, data, message } = res.data || {};
        if (!status) {
            if (!options.silent) logger.error(`${t("ERR_NETWORK")}: ${message || t("ERR_TOTALS_REQUEST_FAILED")}`);
            return null;
        }
        return data;
    } catch (error) {
        const message = error.response?.data?.message || error.message || t("ERR_TOTALS_REQUEST_FAILED");
        if (!options.silent) logger.error(`${t("ERR_NETWORK")}: ${message}`);
        return null;
    }
}

const totalsCmd = new Command("totals")
    .description(t("TOTALS_DESC"))
    .option("--convert <symbol>", t("OPT_CONVERT_DESC"), "USD")
    .option("--history <range>", t("OPT_TOTALS_HISTORY_DESC"))
    .option("--json", t("OPT_JSON_DESC"))
    .addHelpText("after", `\n${formatTotalsHelp()}`)
    .action(async (opts) => {
        if (totalsCmd.args.length === 0 && !opts.history && !opts.json && opts.convert === "USD") return totalsCmd.help();
        const data = await fetchTotalsSummary(opts);
        if (!data) return;
        if (opts.json) return logger.json(data);
        printTotalsSummary(data);
    });

TOTALS_METRICS.forEach(metric => {
    totalsCmd
        .command(metric.command)
        .description(metricLabel(metric))
        .option("--convert <symbol>", t("OPT_CONVERT_DESC"), "USD")
        .option("--history <range>", t("OPT_TOTALS_HISTORY_DESC"))
        .option("--json", t("OPT_JSON_DESC"))
        .action(async (...args) => {
            const argOpts = args.find(arg => arg && arg.constructor === Object) || {};
            const command = args.find(arg => typeof arg?.opts === "function");
            const cmdOpts = command?.opts() || {};
            const parentOpts = command?.parent?.opts?.() || {};
            const opts = { ...argOpts, ...cmdOpts, ...parentOpts };
            const data = await fetchTotalsMetric(metric, opts);
            if (!data) return;
            if (opts.json) return logger.json(data);
            printTotalsMetric(data);
        });
});

function formatTotalsHelp() {
    const title = t("TOTALS_METRICS_TITLE");
    const exampleTitle = t("LABEL_EXAMPLE");
    return [
        helpSection(title, helpList(TOTALS_METRICS.map(metric => [metric.command, metricLabel(metric)]))),
        helpSection(exampleTitle, helpExample("methodalgo totals btc-dominance --json"))
    ].join("\n\n");
}

async function fetchTotalsSummary(opts) {
    const environment = await requestMarketEnvironment(opts);
    if (!environment) return null;
    const metrics = Object.fromEntries(TOTALS_METRICS.map(metric => [
        metric.metric,
        buildMetricPayload(metric, environment)
    ]));
    if (opts.history) {
        await Promise.all(TOTALS_METRICS.map(async metric => {
            metrics[metric.metric].history = await requestMarketHistory(metric, opts);
        }));
    }
    return {
        command: "totals",
        convert: environment.convert || opts.convert || "USD",
        source: environment.source,
        updatedAt: environment.updatedAt || environment.cachedAt || null,
        metrics
    };
}

async function fetchTotalsMetric(metric, opts) {
    const environment = await requestMarketEnvironment(opts);
    if (!environment) return null;
    const payload = {
        command: `totals ${metric.command}`,
        convert: environment.convert || opts.convert || "USD",
        source: environment.source,
        ...buildMetricPayload(metric, environment)
    };
    if (opts.history) payload.history = await requestMarketHistory(metric, opts);
    return payload;
}

async function requestMarketHistory(metric, opts) {
    return requestMacro("market-history", {
        metric: metric.metric,
        timeframe: opts.history,
        convert: opts.convert
    });
}

async function requestMarketEnvironment(opts) {
    const environment = await requestMacro("market-environment", { convert: opts.convert }, { silent: true });
    if (environment) return environment;

    const fallback = await requestMarketTodayTotals();
    if (fallback) return fallback;

    logger.error(`${t("ERR_NETWORK")}: ${t("ERR_TOTALS_REQUEST_FAILED")}`);
    return null;
}

async function requestMarketTodayTotals() {
    try {
        const res = await signedRequest("/cli/signals", {
            channelName: "market-today",
            limit: 1
        });
        const { status, data, message } = res.data || {};
        if (!status) {
            logger.error(`${t("ERR_NETWORK")}: ${message || t("ERR_TOTALS_REQUEST_FAILED")}`);
            return null;
        }
        const marketTotals = Array.isArray(data)
            ? data.find(item => item?.marketTotals)?.marketTotals
            : data?.marketTotals;
        if (!marketTotals) return null;
        return {
            convert: marketTotals.convert || "USD",
            source: marketTotals.source || "market-today",
            updatedAt: marketTotals.updatedAt || marketTotals.cachedAt || null,
            cachedAt: marketTotals.cachedAt,
            btcDominance: marketTotals.btcDominance,
            ethDominance: marketTotals.ethDominance,
            totalMarketCap: marketTotals.totalMarketCap,
            fearAndGreed: marketTotals.fearAndGreed,
            altcoinSeason: marketTotals.altcoinSeason
        };
    } catch (error) {
        return null;
    }
}

function buildMetricPayload(metric, environment) {
    const raw = environment[metric.key];
    return {
        metric: metric.metric,
        label: metricLabel(metric),
        value: raw?.value ?? raw ?? null,
        displayValue: metric.format(raw, environment),
        raw
    };
}

function printTotalsSummary(data) {
    console.log(chalk.bold(t("TOTALS_TITLE")));
    Object.values(data.metrics).forEach(metric => {
        console.log(`  ${chalk.cyan(metric.label.padEnd(18))} ${metric.displayValue}`);
        printHistoryLine(metric.history);
    });
}

function printTotalsMetric(data) {
    console.log(chalk.bold(data.label));
    [
        [t("LABEL_METRIC"), data.metric],
        [t("LABEL_VALUE"), data.displayValue],
        [t("LABEL_SOURCE"), data.source],
        [t("LABEL_CONVERT"), data.convert]
    ].forEach(([key, value]) => {
        if (value !== undefined && value !== null) console.log(`${chalk.dim(key)}: ${value}`);
    });
    printHistoryLine(data.history);
}

function printHistoryLine(history) {
    if (!history?.points?.length) return;
    const latest = history.points[history.points.length - 1];
    console.log(chalk.dim(`    ${t("LABEL_HISTORY")} ${history.timeframe}: ${history.points.length} ${t("LABEL_POINTS").toLowerCase()}, ${t("LABEL_LATEST").toLowerCase()} ${latest.time} ${latest.value}`));
}

function metricLabel(metric) {
    return t(metric.labelKey);
}

function formatPctValue(value) {
    const number = Number(value);
    return Number.isFinite(number) ? `${number.toFixed(2)}%` : value;
}

function formatMoney(value, convert = "USD") {
    const number = Number(value);
    if (!Number.isFinite(number)) return value;
    if (Math.abs(number) >= 1000000000000) return `${convert} ${(number / 1000000000000).toFixed(2)}T`;
    if (Math.abs(number) >= 1000000000) return `${convert} ${(number / 1000000000).toFixed(2)}B`;
    if (Math.abs(number) >= 1000000) return `${convert} ${(number / 1000000).toFixed(2)}M`;
    return `${convert} ${number.toFixed(2)}`;
}

export default totalsCmd;
