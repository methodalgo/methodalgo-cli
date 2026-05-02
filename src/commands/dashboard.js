import { Command } from "commander";
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { render, Box, useInput, useApp } from "ink";
import { DataFetcher } from "../class/DataFetcher.js";
import { ClockPanel } from "../class/Dashboard/ClockPanel.js";
import { PanelList } from "../class/Dashboard/PanelList.js";
import { DetailDialog } from "../class/Dashboard/DetailDialog.js";
import { LoadingScreen } from "../class/Dashboard/LoadingScreen.js";
import { StatusLine } from "../class/Dashboard/StatusLine.js";
import { TickerBar } from "../class/Dashboard/TickerBar.js";
import { SettingsDialog } from "../class/Dashboard/SettingsDialog.js";
import { CommandPalette } from "../class/Dashboard/CommandPalette.js";
import { ToastStrip, buildDashboardToast, hasRenderableToast } from "../class/Dashboard/ToastStrip.js";
import { PANEL_CATEGORIES, PANEL_LABEL_KEYS } from "../class/Dashboard/panel-registry.js";
import { t, getLang } from "../utils/i18n.js";
import {
    getDashboardConfig,
    getEnabledPanels,
    getPanelsByColumn,
    getTickerConfig
} from "../utils/config-manager.js";

const h = React.createElement;

const Dashboard = ({ watchlist = [] }) => {
    const { exit } = useApp();
    const [loading, setLoading] = useState(true);
    const [focusIdx, setFocusIdx] = useState(0);
    const [dialog, setDialog] = useState(null);
    const [showSettings, setShowSettings] = useState(false);
    const [showPalette, setShowPalette] = useState(false);
    const [toast, setToast] = useState(null);
    const [caches, setCaches] = useState({});
    const [statusInfo, setStatusInfo] = useState({ time: "", mem: "0", error: null, connection: "loading" });
    const [config, setConfig] = useState(() => getDashboardConfig());
    const [tickerEnabled, setTickerEnabled] = useState(() => getTickerConfig().enabled);
    
    const dataFetcherRef = useRef(new DataFetcher({ lang: getLang() }));

    const panelsByCol = useMemo(() => getPanelsByColumn(), [config]);
    
    const activePanels = useMemo(() => {
        const allPanels = [];
        
        for (const col of [1, 2, 3]) {
            for (const panel of panelsByCol[col] || []) {
                if (panel.type !== "clock" && config.panels[panel.type]?.enabled) {
                    allPanels.push(panel.type);
                }
            }
        }
        
        const col3 = panelsByCol[3] || [];
        if (col3.some(p => p.type === "clock") && config.panels.clock?.enabled) {
            const nonClockCount = col3.filter(p => p.type !== "clock" && config.panels[p.type]?.enabled).length;
            const clockIdx = allPanels.length - nonClockCount;
            allPanels.splice(Math.max(0, clockIdx), 0, "clock");
        }
        
        return allPanels;
    }, [panelsByCol, config]);

    const col1Panels = useMemo(() => 
        (panelsByCol[1] || []).filter(p => config.panels[p.type]?.enabled !== false),
        [panelsByCol, config]
    );
    
    const col2Panels = useMemo(() => 
        (panelsByCol[2] || []).filter(p => config.panels[p.type]?.enabled !== false),
        [panelsByCol, config]
    );
    
    const col3Panels = useMemo(() => 
        (panelsByCol[3] || []).filter(p => config.panels[p.type]?.enabled !== false),
        [panelsByCol, config]
    );

    const panelIndexMap = useMemo(() => {
        const map = new Map();
        activePanels.forEach((type, idx) => map.set(type, idx));
        return map;
    }, [activePanels]);

    const getPanelLabel = useCallback((type) => {
        const key = PANEL_LABEL_KEYS[type];
        return key ? t(key) : type;
    }, []);

    const getPanelCategory = useCallback((type) => {
        return PANEL_CATEGORIES[type] || null;
    }, []);

    const refreshAll = useCallback(async () => {
        try {
            const enabledPanels = getEnabledPanels().filter(p => p !== "clock");
            await refreshDashboardPanels(dataFetcherRef.current, enabledPanels, setCaches, setStatusInfo);
        } catch (e) {
            setStatusInfo(prev => ({ ...prev, error: e.message, connection: "error" }));
        } finally {
            setLoading(false);
        }
    }, []);

    const handlePanelUpdate = useCallback((panelType, result) => {
        if (result?.data) {
            setCaches(prev => ({ ...prev, [panelType]: result.data }));
        }
        const nextToast = buildDashboardToast(panelType, result, getPanelLabel);
        if (nextToast) setToast(nextToast);
        
        const mem = (process.memoryUsage().rss / 1024 / 1024).toFixed(1);
        setStatusInfo(prev => {
            if (result?.error) {
                return { ...prev, time: new Date().toLocaleTimeString(), mem, error: result.error, connection: result.stale ? "stale" : "error" };
            }
            if (result?.data && !result.stale) {
                return { ...prev, time: new Date().toLocaleTimeString(), mem, error: null };
            }
            if (result?.stale) {
                return { ...prev, time: new Date().toLocaleTimeString(), mem, connection: "stale" };
            }
            return { ...prev, mem };
        });
    }, [getPanelLabel]);

    const startLiveUpdates = useCallback((enabledPanels) => {
        return startDashboardLiveUpdates(
            dataFetcherRef.current,
            enabledPanels,
            handlePanelUpdate,
            setStatusInfo
        );
    }, [handlePanelUpdate]);

    useEffect(() => {
        refreshAll();
        
        const enabledPanels = getEnabledPanels().filter(p => p !== "clock");
        startLiveUpdates(enabledPanels);
        
        return () => {
            dataFetcherRef.current.stopAutoRefresh();
        };
    }, [refreshAll, startLiveUpdates]);

    useEffect(() => {
        setFocusIdx(f => Math.min(f, Math.max(0, activePanels.length - 1)));
    }, [activePanels.length]);

    const openDetail = useCallback((type, idx) => {
        const item = caches[type]?.[idx];
        if (!item) return;
        
        const label = getPanelLabel(type);
        setDialog({ data: item, category: label, type: type });
    }, [caches, getPanelLabel]);

    const handleConfigChange = useCallback((newConfig) => {
        setConfig(newConfig);
        setTickerEnabled(newConfig.ticker?.enabled);
        
        const enabledPanels = getEnabledPanels().filter(p => p !== "clock");
        dataFetcherRef.current.stopAutoRefresh();
        refreshDashboardPanels(dataFetcherRef.current, enabledPanels, setCaches, setStatusInfo);
        startLiveUpdates(enabledPanels);
    }, [startLiveUpdates]);

    const refreshPanels = useCallback(() => {
        const enabledPanels = getEnabledPanels().filter(p => p !== "clock");
        refreshDashboardPanels(dataFetcherRef.current, enabledPanels, setCaches, setStatusInfo);
    }, []);

    const quitDashboard = useCallback(() => {
        dataFetcherRef.current?.destroy();
        exit();
        process.exit(0);
    }, [exit]);

    const toggleTicker = useCallback(() => {
        setTickerEnabled(prev => !prev);
    }, []);

    const nextPanel = useCallback(() => {
        if (activePanels.length === 0) return;
        setFocusIdx(f => (f + 1 + activePanels.length) % activePanels.length);
    }, [activePanels.length]);

    const previousPanel = useCallback(() => {
        if (activePanels.length === 0) return;
        setFocusIdx(f => (f - 1 + activePanels.length) % activePanels.length);
    }, [activePanels.length]);

    const paletteCommands = useMemo(() => buildDashboardPaletteCommands({
        activePanels,
        getPanelLabel,
        refreshPanels,
        openSettings: () => setShowSettings(true),
        toggleTicker,
        nextPanel,
        previousPanel,
        focusPanel: setFocusIdx,
        quitDashboard
    }), [activePanels, getPanelLabel, refreshPanels, toggleTicker, nextPanel, previousPanel, quitDashboard]);

    useEffect(() => {
        if (!toast) return undefined;
        const timer = setTimeout(() => setToast(null), 5000);
        if (typeof timer.unref === "function") timer.unref();
        return () => clearTimeout(timer);
    }, [toast]);

    useInput((input, key) => {
        if (showSettings || dialog || showPalette) return;
        
        if (input === "q") { 
            quitDashboard();
            return;
        }

        if (input === "/" || (key.ctrl && input === "k")) {
            setShowPalette(true);
            return;
        }
        
        if (input === "s") {
            setShowSettings(true);
            return;
        }
        
        if (input === "r") {
            refreshPanels();
            return;
        }
        
        if (input === "t") {
            toggleTicker();
            return;
        }
        
        if (key.tab) {
            setFocusIdx(f => (f + (key.shift ? -1 : 1) + activePanels.length) % activePanels.length);
        }
    });

    if (loading) return h(LoadingScreen);
    if (showSettings) return h(SettingsDialog, { 
        onClose: () => setShowSettings(false),
        onConfigChange: handleConfigChange
    });
    if (dialog) return h(DetailDialog, { ...dialog, onClose: () => setDialog(null) });
    if (showPalette) return h(CommandPalette, {
        commands: paletteCommands,
        onClose: () => setShowPalette(false)
    });

    const termRows = process.stdout.rows || 40;
    const termCols = process.stdout.columns || 120;
    
    const tickerHeight = tickerEnabled ? 3 : 0;
    const showToast = hasRenderableToast(toast);
    const toastHeight = showToast ? 1 : 0;
    const statusHeight = 3;
    const availableRows = Math.max(10, termRows - tickerHeight - toastHeight - statusHeight);
    const colWidth = Math.floor(termCols / 3);

    const col1Count = col1Panels.length;
    const col2Count = col2Panels.length;
    const col3Count = col3Panels.filter(p => p.type !== "clock").length;
    const col3HasClock = col3Panels.some(p => p.type === "clock");
    const clockHeight = col3HasClock ? 4 : 0;

    const MIN_VISIBLE = 6;
    const MAX_VISIBLE = 20;
    const BORDER_OVERHEAD = 2;
    const PANEL_CHROME_HEIGHT = 3;

    const calcMaxVisible = (totalRows, panelCount, fixedOverhead = 0) => {
        if (panelCount === 0) return MIN_VISIBLE;
        const totalOverhead = fixedOverhead + panelCount * BORDER_OVERHEAD;
        const available = Math.max(0, totalRows - totalOverhead);
        const perPanel = Math.max(1, Math.floor(available / panelCount));
        return Math.max(MIN_VISIBLE, Math.min(MAX_VISIBLE, perPanel));
    };

    const col1MaxVisible = calcMaxVisible(availableRows, col1Count);
    const col2MaxVisible = calcMaxVisible(availableRows, col2Count);
    const col3MaxVisible = calcMaxVisible(availableRows, col3Count, clockHeight);

    const col12BasePerPanel = Math.max(MIN_VISIBLE, Math.min(MAX_VISIBLE, Math.floor((availableRows - 4 * BORDER_OVERHEAD) / 4)));
    const col3BasePerPanel = Math.max(MIN_VISIBLE, Math.min(MAX_VISIBLE, Math.floor((availableRows - clockHeight - 2 * BORDER_OVERHEAD) / 2)));
    const col1Heights = distributeDashboardPanelHeights(col1Panels, availableRows);
    const col2Heights = distributeDashboardPanelHeights(col2Panels, availableRows);
    const col3Heights = distributeDashboardPanelHeights(col3Panels, availableRows);

    const renderColumnPanel = (panelConfig, columnIdx, panelIdx) => {
        const panelType = panelConfig.type;
        const globalFocusIdx = panelIndexMap.get(panelType);
        const isFocused = globalFocusIdx === focusIdx;
        const panelHeight = [col1Heights, col2Heights, col3Heights][columnIdx]?.[panelIdx];
        
        if (panelType === "clock") {
            return h(ClockPanel, { 
                key: `${columnIdx}-${panelIdx}-${panelType}`,
                focused: isFocused 
            });
        }
        
        const category = getPanelCategory(panelType);
        const label = getPanelLabel(panelType);
        const items = caches[panelType] || [];
        
        let maxVisible;
        if (columnIdx === 0) {
            maxVisible = col1MaxVisible > 0 ? col1MaxVisible : col12BasePerPanel;
        } else if (columnIdx === 1) {
            maxVisible = col2MaxVisible > 0 ? col2MaxVisible : col12BasePerPanel;
        } else {
            maxVisible = col3MaxVisible > 0 ? col3MaxVisible : col3BasePerPanel;
        }
        if (panelHeight) maxVisible = panelHeight - PANEL_CHROME_HEIGHT;
        maxVisible = Math.max(1, maxVisible);
        
        return h(PanelList, {
            key: `${columnIdx}-${panelIdx}-${panelType}`,
            category,
            label,
            items,
            focused: isFocused,
            onSelect: idx => openDetail(panelType, idx),
            maxVisible,
            height: panelHeight,
            watchlist
        });
    };

    const mainElements = [];

    if (tickerEnabled) {
        mainElements.push(h(Box, {
            key: "ticker-wrapper",
            flexShrink: 0,
            width: "100%"
        },
            h(TickerBar, {
                key: "ticker",
                enabled: tickerEnabled,
                config: config.ticker,
                dashboardCaches: caches
            })
        ));
    }

    if (showToast) {
        mainElements.push(h(ToastStrip, {
            key: "toast",
            toast
        }));
    }

    const columns = [];
    
    if (col1Panels.length > 0) {
        columns.push(
            h(Box, { 
                key: "col1",
                flexDirection: "column", 
                width: colWidth, 
                flexShrink: 1, 
                flexGrow: 1,
                height: availableRows,
                minWidth: 0,
                overflow: "hidden" 
            },
                ...col1Panels.map((p, idx) => renderColumnPanel(p, 0, idx))
            )
        );
    }
    
    if (col2Panels.length > 0) {
        columns.push(
            h(Box, { 
                key: "col2",
                flexDirection: "column", 
                width: colWidth, 
                flexShrink: 1, 
                flexGrow: 1,
                height: availableRows,
                minWidth: 0,
                overflow: "hidden" 
            },
                ...col2Panels.map((p, idx) => renderColumnPanel(p, 1, idx))
            )
        );
    }
    
    if (col3Panels.length > 0) {
        columns.push(
            h(Box, { 
                key: "col3",
                flexDirection: "column", 
                flexGrow: 1, 
                flexShrink: 1, 
                height: availableRows,
                minWidth: 0, 
                overflow: "hidden" 
            },
                ...col3Panels.map((p, idx) => renderColumnPanel(p, 2, idx))
            )
        );
    }

    if (columns.length > 0) {
        mainElements.push(
            h(Box, { 
                key: "main-content",
                height: availableRows,
                flexShrink: 0,
                width: "100%", 
                overflow: "hidden" 
            },
                ...columns
            )
        );
    }

    mainElements.push(h(Box, {
        key: "status-wrapper",
        flexShrink: 0,
        width: "100%"
    },
        h(StatusLine, { 
            key: "status",
            statusInfo,
            focusedPanelLabel: getPanelLabel(activePanels[focusIdx])
        })
    ));

    return h(Box, { 
        flexDirection: "column", 
        height: termRows, 
        width: "100%", 
        overflow: "hidden" 
    },
        ...mainElements
    );
};

const dashboardCmd = new Command("dashboard")
    .description(t("DASHBOARD_DESC"))
    .alias("top")
    .option("-w, --watchlist <symbols>", t("OPT_WATCHLIST_DESC"))
    .action((options) => {
        const storedSymbols = getDashboardConfig().watchlist?.symbols;
        const configWatchlist = Array.isArray(storedSymbols) ? storedSymbols : [];
        const watchlist = [...new Set(parseWatchlist(options.watchlist).concat(configWatchlist.map(symbol => String(symbol).toUpperCase())))];
        render(h(Dashboard, { watchlist }));
    });

export default dashboardCmd;

export function startDashboardLiveUpdates(dataFetcher, enabledPanels, handlePanelUpdate, setStatusInfo) {
    const streamPanels = dataFetcher.getDashboardStreamPanels
        ? dataFetcher.getDashboardStreamPanels(enabledPanels)
        : enabledPanels;
    const pollingPanels = dataFetcher.getDashboardPollingPanels
        ? dataFetcher.getDashboardPollingPanels(enabledPanels)
        : [];

    const startPollingFallback = (panels = enabledPanels) => {
        dataFetcher.startAutoRefresh(panels, handlePanelUpdate);
    };
    if (pollingPanels.length > 0) startPollingFallback(pollingPanels);
    if (streamPanels.length > 0 && setStatusInfo) setStatusInfo(prev => ({ ...prev, connection: "live", error: null }));
    const streamStarted = streamPanels.length > 0 && dataFetcher.startDashboardStream(
        streamPanels,
        handlePanelUpdate,
        error => {
            if (setStatusInfo) setStatusInfo(prev => ({ ...prev, connection: "polling", error: error.message }));
            startPollingFallback(enabledPanels);
        }
    );
    if (!streamStarted) {
        if (setStatusInfo) setStatusInfo(prev => ({ ...prev, connection: "polling" }));
        startPollingFallback(enabledPanels);
    }
    return streamStarted;
}

export async function refreshDashboardPanels(dataFetcher, enabledPanels, setCaches, setStatusInfo, force = false) {
    const { results, errors } = await dataFetcher.fetchMultiple(enabledPanels, force);
    const newCaches = {};
    let firstError = null;

    for (const [type, result] of Object.entries(results)) {
        if (result?.data) newCaches[type] = result.data;
        if (result?.error && !firstError) firstError = result.error;
    }
    setCaches(newCaches);

    const mem = (process.memoryUsage().rss / 1024 / 1024).toFixed(1);
    const fetchError = Object.values(errors)[0];
    setStatusInfo(prev => ({
        time: new Date().toLocaleTimeString(),
        mem,
        error: firstError || fetchError?.message || null,
        connection: firstError || fetchError ? "error" : prev.connection
    }));
    return { results, errors };
}

export function buildDashboardPaletteCommands({
    activePanels = [],
    getPanelLabel = type => type,
    refreshPanels,
    openSettings,
    toggleTicker,
    nextPanel,
    previousPanel,
    focusPanel,
    quitDashboard
} = {}) {
    const commands = [
        { id: "refresh", label: t("TUI_ACTION_REFRESH"), hint: "R", keywords: "reload update", run: refreshPanels },
        { id: "settings", label: t("TUI_ACTION_SETTINGS"), hint: "S", keywords: "config preferences", run: openSettings },
        { id: "toggle-ticker", label: t("TUI_ACTION_TOGGLE_TICKER"), hint: "T", keywords: "ticker bar", run: toggleTicker },
        { id: "next-panel", label: t("TUI_ACTION_NEXT_PANEL"), hint: "Tab", keywords: "focus switch", run: nextPanel },
        { id: "previous-panel", label: t("TUI_ACTION_PREVIOUS_PANEL"), hint: "Shift+Tab", keywords: "focus switch", run: previousPanel },
        { id: "quit", label: t("TUI_ACTION_QUIT"), hint: "Q", keywords: "exit close", run: quitDashboard }
    ];

    activePanels
        .filter(type => type !== "clock")
        .forEach((type, idx) => {
            const panelLabel = getPanelLabel(type);
            commands.push({
                id: `focus-${type}`,
                label: t("TUI_ACTION_FOCUS_PANEL", { panel: panelLabel }),
                hint: `${idx + 1}`,
                keywords: `panel ${type} ${panelLabel}`,
                run: () => focusPanel?.(activePanels.indexOf(type))
            });
        });

    return commands;
}

export function distributeDashboardPanelHeights(panelConfigs = [], totalRows = 0) {
    if (!Array.isArray(panelConfigs) || panelConfigs.length === 0) return [];
    const clockHeight = 4;
    const safeRows = Math.max(panelConfigs.length, Math.floor(totalRows || 0));
    const fixedHeights = panelConfigs.map(panel => panel.type === "clock" ? clockHeight : 0);
    const fixedTotal = fixedHeights.reduce((sum, value) => sum + value, 0);
    const flexibleIndexes = panelConfigs
        .map((panel, idx) => panel.type === "clock" ? -1 : idx)
        .filter(idx => idx >= 0);

    if (flexibleIndexes.length === 0) return fixedHeights;

    const flexibleRows = Math.max(flexibleIndexes.length, safeRows - fixedTotal);
    const base = Math.floor(flexibleRows / flexibleIndexes.length);
    let remainder = flexibleRows % flexibleIndexes.length;
    const heights = [...fixedHeights];

    for (const idx of flexibleIndexes) {
        heights[idx] = base + (remainder > 0 ? 1 : 0);
        if (remainder > 0) remainder -= 1;
    }

    return heights;
}

export function parseWatchlist(value) {
    return String(value || "")
        .split(",")
        .map(symbol => symbol.trim().toUpperCase())
        .filter(Boolean);
}
