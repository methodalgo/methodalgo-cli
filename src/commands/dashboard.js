import { Command } from "commander";
import React, { useState, useEffect, useRef } from "react";
import { render, Box, Text, useInput, useApp } from "ink";
import chalk from "chalk";
import { signedRequest } from "../utils/api.js";
import { t, getLang } from "../utils/i18n.js";
import { BANNER } from "../utils/constants.js";

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
    return text.toString()
        .replace(/[\r\n\t]+/g, " ") // 合并空白线和制表符
        .replace(/[\uD83C\uD83D\uD83E][\uDC00-\uDFFF]|[\u2600-\u27BF]/g, "") // 移除 Emoji
        .replace(/[\u0000-\u001F\u007F-\u009F]/g, "") // 移除控制字符
        .replace(/\s+/g, " ") // 合并连续空格
        .trim();
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
    const local = now.toLocaleTimeString("zh-CN", opts);
    const lse = now.toLocaleTimeString("en-GB", { ...opts, timeZone: "Europe/London" });
    const nyse = now.toLocaleTimeString("en-US", { ...opts, timeZone: "America/New_York" });
    
    return h(Box, { flexDirection: "column", borderStyle: "single", borderColor: bc, width: "100%", height: 4, paddingX: 1, overflow: "hidden" },
        h(Box, { flexDirection: "row" },
            h(Text, { bold: true, color: "yellow" }, " 🕒 Market clock")
        ),
        h(Box, { width: "100%", overflow: "hidden" },
            h(Text, { wrap: "truncate" }, `${local} (L)  ${lse} (E)  ${nyse} (N)`)
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

    const actualItems = Array.isArray(items) ? items : [];
    const visibleItems = actualItems.slice(scrollTop, scrollTop + maxVisible);
    const hasMore = actualItems.length > scrollTop + maxVisible;
    const hasLess = scrollTop > 0;

    const countLabel = actualItems.length > 0 ? ` (${actualItems.length})` : "";
    const scrollHint = hasLess && hasMore ? " ↕" : hasLess ? " ↑" : hasMore ? " ↓" : "";
    return h(Box, { flexDirection: "column", borderStyle: "single", borderColor: bc, flexGrow: 1, overflow: "hidden", width: "100%" },
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
                if (!title) return null; // 如果没有任何可显示标题，则不渲染这一行
                
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
        h(Box, { marginBottom: 1 }, h(Text, null, BANNER)),
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
                        next[type] = res.value.data.data
                            .filter(item => item && (item.title || item.displayTitle)) // 初步过滤空项
                            .map(item => ({
                                ...item,
                                displayTitle: typeof item.title === "object" ? (item.title[lang] || item.title.en || "") : (item.title || "")
                            }))
                            .filter(item => item.displayTitle.trim().length > 0); // 彻底过滤无标题项
                    }
                });

                // Signals processing (后端已智能拆分和标记方向)
                const sigOffset = newsTypes.length;
                const getSig = (idx) => {
                    const res = results[sigOffset + idx];
                    if (res?.status === "fulfilled" && res.value.data.status) {
                        const d = res.value.data.data;
                        if (Array.isArray(d)) return d.filter(item => item && (item.signals || item.displayTitle || item.title));
                        
                        if (d && Array.isArray(d.signals)) {
                            return d.signals.map((s, i) => ({
                                id: `compat-${idx}-${i}`,
                                timestamp: d.updatedAt || new Date().toISOString(),
                                signals: [s]
                            }));
                        }
                        return (d && Object.keys(d).length > 0) ? [d] : [];
                    }
                    return [];
                };

                next.breakout = getSig(0);
                next.exhaustion = [...getSig(1), ...getSig(2)];
                next.goldenPit = [...getSig(3), ...getSig(4)];
                next.liquidation = getSig(5);
                next.marketToday = getSig(6);
                next.tokenUnlock = getSig(7);

                // 最终过滤与格式化重组
                for (const k in next) {
                    if (Array.isArray(next[k])) {
                        next[k] = next[k].map(item => {
                            if (!item) return null;
                            const sig = item.signals?.[0] || {};
                            const details = sig.details || {};
                            let newTitle = cleanText(sig.title || item.displayTitle || "");
                            let direction = sig.direction || item.direction || "";

                            // 尝试从标题中提取 symbol (如果 details 中没有)
                            let symbol = cleanText(details.Symbol || details.symbol || "");
                            if (!symbol) {
                                const match = newTitle.match(/For\s+([\w.*-]+)/i);
                                if (match) symbol = match[1];
                            }
                            
                            const side = (details.Side || details.side || "").toLowerCase();

                            if (k === "breakout") {
                                // 突破信号判定: 优先看 side，再看预计算的 direction
                                const isDown = side.includes("down") || direction === "bear";
                                const isUp = side.includes("up") || direction === "bull";
                                const dirStr = isUp ? "UP" : isDown ? "DOWN" : "";
                                if (dirStr && symbol) newTitle = `Breakout ${dirStr} For ${symbol}`;
                            } else if (k === "goldenPit") {
                                const dirStr = direction === "bull" ? "Bull" : direction === "bear" ? "Bear" : "";
                                if (dirStr && symbol) newTitle = `${dirStr} Golden Pit For ${symbol}`;
                            } else if (k === "liquidation") {
                                // 强平特殊规则: 多单强平(Sell/Bear)为红色, 空单强平(Buy/Bull)为白色
                                const isLong = side.includes("sell") || direction === "bear";
                                const isShort = side.includes("buy") || direction === "bull";
                                if (isLong) {
                                    newTitle = `LONG Liquidation For ${symbol || "Unknown"}`;
                                    direction = "bear";
                                } else if (isShort) {
                                    newTitle = `SHORT Liquidation For ${symbol || "Unknown"}`;
                                    direction = "bull";
                                }
                            }

                            return {
                                ...item,
                                direction, 
                                displayTitle: newTitle
                            };
                        }).filter(item => {
                            if (!item) return false;
                            const title = cleanText(item.displayTitle || "");
                            return title.length > 0;
                        });
                    }
                }

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
    const termCols = process.stdout.columns || 120;
    const availableRows = Math.max(10, termRows - 3); // 减去底部状态栏
    const colWidth = Math.floor(termCols / 3);

    // 计算不同列的渲染数量（扣除面板边框 2 行 + 标题 1 行 = 3 行）
    const col12MaxVisible = Math.max(1, Math.floor(availableRows / 4) - 3);
    const col3MaxVisible = Math.max(1, Math.floor((availableRows - 4) / 2) - 3);

    return h(Box, { flexDirection: "column", height: termRows, width: "100%", overflow: "hidden" },
        h(Box, { flexGrow: 1, width: "100%", overflow: "hidden" },
            // Column 1
            h(Box, { flexDirection: "column", width: colWidth, flexShrink: 0, overflow: "hidden" },
                ["article", "breaking", "onchain", "report"].map((type, i) => h(PanelList, { key: type, label: type === "article" ? t("TYPE_ARTICLE") : type === "breaking" ? t("TYPE_NEWS") : type === "onchain" ? t("TYPE_ONCHAIN") : t("TYPE_REPORT"), items: caches[type], focused: focusIdx === i, onSelect: (idx) => openDetail(type, idx), maxVisible: col12MaxVisible }))
            ),
            // Column 2
            h(Box, { flexDirection: "column", width: colWidth, flexShrink: 0, overflow: "hidden" },
                ["breakout", "exhaustion", "goldenPit", "liquidation"].map((type, i) => h(PanelList, { key: type, label: type === "breakout" ? t("LABEL_BREAKOUT") : type === "exhaustion" ? t("LABEL_EXHAUSTION") : type === "goldenPit" ? t("LABEL_GOLDEN_PIT") : t("LABEL_LIQUIDATION"), items: caches[type], focused: focusIdx === i + 4, onSelect: (idx) => openDetail(type, idx), maxVisible: col12MaxVisible }))
            ),
            // Column 3
            h(Box, { flexDirection: "column", flexGrow: 1, flexShrink: 1, minWidth: 0, overflow: "hidden" },
                h(ClockPanel, { focused: focusIdx === 8 }),
                h(PanelList, { label: t("LABEL_MARKET_TODAY"), items: caches.marketToday, focused: focusIdx === 9, onSelect: (idx) => openDetail("marketToday", idx), maxVisible: col3MaxVisible }),
                h(PanelList, { label: t("LABEL_TOKEN_UNLOCK"), items: caches.tokenUnlock, focused: focusIdx === 10, onSelect: (idx) => openDetail("tokenUnlock", idx), maxVisible: col3MaxVisible })
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
