import { Command } from "commander";
import chalk from "chalk";
import { signedRequest } from "../utils/api.js";
import logger from "../utils/logger.js";
import { t, getLang } from "../utils/i18n.js";

const signalsCmd = new Command("signals")
    .description(t("SIGNALS_DESC"))
    .argument("[channel]", t("ARG_CHANNEL_DESC") || "Channel name")
    .addHelpText("after", `\n${t("LABEL_EXAMPLE")}\n  $ ${t("SIGNALS_EXAMPLE")}\n\n${t("SIGNALS_CHANNELS")}`)
    .option("-l, --limit <number>", t("OPT_LIMIT_DESC") || "Limit results", "10")
    .option("--json", "Output raw JSON data")
    .action(async (channel, options) => {
        try {
            const res = await signedRequest("/mcp/signals", { channelName: channel, limit: options.limit });
            const { status, data, message } = res.data;

            if (!status) {
                logger.error(`${t("ERR_NETWORK")}: ${message}`);
                return;
            }

            if (options.json) {
                logger.json(data);
            } else {
                logger.success(t("FETCH_SUCCESS", { count: data.length }));
                data.forEach((item, index) => {
                    const sig = item.signals && item.signals[0];
                    const title = sig ? sig.title : (item.title || item.content?.substring(0, 50) + "...");
                    const desc = sig ? sig.description : "";
                    const lang = getLang();
                    const date = new Date(item.timestamp).toLocaleString(lang === "zh" ? "zh-CN" : "en-US", {
                        hour12: false, month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit"
                    }).replace(/\//g, "-");

                    console.log(`\n${chalk.bold(`[${index + 1}] ${title}`)} ${chalk.dim(`(${date})`)}`);
                    if (desc) {
                        // 移除 markdown 代码块，并缩进
                        const cleanDesc = desc.replace(/```/g, "").trim().split("\n").map(l => `    ${l}`).join("\n");
                        console.log(chalk.gray(cleanDesc));
                    }
                });
                console.log("");
            }
        } catch (error) {
            logger.error(`Signals Error: ${error.message}`);
        }
    });

export default signalsCmd;
