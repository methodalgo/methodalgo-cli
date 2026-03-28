import { Command } from "commander";
import React, { useState, useEffect, useRef } from "react";
import { render, Box, useInput, useApp } from "ink";
import { DashboardManager } from "../class/DashboardManager.js";
import { ClockPanel } from "../class/Dashboard/ClockPanel.js";
import { PanelList } from "../class/Dashboard/PanelList.js";
import { DetailDialog } from "../class/Dashboard/DetailDialog.js";
import { LoadingScreen } from "../class/Dashboard/LoadingScreen.js";
import { StatusLine } from "../class/Dashboard/StatusLine.js";
import { t, getLang } from "../utils/i18n.js";

const h = React.createElement;
const PANELS = ["article", "breaking", "onchain", "report", "breakout", "exhaustion", "goldenPit", "liquidation", "clock", "marketToday", "tokenUnlock"];

const Dashboard = () => {
    const { exit } = useApp();
    const [loading, setLoading] = useState(true);
    const [focusIdx, setFocusIdx] = useState(0);
    const [dialog, setDialog] = useState(null);
    const [caches, setCaches] = useState({});
    const [statusInfo, setStatusInfo] = useState({ time: "", mem: "0", error: null });
    
    const managerRef = useRef(new DashboardManager(getLang()));
    const timerRef = useRef(null);

    const refresh = async () => {
        try {
            const data = await managerRef.current.fetchData();
            setCaches(data.caches);
            setStatusInfo(data.statusInfo);
        } catch (e) {
            setStatusInfo(prev => ({ ...prev, error: e.message }));
        } finally {
            setLoading(false);
            timerRef.current = setTimeout(refresh, 60000);
        }
    };

    useEffect(() => {
        refresh();
        return () => clearTimeout(timerRef.current);
    }, []);

    useInput((input, key) => {
        if (dialog) return;
        if (input === "q") { exit(); process.exit(0); }
        if (key.tab) setFocusIdx(f => (f + (key.shift ? -1 : 1) + PANELS.length) % PANELS.length);
    });

    const openDetail = (type, idx) => {
        const item = caches[type]?.[idx];
        if (!item) return;
        const labels = {
            article: t("TYPE_ARTICLE"), breaking: t("TYPE_NEWS"), onchain: t("TYPE_ONCHAIN"), report: t("TYPE_REPORT"),
            breakout: t("LABEL_BREAKOUT"), exhaustion: t("LABEL_EXHAUSTION"), goldenPit: t("LABEL_GOLDEN_PIT"), liquidation: t("LABEL_LIQUIDATION"),
            marketToday: t("LABEL_MARKET_TODAY"), tokenUnlock: t("LABEL_TOKEN_UNLOCK")
        };
        setDialog({ data: item, category: labels[type], type: type });
    };

    if (loading) return h(LoadingScreen);
    if (dialog) return h(DetailDialog, { ...dialog, onClose: () => setDialog(null) });

    const termRows = process.stdout.rows || 40;
    const termCols = process.stdout.columns || 120;
    const availableRows = Math.max(10, termRows - 3);
    const colWidth = Math.floor(termCols / 3);

    const col12MaxVisible = Math.max(1, Math.floor(availableRows / 4) - 3);
    const col3MaxVisible = Math.max(1, Math.floor((availableRows - 4) / 2) - 3);

    return h(Box, { flexDirection: "column", height: termRows, width: "100%", overflow: "hidden" },
        h(Box, { flexGrow: 1, width: "100%", overflow: "hidden" },
            // Column 1: News
            h(Box, { flexDirection: "column", width: colWidth, flexShrink: 0, overflow: "hidden" },
                h(PanelList, { label: t("TYPE_ARTICLE"), items: caches.article, focused: focusIdx === 0, onSelect: i => openDetail("article", i), maxVisible: col12MaxVisible }),
                h(PanelList, { label: t("TYPE_NEWS"), items: caches.breaking, focused: focusIdx === 1, onSelect: i => openDetail("breaking", i), maxVisible: col12MaxVisible }),
                h(PanelList, { label: t("TYPE_ONCHAIN"), items: caches.onchain, focused: focusIdx === 2, onSelect: i => openDetail("onchain", i), maxVisible: col12MaxVisible }),
                h(PanelList, { label: t("TYPE_REPORT"), items: caches.report, focused: focusIdx === 3, onSelect: i => openDetail("report", i), maxVisible: col12MaxVisible })
            ),
            // Column 2: Signals
            h(Box, { flexDirection: "column", width: colWidth, flexShrink: 0, overflow: "hidden" },
                h(PanelList, { category: "breakout", label: t("LABEL_BREAKOUT"), items: caches.breakout, focused: focusIdx === 4, onSelect: i => openDetail("breakout", i), maxVisible: col12MaxVisible }),
                h(PanelList, { category: "exhaustion", label: t("LABEL_EXHAUSTION"), items: caches.exhaustion, focused: focusIdx === 5, onSelect: i => openDetail("exhaustion", i), maxVisible: col12MaxVisible }),
                h(PanelList, { category: "goldenPit", label: t("LABEL_GOLDEN_PIT"), items: caches.goldenPit, focused: focusIdx === 6, onSelect: i => openDetail("goldenPit", i), maxVisible: col12MaxVisible }),
                h(PanelList, { category: "liquidation", label: t("LABEL_LIQUIDATION"), items: caches.liquidation, focused: focusIdx === 7, onSelect: i => openDetail("liquidation", i), maxVisible: col12MaxVisible })
            ),
            // Column 3: Misc
            h(Box, { flexDirection: "column", flexGrow: 1, flexShrink: 1, minWidth: 0, overflow: "hidden" },
                h(ClockPanel, { focused: focusIdx === 8 }),
                h(PanelList, { category: "marketToday", label: t("LABEL_MARKET_TODAY"), items: caches.marketToday, focused: focusIdx === 9, onSelect: i => openDetail("marketToday", i), maxVisible: col3MaxVisible }),
                h(PanelList, { category: "tokenUnlock", label: t("LABEL_TOKEN_UNLOCK"), items: caches.tokenUnlock, focused: focusIdx === 10, onSelect: i => openDetail("tokenUnlock", i), maxVisible: col3MaxVisible })
            )
        ),
        h(StatusLine, { statusInfo })
    );
};

const dashboardCmd = new Command("dashboard")
    .description(t("DASHBOARD_DESC"))
    .alias("top")
    .action(() => render(h(Dashboard)));

export default dashboardCmd;
