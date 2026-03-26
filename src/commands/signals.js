import { Command } from "commander";
import chalk from "chalk";
import { signedRequest } from "../utils/api.js";
import logger from "../utils/logger.js";
import { t } from "../utils/i18n.js";

const signalsCmd = new Command("signals")
    .description(t("SIGNALS_DESC"))
    .argument("[channel]", "Channel name (default golden-pit-mtf)", "golden-pit-mtf")
    .option("-l, --limit <number>", "Limit results", "10")
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

                    console.log(`\n${chalk.bold(`[${index + 1}] ${title}`)}`);
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
