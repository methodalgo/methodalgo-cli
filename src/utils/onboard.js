import readline from "readline";
import chalk from "chalk";
import config from "./config-manager.js";
import { t } from "./i18n.js";
import { validateApiKey } from "./api.js";
import { loginWithOAuth } from "./oauth-login.js";

export async function startOnboarding(banner = "", options = {}) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const question = (query) => new Promise((resolve) => rl.question(query, resolve));
    const useOAuth = options.useOAuth !== false;

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

    // 3. 优先使用 OAuth 登录，失败后回退到手动 API Key
    let valid = false;
    if (useOAuth) {
        const authMethod = await question(chalk.bold(`\n${t("ONBOARD_AUTH_METHOD_PROMPT")}`));
        if (authMethod !== "2") {
            try {
                console.log(chalk.blue(`\n⏳ ${t("ONBOARD_OAUTH_OPENING")}`));
                const result = await loginWithOAuth();
                if (result?.apiKey) {
                    valid = true;
                    config.set("apiKey", result.apiKey);
                    console.log(chalk.green(`\n✨ ${t("ONBOARD_OAUTH_SUCCESS", { email: result.user?.email || "MethodAlgo" })}`));
                } else {
                    console.log(chalk.red(`\n❌ ${t("ONBOARD_FAILED")}`));
                }
            } catch (err) {
                console.log(chalk.yellow(`\n⚠️  ${t("ONBOARD_OAUTH_FAILED", { message: err.message })}`));
            }
        }
    }

    // 4. 循环请求 API Key 直到校验成功
    if (!valid) {
        console.log(chalk.yellow(`🔗 ${t("ONBOARD_GET_LINK")}\n`));
    }

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

    rl.close();
    console.log(chalk.cyan("\n" + "=".repeat(50) + "\n"));
}
