import React from "react";
import { Box, Text } from "ink";
import { cleanText } from "../../utils/dashboard-utils.js";
import { t } from "../../utils/i18n.js";

const h = React.createElement;

export const ToastStrip = ({ toast }) => {
    if (!hasRenderableToast(toast)) return null;
    const color = toast.level === "error" ? "red" : toast.level === "success" ? "green" : "cyan";
    
    return h(Box, {
        height: 1,
        width: "100%",
        paddingX: 1,
        alignItems: "center",
        overflow: "hidden"
    },
        h(Text, { color, bold: true, flexShrink: 0 }, `[${toast.icon || "UPDATE"}] `),
        toast.message
            ? h(Text, { color: "white", bold: true, flexShrink: 0 }, toast.message)
            : null,
        toast.latestTitle
            ? h(Text, { color: "gray", wrap: "truncate-end", flexShrink: 1 }, `${toast.message ? " | " : ""}${toast.latestTitle}`)
            : null
    );
};

export function buildDashboardToast(panelType, result, getPanelLabel = type => type, now = Date.now()) {
    if (!result?.data || result.stale) return null;
    const count = getDashboardUpdateCount(result.data);
    if (count <= 0) return null;
    const panelLabel = getPanelLabel(panelType);
    return {
        id: `${panelType}-${now}`,
        level: "success",
        icon: "NEW",
        panelType,
        panelLabel,
        count,
        latestTitle: getDashboardUpdateTitle(result.data),
        createdAt: now,
        message: t("TUI_TOAST_UPDATED", { panel: panelLabel, count })
    };
}

export function getDashboardUpdateCount(data) {
    if (Array.isArray(data)) return data.length;
    if (Array.isArray(data?.data)) return data.data.length;
    if (Array.isArray(data?.items)) return data.items.length;
    return data ? 1 : 0;
}

export function getDashboardUpdateTitle(data) {
    const items = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : Array.isArray(data?.items) ? data.items : [data];
    const item = items.find(Boolean);
    if (!item) return "";
    const sig = item.signals?.[0] || {};
    return cleanText(item.displayTitle || item.title || sig.title || "");
}

export function hasRenderableToast(toast) {
    return Boolean(toast && (String(toast.message || "").trim() || String(toast.latestTitle || "").trim()));
}
