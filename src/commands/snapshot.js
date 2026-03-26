import { Command } from "commander";
import chalk from "chalk";
import { signedRequest } from "../utils/api.js";
import logger from "../utils/logger.js";
import { t } from "../utils/i18n.js";

const snapshotCmd = new Command("snapshot")
    .description(t("SNAPSHOT_DESC"))
    .argument("<symbol>", "Symbol (e.g., SOLUSDT)")
    .argument("[tf]", "Timeframe (default 60)", "60")
    .option("--json", "Output raw JSON data")
    .action(async (symbol, tf, options) => {
        try {
            let ticker = symbol.toUpperCase();
            if (!ticker.startsWith("BINANCE:")) ticker = `BINANCE:${ticker}`;

            const res = await signedRequest("/mcp/snapshot", { ticker, tf, storage: "localurl" });
            const { status, data, message } = res.data;

            if (!status) {
                logger.error(`${t("ERR_NETWORK")}: ${message}`);
                return;
            }

            if (options.json) {
                logger.json(data);
            } else {
                logger.success(t("SNAPSHOT_SUCCESS", { ticker, tf }));
                console.log(chalk.cyan("URL: ") + data.url);
            }
        } catch (error) {
            logger.error(`Snapshot Error: ${error.message}`, t("SUGGESTION_KEY"));
        }
    });

export default snapshotCmd;
