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
            : `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
    } catch { return "--:--"; }
};
