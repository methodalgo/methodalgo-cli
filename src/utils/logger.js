import chalk from "chalk";
import { t } from "./i18n.js";

/**
 * 针对 LLM 优化的日志/错误输出工具
 */
const logger = {
    info: (msg) => console.log(chalk.blue("ℹ ") + msg),
    success: (msg) => console.log(chalk.green("✔ ") + msg),
    warn: (msg) => console.log(chalk.yellow("⚠ ") + msg),
    error: (msg, suggestion) => {
        console.error(chalk.red("✖ ") + chalk.bold(msg));
        if (suggestion) {
            console.error(chalk.cyan(`\n💡 ${t("LABEL_SUGGESTION")}`) + suggestion);
        }
    },
    json: (data) => console.log(JSON.stringify(data, null, 2))
};

export default logger;
