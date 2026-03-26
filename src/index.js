import { program } from "commander";
import { readFileSync } from "fs";
import { resolve } from "path";
import configCmd from "./commands/config.js";
import snapshotCmd from "./commands/snapshot.js";
import newsCmd from "./commands/news.js";
import signalsCmd from "./commands/signals.js";

import { t } from "./utils/i18n.js";

// 读取 package.json 获取版本号
const pkgPath = resolve(process.cwd(), "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));

program
    .name("methodalgo")
    .description(t("HELP_DESC"))
    .version(pkg.version);

// 注册子命令
program.addCommand(configCmd.description(t("CONFIG_DESC")));
program.addCommand(snapshotCmd.description(t("SNAPSHOT_DESC")));
program.addCommand(newsCmd.description(t("NEWS_DESC")));
program.addCommand(signalsCmd.description(t("SIGNALS_DESC")));

// 处理未知命令
program.on("command:*", () => {
    console.error(`无效的命令: ${program.args.join(" ")}\n使用 "methodalgo --help" 查看可用命令。`);
    process.exit(1);
});

program.parse(process.argv);

// 如果没有输入命令，显示帮助
if (!process.argv.slice(2).length) {
    program.outputHelp();
}
