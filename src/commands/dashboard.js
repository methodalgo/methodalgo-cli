import { Command } from "commander";
import React, { useState, useEffect, useRef } from "react";
import { render, Box, Text, useInput, useApp } from "ink";
import chalk from "chalk";
import { signedRequest } from "../utils/api.js";
import { t, getLang } from "../utils/i18n.js";

const h = React.createElement;

// ── 渐变色工具 ─────────────────────────────────────────
const gradientText = (text, fromRGB, toRGB) => {
    const len = text.length;
    if (len === 0) return [];
    return [...text].map((ch, i) => {
        const ratio = len > 1 ? i / (len - 1) : 0;
        const r = Math.round(fromRGB[0] + (toRGB[0] - fromRGB[0]) * ratio);
        const g = Math.round(fromRGB[1] + (toRGB[1] - fromRGB[1]) * ratio);
        const b = Math.round(fromRGB[2] + (toRGB[2] - fromRGB[2]) * ratio);
        return h(Text, { key: i, color: `rgb(${r},${g},${b})`, bold: true }, ch);
    });
};

// ── Spinner 组件 ───────────────────────────────────────
const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const Spinner = ({ color = "red" }) => {
    const [frame, setFrame] = useState(0);
    useEffect(() => {
        const t = setInterval(() => setFrame(f => (f + 1) % SPINNER_FRAMES.length), 80);
        return () => clearInterval(t);
    }, []);
    return h(Text, { color, bold: true }, SPINNER_FRAMES[frame]);
};

// ── 通用工具 ────────────────────────────────────────────────
const cleanText = (text) => {
    if (!text) return "";
    return text.toString().replace(/[\r\n]+/g, " ").replace(/[\uD83C\uD83D\uD83E][\uDC00-\uDFFF]|[\u2600-\u27BF]/g, "").trim();
};

const formatTime = (iso) => {
    try {
        const d = new Date(iso);
        const now = new Date();
        const isToday = d.toDateString() === now.toDateString();
        return isToday
            ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })
            : `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
    } catch { return "--:--"; }
};

// ── 世界时钟组件 ───────────────────────────────────────────
const ClockPanel = ({ focused }) => {
    const [now, setNow] = useState(new Date());
    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);
    const opts = { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false };
    const bc = focused ? "red" : "white";
    return h(Box, { flexDirection: "column", borderStyle: "single", borderColor: bc, flexGrow: 0, height: 4, paddingX: 1, overflow: "hidden" },
        h(Box, { flexDirection: "row" },
            h(Text, { bold: true, color: "yellow" }, " 🕒 Market clock")
        ),
        h(Box, { flexDirection: "row", justifyContent: "space-between" },
            h(Text, null, `${now.toLocaleTimeString("zh-CN", opts)} (LOCAL)  `),
            h(Text, null, `${now.toLocaleTimeString("en-GB", { ...opts, timeZone: "Europe/London" })} (LSE)  `),
            h(Text, null, `${now.toLocaleTimeString("en-US", { ...opts, timeZone: "America/New_York" })} (NYSE) `)
        )
    );
};

// ── 可滚动列表组件（虚拟滚动） ────────────────────────────────
const PanelList = ({ label, items, focused, onSelect, maxVisible = 6 }) => {
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

    const visibleItems = items.slice(scrollTop, scrollTop + maxVisible);
    const hasMore = items.length > scrollTop + maxVisible;
    const hasLess = scrollTop > 0;

    const countLabel = items.length > 0 ? ` (${items.length})` : "";
    const scrollHint = hasLess && hasMore ? " ↕" : hasLess ? " ↑" : hasMore ? " ↓" : "";
    return h(Box, { flexDirection: "column", borderStyle: "single", borderColor: bc, flexGrow: 1, overflow: "hidden" },
        h(Text, { bold: true, color: "red", wrap: "truncate" }, ` ${label}${countLabel}${scrollHint}`),
        items.length === 0
            ? h(Box, { flexGrow: 1, alignItems: "center", justifyContent: "center" }, 
                ...gradientText("Loading...", [255, 60, 60], [255, 255, 255]))
            : visibleItems.map((item, vi) => {
                const realIdx = scrollTop + vi;
                const isFocused = realIdx === selectedIdx && focused;
                const sig = item.signals?.[0] || {};
                let textColor = (sig.direction === "bear") ? "red" : (sig.direction === "bull" ? "green" : "white");
                return h(Text, {
                    key: realIdx,
                    backgroundColor: isFocused ? "red" : undefined,
                    color: isFocused ? "white" : textColor,
                    wrap: "truncate"
                }, ` [${formatTime(item.publish_date || item.timestamp)}] ${cleanText(sig.title || item.displayTitle || "")}`);
            })
    );
};

// ── 详情弹窗 ─────────────────────────
const DetailDialog = ({ data, category, onClose }) => {
    const [scrollOffset, setScrollOffset] = useState(0);
    const termRows = process.stdout.rows || 40;
    const termCols = process.stdout.columns || 80;
    
    // 内容构建：由于后端已清洗，直接消费 signals[0]
    const sig = data.signals?.[0] || {};
    const title = sig.title || data.displayTitle || "";
    const lines = [];
    
    if (data.analysis) lines.push(chalk.yellow(`Analysis: ${data.analysis}`));
    
    // 渲染通用键值对详情 (后端直出)
    if (sig.details && Object.keys(sig.details).length > 0) {
        Object.entries(sig.details).forEach(([k, v]) => {
            if (!v) return;
            lines.push(`${chalk.cyan(k.padEnd(16))}: ${chalk.white(v)}`);
        });
    }

    const description = (sig.description || data.description?.[getLang()] || data.description?.en || data.description || "");
    if (description) lines.push(...description.toString().split("\n").map(l => l.trim()));

    const HEADER = 8;
    const FOOTER = 3;
    const VISIBLE = Math.max(3, termRows - HEADER - FOOTER);

    useInput((input, key) => {
        if (key.escape || key.return || input === "q") onClose();
        if (key.upArrow) setScrollOffset(o => Math.max(0, o - 1));
        if (key.downArrow) setScrollOffset(o => Math.min(Math.max(0, lines.length - VISIBLE), o + 1));
    });

    const visibleContent = lines.slice(scrollOffset, scrollOffset + VISIBLE);
    
    return h(Box, {
        flexDirection: "column", borderStyle: "double", borderColor: "red",
        paddingX: 1, width: "100%", height: termRows
    },
        h(Box, { marginBottom: 1 },
            h(Text, { backgroundColor: "red", color: "white", bold: true }, `  ${(category || "Detail").toUpperCase()}  `)
        ),
        h(Text, { color: "yellow", bold: true, wrap: "wrap" }, title),
        h(Box, { height: 1 }),
        h(Box, { gap: 2 },
            h(Text, null, h(Text, { color: "gray" }, "Time: "), h(Text, { color: "cyan" }, (data.publish_date || data.timestamp || "N/A"))),
        ),
        data.url ? h(Text, { color: "gray", dimColor: true, wrap: "truncate" }, `URL: ${data.url}`) : null,
        
        h(Box, { flexDirection: "column", flexGrow: 1, marginTop: 1 },
            h(Text, { color: "gray", dimColor: true }, "─".repeat(Math.max(10, termCols - 6))),
            ...visibleContent.map((line, i) => h(Text, { key: i, wrap: "wrap", color: "white" }, line || " "))
        ),

        h(Box, { justifyContent: "center", borderStyle: "single", borderColor: "gray", borderTop: true, borderBottom: false, borderLeft: false, borderRight: false },
            h(Text, { backgroundColor: "red", color: "white", bold: true }, " ENTER/ESC "),
            h(Text, { color: "gray" }, " Close  "),
            h(Text, { backgroundColor: "gray", color: "white", bold: true }, " Up/Dn "),
            h(Text, { color: "gray" }, " Scroll")
        )
    );
};

// ── Loading 屏幕 ───────────────────────────────
const LoadingScreen = () => (
    h(Box, { flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%" },
        h(Spinner, { color: "red" }),
        h(Box, { gap: 1, marginTop: 1 },
            ...gradientText("MethodAlgo Market Intelligence Dashboard...", [255, 60, 60], [255, 255, 255])
        )
    )
);

// ── 主 Dashboard 组件 ──────────────────────────────────────
const PANELS = ["article", "breaking", "onchain", "report", "breakout", "exhaustion", "goldenPit", "liquidation", "clock", "marketToday", "tokenUnlock"];

const Dashboard = () => {
    const { exit } = useApp();
    const [loading, setLoading] = useState(true);
    const [focusIdx, setFocusIdx] = useState(0);
    const [dialog, setDialog] = useState(null);
    const [caches, setCaches] = useState({
        article: [], breaking: [], onchain: [], report: [],
        breakout: [], exhaustion: [], goldenPit: [], liquidation: [],
        clock: [], marketToday: [], tokenUnlock: []
    });
    const [statusInfo, setStatusInfo] = useState({ time: "", mem: "0", error: null });
    const refreshTimerRef = useRef(null);
    const lang = getLang();

    const fetchData = async () => {
        try {
            const newsTypes = ["article", "breaking", "onchain", "report"];
            const signals = ["breakout-mtf", "exhaustion-buyer", "exhaustion-seller", "golden-pit-ltf", "golden-pit-mtf", "liquidation", "market-today", "token-unlock"];
            
            const results = await Promise.allSettled([
                ...newsTypes.map(t => signedRequest("/cli/news", { type: t, limit: 30, lang })),
                ...signals.map(c => signedRequest("/cli/signals", { channelName: c, limit: 30, lang }))
            ]);

            const mem = (process.memoryUsage().rss / 1024 / 1024).toFixed(1);
            
            setCaches(prev => {
                const next = { ...prev };
                // News processing
                newsTypes.forEach((type, i) => {
                    const res = results[i];
                    if (res.status === "fulfilled" && res.value.data.status) {
                        next[type] = res.value.data.data.map(item => ({
                            ...item,
                            displayTitle: item.title[lang] || item.title.en || item.title
                        }));
                    }
                });

                // Signals processing (后端已智能拆分和标记方向)
                const sigOffset = newsTypes.length;
                const getSig = (idx) => (results[sigOffset + idx]?.status === "fulfilled" && results[sigOffset + idx].value.data.status) ? results[sigOffset + idx].value.data.data : [];

                next.breakout = getSig(0);
                next.exhaustion = [...getSig(1), ...getSig(2)];
                next.goldenPit = [...getSig(3), ...getSig(4)];
                next.liquidation = getSig(5);
                next.marketToday = getSig(6);
                next.tokenUnlock = getSig(7);

                return next;
            });

            setStatusInfo({ time: new Date().toLocaleTimeString(), mem, error: null });
        } catch (e) {
            setStatusInfo(p => ({ ...p, error: e.message }));
        } finally {
            setLoading(false);
            refreshTimerRef.current = setTimeout(fetchData, 60000);
        }
    };

    useEffect(() => {
        fetchData();
        return () => clearTimeout(refreshTimerRef.current);
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
        setDialog({ data: item, category: labels[type] });
    };

    if (loading) return h(LoadingScreen);
    if (dialog) return h(DetailDialog, { ...dialog, onClose: () => setDialog(null) });

    const termRows = process.stdout.rows || 40;
    const panelVisible = Math.max(2, Math.floor((termRows - 8) / 4));

    return h(Box, { flexDirection: "column", height: termRows },
        h(Box, { flexGrow: 1 },
            h(Box, { flexDirection: "column", width: "33%" },
                ["article", "breaking", "onchain", "report"].map((t, i) => h(PanelList, { key: t, label: t === "article" ? t("TYPE_ARTICLE") : t === "breaking" ? t("TYPE_NEWS") : t === "onchain" ? t("TYPE_ONCHAIN") : t("TYPE_REPORT"), items: caches[t], focused: focusIdx === i, onSelect: (idx) => openDetail(t, idx), maxVisible: panelVisible }))
            ),
            h(Box, { flexDirection: "column", width: "34%" },
                ["breakout", "exhaustion", "goldenPit", "liquidation"].map((t, i) => h(PanelList, { key: t, label: t === "breakout" ? t("LABEL_BREAKOUT") : t === "exhaustion" ? t("LABEL_EXHAUSTION") : t === "goldenPit" ? t("LABEL_GOLDEN_PIT") : t("LABEL_LIQUIDATION"), items: caches[t], focused: focusIdx === i + 4, onSelect: (idx) => openDetail(t, idx), maxVisible: panelVisible }))
            ),
            h(Box, { flexDirection: "column", width: "33%" },
                h(ClockPanel, { focused: focusIdx === 8 }),
                h(PanelList, { label: t("LABEL_MARKET_TODAY"), items: caches.marketToday, focused: focusIdx === 9, onSelect: (idx) => openDetail("marketToday", idx), maxVisible: panelVisible }),
                h(PanelList, { label: t("LABEL_TOKEN_UNLOCK"), items: caches.tokenUnlock, focused: focusIdx === 10, onSelect: (idx) => openDetail("tokenUnlock", idx), maxVisible: panelVisible })
            )
        ),
        h(Box, { borderStyle: "single", borderColor: "red", height: 3, paddingX: 1, alignItems: "center" },
            h(Text, { color: "red", bold: true }, "MethodAlgo Dashboard"),
            h(Text, { color: "gray" }, " | "),
            h(Text, null, `${statusInfo.time} | ${statusInfo.mem} MB`),
            h(Text, { color: "gray" }, " | "),
            h(Text, { color: "yellow" }, t("TUI_HINTS")),
            statusInfo.error && h(Text, { color: "red", wrap: "truncate" }, ` | ${statusInfo.error}`)
        )
    );
};

const dashboardCmd = new Command("dashboard")
    .description(t("DASHBOARD_DESC"))
    .alias("top")
    .action(() => render(h(Dashboard)));

export default dashboardCmd;
