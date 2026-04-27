import React, { useState, useCallback } from "react";
import { Box, Text, useInput } from "ink";
import {
    getDashboardConfig,
    setDashboardConfig,
    resetDashboardConfig
} from "../../utils/config-manager.js";

const h = React.createElement;

const SETTINGS_TABS = [
    { id: "panels", label: "Panels", description: "Enable/Disable and configure panels" },
    { id: "ticker", label: "Ticker", description: "Configure the top ticker bar" },
    { id: "theme", label: "Theme", description: "Customize appearance" },
    { id: "advanced", label: "Advanced", description: "Refresh intervals, keybindings" }
];

const PANEL_LABELS = {
    article: "Articles",
    breaking: "Breaking News",
    onchain: "On-Chain Data",
    report: "Reports",
    breakout: "Breakout Signals",
    exhaustion: "Exhaustion Signals",
    goldenPit: "Golden Pit",
    liquidation: "Liquidation",
    clock: "Market Clock",
    marketToday: "Market Today",
    tokenUnlock: "Token Unlock",
    fredDashboard: "FRED Macro",
    priceTicker: "Price Ticker",
    economicCalendar: "Economic Calendar"
};

const THEME_OPTIONS = [
    { id: "dark-red", name: "Dark Red", accent: "red" },
    { id: "dark-blue", name: "Dark Blue", accent: "blue" },
    { id: "dark-green", name: "Dark Green", accent: "green" },
    { id: "monochrome", name: "Monochrome", accent: "white" }
];

const REFRESH_OPTIONS = [
    { value: 60000, label: "1 minute" },
    { value: 300000, label: "5 minutes" },
    { value: 600000, label: "10 minutes" },
    { value: 3600000, label: "1 hour" }
];

const CLOCK_REFRESH_OPTIONS = [
    { value: 1000, label: "1 second" },
    { value: 5000, label: "5 seconds" },
    { value: 10000, label: "10 seconds" },
    { value: 30000, label: "30 seconds" },
    { value: 60000, label: "1 minute" }
];

const TICKER_SPEED_OPTIONS = [
    { value: 40, label: "Slow" },
    { value: 60, label: "Normal" },
    { value: 80, label: "Fast" },
    { value: 120, label: "Very Fast" }
];

const TICKER_SOURCE_TYPE_LABELS = {
    fred: "FRED Data",
    price: "Price",
    news: "News",
    signal: "Signal",
    custom: "Custom Text"
};

export const SettingsDialog = ({ onClose, onConfigChange }) => {
    const termRows = process.stdout.rows || 40;
    const termCols = process.stdout.columns || 80;
    
    const [activeTab, setActiveTab] = useState(0);
    const [config, setConfig] = useState(() => getDashboardConfig());
    const [selectedPanel, setSelectedPanel] = useState(0);
    const [selectedTickerSource, setSelectedTickerSource] = useState(0);
    const [selectedTheme, setSelectedTheme] = useState(0);
    const [scrollOffset, setScrollOffset] = useState(0);
    const [message, setMessage] = useState(null);
    const [hasChanges, setHasChanges] = useState(false);

    const HEADER = 5;
    const FOOTER = 4;
    const TAB_AREA = 3;
    const CONTENT_ROWS = Math.max(8, termRows - HEADER - FOOTER - TAB_AREA);

    const updateConfig = useCallback((updates) => {
        setConfig(prev => {
            const updated = { ...prev, ...updates };
            return updated;
        });
        setHasChanges(true);
    }, []);

    const updatePanels = useCallback((panelType, updates) => {
        setConfig(prev => {
            const panels = { ...prev.panels };
            panels[panelType] = { ...panels[panelType], ...updates };
            return { ...prev, panels };
        });
        setHasChanges(true);
    }, []);

    const updateTicker = useCallback((updates) => {
        setConfig(prev => {
            const ticker = { ...prev.ticker, ...updates };
            return { ...prev, ticker };
        });
        setHasChanges(true);
    }, []);

    const updateTheme = useCallback((updates) => {
        setConfig(prev => {
            const theme = { ...prev.theme, ...updates };
            return { ...prev, theme };
        });
        setHasChanges(true);
    }, []);

    const saveConfig = useCallback(() => {
        try {
            setDashboardConfig(config);
            setMessage({ type: "success", text: "Configuration saved successfully!" });
            setHasChanges(false);
            if (onConfigChange) {
                onConfigChange(config);
            }
            setTimeout(() => setMessage(null), 2000);
        } catch (e) {
            setMessage({ type: "error", text: `Failed to save: ${e.message}` });
            setTimeout(() => setMessage(null), 3000);
        }
    }, [config, onConfigChange]);

    const resetToDefaults = useCallback(() => {
        const defaults = resetDashboardConfig();
        setConfig(defaults);
        setHasChanges(false);
        setMessage({ type: "info", text: "Reset to defaults." });
        setSelectedPanel(0);
        setSelectedTickerSource(0);
        setTimeout(() => setMessage(null), 2000);
    }, []);

    const getPanelList = () => {
        return Object.entries(config.panels)
            .map(([type, cfg]) => ({ type, ...cfg, label: PANEL_LABELS[type] || type }))
            .sort((a, b) => {
                if (a.column !== b.column) return a.column - b.column;
                return a.order - b.order;
            });
    };

    const handlePanelsInput = (input, key) => {
        const panels = getPanelList();
        
        if (key.upArrow) {
            setSelectedPanel(i => Math.max(0, i - 1));
            return;
        }
        if (key.downArrow) {
            setSelectedPanel(i => Math.min(panels.length - 1, i + 1));
            return;
        }
        if (input === " ") {
            const panel = panels[selectedPanel];
            if (panel) {
                updatePanels(panel.type, { enabled: !panel.enabled });
            }
            return;
        }
        if (input === "1" || input === "2" || input === "3") {
            const panel = panels[selectedPanel];
            if (panel) {
                updatePanels(panel.type, { column: parseInt(input) });
            }
            return;
        }
        if (key.leftArrow || key.rightArrow) {
            const panel = panels[selectedPanel];
            if (panel) {
                const options = panel.type === "clock" ? CLOCK_REFRESH_OPTIONS : REFRESH_OPTIONS;
                let currentIdx = options.findIndex(o => o.value === panel.refreshInterval);
                if (currentIdx === -1) {
                    currentIdx = options.findIndex(o => o.value >= panel.refreshInterval);
                    if (currentIdx === -1) currentIdx = options.length - 1;
                }
                const nextIdx = key.rightArrow 
                    ? Math.min(options.length - 1, currentIdx + 1)
                    : Math.max(0, currentIdx - 1);
                if (options[nextIdx]) {
                    updatePanels(panel.type, { refreshInterval: options[nextIdx].value });
                }
            }
            return;
        }
    };

    const handleTickerInput = (input, key) => {
        const sources = config.ticker.sources || [];
        const maxSelection = sources.length;
        
        if (key.upArrow) {
            setSelectedTickerSource(i => Math.max(0, i - 1));
            return;
        }
        if (key.downArrow) {
            setSelectedTickerSource(i => Math.min(maxSelection, i + 1));
            return;
        }
        if (input === " ") {
            if (selectedTickerSource === 0) {
                updateTicker({ enabled: !config.ticker.enabled });
            } else if (sources[selectedTickerSource - 1]) {
                const updatedSources = [...sources];
                updatedSources[selectedTickerSource - 1] = {
                    ...updatedSources[selectedTickerSource - 1],
                    enabled: !updatedSources[selectedTickerSource - 1].enabled
                };
                updateTicker({ sources: updatedSources });
            }
            return;
        }
        if (key.leftArrow || key.rightArrow) {
            const currentIdx = TICKER_SPEED_OPTIONS.findIndex(o => o.value === config.ticker.speed);
            const nextIdx = key.rightArrow
                ? Math.min(TICKER_SPEED_OPTIONS.length - 1, currentIdx + 1)
                : Math.max(0, currentIdx - 1);
            if (TICKER_SPEED_OPTIONS[nextIdx]) {
                updateTicker({ speed: TICKER_SPEED_OPTIONS[nextIdx].value });
            }
            return;
        }
    };

    const handleThemeInput = (input, key) => {
        if (key.upArrow) {
            setSelectedTheme(i => Math.max(0, i - 1));
            return;
        }
        if (key.downArrow) {
            setSelectedTheme(i => Math.min(THEME_OPTIONS.length - 1, i + 1));
            return;
        }
        if (input === " " || key.return) {
            const theme = THEME_OPTIONS[selectedTheme];
            if (theme) {
                updateTheme({ 
                    name: theme.id, 
                    accentColor: theme.accent 
                });
            }
            return;
        }
    };

    const handleAdvancedInput = (input, key) => {
        // TODO: Advanced settings tab is read-only for now.
        // Implement interactive controls for refresh interval, compact mode, borders, and keybindings.
    };

    useInput((input, key) => {
        if (key.escape || input === "q") {
            onClose();
            return;
        }

        if (key.tab) {
            setActiveTab(prev => (prev + (key.shift ? -1 : 1) + SETTINGS_TABS.length) % SETTINGS_TABS.length);
            setScrollOffset(0);
            return;
        }

        if (input === "s" || key.return) {
            saveConfig();
            return;
        }

        if (input === "r") {
            resetToDefaults();
            return;
        }

        switch (activeTab) {
            case 0:
                handlePanelsInput(input, key);
                break;
            case 1:
                handleTickerInput(input, key);
                break;
            case 2:
                handleThemeInput(input, key);
                break;
            case 3:
                handleAdvancedInput(input, key);
                break;
        }
    });

    const renderTabs = () => {
        return h(Box, { flexDirection: "row", marginBottom: 1 },
            ...SETTINGS_TABS.map((tab, idx) => 
                h(Box, { 
                    key: idx,
                    paddingX: 2,
                    marginRight: 1,
                    backgroundColor: activeTab === idx ? "red" : undefined
                },
                    h(Text, { 
                        color: activeTab === idx ? "white" : "gray",
                        bold: activeTab === idx
                    }, `${idx + 1}. ${tab.label}`)
                )
            )
        );
    };

    const renderPanelsTab = () => {
        const panels = getPanelList();
        const items = [];

        items.push(h(Box, { flexDirection: "row", width: "100%" },
            h(Text, { width: 3, color: "gray" }, "#"),
            h(Text, { width: 6, color: "gray" }, "Enable"),
            h(Text, { width: 8, color: "gray" }, "Column"),
            h(Text, { width: 20, color: "gray" }, "Panel"),
            h(Text, { flexGrow: 1, color: "gray" }, "Refresh Interval")
        ));
        items.push(h(Text, { color: "gray" }, "─".repeat(Math.min(termCols - 6, 70))));

        for (let i = 0; i < Math.min(CONTENT_ROWS - 3, panels.length); i++) {
            const panel = panels[i];
            const isSelected = i === selectedPanel;
            const options = panel.type === "clock" ? CLOCK_REFRESH_OPTIONS : REFRESH_OPTIONS;
            const refreshLabel = options.find(o => o.value === panel.refreshInterval)?.label || "Custom";

            items.push(h(Box, { 
                key: i, 
                flexDirection: "row", 
                width: "100%",
                backgroundColor: isSelected ? "red" : undefined
            },
                h(Text, { 
                    width: 3, 
                    color: isSelected ? "white" : "yellow" 
                }, `${i + 1}.`),
                h(Text, { 
                    width: 6, 
                    color: isSelected ? "white" : (panel.enabled ? "green" : "red")
                }, panel.enabled ? "[✓]" : "[ ]"),
                h(Text, { 
                    width: 8, 
                    color: isSelected ? "white" : "cyan"
                }, `Col ${panel.column}`),
                h(Text, { 
                    width: 20, 
                    color: isSelected ? "white" : "white",
                    bold: true
                }, panel.label?.slice(0, 18)),
                h(Text, { 
                    flexGrow: 1, 
                    color: isSelected ? "white" : "gray"
                }, `← ${refreshLabel} →`)
            ));
        }

        if (panels.length > CONTENT_ROWS - 3) {
            items.push(h(Text, { color: "gray" }, `... and ${panels.length - (CONTENT_ROWS - 3)} more panels`));
        }

        items.push(h(Box, { marginTop: 1 },
            h(Text, { color: "gray" }, "Keys: "),
            h(Text, { color: "cyan" }, "↑↓"),
            h(Text, { color: "gray" }, " Select | "),
            h(Text, { color: "cyan" }, "Space"),
            h(Text, { color: "gray" }, " Toggle | "),
            h(Text, { color: "cyan" }, "1/2/3"),
            h(Text, { color: "gray" }, " Column | "),
            h(Text, { color: "cyan" }, "←→"),
            h(Text, { color: "gray" }, " Interval")
        ));

        return items;
    };

    const renderTickerTab = () => {
        const sources = config.ticker.sources || [];
        const speedLabel = TICKER_SPEED_OPTIONS.find(o => o.value === config.ticker.speed)?.label || "Custom";
        const items = [];

        items.push(h(Box, { flexDirection: "row" },
            h(Text, { color: "cyan" }, "Ticker Status: "),
            h(Text, { color: config.ticker.enabled ? "green" : "red", bold: true }, 
                config.ticker.enabled ? "ENABLED" : "DISABLED"),
            h(Text, { color: "gray" }, "   Speed: "),
            h(Text, { color: "yellow" }, `← ${speedLabel} →`)
        ));
        items.push(h(Text, { color: "gray" }, "─".repeat(Math.min(termCols - 6, 70))));

        items.push(h(Box, { 
            flexDirection: "row", 
            width: "100%",
            backgroundColor: selectedTickerSource === 0 ? "red" : undefined
        },
            h(Text, { 
                width: 3, 
                color: selectedTickerSource === 0 ? "white" : "yellow" 
            }, "0. "),
            h(Text, { 
                width: 6, 
                color: selectedTickerSource === 0 ? "white" : (config.ticker.enabled ? "green" : "red")
            }, config.ticker.enabled ? "[✓]" : "[ ]"),
            h(Text, { 
                color: selectedTickerSource === 0 ? "white" : "white",
                bold: true
            }, "Master Ticker Toggle")
        ));

        items.push(h(Text, { color: "gray" }, "─".repeat(Math.min(termCols - 6, 70))));

        for (let i = 0; i < Math.min(CONTENT_ROWS - 7, sources.length); i++) {
            const source = sources[i];
            const sourceIdx = i + 1;
            const isSelected = sourceIdx === selectedTickerSource;
            const typeLabel = TICKER_SOURCE_TYPE_LABELS[source.type] || source.type;

            let displayText = "";
            if (source.type === "fred") {
                displayText = `${typeLabel}: ${source.series || ""} (${source.format || ""})`;
            } else if (source.type === "price") {
                displayText = `${typeLabel}: ${source.symbol || ""} (${source.format || ""})`;
            } else if (source.type === "news") {
                displayText = `${typeLabel}: ${source.typeFilter || "breaking"} (${source.format || ""})`;
            } else if (source.type === "custom") {
                displayText = `${typeLabel}: ${source.text || ""}`;
            } else {
                displayText = `${typeLabel}: ${JSON.stringify(source)}`;
            }

            items.push(h(Box, { 
                key: sourceIdx, 
                flexDirection: "row", 
                width: "100%",
                backgroundColor: isSelected ? "red" : undefined
            },
                h(Text, { 
                    width: 3, 
                    color: isSelected ? "white" : "yellow" 
                }, `${sourceIdx}. `),
                h(Text, { 
                    width: 6, 
                    color: isSelected ? "white" : ((source.enabled !== false) ? "green" : "red")
                }, (source.enabled !== false) ? "[✓]" : "[ ]"),
                h(Text, { 
                    color: isSelected ? "white" : "white",
                    wrap: "truncate"
                }, displayText.slice(0, termCols - 20))
            ));
        }

        items.push(h(Box, { marginTop: 1 },
            h(Text, { color: "gray" }, "Keys: "),
            h(Text, { color: "cyan" }, "↑↓"),
            h(Text, { color: "gray" }, " Select | "),
            h(Text, { color: "cyan" }, "Space"),
            h(Text, { color: "gray" }, " Toggle | "),
            h(Text, { color: "cyan" }, "←→"),
            h(Text, { color: "gray" }, " Speed")
        ));

        return items;
    };

    const renderThemeTab = () => {
        const items = [];

        items.push(h(Text, { color: "cyan", bold: true }, "Available Themes:"));
        items.push(h(Text, { color: "gray" }, "─".repeat(Math.min(termCols - 6, 70))));

        for (let i = 0; i < THEME_OPTIONS.length; i++) {
            const theme = THEME_OPTIONS[i];
            const isSelected = i === selectedTheme;
            const isActive = config.theme.name === theme.id;

            items.push(h(Box, { 
                key: i, 
                flexDirection: "row", 
                width: "100%",
                backgroundColor: isSelected ? "red" : undefined
            },
                h(Text, { 
                    width: 3, 
                    color: isSelected ? "white" : "yellow" 
                }, `${i + 1}. `),
                h(Text, { 
                    width: 6, 
                    color: isSelected ? "white" : (isActive ? "green" : "gray")
                }, isActive ? "[✓]" : "[ ]"),
                h(Text, { 
                    width: 20, 
                    color: isSelected ? "white" : theme.accent,
                    bold: true
                }, theme.name),
                h(Text, { 
                    color: isSelected ? "white" : "gray"
                }, `Accent: ${theme.accent}`)
            ));
        }

        items.push(h(Box, { marginTop: 1 },
            h(Text, { color: "gray" }, "Current Theme: "),
            h(Text, { color: "yellow", bold: true }, config.theme.name || "dark-red"),
            h(Text, { color: "gray" }, " (Accent: "),
            h(Text, { color: config.theme.accentColor || "red", bold: true }, config.theme.accentColor || "red"),
            h(Text, { color: "gray" }, ")")
        ));

        items.push(h(Box, { marginTop: 1 },
            h(Text, { color: "gray" }, "Keys: "),
            h(Text, { color: "cyan" }, "↑↓"),
            h(Text, { color: "gray" }, " Select | "),
            h(Text, { color: "cyan" }, "Space/Enter"),
            h(Text, { color: "gray" }, " Apply")
        ));

        return items;
    };

    const renderAdvancedTab = () => {
        const items = [];

        items.push(h(Text, { color: "cyan", bold: true }, "Advanced Settings:"));
        items.push(h(Text, { color: "gray" }, "─".repeat(Math.min(termCols - 6, 70))));

        items.push(h(Box, { flexDirection: "row", width: "100%" },
            h(Text, { width: 25, color: "gray" }, "Global Refresh Interval:"),
            h(Text, { color: "yellow" }, REFRESH_OPTIONS.find(o => o.value === config.refreshInterval)?.label || "Custom")
        ));

        items.push(h(Box, { flexDirection: "row", width: "100%", marginTop: 1 },
            h(Text, { width: 25, color: "gray" }, "Compact Mode:"),
            h(Text, { color: config.theme.compactMode ? "green" : "red" }, 
                config.theme.compactMode ? "ENABLED" : "DISABLED")
        ));

        items.push(h(Box, { flexDirection: "row", width: "100%", marginTop: 1 },
            h(Text, { width: 25, color: "gray" }, "Panel Borders:"),
            h(Text, { color: config.theme.panelBorder ? "green" : "red" }, 
                config.theme.panelBorder ? "ENABLED" : "DISABLED")
        ));

        items.push(h(Text, { color: "gray", marginTop: 1 }, "─".repeat(Math.min(termCols - 6, 70))));
        items.push(h(Text, { color: "cyan", bold: true }, "Keybindings:"));

        const keybindings = config.keybindings || {};
        const bindingEntries = Object.entries(keybindings);

        for (let i = 0; i < Math.min(CONTENT_ROWS - 12, bindingEntries.length); i++) {
            const [action, key] = bindingEntries[i];
            items.push(h(Box, { flexDirection: "row", width: "100%" },
                h(Text, { width: 25, color: "gray" }, `${action}:`),
                h(Text, { color: "yellow" }, key.toUpperCase())
            ));
        }

        items.push(h(Box, { marginTop: 1 },
            h(Text, { color: "gray" }, "Note: "),
            h(Text, { color: "yellow" }, "Advanced configuration via config file only.")
        ));

        return items;
    };

    const renderContent = () => {
        switch (activeTab) {
            case 0:
                return renderPanelsTab();
            case 1:
                return renderTickerTab();
            case 2:
                return renderThemeTab();
            case 3:
                return renderAdvancedTab();
            default:
                return [];
        }
    };

    const messageColor = message?.type === "success" ? "green" : 
                       message?.type === "error" ? "red" : "cyan";

    return h(Box, {
        flexDirection: "column", 
        borderStyle: "double", 
        borderColor: "red",
        paddingX: 1, 
        width: "100%", 
        height: termRows
    },
        h(Box, { marginBottom: 1 },
            h(Text, { backgroundColor: "red", color: "white", bold: true }, "  SETTINGS  "),
            hasChanges && h(Text, { color: "yellow", marginLeft: 2 }, "● Unsaved changes"),
            message && h(Text, { color: messageColor, marginLeft: 2 }, message.text)
        ),
        
        renderTabs(),
        
        h(Box, { 
            flexDirection: "column", 
            flexGrow: 1, 
            marginTop: 1,
            overflow: "hidden"
        },
            ...renderContent()
        ),

        h(Box, { 
            justifyContent: "center", 
            borderStyle: "single", 
            borderColor: "gray", 
            borderTop: true, 
            borderBottom: false, 
            borderLeft: false, 
            borderRight: false,
            marginTop: 1
        },
            h(Text, { backgroundColor: "red", color: "white", bold: true }, " S "),
            h(Text, { color: "gray" }, " Save  "),
            h(Text, { backgroundColor: "gray", color: "white", bold: true }, " R "),
            h(Text, { color: "gray" }, " Reset  "),
            h(Text, { backgroundColor: "gray", color: "white", bold: true }, " Tab "),
            h(Text, { color: "gray" }, " Switch Tab  "),
            h(Text, { backgroundColor: "gray", color: "white", bold: true }, " Q/ESC "),
            h(Text, { color: "gray" }, " Close")
        )
    );
};
