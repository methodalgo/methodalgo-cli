import { Command } from "commander";
import chalk from "chalk";
import { signedRequest } from "../utils/api.js";
import logger from "../utils/logger.js";
import { t, getLang } from "../utils/i18n.js";

const calendarCmd = new Command("calendar")
    .description(t("CALENDAR_DESC"))
    .option("-c, --countries <codes>", t("OPT_COUNTRIES_DESC"))
    .option("-f, --from <date>", `${t("OPT_CALENDAR_FROM_DESC")} (Format: YYYY-MM-DD)`)
    .option("-t, --to <date>", `${t("OPT_CALENDAR_TO_DESC")} (Format: YYYY-MM-DD)`)
    .option("--json", t("OPT_JSON_DESC"))
    .addHelpText("after", `\n${t("LABEL_EXAMPLE")}\n  $ ${t("CALENDAR_EXAMPLE")}`)
    .action(async (options) => {
        // 如果没有提供 countries，报错并自动显示帮助信息
        if (!options.countries) {
            console.error(chalk.red(`\n✖ ${t("ERR_MISSING_COUNTRIES")}`));
            return calendarCmd.help();
        }

        try {
            const res = await signedRequest("/cli/calendar", {
                countries: options.countries,
                from: options.from,
                to: options.to
            });
            const { status, data, message } = res.data;
            if (!status) return logger.error(`${t("ERR_NETWORK")}: ${message}`);
            if (options.json) return logger.json(data);

            const lang = getLang();
            if (data.length === 0) {
                return logger.info(lang === "zh" ? "未找到符合条件的经济事件。" : "No economic events found for the specified criteria.");
            }

            data.forEach((item, index) => {
                const dateObj = new Date(item.date);
                const date = dateObj.toLocaleString(lang === "zh" ? "zh-CN" : "en-US", {
                    month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false
                });
                
                const importanceStr = "⭐".repeat(item.importance);
                const color = item.importance === 3 ? chalk.red : item.importance === 2 ? chalk.yellow : chalk.white;
                
                console.log(`\n${chalk.bold(`[${index + 1}] ${date}`)} ${color(`[${importanceStr}]`)} ${chalk.cyan(item.country)}`);
                console.log(`    ${chalk.white.bold(item.title)}`);
                
                if (item.actual !== undefined || item.forecast !== undefined || item.previous !== undefined) {
                    const actualValue = item.actual !== undefined && item.actual !== null ? chalk.bold.green(item.actual + item.unit) : chalk.dim("-");
                    const forecastValue = item.forecast !== undefined && item.forecast !== null ? chalk.yellow(item.forecast + item.unit) : chalk.dim("-");
                    const previousValue = item.previous !== undefined && item.previous !== null ? chalk.gray(item.previous + item.unit) : chalk.dim("-");
                    
                    console.log(`    ${t("LABEL_ACTUAL")}: ${actualValue}  |  ${t("LABEL_FORECAST")}: ${forecastValue}  |  ${t("LABEL_PREVIOUS")}: ${previousValue}`);
                    
                    if (item.source) {
                        const sourceUrl = item.source_url ? ` ${chalk.blue.underline(item.source_url)}` : "";
                        console.log(`    ${chalk.dim(t("LABEL_SOURCE") + ": " + item.source)}${sourceUrl}`);
                    }
                }
                
                if (item.comment) {
                    const cleanComment = item.comment.replace(/\n\s+/g, " ").replace(/\n/g, " ").trim();
                    const truncated = cleanComment.length > 200 ? cleanComment.substring(0, 200) + "..." : cleanComment;
                    console.log(`    ${chalk.dim(truncated)}`);
                }
            });
            console.log("");
        } catch (error) {
            logger.error(`Calendar Error: ${error.message}`);
        }
    });

export default calendarCmd;
