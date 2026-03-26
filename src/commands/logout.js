import { Command } from "commander";
import chalk from "chalk";
import configManager from "../utils/config-manager.js";
import { t } from "../utils/i18n.js";

const logoutCmd = new Command("logout")
    .description(t("LOGOUT_DESC"))
    .action(() => {
        configManager.set("apiKey", "");
        console.log(chalk.green(`\n✅ ${t("LOGOUT_SUCCESS")}`));
    });

export default logoutCmd;
