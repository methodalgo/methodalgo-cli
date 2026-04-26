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
import { t, getLang } from "../utils/i18n.js";
import {
    getDashboardConfig,
    getEnabledPanels,
    getPanelsByColumn,
    getTickerConfig
} from "../utils/config-manager.js";

const h = React.createElement;

const PANEL_LABEL_KEYS = {
    article: "TYPE_ARTICLE",
    breaking: "TYPE_NEWS",
    onchain: "TYPE_ONCHAIN",
    report: "TYPE_REPORT",
    breakout: "LABEL_BREAKOUT",
    exhaustion: "LABEL_EXHAUSTION",
    goldenPit: "LABEL_GOLDEN_PIT",
    liquidation: "LABEL_LIQUIDATION",
    marketToday: "LABEL_MARKET_TODAY",
    tokenUnlock: "LABEL_TOKEN_UNLOCK",
    fredDashboard: "LABEL_FRED_DASHBOARD",
    priceTicker: "LABEL_PRICE_TICKER",
    economicCalendar: "LABEL_ECONOMIC_CALENDAR"
};

const PANEL_CATEGORIES = {
    breakout: "breakout",
    exhaustion: "exhaustion",
    goldenPit: "goldenPit",
    liquidation: "liquidation",
    marketToday: "marketToday",
    tokenUnlock: "tokenUnlock"
};

const Dashboard = () => {
    const { exit } = useApp();
    const [loading, setLoading] = useState(true);
    const [focusIdx, setFocusIdx] = useState(0);
    const [dialog, setDialog] = useState(null);
    const [showSettings, setShowSettings] = useState(false);
    const [caches, setCaches] = useState({});
    const [statusInfo, setStatusInfo] = useState({ time: "", mem: "0", error: null });
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
            const { results, errors } = await dataFetcherRef.current.fetchMultiple(enabledPanels, false);
            
            const newCaches = {};
            for (const [type, result] of Object.entries(results)) {
                if (result?.data) {
                    newCaches[type] = result.data;
                }
            }
            
            setCaches(newCaches);
            
            const mem = (process.memoryUsage().rss / 1024 / 1024).toFixed(1);
            const firstError = Object.values(errors)[0];
            setStatusInfo({
                time: new Date().toLocaleTimeString(),
                mem,
                error: firstError?.message || null
            });
            
        } catch (e) {
            setStatusInfo(prev => ({ ...prev, error: e.message }));
        } finally {
            setLoading(false);
        }
    }, []);

    const handlePanelUpdate = useCallback((panelType, result) => {
        if (result?.data) {
            setCaches(prev => ({ ...prev, [panelType]: result.data }));
        }
    }, []);

    useEffect(() => {
        refreshAll();
        
        const enabledPanels = getEnabledPanels().filter(p => p !== "clock");
        dataFetcherRef.current.startAutoRefresh(enabledPanels, handlePanelUpdate);
        
        return () => {
            dataFetcherRef.current.stopAutoRefresh();
        };
    }, [refreshAll, handlePanelUpdate]);

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
        dataFetcherRef.current.startAutoRefresh(enabledPanels, handlePanelUpdate);
    }, [handlePanelUpdate]);

    const forceRefresh = useCallback(() => {
        const enabledPanels = getEnabledPanels().filter(p => p !== "clock");
        dataFetcherRef.current.fetchMultiple(enabledPanels, true).then(({ results, errors }) => {
            const newCaches = {};
            for (const [type, result] of Object.entries(results)) {
                if (result?.data) {
                    newCaches[type] = result.data;
                }
            }
            setCaches(newCaches);
            
            const mem = (process.memoryUsage().rss / 1024 / 1024).toFixed(1);
            const firstError = Object.values(errors)[0];
            setStatusInfo({
                time: new Date().toLocaleTimeString(),
                mem,
                error: firstError?.message || null
            });
        });
    }, []);

    useInput((input, key) => {
        if (showSettings || dialog) return;
        
        if (input === "q") { 
            dataFetcherRef.current?.destroy();
            exit(); 
            process.exit(0); 
        }
        
        if (input === "s") {
            setShowSettings(true);
            return;
        }
        
        if (input === "r") {
            forceRefresh();
            return;
        }
        
        if (input === "t") {
            setTickerEnabled(prev => !prev);
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

    const termRows = process.stdout.rows || 40;
    const termCols = process.stdout.columns || 120;
    
    const tickerHeight = tickerEnabled ? 3 : 0;
    const statusHeight = 3;
    const availableRows = Math.max(10, termRows - tickerHeight - statusHeight);
    const colWidth = Math.floor(termCols / 3);

    const col1Count = col1Panels.length;
    const col2Count = col2Panels.length;
    const col3Count = col3Panels.filter(p => p.type !== "clock").length;
    const col3HasClock = col3Panels.some(p => p.type === "clock");
    const clockHeight = col3HasClock ? 4 : 0;

    const MIN_VISIBLE = 6;
    const MAX_VISIBLE = 20;
    const BORDER_OVERHEAD = 2;

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

    const renderColumnPanel = (panelConfig, columnIdx, panelIdx) => {
        const panelType = panelConfig.type;
        const globalFocusIdx = panelIndexMap.get(panelType);
        const isFocused = globalFocusIdx === focusIdx;
        
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
        maxVisible = Math.max(1, maxVisible);
        
        return h(PanelList, {
            key: `${columnIdx}-${panelIdx}-${panelType}`,
            category,
            label,
            items,
            focused: isFocused,
            onSelect: idx => openDetail(panelType, idx),
            maxVisible
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
                config: config.ticker
            })
        ));
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
                flexGrow: 1, 
                flexShrink: 1,
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
            statusInfo
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
    .action(() => render(h(Dashboard)));

export default dashboardCmd;
