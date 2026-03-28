import React from "react";
import { Text } from "ink";

const h = React.createElement;

/**
 * 渐变色工具
 * @param {string} text 
 * @param {number[]} fromRGB 
 * @param {number[]} toRGB 
 */
export const gradientText = (text, fromRGB, toRGB) => {
    const len = text.length;
    if (len === 0) return [];
    return [...text].map((ch, i) => {
        const ratio = len > 1 ? i / (len - 1) : 0;
        const r = Math.round(fromRGB[0] + (toRGB[0] - fromRGB[0]) * ratio);
        const g = Math.round(fromRGB[1] + (toRGB[1] - fromRGB[1]) * ratio);
        const b = Math.round(fromRGB[2] + (toRGB[2] - fromRGB[2]) * ratio);
        return h(Text, { key: i, color: `rgb(${r},${g},${b})`, bold: true }, ch);
    });
};

/**
 * 清洁文本，处理空白、Emoji 和控制字符
 * @param {string} text 
 */
export const cleanText = (text) => {
    if (!text) return "";
    return text.toString()
        .replace(/\*\*|__/g, "") // 移除 Markdown 加粗
        .replace(/[\r\n\t]+/g, " ") // 合并空白线和制表符
        .replace(/[\uD83C\uD83D\uD83E][\uDC00-\uDFFF]|[\u2600-\u27BF]/g, "") // 移除 Emoji
        .replace(/[\u0000-\u001F\u007F-\u009F]/g, "") // 移除控制字符
        .replace(/\s+/g, " ") // 合并连续空格
        .trim();
};

/**
 * 格式化 ISO 字符串为本地时间
 * @param {string} iso 
 */
export const formatTime = (iso) => {
    try {
        const d = new Date(iso);
        const now = new Date();
        const isToday = d.toDateString() === now.toDateString();
        return isToday
            ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })
            : `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    } catch { return "--:--"; }
};

/**
 * 根据不同信号模块（category），专门定制列表项颜色的策略控制
 * @param {string} category 模块名称
 * @param {object} item 信号对应的原始项
 */
export const getSignalColor = (category, item) => {
    // 默认非信号模块为白色
    if (!["breakout", "exhaustion", "goldenPit", "liquidation"].includes(category)) return "white";

    const sig = item.signals?.[0] || {};
    const details = sig.details || {};
    const title = (sig.title || item.displayTitle || "").toLowerCase();
    
    // 如果数据层带有明确方向属性，提取备用
    const direction = item.direction || sig.direction || "";

    switch (category) {
        case "breakout":
            // 突破：UP(bull) -> 绿, DOWN(bear) -> 红
            if (direction === "bull" || title.includes("up")) return "white";
            if (direction === "bear" || title.includes("down")) return "red";
            return "white";

        case "goldenPit":
            // 黄金坑：Bull -> 绿, Bear -> 红
            if (direction === "bull" || title.includes("bull")) return "white";
            if (direction === "bear" || title.includes("bear")) return "red";
            return "white";

        case "liquidation":
            // 清算：SHORT (空头爆仓) -> 逼空上涨(绿)；LONG (多头爆仓) -> 加速下跌(红)
            const isLong = (details.Side || "").toLowerCase().includes("sell") || direction === "bear" || title.includes("long");
            const isShort = (details.Side || "").toLowerCase().includes("buy") || direction === "bull" || title.includes("short");
            if (isShort) return "white";
            if (isLong) return "red";
            return "white";

        case "exhaustion":
            // 衰竭：SELLER (空头衰竭) -> 见底反转(绿)；BUYER (多头衰竭) -> 见顶反转(红)
            if (title.includes("seller")) return "white";
            if (title.includes("buyer")) return "red";
            return "white";

        default:
            return "white";
    }
};
