import React, { useMemo, useState } from "react";
import { Box, Text, useInput } from "ink";
import { getLang, t } from "../../utils/i18n.js";
import { cleanText, formatTime } from "../../utils/dashboard-utils.js";

const h = React.createElement;

export const DetailDialog = ({ data, category, type, onClose }) => {
    const [scrollOffset, setScrollOffset] = useState(0);
    const termRows = process.stdout.rows || 40;
    const termCols = process.stdout.columns || 80;
    const lang = getLang();
    const model = useMemo(() => buildDetailModel({ data, category, type, lang }), [data, category, type, lang]);
    const contentRows = useMemo(() => flattenDetailSections(model.sections), [model.sections]);
    const headerRows = 9 + Math.ceil(model.title.length / Math.max(24, termCols - 4));
    const visibleRows = Math.max(4, termRows - headerRows - 4);

    useInput((input, key) => {
        if (key.escape || key.return || input === "q") onClose();
        if (key.upArrow) setScrollOffset(o => Math.max(0, o - 1));
        if (key.downArrow) setScrollOffset(o => Math.min(Math.max(0, contentRows.length - visibleRows), o + 1));
    });

    const visibleContent = contentRows.slice(scrollOffset, scrollOffset + visibleRows);

    return h(Box, {
        flexDirection: "column",
        borderStyle: "double",
        borderColor: "red",
        paddingX: 1,
        width: "100%",
        height: termRows
    },
        h(Box, { gap: 1, marginBottom: 1, flexWrap: "wrap" },
            ...model.badges.map((badge, idx) => h(Text, {
                key: `${badge}-${idx}`,
                backgroundColor: idx === 0 ? "red" : "gray",
                color: "white",
                bold: true
            }, ` ${badge} `))
        ),
        h(Text, { color: "yellow", bold: true, wrap: "wrap" }, model.title || t("TUI_DETAIL_UNTITLED")),
        h(Box, { marginTop: 1, flexDirection: "row", flexWrap: "wrap", gap: 2 },
            ...model.meta.map(item => h(Text, { key: item.labelKey, color: "cyan", wrap: "truncate" },
                h(Text, { color: "gray" }, `${t(item.labelKey)}: `),
                item.value
            ))
        ),
        h(Text, { color: "gray", dimColor: true }, "─".repeat(Math.max(10, termCols - 6))),
        h(Box, { flexDirection: "column", flexGrow: 1, overflow: "hidden" },
            ...visibleContent.map((row, idx) => renderContentRow(row, idx))
        ),
        h(Box, {
            justifyContent: "center",
            borderStyle: "single",
            borderColor: "gray",
            borderTop: true,
            borderBottom: false,
            borderLeft: false,
            borderRight: false
        },
            h(Text, { backgroundColor: "red", color: "white", bold: true }, " ENTER/ESC "),
            h(Text, { color: "gray" }, ` ${t("TUI_DETAIL_CLOSE")}  `),
            h(Text, { backgroundColor: "gray", color: "white", bold: true }, " Up/Dn "),
            h(Text, { color: "gray" }, ` ${t("TUI_DETAIL_SCROLL")}`)
        )
    );
};

export function buildDetailModel({ data = {}, category = "", type = "", lang = "en" }) {
    const sig = data.sig || data.signals?.[0] || {};
    const details = sig.details || {};
    const title = cleanText(parseDetailText(sig.title || data.displayTitle || data.title, lang));
    const timestamp = data.publish_date || data.ts || data.timestamp || data.updatedAt;
    const badges = buildBadges({ data, sig, details, category, type });
    const meta = [
        { labelKey: "TUI_DETAIL_TIME", value: formatTime(timestamp || "N/A") },
        { labelKey: "TUI_DETAIL_TYPE", value: category || type || "Detail" }
    ];
    const sections = [];

    if (type === "tokenUnlock") {
        addSection(sections, "TUI_DETAIL_KEY_METRICS", buildTokenMetrics(data));
    } else if (details && Object.keys(details).length > 0) {
        addSection(sections, "TUI_DETAIL_SIGNAL_DETAILS", Object.entries(details)
            .filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== "")
            .map(([key, value]) => `${key}: ${parseDetailText(value, lang)}`));
    }

    addSection(sections, "TUI_DETAIL_ANALYSIS", splitDetailLines(parseDetailText(data.analysis, lang)));
    addSection(sections, "TUI_DETAIL_SUMMARY", splitDetailLines(firstDetailText([
        sig.description,
        data.description,
        data.excerpt,
        data.content
    ], lang)));
    addSection(sections, "TUI_DETAIL_RESOURCES", buildResourceLines(data, sig));

    return {
        title,
        badges,
        meta,
        sections
    };
}

export function parseDetailText(value, lang = "en") {
    if (value === null || value === undefined) return "";
    if (typeof value === "string") return value.trim();
    if (Array.isArray(value)) return value.map(item => parseDetailText(item, lang)).filter(Boolean).join("\n");
    if (typeof value === "object") {
        const hit = [value[lang], value.en, value.zh, value.excerpt, value.content, value.text, value.message]
            .find(item => item !== undefined && item !== null);
        if (hit !== undefined) return parseDetailText(hit, lang);
        const keys = Object.keys(value);
        if (keys.length === 1) return parseDetailText(value[keys[0]], lang);
        return JSON.stringify(value);
    }
    return String(value).trim();
}

function buildBadges({ data, sig, details, category, type }) {
    const badges = [String(category || type || "Detail").replace(/([a-z])([A-Z])/g, "$1 $2").toUpperCase()];
    const symbol = data.symbol || data.token || details.Symbol || details.symbol || extractSymbol(sig.title || data.displayTitle || "");
    const direction = data.direction || sig.direction;
    const timeframe = details.TimeFrame || details.Timeframe || details.tf || details.TF || extractTimeFrame(sig.description);
    if (symbol) badges.push(cleanText(symbol).toUpperCase());
    if (direction) badges.push(String(direction).toUpperCase());
    if (timeframe) badges.push(String(timeframe).toUpperCase());
    return [...new Set(badges.filter(Boolean))];
}

function buildTokenMetrics(data) {
    return [
        ["Symbol", data.symbol || data.token],
        ["Market Cap", data.marketCap],
        ["Progress", data.progress],
        ["Countdown", data.countDown || data.unlockTime || data.nextUnlock],
        ["Quantity", data.unlockValue || data.unlockTokenVal || data.unlockQuantity],
        ["Percentage", data.perc ? `${data.perc}%` : null]
    ].filter(([, value]) => value).map(([label, value]) => `${label}: ${value}`);
}

function buildResourceLines(data, sig) {
    const lines = [];
    const image = data.imageUrl || data.image || data.fileUrl || data.image_url || sig.image || sig.imageUrl || data.attachments?.[0]?.url;
    if (data.url) lines.push(`URL: ${data.url}`);
    if (image) lines.push(`Image: ${image}`);
    if (Array.isArray(data.attachments)) {
        for (const item of data.attachments) {
            const url = typeof item === "string" ? item : item?.url;
            if (url && url !== image) lines.push(`Attachment: ${url}`);
        }
    }
    return lines;
}

function firstDetailText(candidates, lang) {
    for (const candidate of candidates) {
        const text = parseDetailText(candidate, lang);
        if (text) return text;
    }
    return "";
}

function splitDetailLines(text) {
    return String(text || "").split(/\r?\n/).map(line => line.trim()).filter(Boolean);
}

function addSection(sections, titleKey, lines) {
    if (Array.isArray(lines) && lines.length > 0) sections.push({ titleKey, lines });
}

function flattenDetailSections(sections) {
    const rows = [];
    for (const section of sections) {
        if (rows.length > 0) rows.push({ type: "blank" });
        rows.push({ type: "section", text: t(section.titleKey) });
        for (const line of section.lines) rows.push({ type: "line", text: line });
    }
    return rows;
}

function renderContentRow(row, idx) {
    if (row.type === "blank") return h(Text, { key: idx }, " ");
    if (row.type === "section") return h(Text, { key: idx, color: "red", bold: true }, `> ${row.text}`);
    return h(Text, { key: idx, color: "white", wrap: "wrap" }, row.text);
}

function extractSymbol(text) {
    const match = String(text || "").match(/For\s+([\w.*-]+)/i);
    return match ? match[1] : "";
}

function extractTimeFrame(text) {
    const match = String(text || "").match(/TimeFrame:\s*([\w-]+)/i);
    return match ? match[1] : "";
}
