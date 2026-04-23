import readline from "readline";
import chalk from "chalk";
import config from "./config-manager.js";
import { t } from "./i18n.js";
import { validateApiKey } from "./api.js";

export async function startOnboarding(banner = "") {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const question = (query) => new Promise((resolve) => rl.question(query, resolve));

    console.clear();
    if (banner) console.log(banner);

    // 1. 设置语言
    console.log(chalk.cyan("\n" + "=".repeat(50)));
    const langIdx = await question(chalk.bold("\n请选择语言 / Select Language (1: English, 2: 中文) [1]: "));
    const lang = langIdx === "2" ? "zh" : "en";
    config.set("lang", lang);
    console.log(chalk.green(`\n✓ Language set to: ${lang === "zh" ? "中文" : "English"}`));

    // 2. 引导欢迎语
    console.log(chalk.blue(`\n💡 ${t("ONBOARD_WELCOME")}`));
    console.log(chalk.yellow(`🔗 ${t("ONBOARD_GET_LINK")}\n`));

    // 3. 循环请求 API Key 直到校验成功
    let valid = false;
    while (!valid) {
        const key = await question(chalk.bold(`🔑 ${t("ONBOARD_PROMPT")}`));
        if (!key) continue;

        console.log(chalk.blue(`\n⏳ ${t("ONBOARD_VALIDATING")}...`));
        valid = await validateApiKey(key);

        if (valid) {
            config.set("apiKey", key);
            console.log(chalk.green(`\n✨ ${t("ONBOARD_SUCCESS")}`));
        } else {
            console.log(chalk.red(`\n❌ ${t("ONBOARD_FAILED")}`));
            console.log(chalk.yellow(`🔗 ${t("ONBOARD_GET_LINK")}\n`));
        }
    }

    // 4. 可选：FRED API Key
    console.log(chalk.cyan("\n" + "─".repeat(30)));
    console.log(chalk.blue(`💡 (Optional) ${t("ONBOARD_FRED_DESC") || "Add FRED support for macro economic data."}`));
    const fredKey = await question(chalk.bold(`🔑 FRED API Key (Press Enter to skip): `));
    if (fredKey) {
        config.set("fredApiKey", fredKey);
        console.log(chalk.green(`✓ FRED API Key saved.`));
    }


    rl.close();
    console.log(chalk.cyan("\n" + "=".repeat(50) + "\n"));
}
