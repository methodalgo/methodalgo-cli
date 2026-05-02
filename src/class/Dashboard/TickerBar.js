import React, { useState, useEffect, useRef, useCallback } from "react";
import { Box, Text } from "ink";
import { getLang } from "../../utils/i18n.js";
import { getTickerConfig } from "../../utils/config-manager.js";
import { TickerDataManager, TICKER_SOURCE_TYPES } from "./ticker-data-manager.js";

const h = React.createElement;

export const TickerBar = ({ enabled = true, config = null, onToggle = null, dashboardCaches = null }) => {
    const termCols = process.stdout.columns || 120;
    const placeholder = " Loading market data... ".padEnd(termCols, " ");
    
    const [tickerText, setTickerText] = useState(placeholder);
    const [offset, setOffset] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const [sourceData, setSourceData] = useState([]);
    
    const tickerDataManager = useRef(null);
    const actualConfig = config || getTickerConfig();

    useEffect(() => {
        tickerDataManager.current = new TickerDataManager(getLang());
    }, []);

    const fetchAllSources = useCallback(async () => {
        if (!tickerDataManager.current || !actualConfig?.sources) return;

        const enabledSources = actualConfig.sources.filter(s => s.enabled !== false);
        
        const results = await Promise.allSettled(
            enabledSources.map(async (source, i) => {
                try {
                    const data = await tickerDataManager.current.fetchSource(source, i, dashboardCaches);
                    const formatted = tickerDataManager.current.formatSource(source, data);
                    return formatted;
                } catch (e) {
                    console.debug(`[TickerBar] Error fetching source ${source.type}:`, e.message);
                    return null;
                }
            })
        );

        const allFormatted = [];
        for (const result of results) {
            if (result.status === "fulfilled" && result.value) {
                if (Array.isArray(result.value)) {
                    allFormatted.push(...result.value);
                } else {
                    allFormatted.push(result.value);
                }
            }
        }

        setSourceData(allFormatted);

        const separator = actualConfig.separator || " | ";
        const textParts = allFormatted.map(f => f?.text || "").filter(Boolean);
        const fullText = textParts.join(separator);
        
        if (fullText.trim()) {
            setOffset(0);
            setTickerText(fullText + separator + fullText);
        }
    }, [actualConfig, dashboardCaches]);

    useEffect(() => {
        if (enabled) {
            fetchAllSources();
            
            const refreshInterval = setInterval(() => {
                fetchAllSources();
            }, 30000);

            return () => clearInterval(refreshInterval);
        }
    }, [enabled, fetchAllSources]);

    useEffect(() => {
        if (!enabled || !tickerText || isPaused) return;

        const speed = actualConfig?.speed || 80;
        const delay = Math.max(30, Math.round(1000 / (speed / 10)));

        const timer = setInterval(() => {
            setOffset(prev => {
                const textLength = tickerText.length / 2;
                if (textLength <= 0) return 0;
                return (prev + 1) % textLength;
            });
        }, delay);

        return () => clearInterval(timer);
    }, [enabled, tickerText, isPaused, actualConfig]);

    const getDirectionColor = (direction) => {
        switch (direction) {
            case "up":
            case "bull":
                return "green";
            case "down":
            case "bear":
                return "red";
            default:
                return "white";
        }
    };

    if (!enabled) return null;

    const displayText = tickerText.slice(offset);
    const paddedText = displayText.padEnd(termCols + 20, " ");
    const visibleText = paddedText.slice(0, termCols + 20).replace(/[\r\n]/g, " ");

    return h(Box, {
        flexDirection: "row",
        borderStyle: "single",
        borderColor: "red",
        height: 3,
        paddingX: 0,
        alignItems: "center",
        overflow: "hidden",
        width: "100%"
    },
        h(Box, { flexGrow: 1, overflow: "hidden", paddingX: 1 },
            h(Text, { color: "white", wrap: "truncate" }, visibleText)
        ),
        onToggle && h(Text, { color: "gray", paddingX: 1 }, " [T]")
    );
};

export { TickerDataManager, TICKER_SOURCE_TYPES };
