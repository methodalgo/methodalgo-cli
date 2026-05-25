import { Command } from "commander";
import chalk from "chalk";
import { signedRequest } from "../utils/api.js";
import logger from "../utils/logger.js";
import { t } from "../utils/i18n.js";
import { helpExample, helpSection } from "../utils/help-format.js";

async function requestMacro(type, params = {}, opts = {}) {
    try {
        const res = await signedRequest("/cli/macro", { type, ...params });
        const { status, data, message } = res.data || {};
        if (!status) {
            if (!opts.silent) logger.error(`${t("ERR_NETWORK")}: ${message || t("ERR_MACRO_REQUEST_FAILED")}`);
            return null;
        }
        if (opts.json) logger.json(data);
        return data;
    } catch (error) {
        const message = error.response?.data?.message || error.message || t("ERR_MACRO_REQUEST_FAILED");
        if (!opts.silent) logger.error(`${t("ERR_NETWORK")}: ${message}`);
        return null;
    }
}

async function requestMarketEnvironment(params = {}, opts = {}) {
    const data = await requestMacro("market-environment", params, { ...opts, silent: true, json: false });
    if (data) {
        if (opts.json) logger.json(data);
        return data;
    }

    const fallback = await requestMarketTodayTotals();
    if (fallback) {
        if (opts.json) logger.json(fallback);
        return fallback;
    }

    logger.error(`${t("ERR_NETWORK")}: ${t("ERR_MACRO_REQUEST_FAILED")}`);
    return null;
}

async function requestMarketTodayTotals() {
    try {
        const res = await signedRequest("/cli/signals", {
            channelName: "market-today",
            limit: 1
        });
        const { status, data } = res.data || {};
        if (!status) return null;
        const marketTotals = Array.isArray(data)
            ? data.find(item => item?.marketTotals)?.marketTotals
            : data?.marketTotals;
        if (!marketTotals) return null;
        return {
            convert: marketTotals.convert || "USD",
            btcDominance: marketTotals.btcDominance,
            ethDominance: marketTotals.ethDominance,
            totalMarketCap: marketTotals.totalMarketCap,
            totalVolume24h: marketTotals.totalVolume24h,
            fearAndGreed: marketTotals.fearAndGreed,
            altcoinSeason: marketTotals.altcoinSeason,
            source: marketTotals.source || "market-today",
            cachedAt: marketTotals.cachedAt,
            expiresAt: marketTotals.expiresAt
        };
    } catch (error) {
        return null;
    }
}

function fmtVal(value, decimals = 2) {
    if (value === null || value === undefined || value === ".") return t("LABEL_NA");
    const number = Number(value);
    if (!Number.isFinite(number)) return String(value);
    return Math.abs(number) >= 1000 ? number.toLocaleString("en-US", { maximumFractionDigits: decimals }) : number.toFixed(decimals);
}

function fmtDollarsB(value) {
    if (value === null || value === undefined) return t("LABEL_NA");
    return Math.abs(value) >= 1000 ? `$${(value / 1000).toFixed(2)}T` : `$${value.toFixed(1)}B`;
}

function printKeyValues(title, rows) {
    console.log(chalk.bold(title));
    for (const [key, value] of rows) {
        if (value !== undefined && value !== null) console.log(`${chalk.dim(key)}: ${value}`);
    }
}

const macroCmd = new Command("macro")
    .description(t("MACRO_DESC"))
    .addHelpText("after", `\n${formatMacroHelp()}`);

function formatMacroHelp() {
    const lines = t("MACRO_HELP_EXAMPLES").split("\n").filter(Boolean);
    const title = lines.shift() || "";
    const examples = lines.map(line => helpExample(line.replace(/^\s*\$\s*/, ""))).join("\n");
    return helpSection(title, examples);
}

macroCmd
    .command("environment")
    .description(t("MACRO_ENV_DESC"))
    .option("--convert <symbol>", t("OPT_CONVERT_DESC"), "USD")
    .option("--json", t("OPT_JSON_DESC"))
    .action(async (opts) => {
        const data = await requestMarketEnvironment({ convert: opts.convert }, opts);
        if (!data || opts.json) return;
        printKeyValues(t("MACRO_ENV_TITLE"), [
            [t("LABEL_BTC_DOMINANCE"), formatPctValue(data.btcDominance)],
            [t("LABEL_ETH_DOMINANCE"), formatPctValue(data.ethDominance)],
            [t("LABEL_TOTAL_MARKET_CAP"), formatMoney(data.totalMarketCap, data.convert)],
            [t("LABEL_24H_VOLUME"), formatMoney(data.totalVolume24h, data.convert)],
            [t("LABEL_FEAR_GREED"), data.fearAndGreed ? `${data.fearAndGreed.value} ${data.fearAndGreed.classification || ""}`.trim() : null],
            [t("LABEL_ALTCOIN_SEASON"), data.altcoinSeason ? data.altcoinSeason.value : null]
        ]);
    });

macroCmd
    .command("history <metric>")
    .description(t("MACRO_HISTORY_DESC"))
    .option("--timeframe <range>", t("OPT_MARKET_HISTORY_TIMEFRAME_DESC"), "90d")
    .option("--convert <symbol>", t("OPT_CONVERT_DESC"), "USD")
    .option("--json", t("OPT_JSON_DESC"))
    .action(async (metric, opts) => {
        const data = await requestMacro("market-history", { metric, timeframe: opts.timeframe, convert: opts.convert }, opts);
        if (!data || opts.json) return;
        const points = data.points || [];
        const latest = points[points.length - 1];
        printKeyValues(t("MACRO_HISTORY_TITLE", { metric: data.metric || metric }), [
            [t("LABEL_TIMEFRAME"), data.timeframe || opts.timeframe],
            [t("LABEL_POINTS"), points.length],
            [t("LABEL_LATEST"), latest ? `${latest.time} ${latest.value}` : null]
        ]);
    });

macroCmd
    .command("snapshot")
    .description(t("MACRO_SNAPSHOT_DESC"))
    .option("--region <code>", t("OPT_REGION_DESC"), "US")
    .option("--no-calendar", t("OPT_NO_CALENDAR_DESC"))
    .option("--json", t("OPT_JSON_DESC"))
    .action(async (opts) => {
        const data = await requestMacro("macro-snapshot", { region: opts.region, includeCalendar: opts.calendar }, opts);
        if (!data || opts.json) return;
        console.log(chalk.bold(t("MACRO_SNAPSHOT_TITLE", { region: data.region || opts.region })));
        for (const [group, items] of Object.entries(data.groups || {})) {
            console.log(chalk.cyan(`\n${group}`));
            for (const item of items) console.log(`  ${item.label || item.seriesId}: ${item.value} ${item.unit || ""} ${chalk.dim(item.time || "")}`.trim());
        }
        if (data.calendar?.length) console.log(chalk.dim(`\n${t("LABEL_CALENDAR_EVENTS")}: ${data.calendar.length}`));
    });

macroCmd
    .command("series <source> <seriesId>")
    .description(t("MACRO_SERIES_DESC"))
    .option("--timeframe <range>", t("OPT_MACRO_SERIES_TIMEFRAME_DESC"), "1y")
    .option("--json", t("OPT_JSON_DESC"))
    .action(async (source, seriesId, opts) => {
        const data = await requestMacro("macro-series", { source, seriesId, timeframe: opts.timeframe }, opts);
        if (!data || opts.json) return;
        const points = data.points || [];
        const latest = points[points.length - 1];
        printKeyValues(data.label || data.seriesId || seriesId, [
            [t("LABEL_SOURCE"), data.source || source],
            [t("LABEL_TIMEFRAME"), data.timeframe || opts.timeframe],
            [t("LABEL_POINTS"), points.length],
            [t("LABEL_LATEST"), latest ? `${latest.time} ${latest.value} ${data.unit || ""}`.trim() : null]
        ]);
    });

macroCmd
    .command("calendar")
    .description(t("MACRO_CALENDAR_DESC"))
    .option("-c, --countries <codes>", t("OPT_COUNTRIES_DESC"), "US")
    .option("-f, --from <date>", `${t("OPT_CALENDAR_FROM_DESC")} (${t("LABEL_FORMAT")}: YYYY-MM-DD)`)
    .option("-t, --to <date>", `${t("OPT_CALENDAR_TO_DESC")} (${t("LABEL_FORMAT")}: YYYY-MM-DD)`)
    .option("--min-importance <n>", t("OPT_MIN_IMPORTANCE_DESC"), "1")
    .option("--json", t("OPT_JSON_DESC"))
    .action(async (opts) => {
        const data = await requestMacro("calendar", { countries: opts.countries, from: opts.from, to: opts.to, minImportance: opts.minImportance }, opts);
        if (!data || opts.json) return;
        const events = data.events || [];
        console.log(chalk.bold(`${t("LABEL_ECONOMIC_CALENDAR")} (${events.length})`));
        for (const item of events.slice(0, 20)) {
            const date = item.date ? new Date(item.date).toISOString().replace("T", " ").slice(0, 16) : "--";
            console.log(`${chalk.dim(date)} ${chalk.cyan(item.country || "")} ${item.title || ""}`);
        }
    });

macroCmd
    .command("search <query>")
    .description(t("MACRO_SEARCH_DESC"))
    .option("-l, --limit <n>", t("OPT_MAX_RESULTS_DESC"), "10")
    .option("--order <field>", t("OPT_FRED_ORDER"), "search_rank")
    .option("--sort <dir>", t("OPT_SORT_DESC"), "desc")
    .option("--tag <names>", t("OPT_TAG_DESC"))
    .option("--json", t("OPT_JSON_DESC"))
    .action(async (query, opts) => {
        const data = await requestMacro("fred-search", { query, limit: opts.limit, order: opts.order, sort: opts.sort, tag: opts.tag }, opts);
        if (!data || opts.json) return;
        const results = data.results || [];
        if (!results.length) return logger.info(t("MSG_NO_RESULTS_FOR", { query }));
        console.log(chalk.bold(`${t("LABEL_SEARCH")}: "${query}" (${results.length} ${t("LABEL_RESULTS").toLowerCase()})\n`) + "-".repeat(70));
        for (const item of results) {
            console.log(`\n  ${chalk.cyan(item.id)} - ${item.title}`);
            console.log(`  ${chalk.dim(`${item.frequency || ""} | ${item.units || ""} | ${t("LABEL_POPULARITY")}: ${item.popularity || t("LABEL_NA")} | ${t("LABEL_LAST")}: ${item.observation_end || t("LABEL_NA")}`)}`);
        }
    });

macroCmd
    .command("get <seriesId>")
    .description(t("MACRO_GET_DESC"))
    .option("--tail <n>", t("OPT_FRED_TAIL"))
    .option("--start <date>", t("OPT_START_DATE_DESC"))
    .option("--end <date>", t("OPT_END_DATE_DESC"))
    .option("--units <u>", t("OPT_UNITS_DESC"))
    .option("--frequency <f>", t("OPT_FREQUENCY_DESC"))
    .option("--json", t("OPT_JSON_DESC"))
    .action(async (seriesId, opts) => {
        const data = await requestMacro("fred-get", { seriesId, tail: opts.tail, start: opts.start, end: opts.end, units: opts.units, frequency: opts.frequency }, opts);
        if (!data || opts.json) return;
        console.log(chalk.bold(data.title || seriesId));
        console.log(chalk.dim(`${t("FRED_UNITS")}: ${data.units || t("LABEL_NA")} | ${t("FRED_FREQ")}: ${data.frequency || t("LABEL_NA")} | ${t("FRED_OBS")}: ${data.count || 0}\n`));
        console.log(`${t("FRED_DATE").padEnd(14)} ${t("LABEL_VALUE").padStart(14)}`);
        console.log("-".repeat(30));
        for (const item of data.data || []) console.log(`${item.date.padEnd(14)} ${fmtVal(item.value).padStart(14)}`);
    });

macroCmd
    .command("info <seriesId>")
    .description(t("MACRO_INFO_DESC"))
    .option("--json", t("OPT_JSON_DESC"))
    .action(async (seriesId, opts) => {
        const data = await requestMacro("fred-info", { seriesId }, opts);
        if (!data || opts.json) return;
        [
            [t("LABEL_SERIES_ID"), data.id],
            [t("LABEL_TITLE"), data.title],
            [t("FRED_FREQ"), data.frequency],
            [t("FRED_UNITS"), data.units],
            [t("LABEL_SEASONAL_ADJ"), data.seasonal_adjustment],
            [t("LABEL_FIRST_OBS"), data.observation_start],
            [t("LABEL_LAST_OBS"), data.observation_end],
            [t("LABEL_LAST_UPDATED"), data.last_updated],
            [t("LABEL_POPULARITY"), data.popularity]
        ].forEach(([label, value]) => console.log(`${chalk.cyan(label)}: ${value || t("LABEL_NA")}`));
    });

macroCmd
    .command("latest <seriesId>")
    .description(t("MACRO_LATEST_DESC"))
    .option("--json", t("OPT_JSON_DESC"))
    .action(async (seriesId, opts) => {
        const data = await requestMacro("fred-latest", { seriesId }, opts);
        if (!data || opts.json) return;
        console.log(chalk.bold(data.title || seriesId));
        console.log(`${t("LABEL_LATEST")}: ${chalk.green(fmtVal(data.value))}`);
        console.log(`${t("FRED_DATE")}: ${data.date}`);
        console.log(`${t("FRED_UNITS")}: ${data.units || t("LABEL_NA")}`);
    });

macroCmd
    .command("compare <seriesIds>")
    .description(t("MACRO_COMPARE_DESC"))
    .option("--tail <n>", t("OPT_FRED_TAIL"))
    .option("--start <date>", t("OPT_START_DATE_DESC"))
    .option("--end <date>", t("OPT_END_DATE_DESC"))
    .option("--json", t("OPT_JSON_DESC"))
    .action(async (seriesIds, opts) => {
        const data = await requestMacro("fred-compare", { seriesIds, tail: opts.tail, start: opts.start, end: opts.end }, opts);
        if (!data || opts.json) return;
        const ids = Object.keys(data.series || {});
        ids.forEach(id => console.log(`  ${chalk.cyan(id)}: ${data.series[id]}`));
        const header = t("FRED_DATE").padEnd(14) + ids.map(id => id.padStart(14)).join(" ");
        console.log(`\n${header}`);
        console.log("-".repeat(14 + 15 * ids.length));
        for (const row of data.data || []) console.log(row.date.padEnd(14) + ids.map(id => fmtVal(row[id]).padStart(14)).join(" "));
    });

macroCmd
    .command("changes <seriesId>")
    .description(t("MACRO_CHANGES_DESC"))
    .option("-p, --periods <n>", t("OPT_PERIODS_DESC"), "6")
    .option("--json", t("OPT_JSON_DESC"))
    .action(async (seriesId, opts) => {
        const data = await requestMacro("fred-changes", { seriesId, periods: opts.periods }, opts);
        if (!data || opts.json) return;
        console.log(chalk.bold(data.title || seriesId));
        console.log(chalk.dim(`${t("FRED_UNITS")}: ${data.units || t("LABEL_NA")}\n`));
        console.log(`${t("FRED_DATE").padEnd(14)} ${t("LABEL_VALUE").padStart(12)} ${t("LABEL_CHANGE").padStart(10)} ${t("LABEL_PCT_CHANGE").padStart(8)} ${t("LABEL_YOY_PCT").padStart(8)}`);
        console.log("-".repeat(54));
        for (const row of data.data || []) {
            const change = row.change !== undefined ? `${row.change >= 0 ? "+" : ""}${row.change.toFixed(2)}` : "-";
            const pct = row.pct_change !== undefined ? `${row.pct_change >= 0 ? "+" : ""}${row.pct_change.toFixed(2)}%` : "-";
            const yoy = row.yoy_pct !== undefined ? `${row.yoy_pct >= 0 ? "+" : ""}${row.yoy_pct.toFixed(2)}%` : "-";
            console.log(`${row.date.padEnd(14)} ${fmtVal(row.value).padStart(12)} ${change.padStart(10)} ${pct.padStart(8)} ${yoy.padStart(8)}`);
        }
    });

macroCmd
    .command("spread <series1> <series2>")
    .description(t("MACRO_SPREAD_DESC"))
    .option("--tail <n>", t("OPT_FRED_TAIL"), "12")
    .option("--start <date>", t("OPT_START_DATE_DESC"))
    .option("--json", t("OPT_JSON_DESC"))
    .action(async (series1, series2, opts) => {
        const data = await requestMacro("fred-spread", { series1, series2, tail: opts.tail, start: opts.start }, opts);
        if (!data || opts.json) return;
        console.log(chalk.bold(`${t("LABEL_SPREAD")}: ${series1} - ${series2}`));
        console.log(`${t("FRED_DATE").padEnd(14)} ${series1.padStart(12)} ${series2.padStart(12)} ${t("LABEL_SPREAD").padStart(12)}`);
        console.log("-".repeat(52));
        for (const row of data.data || []) console.log(`${row.date.padEnd(14)} ${fmtVal(row.v1).padStart(12)} ${fmtVal(row.v2).padStart(12)} ${fmtVal(row.spread).padStart(12)}`);
    });

macroCmd
    .command("liquidity")
    .description(t("MACRO_LIQUIDITY_DESC"))
    .option("--tail <n>", t("OPT_FRED_TAIL"), "12")
    .option("--m2", t("OPT_INCLUDE_M2_DESC"))
    .option("--json", t("OPT_JSON_DESC"))
    .action(async (opts) => {
        const data = await requestMacro("fred-liquidity", { tail: opts.tail, includeM2: opts.m2 }, opts);
        if (!data || opts.json) return;
        const cols = ["WALCL", "RRPONTSYD", "WTREGEN", "NET_LIQ", ...(opts.m2 ? ["M2SL"] : [])];
        const labels = { WALCL: t("LABEL_FED_BALANCE_SHEET_SHORT"), RRPONTSYD: t("LABEL_RRP_SHORT"), WTREGEN: t("LABEL_TGA_SHORT"), NET_LIQ: t("LABEL_NET_LIQ_SHORT"), M2SL: t("LABEL_M2_SHORT") };
        console.log(chalk.bold(t("MACRO_LIQUIDITY_DESC")));
        console.log(chalk.dim(`${t("MACRO_LIQUIDITY_UNIT_NOTE")}\n`));
        console.log(t("FRED_DATE").padEnd(14) + cols.map(col => labels[col].padStart(12)).join(" "));
        console.log("-".repeat(14 + 13 * cols.length));
        for (const row of data.data || []) console.log(row.date.padEnd(14) + cols.map(col => fmtDollarsB(row[col]).padStart(12)).join(" "));
    });

macroCmd
    .command("zscore <seriesId>")
    .description(t("MACRO_ZSCORE_DESC"))
    .option("--lookback <period>", t("OPT_FRED_LOOKBACK"), "10y")
    .option("--json", t("OPT_JSON_DESC"))
    .action(async (seriesId, opts) => {
        const data = await requestMacro("fred-zscore", { seriesId, lookback: opts.lookback }, opts);
        if (!data || opts.json) return;
        printKeyValues(data.title || seriesId, [
            [t("LABEL_LOOKBACK"), `${data.lookback} (${data.observations} ${t("FRED_OBS").toLowerCase()})`],
            [t("LABEL_CURRENT"), fmtVal(data.current)],
            [t("LABEL_MEAN"), fmtVal(data.mean)],
            [t("LABEL_STD_DEV"), fmtVal(data.std)],
            [t("LABEL_ZSCORE"), `${data.zscore >= 0 ? "+" : ""}${data.zscore}`],
            [t("LABEL_PERCENTILE"), `${data.percentile}%`],
            [t("LABEL_RANGE"), `${fmtVal(data.min)} - ${fmtVal(data.max)}`]
        ]);
    });

macroCmd
    .command("dashboard")
    .description(t("MACRO_DASHBOARD_DESC"))
    .option("--json", t("OPT_JSON_DESC"))
    .action(async (opts) => {
        const data = await requestMacro("fred-dashboard", {}, opts);
        if (!data || opts.json) return;
        console.log(chalk.bold(`${t("FRED_DASHBOARD_TITLE")} - ${new Date().toISOString().slice(0, 10)}`));
        for (const [section, items] of Object.entries(data.sections || {})) {
            console.log(chalk.cyan(`\n${section}`));
            for (const [id, item] of Object.entries(items)) console.log(`  ${id.padEnd(14)} ${fmtVal(item.value).padStart(12)} ${chalk.dim(item.date || "")}`);
        }
        if (data.liquidity?.NET_LIQ) console.log(`\n${t("LABEL_NET_LIQUIDITY")}: ${fmtDollarsB(data.liquidity.NET_LIQ.value_billions)}`);
    });

macroCmd
    .command("recession")
    .description(t("MACRO_RECESSION_DESC"))
    .option("--json", t("OPT_JSON_DESC"))
    .action(async (opts) => {
        const data = await requestMacro("fred-recession", {}, opts);
        if (!data || opts.json) return;
        console.log(chalk.bold(`${t("FRED_RECESSION_TITLE")}\n`));
        for (const signal of data.signals || []) console.log(`  ${signal.signal.padEnd(30)} ${signal.status.padEnd(12)} ${signal.reading}`);
        console.log(`\n${t("FRED_SCORE", { n: data.warnings, total: data.total })}`);
    });

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

export default macroCmd;
