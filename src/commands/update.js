import { Command } from "commander";
import { exec } from "child_process";
import { existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import chalk from "chalk";
import { t } from "../utils/i18n.js";
import logger from "../utils/logger.js";

async function detectInstallMethod() {
    const execPath = process.execPath;
    const isSea = process.getBuiltinModule && process.getBuiltinModule("node:sea");
    if (execPath.includes("methodalgo") && !execPath.includes("node_modules")) return "binary";
    
    // 获取当前脚本所在目录的根路径 (假设在 src/commands/)
    const __filename = fileURLToPath(import.meta.url);
    const rootDir = join(dirname(__filename), "../../");
    const gitDir = join(rootDir, ".git");
    
    if (existsSync(gitDir) && !process.argv[1].includes("node_modules")) return "git";
    return "npm";
}

const updateCmd = new Command("update")
    .description(t("UPDATE_DESC"))
    .action(async () => {
        logger.info(t("UPDATE_DETECTING"));
        const method = await detectInstallMethod();
        if (method === "binary") {
            logger.info(t("UPDATE_METHOD_BINARY"));
            logger.info(`${t("LABEL_SUGGESTION")}${chalk.cyan(t("UPDATE_BINARY_GUIDE"))}`);
            return;
        }
        if (method === "git") {
            logger.info(t("UPDATE_METHOD_GIT"));
            exec("git pull", (err, stdout, stderr) => {
                if (err) return logger.error(`${t("UPDATE_GIT_FAIL")}\n${chalk.red(err.message)}`);
                logger.success(t("UPDATE_SUCCESS"));
                if (stdout) console.log(chalk.dim(stdout));
            });
            return;
        }
        logger.info(t("UPDATE_METHOD_NPM"));
        exec("npm install -g methodalgo-cli", (err, stdout, stderr) => {
            if (err || (stderr && stderr.includes("ERR!"))) return logger.error(`${t("UPDATE_FAIL")}\n${chalk.red(err?.message || stderr)}`);
            logger.success(t("UPDATE_SUCCESS"));
            if (stdout) console.log(chalk.dim(stdout));
        });
    });

export default updateCmd;
