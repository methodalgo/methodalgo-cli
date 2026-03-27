import { Command } from "commander";
import chalk from "chalk";
import { signedRequest } from "../utils/api.js";
import logger from "../utils/logger.js";
import { t } from "../utils/i18n.js";

const newsCmd = new Command("news")
    .description(t("NEWS_DESC"))
    .option("-t, --type <type>", "News type. Use 'methodalgo news --help' to see all types.")
    .option("-l, --limit <number>", t("OPT_LIMIT_DESC"), "10")
    .option("-g, --language <lang>", "Language (zh, en)", "zh")
    .option("-s, --search <keyword>", t("OPT_SEARCH_DESC"))
    .option("-S, --start-date <date>", t("OPT_START_DATE_DESC"))
    .option("-E, --end-date <date>", t("OPT_END_DATE_DESC"))
    .option("--json", "Output raw JSON data")
    .addHelpText("after", `\n${t("NEWS_LIMIT_NOTE")}\n\n${t("LABEL_EXAMPLE")}\n  $ ${t("NEWS_EXAMPLE")}\n\n${t("NEWS_TYPES")}`)
    .action(async (options) => {
        if (!options.type) {
            newsCmd.help();
            return;
        }

        try {
            const params = {
                type: options.type,
                limit: options.limit,
                lang: options.language,
                search: options.search,
                startDate: options.startDate,
                endDate: options.endDate
            };

            const res = await signedRequest("/mcp/news", params);
            const { status, data, message } = res.data;

            if (!status) {
                logger.error(`${t("ERR_NETWORK")}: ${message}`);
                return;
            }

            if (options.json) {
                logger.json(data);
            } else {
                const lang = t("FETCH_SUCCESS").includes("获取") ? "zh" : "en";
                logger.success(t("FETCH_SUCCESS", { count: data.length }));
                data.forEach((item, index) => {
                    const title = (item.title[lang] || item.title["en"]).replace(/\n/g, ", ");
                    let source = "MethodAlgo";
                    try { if (item.url) source = new URL(item.url).hostname.replace("www.", ""); } catch (_) {}
                    const date = new Date(item.publish_date).toLocaleString(lang === "zh" ? "zh-CN" : "en-US", {
                        hour12: false, month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit"
                    }).replace(/\//g, "-");
                    const excerpt = item.excerpt ? (item.excerpt[lang] || item.excerpt["en"]) : "";
                    
                    console.log(`\n${chalk.bold(`[${index + 1}] ${title}`)} ${chalk.dim(`(${source} · ${date})`)}`);
                    if (excerpt) {
                        console.log(`    ${chalk.gray(excerpt.replace(/\n/g, " ").substring(0, 150) + "...")}`);
                    }
                    if (item.url) {
                        console.log(`    ${chalk.blue.underline(item.url)}`);
                    }
                    if (item.image_url) {
                        console.log(`    ${chalk.yellow("🖼  Image: ")}${chalk.dim.underline(item.image_url)}`);
                    }
                    if (item.video_url) {
                        console.log(`    ${chalk.yellow("📹 Video: ")}${chalk.dim.underline(item.video_url)}`);
                    }
                });
                console.log(""); // 底部留白
            }
        } catch (error) {
            logger.error(`News Error: ${error.message}`);
        }
    });

export default newsCmd;
