import { Command } from "commander";
import config from "../utils/config-manager.js";
import logger from "../utils/logger.js";
import { t } from "../utils/i18n.js";

const configCmd = new Command("config").description(t("CONFIG_DESC"));

configCmd
    .command("set")
    .description(t("CONFIG_SET_DESC"))
    .argument("<key>", "Key (e.g., api-key, lang)")
    .argument("<value>", "Value")
    .action((key, value) => {
        const configKey = key === "api-key" ? "apiKey" : (key === "api-base" ? "apiBase" : key);
        config.set(configKey, value);
        logger.success(t("SET_SUCCESS", { key, value }));
    });

configCmd
    .command("get")
    .description(t("CONFIG_GET_DESC"))
    .argument("<key>", "Key")
    .action((key) => {
        const configKey = key === "api-key" ? "apiKey" : (key === "api-base" ? "apiBase" : key);
        const value = config.get(configKey);
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
        logger.json(safeData);
    });

export default configCmd;
