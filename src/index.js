import { program } from "commander";
import chalk from "chalk";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import configCmd from "./commands/config.js";
import snapshotCmd from "./commands/snapshot.js";
import newsCmd from "./commands/news.js";
import signalsCmd from "./commands/signals.js";
import dashboardCmd from "./commands/dashboard.js";
import updateCmd from "./commands/update.js";
import logoutCmd from "./commands/logout.js";
import config from "./utils/config-manager.js";
import { startOnboarding } from "./utils/onboard.js";
import { t } from "./utils/i18n.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pkgPath = resolve(__dirname, "../package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));

import { BANNER as finalBanner } from "./utils/constants.js";

program
    .name("methodalgo")
    .description(t("HELP_DESC"))
    .version(pkg.version)
    .showHelpAfterError();

program.addCommand(configCmd.description(t("CONFIG_DESC")));
program.addCommand(snapshotCmd.description(t("SNAPSHOT_DESC")));
program.addCommand(newsCmd.description(t("NEWS_DESC")));
program.addCommand(signalsCmd.description(t("SIGNALS_DESC")));
program.addCommand(dashboardCmd.description(t("DASHBOARD_DESC")));
program.addCommand(updateCmd.description(t("UPDATE_DESC")));
program.addCommand(logoutCmd);

// 确保所有层级的指令（包括嵌套子指令）在参数缺失/报错时也显示帮助信息
function applyShowHelp(cmd) {
    cmd.showHelpAfterError();
    cmd.commands.forEach(applyShowHelp);
}
applyShowHelp(program);

program.on("command:*", () => {
    console.error(`无效的命令: ${program.args.join(" ")}\n使用 "methodalgo --help" 查看可用命令。`);
    process.exit(1);
});

async function main() {
    // 检查是否需要引导 (无环境变量且无本地 API Key 则引导)
    const hasEnvKey = !!process.env.METHODALGO_API_KEY;
    const hasConfigKey = !!config.get("apiKey");

    if (!process.argv.includes("--json") && hasEnvKey) {
        console.error(chalk.blue("ℹ️  " + t("INFO_USE_ENV_KEY")));
    }

    if (!hasEnvKey && !hasConfigKey && !process.argv.includes("config") && !process.argv.includes("--help") && !process.argv.includes("-h")) {
        await startOnboarding(finalBanner);
    }
    
    if (process.argv.length <= 2) {
        process.stdout.write(finalBanner + "\n");
        program.help();
    }

    await program.parseAsync(process.argv);
}

main();
