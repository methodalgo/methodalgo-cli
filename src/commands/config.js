import { Command } from "commander";
import chalk from "chalk";
import config from "../utils/config-manager.js";
import logger from "../utils/logger.js";
import { t } from "../utils/i18n.js";
import { validateApiKey } from "../utils/api.js";

const API_KEY_MAP = {
    "api-key": "apiKey",
    "lang": "lang",
    "api-base": "apiBase",
    "fred-api-key": "fredApiKey"
};

const configCmd = new Command("config")
    .description(t("CONFIG_DESC"))
    .addHelpText("after", `\n${t("LABEL_EXAMPLE")}\n  $ ${t("CONFIG_EXAMPLE")}\n`);

configCmd.addHelpText("after", `\n${t("VAL_ALLOWED_KEYS")}`);

configCmd
    .command("set")
    .description(t("CONFIG_SET_DESC"))
    .argument("<key>", "Key (api-key, lang, api-base, fred-api-key)")
    .argument("<value>", "Value")
    .action(async (key, value) => {
        if (!API_KEY_MAP[key]) {
            logger.error(t("ERR_INVALID_CONFIG_KEY", { key }));
            console.log(chalk.yellow(`💡 ${t("VAL_ALLOWED_KEYS")}`));
            return;
        }

        const configKey = API_KEY_MAP[key];
        
        // 关键校验：如果是设置 API Key，必须先验证有效性
        if (configKey === "apiKey") {
            logger.info(`${t("ONBOARD_VALIDATING")}...`);
            const isValid = await validateApiKey(value);
            if (!isValid) {
                logger.error(t("ONBOARD_FAILED"));
                console.log(chalk.yellow(`🔗 ${t("ONBOARD_GET_LINK")}`));
                return;
            }
            logger.success(t("ONBOARD_SUCCESS"));
        }

        // FRED API Key: just save, no validation needed
        if (configKey === "fredApiKey") {
            config.set(configKey, value);
            logger.success(`FRED API Key saved. Test with: methodalgo fred latest FEDFUNDS`);
            return;
        }

        config.set(configKey, value);
        logger.success(t("SET_SUCCESS", { key, value }));
    });

configCmd
    .command("get")
    .description(t("CONFIG_GET_DESC"))
    .argument("<key>", "Key (api-key, lang, api-base, fred-api-key)")
    .action((key) => {
        if (!API_KEY_MAP[key]) {
            logger.error(t("ERR_INVALID_CONFIG_KEY", { key }));
            console.log(chalk.yellow(`💡 ${t("VAL_ALLOWED_KEYS")}`));
            return;
        }

        const configKey = API_KEY_MAP[key];
        const value = config.get(configKey);
        if (configKey === "apiKey" && process.env.METHODALGO_API_KEY) {
            logger.info(t("INFO_USE_ENV_KEY"));
        }
        if (configKey === "fredApiKey" && process.env.FRED_API_KEY) {
            logger.info("Using FRED API Key from environment variable (FRED_API_KEY).");
        }
        if (value) {
            console.log(value);
        } else {
            logger.warn(t("VAL_NOT_SET", { key }));
        }
    });

configCmd
    .command("list")
    .description(t("CONFIG_LIST_DESC"))
    .action(() => {
        const all = config.store;
        const safeData = { ...all };
        if (safeData.apiKey) safeData.apiKey = "********";
        if (safeData.fredApiKey) safeData.fredApiKey = "********";
        logger.json(safeData);
    });

export default configCmd;
