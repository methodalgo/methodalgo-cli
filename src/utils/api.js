import crypto from "crypto";
import config from "./config-manager.js";
import { t } from "./i18n.js";

const SALT = "methodalgoMcpSALT";

/**
 * 带有 HMAC 签名的安全请求函数 (迁移自原 core.js)
 * 使用原生 fetch 以获得更好的跨平台兼容性 (Node 18+, Bun)
 */
export async function signedRequest(endpoint, params = {}, extraOptions = {}) {
    const apiKey = process.env.METHODALGO_API_KEY || config.get("apiKey");
    const apiBase = config.get("apiBase");

    if (!apiKey) {
        throw new Error(t("ERR_MISSING_KEY"));
    }

    const timestamp = Date.now().toString();

    // 过滤并排序参数
    const cleanParams = Object.fromEntries(
        Object.entries(params).filter(([_, v]) => v !== undefined && v !== null)
    );
    const urlObj = new URL(`${apiBase}${endpoint}`);
    Object.entries(cleanParams).forEach(([k, v]) => urlObj.searchParams.append(k, v));

    const sortedKeys = Object.keys(cleanParams).sort();
    const sortedParams = sortedKeys.map(key => `${key}=${encodeURIComponent(cleanParams[key])}`).join("&");

    const signature = crypto.createHmac("sha256", apiKey + SALT)
        .update(sortedParams)
        .digest("hex");

    const response = await fetch(urlObj.toString(), {
        method: "GET",
        headers: {
            "x-mcp-signature": signature,
            "x-mcp-timestamp": timestamp,
            "Authorization": `Bearer ${apiKey}`,
            "Accept": "application/json",
            ...extraOptions.headers
        },
        signal: extraOptions.signal,
    });

    if (!response.ok) {
        let serverMsg = "";
        try {
            const errorData = await response.json();
            serverMsg = errorData.msg || errorData.message || "";
        } catch (_) {}
        const error = new Error(serverMsg || `Request failed with status ${response.status}`);
        error.status = response.status;
        throw error;
    }

    if (extraOptions.responseType === "arraybuffer") {
        const data = await response.arrayBuffer();
        return { data, headers: Object.fromEntries(response.headers.entries()) };
    }

    const data = await response.json();
    return { data, headers: Object.fromEntries(response.headers.entries()) };
}

/**
 * 验证 API Key 是否有效 (拉取 1 条新闻测试)
 */
export async function validateApiKey(apiKey) {
    if (!apiKey) return false;
    const apiBase = config.get("apiBase");
    const endpoint = "/cli/news";
    const timestamp = Date.now().toString();

    // 构造签名
    const sortedParams = "limit=1&type=news";
    const signature = crypto.createHmac("sha256", apiKey + SALT)
        .update(sortedParams)
        .digest("hex");

    const urlObj = new URL(`${apiBase}${endpoint}`);
    urlObj.searchParams.append("type", "news");
    urlObj.searchParams.append("limit", "1");

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(urlObj.toString(), {
            method: "GET",
            headers: {
                "x-mcp-signature": signature,
                "x-mcp-timestamp": timestamp,
                "Authorization": `Bearer ${apiKey}`,
                "Accept": "application/json"
            },
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) return false;
        const data = await response.json();
        return data.status === true;
    } catch (err) {
        return false;
    }
}
