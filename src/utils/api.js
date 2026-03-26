import axios from "axios";
import crypto from "crypto";
import config from "./config-manager.js";
import { t } from "./i18n.js";

const SALT = "methodalgoMcpSALT";

/**
 * 带有 HMAC 签名的安全请求函数 (迁移自原 core.js)
 */
export async function signedRequest(endpoint, params = {}) {
    const apiKey = process.env.METHODALGO_API_KEY || config.get("apiKey");
    const apiBase = config.get("apiBase");

    if (!apiKey) {
        throw new Error(t("ERR_MISSING_KEY"));
    }

    const url = `${apiBase}${endpoint}`;
    const timestamp = Date.now().toString();

    // 过滤空值
    const cleanParams = Object.fromEntries(
        Object.entries(params).filter(([_, v]) => v !== undefined && v !== null)
    );

    const sortedKeys = Object.keys(cleanParams).sort();
    const sortedParams = sortedKeys.map(key => `${key}=${encodeURIComponent(cleanParams[key])}`).join("&");

    const signature = crypto.createHmac("sha256", apiKey + SALT)
        .update(sortedParams)
        .digest("hex");

    return axios.get(url, {
        params: cleanParams,
        headers: {
            "x-mcp-signature": signature,
            "x-mcp-timestamp": timestamp,
            "Authorization": `Bearer ${apiKey}`
        }
    });
}
