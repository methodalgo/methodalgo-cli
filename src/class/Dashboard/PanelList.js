import React, { useState, useEffect } from "react";
import { Box, Text, useInput } from "ink";
import { gradientText, cleanText, formatTime, getSignalColor } from "../../utils/dashboard-utils.js";

const h = React.createElement;
const NEW_EVENT_WINDOW_MS = 60000;

export const PanelList = ({ category, label, items, focused, onSelect, maxVisible = 6, watchlist = [], height }) => {
    const actualItems = Array.isArray(items) ? items : [];
    const renderableItems = getRenderableDashboardItems(actualItems);
    const [now, setNow] = useState(() => Date.now());
    const [selectedIdx, setSelectedIdx] = useState(0);
    const [selectedKey, setSelectedKey] = useState(() => getDashboardItemKey(renderableItems[0]?.item));
    const [scrollTop, setScrollTop] = useState(0);
    const bc = focused ? "red" : "white";

    useInput((input, key) => {
        if (!focused) return;
        if (key.upArrow) {
            setSelectedIdx(i => {
                const next = Math.max(0, i - 1);
                setSelectedKey(getDashboardItemKey(renderableItems[next]?.item));
                setScrollTop(st => (next < st ? next : st));
                return next;
            });
        }
        if (key.downArrow) {
            setSelectedIdx(i => {
                const len = renderableItems.length;
                const next = Math.min(Math.max(0, len - 1), i + 1);
                setSelectedKey(getDashboardItemKey(renderableItems[next]?.item));
                setScrollTop(st => (next >= st + maxVisible ? next - maxVisible + 1 : st));
                return next;
            });
        }
        if (key.return) {
            const entry = renderableItems[selectedIdx];
            if (entry) onSelect(entry.originalIndex);
        }
    });

    useEffect(() => {
        const len = renderableItems.length;
        setSelectedIdx(i => {
            const anchoredIdx = findDashboardItemIndex(renderableItems.map(entry => entry.item), selectedKey);
            const next = anchoredIdx >= 0 ? anchoredIdx : Math.min(i, Math.max(0, len - 1));
            if (anchoredIdx < 0 && renderableItems[next]?.item) setSelectedKey(getDashboardItemKey(renderableItems[next].item));
            setScrollTop(st => {
                const maxScroll = Math.max(0, len - maxVisible);
                if (next < st) return next;
                if (next >= st + maxVisible) return Math.min(maxScroll, next - maxVisible + 1);
                return Math.min(st, maxScroll);
            });
            return next;
        });
    }, [items, maxVisible, selectedKey]);

    const visibleItems = renderableItems.slice(scrollTop, scrollTop + maxVisible);

    useEffect(() => {
        if (!hasRecentDashboardItems(visibleItems.map(entry => entry.item), now)) return undefined;
        const timer = setInterval(() => setNow(Date.now()), 1000);
        if (typeof timer.unref === "function") timer.unref();
        return () => clearInterval(timer);
    }, [visibleItems, now]);

    const hasMore = renderableItems.length > scrollTop + maxVisible;
    const hasLess = scrollTop > 0;

    const countLabel = renderableItems.length > 0 ? ` (${renderableItems.length})` : "";
    const scrollHint = hasLess && hasMore ? " ↕" : hasLess ? " ↑" : hasMore ? " ↓" : "";

    const boxProps = {
        flexDirection: "column",
        borderStyle: "single",
        borderColor: bc,
        overflow: "hidden",
        width: "100%",
        ...(height ? { height, flexShrink: 0 } : { flexGrow: 1 })
    };

    return h(Box, boxProps,
        h(Text, { bold: true, color: "red", wrap: "truncate" }, ` ${label}${countLabel}${scrollHint}`),
        renderableItems.length === 0
            ? h(Box, { flexGrow: 1, alignItems: "center", justifyContent: "center" },
                ...gradientText("Loading...", [255, 60, 60], [255, 255, 255]))
            : visibleItems.map((entry, vi) => {
                const item = entry.item;
                const realIdx = scrollTop + vi;
                const isFocused = realIdx === selectedIdx && focused;
                const title = entry.title;
                
                const matches = getWatchlistMatches(item, watchlist);
                const newLabel = getNewEventLabel(item, now);
                const prefixParts = [
                    newLabel,
                    matches.length > 0 ? `[WATCH ${matches.join(",")}]` : ""
                ].filter(Boolean);
                const prefix = prefixParts.length > 0 ? `${prefixParts.join(" ")} ` : "";
                const timePrefix = getDashboardItemTimePrefix(item);
                const textColor = matches.length > 0 ? "yellow" : category ? getSignalColor(category, item) : "white";
                
                return h(Box, { key: getDashboardItemKey(item) || realIdx, width: "100%", overflow: "hidden" },
                    h(Text, {
                        backgroundColor: isFocused ? "red" : undefined,
                        color: isFocused ? "white" : textColor,
                        wrap: "truncate-end"
                    }, ` ${timePrefix}${prefix}${title}`)
                );
            })
    );
};

export function getRenderableDashboardItems(items) {
    if (!Array.isArray(items)) return [];
    return items
        .map((item, originalIndex) => ({ item, originalIndex, title: getDashboardItemTitle(item) }))
        .filter(entry => entry.item && entry.title);
}

export function getDashboardItemTitle(item) {
    if (!item) return "";
    const sig = item.signals?.[0] || {};
    return cleanText(item.displayTitle || item.title || sig.title || "");
}

export function getDashboardItemTimePrefix(item) {
    return item?.hideTime ? "" : `[${formatTime(item?.publish_date || item?.timestamp)}] `;
}

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

export function getNewEventLabel(item, now = Date.now()) {
    const timestamp = getDashboardItemTime(item);
    if (!timestamp) return "";
    const ageMs = now - timestamp;
    if (ageMs < 0 || ageMs > NEW_EVENT_WINDOW_MS) return "";
    return `[NEW ${Math.max(0, Math.floor(ageMs / 1000))}s]`;
}

export function hasRecentDashboardItems(items, now = Date.now()) {
    return Array.isArray(items) && items.some(item => getNewEventLabel(item, now));
}

function getDashboardItemTime(item) {
    const raw = item?.publish_date || item?.timestamp || item?.ts || item?.updatedAt;
    if (!raw) return 0;
    if (typeof raw === "number") return raw < 10000000000 ? raw * 1000 : raw;
    const parsed = Date.parse(raw);
    return Number.isNaN(parsed) ? 0 : parsed;
}

function normalizeWatchSymbol(symbol) {
    return String(symbol || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/(USDT|USDC|USD|PERP)$/u, "");
}

function symbolMatchesSource(symbol, source) {
    if (!symbol || !source) return false;
    const pattern = new RegExp(`(^|[^A-Z0-9])${symbol}(USDT|USDC|USD|BTC|ETH|PERP|\\.P)?([^A-Z0-9]|$)`);
    return pattern.test(source);
}
