import React, { useState, useEffect } from "react";
import { Box, Text, useInput } from "ink";
import { gradientText, cleanText, formatTime, getSignalColor } from "../../utils/dashboard-utils.js";

const h = React.createElement;

export const PanelList = ({ category, label, items, focused, onSelect, maxVisible = 6, watchlist = [] }) => {
    const actualItems = Array.isArray(items) ? items : [];
    const [selectedIdx, setSelectedIdx] = useState(0);
    const [selectedKey, setSelectedKey] = useState(() => getDashboardItemKey(actualItems[0]));
    const [scrollTop, setScrollTop] = useState(0);
    const bc = focused ? "red" : "white";

    useInput((input, key) => {
        if (!focused) return;
        if (key.upArrow) {
            setSelectedIdx(i => {
                const next = Math.max(0, i - 1);
                setSelectedKey(getDashboardItemKey(actualItems[next]));
                setScrollTop(st => (next < st ? next : st));
                return next;
            });
        }
        if (key.downArrow) {
            setSelectedIdx(i => {
                const len = actualItems.length;
                const next = Math.min(Math.max(0, len - 1), i + 1);
                setSelectedKey(getDashboardItemKey(actualItems[next]));
                setScrollTop(st => (next >= st + maxVisible ? next - maxVisible + 1 : st));
                return next;
            });
        }
        if (key.return) onSelect(selectedIdx);
    });

    useEffect(() => {
        const len = actualItems.length;
        setSelectedIdx(i => {
            const anchoredIdx = findDashboardItemIndex(actualItems, selectedKey);
            const next = anchoredIdx >= 0 ? anchoredIdx : Math.min(i, Math.max(0, len - 1));
            if (anchoredIdx < 0 && actualItems[next]) setSelectedKey(getDashboardItemKey(actualItems[next]));
            setScrollTop(st => {
                const maxScroll = Math.max(0, len - maxVisible);
                if (next < st) return next;
                if (next >= st + maxVisible) return Math.min(maxScroll, next - maxVisible + 1);
                return Math.min(st, maxScroll);
            });
            return next;
        });
    }, [items, maxVisible, selectedKey]);

    const visibleItems = actualItems.slice(scrollTop, scrollTop + maxVisible);
    const hasMore = actualItems.length > scrollTop + maxVisible;
    const hasLess = scrollTop > 0;

    const countLabel = actualItems.length > 0 ? ` (${actualItems.length})` : "";
    const scrollHint = hasLess && hasMore ? " ↕" : hasLess ? " ↑" : hasMore ? " ↓" : "";
    
    return h(Box, { 
        flexDirection: "column", borderStyle: "single", borderColor: bc, 
        flexGrow: 1, overflow: "hidden", width: "100%" 
    },
        h(Text, { bold: true, color: "red", wrap: "truncate" }, ` ${label}${countLabel}${scrollHint}`),
        actualItems.length === 0
            ? h(Box, { flexGrow: 1, alignItems: "center", justifyContent: "center" }, 
                ...gradientText("Loading...", [255, 60, 60], [255, 255, 255]))
            : visibleItems.map((item, vi) => {
                if (!item) return null;
                const realIdx = scrollTop + vi;
                const isFocused = realIdx === selectedIdx && focused;
                const sig = item.signals?.[0] || {};
                const title = cleanText(item.displayTitle || sig.title || "");
                if (!title) return null;
                
                const matches = getWatchlistMatches(item, watchlist);
                const prefix = matches.length > 0 ? `[WATCH ${matches.join(",")}] ` : "";
                const textColor = matches.length > 0 ? "yellow" : category ? getSignalColor(category, item) : "white";
                
                return h(Box, { key: getDashboardItemKey(item) || realIdx, width: "100%", overflow: "hidden" },
                    h(Text, {
                        backgroundColor: isFocused ? "red" : undefined,
                        color: isFocused ? "white" : textColor,
                        wrap: "truncate-end"
                    }, ` [${formatTime(item.publish_date || item.timestamp)}] ${prefix}${title}`)
                );
            })
    );
};

export function getDashboardItemKey(item) {
    if (!item) return "";
    const sig = item.signals?.[0] || {};
    return String(item.id || item.url || item.link || sig.id || `${item.timestamp || item.publish_date || ""}:${item.displayTitle || item.title || sig.title || ""}`);
}

export function findDashboardItemIndex(items, selectedKey) {
    if (!selectedKey || !Array.isArray(items)) return -1;
    return items.findIndex(item => getDashboardItemKey(item) === selectedKey);
}

export function getWatchlistMatches(item, watchlist = []) {
    if (!item || !Array.isArray(watchlist) || watchlist.length === 0) return [];
    const sig = item.signals?.[0] || {};
    const details = sig.details || {};
    const source = [
        item.displayTitle,
        item.title,
        sig.title,
        details.Symbol,
        details.symbol
    ].filter(Boolean).join(" ").toUpperCase();

    return watchlist
        .map(symbol => normalizeWatchSymbol(symbol))
        .filter(Boolean)
        .filter((symbol, idx, arr) => arr.indexOf(symbol) === idx)
        .filter(symbol => symbolMatchesSource(symbol, source));
}

function normalizeWatchSymbol(symbol) {
    return String(symbol || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/(USDT|USDC|USD|PERP)$/u, "");
}

function symbolMatchesSource(symbol, source) {
    if (!symbol || !source) return false;
    const pattern = new RegExp(`(^|[^A-Z0-9])${symbol}(USDT|USDC|USD|BTC|ETH|PERP|\\.P)?([^A-Z0-9]|$)`);
    return pattern.test(source);
}
