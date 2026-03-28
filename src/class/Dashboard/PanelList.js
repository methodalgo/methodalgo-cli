import React, { useState, useEffect } from "react";
import { Box, Text, useInput } from "ink";
import { gradientText, cleanText, formatTime } from "../../utils/dashboard-utils.js";

const h = React.createElement;

export const PanelList = ({ label, items, focused, onSelect, maxVisible = 6 }) => {
    const [selectedIdx, setSelectedIdx] = useState(0);
    const [scrollTop, setScrollTop] = useState(0);
    const bc = focused ? "red" : "white";

    useInput((input, key) => {
        if (!focused) return;
        if (key.upArrow) {
            setSelectedIdx(i => {
                const next = Math.max(0, i - 1);
                setScrollTop(st => (next < st ? next : st));
                return next;
            });
        }
        if (key.downArrow) {
            setSelectedIdx(i => {
                const next = Math.min(items.length - 1, i + 1);
                setScrollTop(st => (next >= st + maxVisible ? next - maxVisible + 1 : st));
                return next;
            });
        }
        if (key.return) onSelect(selectedIdx);
    });

    useEffect(() => {
        setSelectedIdx(i => Math.min(i, Math.max(0, items.length - 1)));
        setScrollTop(st => Math.min(st, Math.max(0, items.length - maxVisible)));
    }, [items.length]);

    const actualItems = Array.isArray(items) ? items : [];
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
                
                const itemDirection = item.direction || sig.direction || "";
                let textColor = (itemDirection === "bear") ? "red" : "white";
                return h(Box, { key: realIdx, width: "100%", overflow: "hidden" },
                    h(Text, {
                        backgroundColor: isFocused ? "red" : undefined,
                        color: isFocused ? "white" : textColor,
                        wrap: "truncate-end"
                    }, ` [${formatTime(item.publish_date || item.timestamp)}] ${title}`)
                );
            })
    );
};
