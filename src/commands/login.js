import { Command } from "commander";
import chalk from "chalk";
import readline from "readline";
import config from "../utils/config-manager.js";
import logger from "../utils/logger.js";
import { startOnboarding } from "../utils/onboard.js";
import { t } from "../utils/i18n.js";
import { BANNER } from "../utils/constants.js";

const loginCmd = new Command("login")
    .description(t("LOGIN_DESC"))
    .option("--api-key", t("LOGIN_API_KEY_OPTION"))
    .action(async (options) => {
        const hasEnvKey = !!process.env.METHODALGO_API_KEY;
        const hasConfigKey = !!config.get("apiKey");

        if (hasEnvKey) {
            console.log(chalk.yellow("\n⚠️  " + t("LOGIN_USE_ENV_KEY")));
            return;
        }

        // 登录必须在交互式终端里进行：没有终端输入时明确失败，而不是停在“是否重新登录”的询问上
        if (!process.stdin.isTTY) {
            logger.error(t("ERR_ONBOARD_NO_INPUT"), t("SUGGESTION_LOGIN"));
            return;
        }

        if (hasConfigKey) {
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });

            const answer = await new Promise(resolve => {
                rl.question(chalk.blue("\nℹ️  " + t("LOGIN_ALREADY_LOGGED_IN")) + "\n" + chalk.yellow("❓ " + t("LOGIN_RELOGIN_PROMPT")), resolve);
            });

            rl.close();

            if (answer && answer.toLowerCase() !== "y") {
                return;
            }
            
            // 如果用户选择重新登录，先清空 Key
            config.set("apiKey", "");
        }

        await startOnboarding(BANNER, { useOAuth: !options.apiKey });
    });

export default loginCmd;
