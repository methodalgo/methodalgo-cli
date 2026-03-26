import axios from "axios";
import crypto from "crypto";
import config from "./config-manager.js";
import { t } from "./i18n.js";

const SALT = "methodalgoMcpSALT";

/**
 * 带有 HMAC 签名的安全请求函数 (迁移自原 core.js)
 */
export async function signedRequest(endpoint, params = {}, extraOptions = {}) {
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
        },
        ...extraOptions
    });
}

/**
 * 验证 API Key 是否有效 (拉取 1 条新闻测试)
 */
export async function validateApiKey(apiKey) {
    if (!apiKey) return false;
    const apiBase = config.get("apiBase");
    const endpoint = "/mcp/news";
    const params = { type: "news", limit: 1 };
    const timestamp = Date.now().toString();

    // 构造签名 (不依赖 config 中的 apiKey)
    const sortedParams = "limit=1&type=news";
    const signature = crypto.createHmac("sha256", apiKey + SALT)
        .update(sortedParams)
        .digest("hex");

    try {
        const res = await axios.get(`${apiBase}${endpoint}`, {
            params,
            headers: {
                "x-mcp-signature": signature,
                "x-mcp-timestamp": timestamp,
                "Authorization": `Bearer ${apiKey}`
            },
            timeout: 5000
        });
        return res.data.status === true;
    } catch (err) {
        return false;
    }
}
