import { Command } from "commander";
import chalk from "chalk";
import { signedRequest } from "../utils/api.js";
import logger from "../utils/logger.js";
import { t, getLang } from "../utils/i18n.js";

const handleTokenUnlock = (data, options, lang) => {
    let signals = data.signals || [];
    const limit = parseInt(options.limit) || 10;
    signals = signals.slice(0, limit);

    logger.success(t("FETCH_SUCCESS", { count: signals.length }));
    if (data.updatedAt) {
        const updateTimeStr = new Date(data.updatedAt).toLocaleString(lang === "zh" ? "zh-CN" : "en-US", {
            month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit"
        }).replace(/\//g, "-");
        console.log(chalk.dim(`    updateAt: ${updateTimeStr}`));
    }

    signals.forEach((item, index) => {
        const symbol = chalk.yellow.bold(item.symbol || "UNKNOWN");
        const perc = parseFloat(item.perc || 0);
        const percColor = perc > 5 ? chalk.red : chalk.green;
        const unlockAt = new Date(item.ts).toLocaleString(lang === "zh" ? "zh-CN" : "en-US", {
            month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit"
        }).replace(/\//g, "-");

        const diffMs = item.ts - Date.now();
        let countDownStr = "Expired";
        if (diffMs > 0) {
            const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
            const hours = Math.floor((diffMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
            const mins = Math.floor((diffMs % (60 * 60 * 1000)) / (60 * 1000));
            countDownStr = `${days}Day${hours}Hr${mins}Min`;
        }

        console.log(`\n${chalk.bold(`[${index + 1}]`)} ${chalk.dim(`capturedAt:${new Date(data.updatedAt || Date.now()).toLocaleDateString()}`)} `);
        console.log(`    ${chalk.dim("token: ")}${symbol}`);
        console.log(`    ${chalk.dim("marketCap: ")}${chalk.white(item.marketCap || "N/A")}`);
        console.log(`    ${chalk.dim("unlockProgress: ")}${chalk.blue(item.progress || "0%")}`);
        console.log(`    ${chalk.dim("unlockTime: ")} ${chalk.white(unlockAt)}`);
        console.log(`    ${chalk.dim("unlockTimeCountDown: ")} ${chalk.cyan(countDownStr)}`);
        console.log(`    ${chalk.dim("unlockQuantity: ")}${chalk.white(item.unlockToken || "N/A")}`);
        console.log(`    ${chalk.dim("unlockValue: ")} ${chalk.white(item.unlockTokenVal?.split("(")[0]?.trim() || "N/A")}`);
        console.log(`    ${chalk.dim("unlockPercent: ")}${percColor(`${perc}% of M.Cap`)}`);
    });
    console.log("");
};

const signalsCmd = new Command("signals")
    .description(t("SIGNALS_DESC"))
    .argument("[channel]", t("ARG_CHANNEL_DESC") || "Channel name")
    .addHelpText("after", `\n${t("LABEL_EXAMPLE")}\n  $ ${t("SIGNALS_EXAMPLE")}\n\n${t("SIGNALS_CHANNELS")}`)
    .option("-l, --limit <number>", t("OPT_LIMIT_DESC"), "10")
    .option("-a, --after <id>", t("OPT_AFTER_DESC"))
    .option("--json", "Output raw JSON data")
    .addHelpText("after", `\n${t("SIGNALS_LIMIT_NOTE")}`)
    .action(async (channel, options) => {
        if (!channel) return signalsCmd.help();
        try {
            const res = await signedRequest("/cli/signals", { 
                channelName: channel, 
                limit: options.limit,
                after: options.after
            });
            const { status, data, message } = res.data;
            if (!status) return logger.error(`${t("ERR_NETWORK")}: ${message}`);
            if (options.json) return logger.json(data);

            const lang = getLang();

            // 1. 处理 Token Unlock 劫持频道 (数据结构为 { signals, updatedAt })
            if (channel === "token-unlock") {
                handleTokenUnlock(data, options, lang);
                return;
            }

            // 2. 处理常规信号频道 (数据结构为 Array<Signal>)
            if (!Array.isArray(data)) return logger.error(t("ERR_DATA_FORMAT"));
            
            logger.success(t("FETCH_SUCCESS", { count: data.length }));
            
            data.forEach((item, index) => {
                const date = new Date(item.timestamp).toLocaleString(lang === "zh" ? "zh-CN" : "en-US", {
                    hour12: false, month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit"
                }).replace(/\//g, "-");

                console.log(`\n${chalk.bold(`[${index + 1}]`)} ${chalk.dim(`(${date})`)}`);

                const sig = item.signals?.[0] || {};
                const title = sig.title || "";
                const desc = sig.description || "";
                
                const titleColor = sig.direction === "bull" ? chalk.green.bold : (sig.direction === "bear" ? chalk.red.bold : chalk.bold);
                console.log(`    ${titleColor(title)}`);

                if (sig.details && Object.keys(sig.details).length > 0) {
                    Object.entries(sig.details).forEach(([key, val]) => {
                        if (!val) return;
                        const cleanVal = val.split("\n").join("\n            ");
                        console.log(`    ${chalk.cyan(key.padEnd(20))}: ${chalk.white(cleanVal)}`);
                    });
                }

                if (desc) {
                    const cleanDesc = desc.trim().split("\n").map(l => `    ${l}`).join("\n");
                    console.log(chalk.gray(cleanDesc));
                }

                const attachments = [...(item.attachments || []), ...(item.image ? [item.image] : [])];
                new Set(attachments).forEach(url => {
                    if (url) console.log(`    ${chalk.blue.underline(url)}`);
                });
            });
            console.log("");
        } catch (error) {
            logger.error(`Signals Error: ${error.message}`);
        }
    });

export default signalsCmd;
