import { program } from "commander";
import chalk from "chalk";
import { readFileSync } from "fs";
import { resolve } from "path";
import configCmd from "./commands/config.js";
import snapshotCmd from "./commands/snapshot.js";
import newsCmd from "./commands/news.js";
import signalsCmd from "./commands/signals.js";

import { t } from "./utils/i18n.js";

const pkgPath = resolve(process.cwd(), "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));

// 极简版: 仅保留用户指定的蓝色块状 ASCII 字
const title = chalk.blueBright.bold;

const finalBanner = `
${title("▄▄▄      ▄▄▄             ▄▄             ▄▄   ▄▄▄▄   ▄▄             ")}
${title("████▄  ▄████        ██   ██             ██ ▄██▀▀██▄ ██             ")}
${title("███▀████▀███ ▄█▀█▄ ▀██▀▀ ████▄ ▄███▄ ▄████ ███  ███ ██ ▄████ ▄███▄ ")}
${title("███  ▀▀  ███ ██▄█▀  ██   ██ ██ ██ ██ ██ ██ ███▀▀███ ██ ██ ██ ██ ██ ")}
${title("███      ███ ▀█▄▄▄  ██   ██ ██ ▀███▀ ▀████ ███  ███ ██ ▀████ ▀███▀ ")}
${title("                                                          ██       ")}
${title("                                                        ▀▀▀        ")}
  ${chalk.dim("Cli | v" + pkg.version)}
`;

program
    .name("methodalgo")
    .description(t("HELP_DESC"))
    .version(pkg.version)
    .addHelpText("beforeAll", finalBanner);

program.addCommand(configCmd.description(t("CONFIG_DESC")));
program.addCommand(snapshotCmd.description(t("SNAPSHOT_DESC")));
program.addCommand(newsCmd.description(t("NEWS_DESC")));
program.addCommand(signalsCmd.description(t("SIGNALS_DESC")));

program.on("command:*", () => {
    console.error(`无效的命令: ${program.args.join(" ")}\n使用 "methodalgo --help" 查看可用命令。`);
    process.exit(1);
});

if (process.argv.length <= 2) {
    program.help();
}

program.parse(process.argv);
