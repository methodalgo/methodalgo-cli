import { Command } from "commander";
import chalk from "chalk";
import axios from "axios";
import { signedRequest } from "../utils/api.js";
import logger from "../utils/logger.js";
import { t } from "../utils/i18n.js";

const snapshotCmd = new Command("snapshot")
    .description(t("SNAPSHOT_DESC"))
    .argument("<symbol>", t("ARG_SYMBOL_DESC"))
    .argument("[tf]", t("ARG_TF_DESC"), "60")
    .option("--json", "Output raw JSON data")
    .option("-u, --url", t("OPT_URL_DESC"))
    .option("-b, --buffer", t("OPT_BUFFER_DESC"))
    .addHelpText("after", `\n${t("LABEL_EXAMPLE")}\n  $ ${t("SNAPSHOT_EXAMPLE")}\n`)
    .action(async (symbol, tf, options) => {
        try {
            let ticker = symbol.toUpperCase();
            if (!ticker.startsWith("BINANCE:")) ticker = `BINANCE:${ticker}`;

            // 智能选择存储模式优先级：--buffer > --url/--json > iTerm2 自动检测
            const useLocal = (options.buffer || logger.isIterm2) && !options.json && !options.url;
            // 如果显式指定了 --buffer，即使不是 iterm2 也尝试 local
            const storage = (options.buffer || useLocal) ? "local" : "localurl";
            const isBinaryMode = storage === "local";

            const res = await signedRequest(
                "/mcp/snapshot", 
                { ticker, tf, storage }, 
                isBinaryMode ? { responseType: "arraybuffer" } : {}
            );

            if (isBinaryMode) {
                // 处理二进制返回
                const contentType = res.headers["content-type"] || "";
                if (contentType.includes("image")) {
                    const buffer = Buffer.from(res.data);
                    if (options.json) {
                        logger.json({ ticker, tf, size: buffer.length, format: contentType });
                    } else {
                        logger.image(buffer, options.buffer); // 如果指定了 --buffer，强制渲染
                        logger.success(t("SNAPSHOT_SUCCESS", { ticker, tf }));
                        const tip = t("VAL_ALLOWED_KEYS").includes("键") ? "提示: 二进制模式下不显示 URL" : "Note: URL not available in binary mode";
                        logger.info(tip);
                    }
                    return;
                } else {
                    // 可能是错误响应被转成了 buffer
                    const result = JSON.parse(Buffer.from(res.data).toString());
                    const errMsg = result.message || result.error || JSON.stringify(result);
                    logger.error(`${t("ERR_NETWORK")}: ${errMsg}`);
                    return;
                }
            }

            // 处理常规 JSON 返回 (localurl)
            const result = res.data;
            const snapshotUrl = result.url || (result.data && result.data.url);
            
            if (snapshotUrl) {
                if (options.json) {
                    logger.json(result);
                } else {
                    logger.success(t("SNAPSHOT_SUCCESS", { ticker, tf }));
                    console.log(chalk.cyan("URL: ") + snapshotUrl);
                }
                return;
            }

            if (result.status === false) {
                const errMsg = result.message || result.error || JSON.stringify(result);
                logger.error(`${t("ERR_NETWORK")}: ${errMsg}`);
                return;
            }

            logger.error(`${t("ERR_NETWORK")}: ${JSON.stringify(result)}`);
        } catch (error) {
            logger.error(`Snapshot Error: ${error.message}`, t("SUGGESTION_KEY"));
        }
    });

export default snapshotCmd;
