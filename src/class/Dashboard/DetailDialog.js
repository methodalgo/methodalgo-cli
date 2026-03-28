import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import chalk from "chalk";
import { getLang } from "../../utils/i18n.js";
import { formatTime } from "../../utils/dashboard-utils.js";

const h = React.createElement;

export const DetailDialog = ({ data, category, type, onClose }) => {
    const [scrollOffset, setScrollOffset] = useState(0);
    const termRows = process.stdout.rows || 40;
    const termCols = process.stdout.columns || 80;
    const lang = getLang();

    // 辅助函数：解析多语言对象或字符串，防止 [object Object]
    const parseText = (val) => {
        if (!val) return "";
        if (typeof val === "string") return val;
        if (Array.isArray(val)) return val.map(v => parseText(v)).join("\n");
        if (typeof val === "object") {
            // 尝试优先提取文本字段 (兼容空字符串)
            const hit = [val[lang], val.en, val.zh, val.excerpt, val.content, val.text, val.message].find(v => v !== undefined);
            if (hit !== undefined) {
                if (typeof hit === "string") return hit;
                return parseText(hit); // 递归处理
            }
            // 如果只有一对键值，且值是字符串，提取它
            const keys = Object.keys(val);
            if (keys.length === 1 && typeof val[keys[0]] === "string") return val[keys[0]];
            
            return JSON.stringify(val);
        }
        return String(val);
    };

    const sig = data.sig || data.signals?.[0] || {};
    const title = sig.title || data.displayTitle || "";
    const lines = [];

    // 处理 Analysis 高亮展示
    const analysisText = parseText(data.analysis);
    if (analysisText) {
        lines.push(chalk.yellow(`Analysis: ${analysisText}`));
        lines.push(""); // 间隔
    }

    const addLine = (k, v) => v && lines.push(`${chalk.cyan(k.padEnd(16))}: ${chalk.white(v)}`);

    if (type === "tokenUnlock") {
        addLine("Symbol", data.symbol || data.token);
        addLine("Unlock Time", formatTime(data.publish_date || data.ts || data.timestamp));
        addLine("Market Cap", data.marketCap);
        addLine("Progress", data.progress);
        addLine("Countdown", data.countDown || data.unlockTime || data.nextUnlock);
        addLine("Quantity", data.unlockValue || data.unlockTokenVal || data.unlockQuantity);
        addLine("Percentage", data.perc ? `${data.perc}%` : null);
    } else if (sig.details && Object.keys(sig.details).length > 0) {
        Object.entries(sig.details).forEach(([k, v]) => {
            if (!v) return;
            lines.push(`${chalk.cyan(k.padEnd(16))}: ${chalk.white(v)}`);
        });
    }

    // ── Image URL ──
    const imgUrl = data.imageUrl || data.image || data.fileUrl || data.image_url || sig.image || sig.imageUrl || (data.attachments?.[0]?.url);
    if (imgUrl) addLine("Image URL", imgUrl);

    // 辅助解析摘要：按优先级在 sig.desc, data.desc, data.excerpt, data.content 中寻找第一个非空文本
    const getSummary = () => {
        const candidates = [sig.description, data.description, data.excerpt, data.content];
        for (const c of candidates) {
            const t = parseText(c);
            if (t && t.trim().length > 0) return t;
        }
        return "";
    };

    const description = getSummary();
    if (description) {
        lines.push("");
        lines.push(...description.toString().split("\n").map(l => l.trim()));
    }

    const HEADER = 8;
    const FOOTER = 3;
    const VISIBLE = Math.max(3, termRows - HEADER - FOOTER);

    useInput((input, key) => {
        if (key.escape || key.return || input === "q") onClose();
        if (key.upArrow) setScrollOffset(o => Math.max(0, o - 1));
        if (key.downArrow) setScrollOffset(o => Math.min(Math.max(0, lines.length - VISIBLE), o + 1));
    });

    const visibleContent = lines.slice(scrollOffset, scrollOffset + VISIBLE);
    
    return h(Box, {
        flexDirection: "column", borderStyle: "double", borderColor: "red",
        paddingX: 1, width: "100%", height: termRows
    },
        h(Box, { marginBottom: 1 },
            h(Text, { backgroundColor: "red", color: "white", bold: true }, `  ${(category || "Detail").toUpperCase()}  `)
        ),
        h(Text, { color: "yellow", bold: true, wrap: "wrap" }, title),
        h(Box, { height: 1 }),
        h(Box, { gap: 2 },
            h(Text, null, h(Text, { color: "gray" }, "Time: "), h(Text, { color: "cyan" }, formatTime(data.publish_date || data.ts || data.timestamp || "N/A"))),
        ),
        data.url ? h(Text, { color: "gray", dimColor: true, wrap: "truncate" }, `URL: ${data.url}`) : null,
        
        h(Box, { flexDirection: "column", flexGrow: 1, marginTop: 1 },
            h(Text, { color: "gray", dimColor: true }, "─".repeat(Math.max(10, termCols - 6))),
            ...visibleContent.map((line, i) => h(Text, { key: i, wrap: "wrap", color: "white" }, line || " "))
        ),

        h(Box, { justifyContent: "center", borderStyle: "single", borderColor: "gray", borderTop: true, borderBottom: false, borderLeft: false, borderRight: false },
            h(Text, { backgroundColor: "red", color: "white", bold: true }, " ENTER/ESC "),
            h(Text, { color: "gray" }, " Close  "),
            h(Text, { backgroundColor: "gray", color: "white", bold: true }, " Up/Dn "),
            h(Text, { color: "gray" }, " Scroll")
        )
    );
};
