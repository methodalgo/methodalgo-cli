import { Command } from "commander";
import chalk from "chalk";
import readline from "readline";
import config from "../utils/config-manager.js";
import { startOnboarding } from "../utils/onboard.js";
import { t } from "../utils/i18n.js";
import { BANNER } from "../utils/constants.js";

const loginCmd = new Command("login")
    .description(t("LOGIN_DESC"))
    .action(async () => {
        const hasEnvKey = !!process.env.METHODALGO_API_KEY;
        const hasConfigKey = !!config.get("apiKey");

        if (hasEnvKey) {
            console.log(chalk.yellow("\n⚠️  " + t("LOGIN_USE_ENV_KEY")));
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

        await startOnboarding(BANNER);
    });

export default loginCmd;
