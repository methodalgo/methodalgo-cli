import { Command } from "commander";
import chalk from "chalk";
import config from "../utils/config-manager.js";
import logger from "../utils/logger.js";
import { t } from "../utils/i18n.js";
import * as fred from "../utils/fred-api.js";

// ─── Helpers ────────────────────────────────────────────────────

function fmtVal(val, decimals = 2) {
    if (val === null || val === undefined || val === ".") return "N/A";
    const n = Number(val);
    if (isNaN(n)) return String(val);
    return Math.abs(n) >= 1000 ? n.toLocaleString("en-US", { maximumFractionDigits: decimals }) : n.toFixed(decimals);
}

function toBillions(value, unitsStr) {
    if (value === null || value === undefined || value === ".") return null;
    const n = Number(value);
    if (isNaN(n)) return null;
    const u = (unitsStr || "").toLowerCase();
    if (u.includes("trillion")) return n * 1000;
    if (u.includes("billion")) return n;
    if (u.includes("million")) return n / 1000;
    if (u.includes("thousand")) return n / 1e6;
    return n;
}

function fmtDollarsB(valB) {
    if (valB === null || valB === undefined) return "N/A";
    if (Math.abs(valB) >= 1000) return `$${(valB / 1000).toFixed(2)}T`;
    return `$${valB.toFixed(1)}B`;
}

function parseObs(observations) {
    return observations
        .filter(o => o.value !== ".")
        .map(o => ({ date: o.date, value: Number(o.value) }));
}

async function fetchLatest(seriesId) {
    const [infoRes, obsRes] = await Promise.all([
        fred.getSeries({ series_id: seriesId }),
        fred.getSeriesObservations({
            series_id: seriesId,
            sort_order: "desc",
            limit: 5,
        }),
    ]);
    const info = infoRes.seriess?.[0] || {};
    const obs = parseObs(obsRes.observations || []);
    return { info, obs };
}

async function fetchObservations(seriesId, opts = {}) {
    const params = { series_id: seriesId, sort_order: "desc" };
    if (opts.limit) params.limit = opts.limit;
    if (opts.start) params.observation_start = opts.start;
    if (opts.end) params.observation_end = opts.end;
    if (opts.sort) params.sort_order = opts.sort;
    if (opts.units) params.units = opts.units;
    if (opts.frequency) params.frequency = opts.frequency;
    const res = await fred.getSeriesObservations(params);
    return parseObs(res.observations || []);
}

// ─── Command Definition ────────────────────────────────────────

const fredCmd = new Command("fred")
    .description(t("FRED_DESC"))
    .addHelpText("after", `${t("FRED_HELP_DATA_TYPES")}\n${t("FRED_HELP_EXAMPLES")}`);

// 仅当未设置 API Key 时才显示获取 Key 的提示
if (!fred.getFredApiKey()) {
    fredCmd.addHelpText("after", `
${chalk.yellow("⚠️  Requires a free FRED API key.")}
${chalk.dim("Get one at: https://fred.stlouisfed.org/docs/api/api_key.html")}
${chalk.dim("Then run: methodalgo config set fred-api-key <your-key>")}
`);
}

// 增加预处理钩子，支持在指令运行前交互式设置 Key
fredCmd.hook("preAction", async (thisCommand, actionCommand) => {
    // 排除 help 指令
    if (actionCommand.name() === "help") return;

    if (!fred.getFredApiKey()) {
        const readline = await import("readline");
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        const question = (query) => new Promise((resolve) => rl.question(query, resolve));

        console.log(chalk.yellow(`\n⚠️  ${t("ERR_FRED_KEY_MISSING") || "FRED API Key is not configured."}`));
        const answer = await question(chalk.bold("❓ Would you like to set it now? (y/N): "));
        
        if (answer.toLowerCase() === "y") {
            const key = await question(chalk.bold("🔑 Enter your FRED API Key: "));
            if (key) {
                config.set("fredApiKey", key);
                logger.success("✓ FRED API Key saved. Proceeding with command...\n");
            } else {
                logger.warn("Skipped. Command may fail.\n");
            }
        } else {
            console.log(chalk.dim("You can set it later using: methodalgo config set fred-api-key <your-key>\n"));
        }
        rl.close();
    }
});




// ─── search ─────────────────────────────────────────────────────

fredCmd
    .command("search <query>")
    .description(t("FRED_SEARCH_DESC"))
    .option("-l, --limit <n>", "Max results", "10")
    .option("--order <field>", t("OPT_FRED_ORDER"), "search_rank")
    .option("--sort <dir>", "Sort direction (asc, desc)", "desc")
    .option("--tag <names>", "Filter by tag names (semicolon-separated)")
    .option("--json", "Output JSON")
    .action(async (query, opts) => {
        try {
            const params = {
                search_text: query,
                limit: opts.limit,
                order_by: opts.order,
                sort_order: opts.sort,
            };
            if (opts.tag) params.tag_names = opts.tag;
            const res = await fred.getSeriesSearch(params);
            const series = res.seriess || [];

            if (opts.json) return logger.json({ query, count: series.length, results: series });

            if (series.length === 0) {
                return logger.info(`No results for: "${query}"`);
            }

            console.log(chalk.bold(`Search: "${query}" (${series.length} results)\n`) + "─".repeat(70));
            for (const s of series) {
                console.log(`\n  ${chalk.cyan(s.id)} — ${s.title}`);
                console.log(`  ${chalk.dim(`${s.frequency} | ${s.units} | Popularity: ${s.popularity} | Last: ${s.observation_end}`)}`);
            }
            console.log("");
        } catch (e) { logger.error(e.message); }
    });

// ─── get ────────────────────────────────────────────────────────

fredCmd
    .command("get <series_id>")
    .description(t("FRED_GET_DESC"))
    .option("--tail <n>", "Show last N observations")
    .option("--start <date>", "Start date (YYYY-MM-DD)")
    .option("--end <date>", "End date (YYYY-MM-DD)")
    .option("--units <u>", "Data transformation (lin, chg, ch1, pch, pc1, pca, cch, cca, log)")
    .option("--frequency <f>", "Aggregation frequency (d, w, bw, m, q, sa, a)")
    .option("--json", "Output JSON")
    .action(async (seriesId, opts) => {
        try {
            const [infoRes, obsRes] = await Promise.all([
                fred.getSeries({ series_id: seriesId }),
                fred.getSeriesObservations({
                    series_id: seriesId,
                    sort_order: "asc",
                    observation_start: opts.start,
                    observation_end: opts.end,
                    units: opts.units,
                    frequency: opts.frequency,
                }),
            ]);
            const info = infoRes.seriess?.[0] || {};
            let obs = parseObs(obsRes.observations || []);
            if (opts.tail) obs = obs.slice(-Number(opts.tail));

            if (opts.json) return logger.json({ series_id: seriesId, title: info.title, units: info.units, frequency: info.frequency, count: obs.length, data: obs });

            console.log(chalk.bold(info.title || seriesId));
            console.log(chalk.dim(`Units: ${info.units || "N/A"} | Frequency: ${info.frequency || "N/A"} | Observations: ${obs.length}\n`));
            console.log(`${"Date".padEnd(14)} ${"Value".padStart(14)}`);
            console.log("─".repeat(30));
            for (const o of obs) {
                console.log(`${o.date.padEnd(14)} ${fmtVal(o.value).padStart(14)}`);
            }
        } catch (e) { logger.error(e.message); }
    });

// ─── info ───────────────────────────────────────────────────────

fredCmd
    .command("info <series_id>")
    .description(t("FRED_INFO_DESC"))
    .option("--json", "Output JSON")
    .action(async (seriesId, opts) => {
        try {
            const res = await fred.getSeries({ series_id: seriesId });
            const s = res.seriess?.[0];
            if (!s) return logger.error(`Series not found: ${seriesId}`);

            if (opts.json) return logger.json(s);

            const fields = [
                ["Series ID", s.id], ["Title", s.title], ["Frequency", s.frequency],
                ["Units", s.units], ["Seasonal Adj", s.seasonal_adjustment],
                ["First Obs", s.observation_start], ["Last Obs", s.observation_end],
                ["Last Updated", s.last_updated], ["Popularity", s.popularity],
                ["Notes", s.notes ? (s.notes.length > 500 ? s.notes.slice(0, 500) + "..." : s.notes) : "N/A"],
            ];
            for (const [label, val] of fields) {
                console.log(`${chalk.cyan(label)}: ${val || "N/A"}`);
            }
        } catch (e) { logger.error(e.message); }
    });

// ─── latest ─────────────────────────────────────────────────────

fredCmd
    .command("latest <series_id>")
    .description(t("FRED_LATEST_DESC"))
    .option("--json", "Output JSON")
    .action(async (seriesId, opts) => {
        try {
            const { info, obs } = await fetchLatest(seriesId);
            if (obs.length === 0) return logger.error(`No data for: ${seriesId}`);
            const latest = obs[0];

            if (opts.json) return logger.json({ series_id: seriesId, title: info.title, units: info.units, ...latest });

            console.log(chalk.bold(info.title || seriesId));
            console.log(`Latest: ${chalk.green(fmtVal(latest.value))}`);
            console.log(`Date: ${latest.date}`);
            console.log(`Units: ${info.units || "N/A"}`);
        } catch (e) { logger.error(e.message); }
    });

// ─── compare ────────────────────────────────────────────────────

fredCmd
    .command("compare <series_ids>")
    .description(t("FRED_COMPARE_DESC"))
    .option("--tail <n>", "Show last N observations")
    .option("--start <date>", "Start date (YYYY-MM-DD)")
    .option("--end <date>", "End date (YYYY-MM-DD)")
    .option("--json", "Output JSON")
    .action(async (seriesIds, opts) => {
        try {
            const ids = seriesIds.split(",").map(s => s.trim());
            const results = await Promise.all(ids.map(async id => {
                const [infoRes, obsRes] = await Promise.all([
                    fred.getSeries({ series_id: id }),
                    fred.getSeriesObservations({
                        series_id: id, sort_order: "asc",
                        observation_start: opts.start, observation_end: opts.end,
                    }),
                ]);
                return {
                    id,
                    title: infoRes.seriess?.[0]?.title || id,
                    obs: parseObs(obsRes.observations || []),
                };
            }));

            // Merge by date
            const dateMap = new Map();
            for (const r of results) {
                for (const o of r.obs) {
                    if (!dateMap.has(o.date)) dateMap.set(o.date, {});
                    dateMap.get(o.date)[r.id] = o.value;
                }
            }
            let rows = [...dateMap.entries()].sort((a, b) => a[0].localeCompare(b[0]));
            if (opts.tail) rows = rows.slice(-Number(opts.tail));

            if (opts.json) {
                return logger.json({
                    series: Object.fromEntries(results.map(r => [r.id, r.title])),
                    data: rows.map(([date, vals]) => ({ date, ...vals })),
                });
            }

            console.log(chalk.bold(`\n--- ${t("FRED_COMPARE_TITLE")} ---`));
            for (const r of results) console.log(`  ${chalk.cyan(r.id)}: ${r.title}`);
            console.log("");

            const header = "Date".padEnd(14) + ids.map(id => id.padStart(14)).join(" ");
            console.log(header);
            console.log("─".repeat(14 + 15 * ids.length));
            for (const [date, vals] of rows) {
                const line = date.padEnd(14) + ids.map(id => (vals[id] !== undefined ? fmtVal(vals[id]) : "—").padStart(14)).join(" ");
                console.log(line);
            }
        } catch (e) { logger.error(e.message); }
    });

// ─── changes ────────────────────────────────────────────────────

fredCmd
    .command("changes <series_id>")
    .description(t("FRED_CHANGES_DESC"))
    .option("-p, --periods <n>", "Number of periods to show", "6")
    .option("--json", "Output JSON")
    .action(async (seriesId, opts) => {
        try {
            const [infoRes, obsRes] = await Promise.all([
                fred.getSeries({ series_id: seriesId }),
                fred.getSeriesObservations({ series_id: seriesId, sort_order: "asc" }),
            ]);
            const info = infoRes.seriess?.[0] || {};
            const allObs = parseObs(obsRes.observations || []);
            if (allObs.length === 0) return logger.error(`No data for: ${seriesId}`);

            const periods = Number(opts.periods);
            const display = allObs.slice(-periods);
            const freqShort = (info.frequency_short || "M").charAt(0);
            const yoyLb = { D: 252, W: 52, M: 12, Q: 4, A: 1 }[freqShort] || 12;

            const rows = display.map(o => {
                const idx = allObs.findIndex(a => a.date === o.date);
                const entry = { date: o.date, value: o.value };
                if (idx > 0) {
                    const prev = allObs[idx - 1].value;
                    entry.change = o.value - prev;
                    entry.pct_change = prev !== 0 ? ((o.value - prev) / Math.abs(prev)) * 100 : 0;
                }
                if (idx >= yoyLb) {
                    const yp = allObs[idx - yoyLb].value;
                    entry.yoy_pct = yp !== 0 ? ((o.value - yp) / Math.abs(yp)) * 100 : 0;
                }
                return entry;
            });

            if (opts.json) return logger.json({ series_id: seriesId, title: info.title, units: info.units, data: rows });

            console.log(chalk.bold(info.title || seriesId));
            console.log(chalk.dim(`Units: ${info.units || "N/A"} | Frequency: ${info.frequency || "N/A"}\n`));
            console.log(`${"Date".padEnd(14)} ${"Value".padStart(12)} ${"Change".padStart(10)} ${"% Chg".padStart(8)} ${"YoY %".padStart(8)}`);
            console.log("─".repeat(54));
            for (const r of rows) {
                const chg = r.change !== undefined ? (r.change >= 0 ? "+" : "") + r.change.toFixed(2) : "—";
                const pct = r.pct_change !== undefined ? (r.pct_change >= 0 ? "+" : "") + r.pct_change.toFixed(2) + "%" : "—";
                const yoy = r.yoy_pct !== undefined ? (r.yoy_pct >= 0 ? "+" : "") + r.yoy_pct.toFixed(2) + "%" : "—";
                console.log(`${r.date.padEnd(14)} ${fmtVal(r.value).padStart(12)} ${chg.padStart(10)} ${pct.padStart(8)} ${yoy.padStart(8)}`);
            }
        } catch (e) { logger.error(e.message); }
    });

// ─── spread ─────────────────────────────────────────────────────

fredCmd
    .command("spread <series1> <series2>")
    .description(t("FRED_SPREAD_DESC"))
    .option("--tail <n>", "Show last N observations", "12")
    .option("--start <date>", "Start date (YYYY-MM-DD)")
    .option("--json", "Output JSON")
    .action(async (series1, series2, opts) => {
        try {
            const [info1, info2, obs1Res, obs2Res] = await Promise.all([
                fred.getSeries({ series_id: series1 }),
                fred.getSeries({ series_id: series2 }),
                fred.getSeriesObservations({ series_id: series1, sort_order: "asc", observation_start: opts.start }),
                fred.getSeriesObservations({ series_id: series2, sort_order: "asc", observation_start: opts.start }),
            ]);

            const t1 = info1.seriess?.[0]?.title || series1;
            const t2 = info2.seriess?.[0]?.title || series2;
            const obs1Map = new Map(parseObs(obs1Res.observations || []).map(o => [o.date, o.value]));
            const obs2Map = new Map(parseObs(obs2Res.observations || []).map(o => [o.date, o.value]));

            const dates = [...new Set([...obs1Map.keys(), ...obs2Map.keys()])].sort();
            let rows = dates
                .filter(d => obs1Map.has(d) && obs2Map.has(d))
                .map(d => ({ date: d, v1: obs1Map.get(d), v2: obs2Map.get(d), spread: obs1Map.get(d) - obs2Map.get(d) }));
            rows = rows.slice(-Number(opts.tail));

            if (opts.json) {
                return logger.json({
                    series1: { id: series1, title: t1 },
                    series2: { id: series2, title: t2 },
                    formula: `${series1} - ${series2}`,
                    data: rows,
                });
            }

            console.log(chalk.bold(`Spread: ${series1} - ${series2}`));
            console.log(`  ${chalk.cyan(series1)}: ${t1}`);
            console.log(`  ${chalk.cyan(series2)}: ${t2}\n`);
            console.log(`${"Date".padEnd(14)} ${series1.padStart(12)} ${series2.padStart(12)} ${"Spread".padStart(12)}`);
            console.log("─".repeat(52));
            for (const r of rows) {
                console.log(`${r.date.padEnd(14)} ${fmtVal(r.v1).padStart(12)} ${fmtVal(r.v2).padStart(12)} ${fmtVal(r.spread).padStart(12)}`);
            }
            if (rows.length >= 2) {
                const spreads = rows.map(r => r.spread);
                const mean = spreads.reduce((a, b) => a + b, 0) / spreads.length;
                const min = Math.min(...spreads);
                const max = Math.max(...spreads);
                console.log(`\nLatest: ${fmtVal(spreads[spreads.length - 1])} | Mean: ${fmtVal(mean)} | Min: ${fmtVal(min)} | Max: ${fmtVal(max)}`);
            }
        } catch (e) { logger.error(e.message); }
    });

// ─── liquidity ──────────────────────────────────────────────────

fredCmd
    .command("liquidity")
    .description(t("FRED_LIQUIDITY_DESC"))
    .option("--tail <n>", "Show last N observations", "12")
    .option("--m2", "Include M2 Money Supply")
    .option("--json", "Output JSON")
    .action(async (opts) => {
        try {
            const ids = ["WALCL", "RRPONTSYD", "WTREGEN"];
            if (opts.m2) ids.push("M2SL");

            const results = await Promise.all(ids.map(async id => {
                const [infoRes, obsRes] = await Promise.all([
                    fred.getSeries({ series_id: id }),
                    fred.getSeriesObservations({ series_id: id, sort_order: "asc" }),
                ]);
                const info = infoRes.seriess?.[0] || {};
                return { id, units: info.units || "", obs: parseObs(obsRes.observations || []) };
            }));

            const seriesMap = Object.fromEntries(results.map(r => [r.id, r]));

            // Build date-aligned data, forward-fill
            const allDates = new Set();
            for (const r of results) for (const o of r.obs) allDates.add(o.date);
            const dates = [...allDates].sort();

            const rows = [];
            const lastVals = {};
            for (const d of dates) {
                const row = { date: d };
                for (const r of results) {
                    const found = r.obs.find(o => o.date === d);
                    if (found) lastVals[r.id] = toBillions(found.value, seriesMap[r.id].units);
                    row[r.id] = lastVals[r.id] ?? null;
                }
                if (row.WALCL !== null) {
                    row.NET_LIQ = row.WALCL - (row.RRPONTSYD || 0) - (row.WTREGEN || 0);
                    rows.push(row);
                }
            }

            const display = rows.slice(-Number(opts.tail));

            if (opts.json) {
                return logger.json({
                    command: "liquidity", unit: "billions_usd",
                    formula: "WALCL - RRPONTSYD - WTREGEN",
                    data: display,
                });
            }

            console.log(chalk.bold("Net Liquidity = Fed Balance Sheet - Reverse Repo - TGA"));
            console.log(chalk.dim("All values in USD (billions)\n"));

            const cols = ["WALCL", "RRPONTSYD", "WTREGEN", "NET_LIQ"];
            if (opts.m2) cols.push("M2SL");
            const labels = { WALCL: "Fed BS", RRPONTSYD: "RRP", WTREGEN: "TGA", NET_LIQ: "Net Liq", M2SL: "M2" };

            const header = "Date".padEnd(14) + cols.map(c => (labels[c] || c).padStart(12)).join(" ");
            console.log(header);
            console.log("─".repeat(14 + 13 * cols.length));
            for (const row of display) {
                const line = row.date.padEnd(14) + cols.map(c => {
                    const v = row[c];
                    return (v !== null && v !== undefined ? fmtDollarsB(v) : "—").padStart(12);
                }).join(" ");
                console.log(line);
            }

            if (display.length >= 2) {
                const latest = display[display.length - 1].NET_LIQ;
                const prev = display[display.length - 2].NET_LIQ;
                const chg = latest - prev;
                const dir = chg > 0 ? "↑ expanding" : "↓ contracting";
                const pct = prev !== 0 ? ((chg / Math.abs(prev)) * 100).toFixed(2) : "0.00";
                console.log(`\nLatest: ${fmtDollarsB(latest)} (${dir}, ${chg > 0 ? "+" : ""}${pct}%)`);
            }
        } catch (e) { logger.error(e.message); }
    });

// ─── zscore ─────────────────────────────────────────────────────

fredCmd
    .command("zscore <series_id>")
    .description(t("FRED_ZSCORE_DESC"))
    .option("--lookback <period>", t("OPT_FRED_LOOKBACK"), "10y")
    .option("--json", "Output JSON")
    .action(async (seriesId, opts) => {
        try {
            const lb = opts.lookback;
            const unit = lb.slice(-1).toLowerCase();
            const num = parseInt(lb.slice(0, -1));
            const days = unit === "y" ? num * 365 : unit === "m" ? num * 30 : num;
            const cutoff = new Date(Date.now() - days * 86400000);
            const startDate = cutoff.toISOString().split("T")[0];

            const [infoRes, obsRes] = await Promise.all([
                fred.getSeries({ series_id: seriesId }),
                fred.getSeriesObservations({ series_id: seriesId, sort_order: "asc", observation_start: startDate }),
            ]);
            const info = infoRes.seriess?.[0] || {};
            const obs = parseObs(obsRes.observations || []);
            if (obs.length < 10) return logger.error("Not enough data for z-score analysis.");

            const values = obs.map(o => o.value);
            const current = values[values.length - 1];
            const mean = values.reduce((a, b) => a + b, 0) / values.length;
            const std = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length);
            const z = std !== 0 ? (current - mean) / std : 0;
            const percentile = (values.filter(v => v < current).length / values.length) * 100;
            const min = Math.min(...values);
            const max = Math.max(...values);

            if (opts.json) {
                return logger.json({
                    series_id: seriesId, title: info.title, lookback: lb,
                    observations: obs.length, current, mean: +mean.toFixed(6),
                    std: +std.toFixed(6), zscore: +z.toFixed(4),
                    percentile: +percentile.toFixed(2), min, max,
                });
            }

            console.log(chalk.bold(info.title || seriesId));
            console.log(chalk.dim(`Lookback: ${lb} (${obs.length} observations)\n`));
            console.log(`  Current:     ${fmtVal(current)}`);
            console.log(`  Mean:        ${fmtVal(mean)}`);
            console.log(`  Std Dev:     ${fmtVal(std)}`);
            console.log(`  Z-Score:     ${z >= 0 ? "+" : ""}${z.toFixed(2)}`);
            console.log(`  Percentile:  ${percentile.toFixed(1)}%`);
            console.log(`  Range:       ${fmtVal(min)} — ${fmtVal(max)}`);

            // Visual bar
            const barW = 40;
            const pos = max !== min ? Math.min(barW - 1, Math.max(0, Math.round(((current - min) / (max - min)) * barW))) : barW / 2;
            const meanPos = max !== min ? Math.min(barW - 1, Math.max(0, Math.round(((mean - min) / (max - min)) * barW))) : barW / 2;
            const bar = Array(barW).fill("─");
            bar[pos] = "█";
            if (meanPos !== pos) bar[meanPos] = "│";
            console.log(`\n  [${fmtVal(min)}] ${bar.join("")} [${fmtVal(max)}]`);
            console.log("  █ = current  │ = mean");
        } catch (e) { logger.error(e.message); }
    });

// ─── dashboard ──────────────────────────────────────────────────

fredCmd
    .command("dashboard")
    .description(t("FRED_DASHBOARD_DESC"))
    .option("--json", "Output JSON")
    .action(async (opts) => {
        try {
            const sections = [
                [t("FRED_SEC_RATES"), [
                    ["FEDFUNDS", "Fed Funds Rate", "%"],
                    ["DFEDTARU", "Target Upper", "%"],
                    ["DGS2", "2Y Treasury", "%"],
                    ["DGS10", "10Y Treasury", "%"],
                    ["DGS30", "30Y Treasury", "%"],
                    ["T10Y2Y", "10Y-2Y Spread", "%"],
                    ["T10Y3M", "10Y-3M Spread", "%"],
                ]],
                [t("FRED_SEC_INFLATION"), [
                    ["T5YIE", "5Y Breakeven", "%"],
                    ["T10YIE", "10Y Breakeven", "%"],
                    ["MICH", "Michigan Expectations", "%"],
                ]],
                [t("FRED_SEC_EMPLOYMENT"), [
                    ["UNRATE", "Unemployment", "%"],
                    ["ICSA", "Initial Claims", "K"],
                    ["CCSA", "Continued Claims", "K"],
                ]],
                [t("FRED_SEC_FINANCE"), [
                    ["VIXCLS", "VIX", ""],
                    ["NFCI", "NFCI", ""],
                    ["BAMLH0A0HYM2", "HY OAS Spread", "%"],
                    ["DTWEXBGS", "Dollar Index", ""],
                ]],
                ["COMMODITIES", [
                    ["DCOILWTICO", "WTI Crude", "$"],
                    ["GOLDAMGBD228NLBM", "Gold (London)", "$"],
                ]],
            ];

            // Fetch all in parallel
            const allIds = sections.flatMap(([, items]) => items.map(([id]) => id));
            const liqIds = ["WALCL", "RRPONTSYD", "WTREGEN", "M2SL"];
            const yoyIds = ["CPIAUCSL", "PCEPILFE"];
            const fetchIds = [...new Set([...allIds, ...liqIds, ...yoyIds])];

            const fetched = {};
            await Promise.all(fetchIds.map(async id => {
                try {
                    const [infoRes, obsRes] = await Promise.all([
                        fred.getSeries({ series_id: id }),
                        fred.getSeriesObservations({ series_id: id, sort_order: "desc", limit: 15 }),
                    ]);
                    const info = infoRes.seriess?.[0] || {};
                    const obs = parseObs(obsRes.observations || []);
                    fetched[id] = { info, obs };
                } catch (e) {
                    // silently skip failed series
                }
            }));

            // Compute liquidity
            const liqData = {};
            for (const id of liqIds) {
                if (fetched[id]?.obs.length > 0) {
                    liqData[id] = toBillions(fetched[id].obs[0].value, fetched[id].info.units);
                }
            }
            const netLiq = liqData.WALCL !== undefined
                ? liqData.WALCL - (liqData.RRPONTSYD || 0) - (liqData.WTREGEN || 0)
                : null;

            // Compute YoY inflation
            const inflationYoy = {};
            for (const [id, label] of [["CPIAUCSL", "CPI YoY"], ["PCEPILFE", "Core PCE YoY"]]) {
                if (fetched[id]?.obs.length >= 13) {
                    const obs = fetched[id].obs; // desc order
                    const cur = obs[0].value;
                    const prev12 = obs[12].value;
                    if (prev12 !== 0) inflationYoy[label] = ((cur - prev12) / prev12) * 100;
                }
            }

            if (opts.json) {
                const result = { command: "dashboard", sections: {}, liquidity: {}, inflation_yoy: inflationYoy };
                for (const [secName, items] of sections) {
                    result.sections[secName] = {};
                    for (const [id] of items) {
                        if (fetched[id]?.obs.length > 0) {
                            result.sections[secName][id] = {
                                value: fetched[id].obs[0].value,
                                date: fetched[id].obs[0].date,
                                title: fetched[id].info.title,
                            };
                        }
                    }
                }
                for (const [id, val] of Object.entries(liqData)) result.liquidity[id] = { value_billions: +val.toFixed(2) };
                if (netLiq !== null) result.liquidity.NET_LIQ = { value_billions: +netLiq.toFixed(2) };
                return logger.json(result);
            }

            const w = 56;
            console.log("\n" + "═".repeat(w));
            console.log(`  ${t("FRED_DASHBOARD_TITLE")} — ${new Date().toISOString().split("T")[0]}`);
            console.log("═".repeat(w));

            for (const [secName, items] of sections) {
                console.log(`\n  ${chalk.bold(secName)}`);
                console.log("  " + "─".repeat(w - 4));
                for (const [id, label, unit] of items) {
                    if (fetched[id]?.obs.length > 0) {
                        const v = fetched[id].obs[0].value;
                        let arrow = "";
                        if (fetched[id].obs.length >= 2) {
                            const diff = v - fetched[id].obs[1].value;
                            if (Math.abs(diff) > 0.001) arrow = diff > 0 ? " ↑" : " ↓";
                        }
                        let vs;
                        if (unit === "%") vs = `${v.toFixed(2)}%`;
                        else if (unit === "$") vs = `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                        else if (unit === "K") vs = v.toLocaleString("en-US", { maximumFractionDigits: 0 });
                        else vs = v.toFixed(2);
                        console.log(`  ${label.padEnd(24)} ${vs.padStart(12)}${arrow}`);
                    } else {
                        console.log(`  ${label.padEnd(24)} ${"N/A".padStart(12)}`);
                    }
                }
            }

            if (Object.keys(inflationYoy).length > 0) {
                console.log(`\n  ${chalk.bold("INFLATION (YoY)")}`);
                console.log("  " + "─".repeat(w - 4));
                for (const [label, val] of Object.entries(inflationYoy)) {
                    console.log(`  ${label.padEnd(24)} ${(val.toFixed(2) + "%").padStart(12)}`);
                }
            }

            console.log(`\n  ${chalk.bold("LIQUIDITY (crypto signal)")}`);
            console.log("  " + "─".repeat(w - 4));
            for (const [id, label] of [["WALCL", "Fed Balance Sheet"], ["RRPONTSYD", "Reverse Repo"], ["WTREGEN", "TGA"], ["M2SL", "M2 Money Supply"]]) {
                if (liqData[id] !== undefined) console.log(`  ${label.padEnd(24)} ${fmtDollarsB(liqData[id]).padStart(12)}`);
            }
            if (netLiq !== null) console.log(`  ${"Net Liquidity".padEnd(24)} ${fmtDollarsB(netLiq).padStart(12)}`);

            console.log("\n" + "═".repeat(w));
        } catch (e) { logger.error(e.message); }
    });

// ─── recession ──────────────────────────────────────────────────

fredCmd
    .command("recession")
    .description(t("FRED_RECESSION_DESC"))
    .option("--json", "Output JSON")
    .action(async (opts) => {
        try {
            const signals = [];

            // Fetch all needed series in parallel
            const ids = ["T10Y2Y", "T10Y3M", "UNRATE", "ICSA", "NFCI", "BAMLH0A0HYM2"];
            const fetched = {};
            await Promise.all(ids.map(async id => {
                try {
                    const res = await fred.getSeriesObservations({ series_id: id, sort_order: "desc", limit: 20 });
                    fetched[id] = parseObs(res.observations || []);
                } catch (e) { /* skip */ }
            }));

            // 1. Yield Curve 10Y-2Y
            if (fetched.T10Y2Y?.length > 0) {
                const v = fetched.T10Y2Y[0].value;
                const [status, emoji] = v < -0.2 ? ["INVERTED", "❌"] : v < 0.2 ? ["FLAT", "⚠️"] : ["NORMAL", "✅"];
                signals.push({ name: "Yield Curve (10Y-2Y)", status, emoji, reading: `${v >= 0 ? "+" : ""}${v.toFixed(2)}%` });
            }

            // 2. Yield Curve 10Y-3M
            if (fetched.T10Y3M?.length > 0) {
                const v = fetched.T10Y3M[0].value;
                const [status, emoji] = v < -0.2 ? ["INVERTED", "❌"] : v < 0.2 ? ["FLAT", "⚠️"] : ["NORMAL", "✅"];
                signals.push({ name: "Yield Curve (10Y-3M)", status, emoji, reading: `${v >= 0 ? "+" : ""}${v.toFixed(2)}%` });
            }

            // 3. Sahm Rule
            if (fetched.UNRATE?.length >= 15) {
                const obs = [...fetched.UNRATE].reverse(); // asc
                const recent3m = obs.slice(-3).reduce((a, b) => a + b.value, 0) / 3;
                const low12m = Math.min(...obs.slice(-12).map(o => o.value));
                const sahm = recent3m - low12m;
                const [status, emoji] = sahm >= 0.5 ? ["TRIGGERED", "❌"] : sahm >= 0.3 ? ["ELEVATED", "⚠️"] : ["CLEAR", "✅"];
                signals.push({ name: "Sahm Rule", status, emoji, reading: `${sahm.toFixed(2)}pp (3m avg - 12m low)` });
            }

            // 4. Initial Claims Trend
            if (fetched.ICSA?.length >= 13) {
                const obs = [...fetched.ICSA].reverse(); // asc
                const latest = obs[obs.length - 1].value;
                const avg3m = obs.slice(-13, -1).reduce((a, b) => a + b.value, 0) / 12;
                const chgPct = ((latest - avg3m) / avg3m) * 100;
                const [status, emoji] = chgPct > 15 ? ["SURGING", "❌"] : chgPct > 5 ? ["RISING", "⚠️"] : ["STABLE", "✅"];
                signals.push({ name: "Initial Claims", status, emoji, reading: `${latest.toLocaleString()} (${chgPct >= 0 ? "+" : ""}${chgPct.toFixed(1)}% vs 3m avg)` });
            }

            // 5. NFCI
            if (fetched.NFCI?.length > 0) {
                const v = fetched.NFCI[0].value;
                const [status, emoji] = v > 0.5 ? ["TIGHT", "❌"] : v > 0 ? ["TIGHTENING", "⚠️"] : ["LOOSE", "✅"];
                signals.push({ name: "Financial Conditions (NFCI)", status, emoji, reading: v.toFixed(3) });
            }

            // 6. HY OAS
            if (fetched["BAMLH0A0HYM2"]?.length > 0) {
                const v = fetched["BAMLH0A0HYM2"][0].value;
                const [status, emoji] = v > 6 ? ["STRESS", "❌"] : v > 4.5 ? ["ELEVATED", "⚠️"] : ["NORMAL", "✅"];
                signals.push({ name: "Credit Spreads (HY OAS)", status, emoji, reading: `${v.toFixed(2)}%` });
            }

            const nWarn = signals.filter(s => !["NORMAL", "CLEAR", "STABLE", "LOOSE"].includes(s.status)).length;

            if (opts.json) {
                return logger.json({
                    command: "recession",
                    signals: signals.map(({ name, status, reading }) => ({ signal: name, status, reading })),
                    warnings: nWarn, total: signals.length,
                });
            }

            const w = 60;
            console.log("\n" + "═".repeat(w));
            console.log(`  ${t("FRED_RECESSION_TITLE")}`);
            console.log("═".repeat(w) + "\n");
            console.log(`  ${t("FRED_COL_SIGNAL").padEnd(28)} ${t("FRED_COL_STATUS").padEnd(12)} ${t("FRED_COL_READING")}`);
            console.log("  " + "─".repeat(w - 4));
            for (const s of signals) {
                console.log(`  ${s.emoji} ${s.name.padEnd(26)} ${s.status.padEnd(12)} ${s.reading}`);
            }
            console.log(`\n  ${t("FRED_SCORE", { n: nWarn, total: signals.length })}`);
                        if (nWarn === 0) console.log(`  ${t("FRED_ASSESS_CLEAR")}`);
                        else if (nWarn <= 2) console.log(`  ${t("FRED_ASSESS_MIXED")}`);
                        else if (nWarn <= 4) console.log(`  ${t("FRED_ASSESS_ELEVATED")}`);
                        else console.log(`  ${t("FRED_ASSESS_HIGH")}`);
            console.log("\n" + "═".repeat(w));
        } catch (e) { logger.error(e.message); }
    });

// ─── Raw API Access Commands ────────────────────────────────────

// category
fredCmd
    .command("category [category_id]")
    .description(t("FRED_CATEGORY_DESC"))
    .option("--children", "List child categories")
    .option("--series", "List series in category")
    .option("--tags", "List tags for category")
    .option("--json", "Output JSON")
    .action(async (categoryId, opts) => {
        try {
            const id = categoryId || "0";
            let res;
            if (opts.children) res = await fred.getCategoryChildren({ category_id: id });
            else if (opts.series) res = await fred.getCategorySeries({ category_id: id });
            else if (opts.tags) res = await fred.getCategoryTags({ category_id: id });
            else res = await fred.getCategory({ category_id: id });

            if (opts.json) return logger.json(res);

            if (res.categories) {
                for (const c of res.categories) console.log(`  ${chalk.cyan(c.id)} — ${c.name}`);
            }
            if (res.seriess) {
                for (const s of res.seriess) console.log(`  ${chalk.cyan(s.id)} — ${s.title} (${s.frequency})`);
            }
            if (res.tags) {
                for (const t of res.tags) console.log(`  ${chalk.cyan(t.name)} (${t.group_id}) — ${t.notes || ""}`);
            }
        } catch (e) { logger.error(e.message); }
    });

// releases
fredCmd
    .command("releases")
    .description(t("FRED_RELEASES_DESC"))
    .option("--dates", "Show release dates instead")
    .option("-l, --limit <n>", "Max results", "20")
    .option("--json", "Output JSON")
    .action(async (opts) => {
        try {
            let res;
            if (opts.dates) res = await fred.getReleasesDates({ limit: opts.limit });
            else res = await fred.getReleases({ limit: opts.limit });

            if (opts.json) return logger.json(res);

            if (res.releases) {
                for (const r of res.releases) console.log(`  ${chalk.cyan(String(r.id).padEnd(6))} ${r.name}`);
            }
            if (res.release_dates) {
                for (const d of res.release_dates) console.log(`  ${d.date} — Release #${d.release_id}: ${d.release_name || ""}`);
            }
        } catch (e) { logger.error(e.message); }
    });

// release
fredCmd
    .command("release <release_id>")
    .description(t("FRED_RELEASE_DESC"))
    .option("--series", "List series in this release")
    .option("--dates", "Show release dates")
    .option("--sources", "Show sources")
    .option("--tags", "Show tags")
    .option("--tables", "Show release tables")
    .option("--json", "Output JSON")
    .action(async (releaseId, opts) => {
        try {
            let res;
            if (opts.series) res = await fred.getReleaseSeries({ release_id: releaseId });
            else if (opts.dates) res = await fred.getReleaseDates({ release_id: releaseId });
            else if (opts.sources) res = await fred.getReleaseSources({ release_id: releaseId });
            else if (opts.tags) res = await fred.getReleaseTags({ release_id: releaseId });
            else if (opts.tables) res = await fred.getReleaseTables({ release_id: releaseId });
            else res = await fred.getRelease({ release_id: releaseId });

            if (opts.json) return logger.json(res);

            if (res.releases) for (const r of res.releases) console.log(`  ${r.id}: ${r.name}\n  ${chalk.dim(r.link || "")}`);
            if (res.seriess) for (const s of res.seriess) console.log(`  ${chalk.cyan(s.id)} — ${s.title}`);
            if (res.release_dates) for (const d of res.release_dates) console.log(`  ${d.date}`);
            if (res.sources) for (const s of res.sources) console.log(`  ${s.id}: ${s.name} — ${s.link || ""}`);
            if (res.tags) for (const t of res.tags) console.log(`  ${chalk.cyan(t.name)} (${t.group_id})`);
            if (res.elements) logger.json(res.elements);
        } catch (e) { logger.error(e.message); }
    });

// sources
fredCmd
    .command("sources")
    .description(t("FRED_SOURCES_DESC"))
    .option("--json", "Output JSON")
    .action(async (opts) => {
        try {
            const res = await fred.getSources({});
            if (opts.json) return logger.json(res);
            for (const s of (res.sources || [])) console.log(`  ${chalk.cyan(String(s.id).padEnd(4))} ${s.name}`);
        } catch (e) { logger.error(e.message); }
    });

// source
fredCmd
    .command("source <source_id>")
    .description(t("FRED_SOURCE_DESC"))
    .option("--releases", "List releases from this source")
    .option("--json", "Output JSON")
    .action(async (sourceId, opts) => {
        try {
            let res;
            if (opts.releases) res = await fred.getSourceReleases({ source_id: sourceId });
            else res = await fred.getSource({ source_id: sourceId });

            if (opts.json) return logger.json(res);
            if (res.sources) for (const s of res.sources) console.log(`  ${s.id}: ${s.name}\n  ${chalk.dim(s.link || "")}`);
            if (res.releases) for (const r of res.releases) console.log(`  ${chalk.cyan(String(r.id).padEnd(6))} ${r.name}`);
        } catch (e) { logger.error(e.message); }
    });

// tags
fredCmd
    .command("tags")
    .description(t("FRED_TAGS_DESC"))
    .option("-s, --search <text>", "Search tag names")
    .option("-l, --limit <n>", "Max results", "20")
    .option("--json", "Output JSON")
    .action(async (opts) => {
        try {
            const params = { limit: opts.limit };
            if (opts.search) params.search_text = opts.search;
            const res = await fred.getTags(params);
            if (opts.json) return logger.json(res);
            for (const t of (res.tags || [])) {
                console.log(`  ${chalk.cyan(t.name.padEnd(30))} ${chalk.dim(`group: ${t.group_id} | series: ${t.series_count}`)}`);
            }
        } catch (e) { logger.error(e.message); }
    });

// series-updates
fredCmd
    .command("updates")
    .description(t("FRED_UPDATES_DESC"))
    .option("-l, --limit <n>", "Max results", "20")
    .option("--json", "Output JSON")
    .action(async (opts) => {
        try {
            const res = await fred.getSeriesUpdates({ limit: opts.limit });
            if (opts.json) return logger.json(res);
            for (const s of (res.seriess || [])) {
                console.log(`  ${chalk.cyan(s.id.padEnd(20))} ${s.title} ${chalk.dim(`(${s.last_updated})`)}`);
            }
        } catch (e) { logger.error(e.message); }
    });

// vintage dates
fredCmd
    .command("vintages <series_id>")
    .description(t("FRED_VINTAGES_DESC"))
    .option("--json", "Output JSON")
    .action(async (seriesId, opts) => {
        try {
            const res = await fred.getSeriesVintageDates({ series_id: seriesId });
            if (opts.json) return logger.json(res);
            console.log(chalk.bold(`Vintage dates for ${seriesId}:`));
            for (const d of (res.vintage_dates || [])) console.log(`  ${d}`);
        } catch (e) { logger.error(e.message); }
    });

// geo/maps
fredCmd
    .command("geo <series_id>")
    .description(t("FRED_GEO_DESC"))
    .option("--json", "Output JSON")
    .action(async (seriesId, opts) => {
        try {
            const res = await fred.getGeoSeriesData({ series_id: seriesId });
            if (opts.json) return logger.json(res);
            const data = res.meta?.data || res.data || res;
            logger.json(data);
        } catch (e) { logger.error(e.message); }
    });

export default fredCmd;
