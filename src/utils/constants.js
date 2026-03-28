import chalk from "chalk";
import { readFileSync } from "fs";
import { resolve } from "path";

// 动态获取版本号
const pkgPath = resolve(resolve(new URL(import.meta.url).pathname), "../../..", "package.json");
let version = "1.0.0";
try {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    version = pkg.version;
} catch (e) {
    // 忽略错误
}

export const BANNER = `
${chalk.red.bold("▄▄▄      ▄▄▄             ▄▄             ▄▄   ▄▄▄▄   ▄▄             ")}
${chalk.red.bold("████▄  ▄████        ██   ██             ██ ▄██▀▀██▄ ██             ")}
${chalk.red.bold("███▀████▀███ ▄█▀█▄ ▀██▀▀ ████▄ ▄███▄ ▄████ ███  ███ ██ ▄████ ▄███▄ ")}
${chalk.red.bold("███  ▀▀  ███ ██▄█▀  ██   ██ ██ ██ ██ ██ ██ ███▀▀███ ██ ██ ██ ██ ██ ")}
${chalk.white.bold("███      ███ ▀█▄▄▄  ██   ██ ██ ▀███▀ ▀████ ███  ███ ██ ▀████ ▀███▀ ")}
${chalk.white.bold("                                                          ██       ")}
${chalk.white.bold("                                                        ▀▀▀        ")}
  ${chalk.dim("Cli | v" + version)}
`;
