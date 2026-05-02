import React from "react";
import { Box, Text } from "ink";
import { t } from "../../utils/i18n.js";
import { gradientText } from "../../utils/dashboard-utils.js";

const h = React.createElement;

const CACHED_GRADIENT = gradientText("MethodAlgo Dashboard", [255, 0, 0], [255, 255, 255]);

export const StatusLine = ({ statusInfo, focusedPanelLabel = "" }) => {
    const safeStatus = statusInfo || {};
    const mem = safeStatus.mem && safeStatus.mem.trim() !== "" ? safeStatus.mem : "0";
    const connection = formatConnection(safeStatus.connection);
    const actions = getStatusLineActions();
    
    const fixedContent = [
        h(Text, { key: "title", flexShrink: 0 }, CACHED_GRADIENT),
        h(Text, { key: "sep1", color: "gray", flexShrink: 0 }, " | "),
        h(Text, { key: "connection", color: connection.color, flexShrink: 0 }, connection.label),
        h(Text, { key: "sep-status", color: "gray", flexShrink: 0 }, " | "),
        h(Text, { key: "updated", color: "cyan", flexShrink: 0 }, `📡 Updated: ${safeStatus.time || "--"}`),
        h(Text, { key: "sep2", color: "gray", flexShrink: 0 }, " | Mem: "),
        h(Text, { key: "mem", flexShrink: 0 }, `${mem} MB`)
    ];
    
    const flexibleContent = [];

    if (focusedPanelLabel) {
        flexibleContent.push(
            h(Text, { key: "sep-panel", color: "gray", flexShrink: 0 }, " | "),
            h(Text, { key: "panel", color: "white", bold: true, wrap: "truncate", flexShrink: 1 }, focusedPanelLabel)
        );
    }

    flexibleContent.push(
        h(Text, { key: "sep-actions-start", color: "gray", flexShrink: 0 }, " | "),
        ...actions.flatMap((item, idx) => [
            h(Text, { key: `${item.key}-shortcut`, color: "yellow", bold: true, flexShrink: 0 }, item.shortcut),
            h(Text, { key: `${item.key}-label`, color: "white", flexShrink: 0 }, ` ${t(item.labelKey)}`),
            idx < actions.length - 1
                ? h(Text, { key: `${item.key}-sep`, color: "gray", flexShrink: 0 }, " | ")
                : null
        ].filter(Boolean))
    );
    
    if (safeStatus.error) {
        flexibleContent.push(h(Text, { key: "error", color: "red", wrap: "truncate", flexShrink: 2 }, ` | ${safeStatus.error}`));
    }
    
    return h(Box, { 
        borderStyle: "single", 
        borderColor: "red", 
        height: 3, 
        paddingX: 1, 
        alignItems: "center",
        overflow: "hidden"
    },
        h(Box, { flexShrink: 0, flexDirection: "row", alignItems: "center" },
            ...fixedContent
        ),
        h(Box, { flexShrink: 1, flexDirection: "row", alignItems: "center", minWidth: 0, overflow: "hidden" },
            ...flexibleContent
        )
    );
};

export function getStatusLineActions() {
    return [
        { key: "palette", shortcut: "/", labelKey: "TUI_ACTION_PALETTE" },
        { key: "detail", shortcut: "Enter", labelKey: "TUI_ACTION_DETAIL" },
        { key: "refresh", shortcut: "R", labelKey: "TUI_ACTION_REFRESH" },
        { key: "ticker", shortcut: "T", labelKey: "TUI_ACTION_TOGGLE_TICKER" },
        { key: "settings", shortcut: "S", labelKey: "TUI_ACTION_SETTINGS" },
        { key: "quit", shortcut: "Q", labelKey: "TUI_ACTION_QUIT" }
    ];
}

function formatConnection(connection) {
    switch (connection) {
        case "live":
            return { label: "LIVE", color: "green" };
        case "polling":
            return { label: "POLLING", color: "yellow" };
        case "stale":
            return { label: "STALE", color: "red" };
        case "error":
            return { label: "ERROR", color: "red" };
        default:
            return { label: "LOADING", color: "gray" };
    }
}
