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
    json: (data) => console.log(JSON.stringify(data, null, 2)),
    isIterm2: process.env.TERM_PROGRAM === "iTerm.app" || !!process.env.ITERM_SESSION_ID,
    image: (buffer, force = false) => {
        if ((!logger.isIterm2 && !force) || !buffer) return;
        // iTerm2 Inline Image Protocol: \x1b]1337;File=inline=1;size=...:[base64]\x07
        const base64 = buffer.toString("base64");
        process.stdout.write(`\x1b]1337;File=inline=1;size=${buffer.length}:${base64}\x07\n`);
    }
};

export default logger;
