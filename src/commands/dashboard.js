import { Command } from "commander";
import React, { useState, useEffect, useRef } from "react";
import { render, Box, Text, useInput, useApp } from "ink";
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
    return text.replace(/[\r\n]+/g, ", ").replace(/[\uD83C\uD83D\uD83E][\uDC00-\uDFFF]|[\u2600-\u27BF]/g, "").trim();
};

const formatTime = (iso) => {
    try {
        const d = new Date(iso);
        const now = new Date();
        const isToday = d.toDateString() === now.toDateString();
        return isToday
            ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
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
    return h(Box, { flexDirection: "column", borderStyle: "single", borderColor: bc, flexGrow: 1, height: "100%" },
        h(Text, { bold: true, color: "yellow" }, " World Clocks"),
        h(Box, { flexDirection: "column", paddingX: 1, paddingTop: 1 },
            h(Box, { flexDirection: "column", marginBottom: 1 },
                h(Text, { color: "yellow" }, "LOCAL TIME"),
                h(Text, { bold: true, color: "white" }, now.toLocaleTimeString("zh-CN", opts))
            ),
            h(Box, { flexDirection: "column", marginBottom: 1 },
                h(Text, { color: "yellow" }, "LONDON (GMT)"),
                h(Text, { bold: true, color: "white" }, now.toLocaleTimeString("en-GB", { ...opts, timeZone: "Europe/London" }))
            ),
            h(Box, { flexDirection: "column" },
                h(Text, { color: "yellow" }, "NEW YORK (EST)"),
                h(Text, { bold: true, color: "white" }, now.toLocaleTimeString("en-US", { ...opts, timeZone: "America/New_York" }))
            )
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
                // 选中项超出可视窗口上边界时，滚动窗口
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

    // 只渲染可视窗口内的条目
    const visibleItems = items.slice(scrollTop, scrollTop + maxVisible);
    const hasMore = items.length > scrollTop + maxVisible;
    const hasLess = scrollTop > 0;

    // 标题行：始终显示，标题固定红色
    const countLabel = items.length > 0 ? ` (${items.length})` : "";
    const scrollHint = hasLess && hasMore ? " ↕" : hasLess ? " ↑" : hasMore ? " ↓" : "";
    return h(Box, { flexDirection: "column", borderStyle: "single", borderColor: bc, flexGrow: 1, overflow: "hidden" },
        h(Text, { bold: true, color: "red", wrap: "truncate" }, ` ${label}${countLabel}${scrollHint}`),
        items.length === 0
            ? h(Text, { color: "gray" }, " Loading...")
            : visibleItems.map((item, vi) => {
                const realIdx = scrollTop + vi;
                return h(Text, {
                    key: realIdx,
                    backgroundColor: (realIdx === selectedIdx && focused) ? "red" : undefined,
                    color: "white",
                    wrap: "truncate"
                }, ` [${formatTime(item.publish_date || item.timestamp)}] ${item.displayTitle || ""}`);
            })
    );
};

// ── 详情弹窗（全屏替换主界面） ─────────────────────────
const DetailDialog = ({ data, category, onClose }) => {
    const [scrollOffset, setScrollOffset] = useState(0);
    const termRows = process.stdout.rows || 40;
    const termCols = process.stdout.columns || 80;
    // 结构化渲染内容
    const title = data?.displayTitle || data?.title || "";
    const time = data?.publish_date || data?.timestamp || "";
    const url = data?.url || "";
    const content = data?.content || data?.fullText || "No detailed content";
    const contentLines = content.split("\n");
    const HEADER = 8; // 标题区占行数
    const FOOTER = 3; // 底部按钮+滚动提示
    const VISIBLE = Math.max(3, termRows - HEADER - FOOTER);

    useInput((input, key) => {
        if (key.escape || key.return || input === "q") onClose();
        if (key.upArrow) setScrollOffset(o => Math.max(0, o - 1));
        if (key.downArrow) setScrollOffset(o => Math.min(Math.max(0, contentLines.length - VISIBLE), o + 1));
    });

    const sep = "─".repeat(Math.min(60, termCols - 6));
    const visibleContent = contentLines.slice(scrollOffset, scrollOffset + VISIBLE);
    return h(Box, {
        flexDirection: "column", borderStyle: "double", borderColor: "red",
        paddingX: 1, width: "100%", height: termRows
    },
        // 分类标签
        h(Box, { marginBottom: 0 },
            h(Text, { backgroundColor: "red", color: "white", bold: true }, ` ${category || "Detail"} `)
        ),
        // 标题
        h(Text, { color: "yellow", bold: true, wrap: "wrap" }, title),
        // 元数据行
        h(Box, { gap: 2 },
            h(Text, null, h(Text, { color: "gray" }, "Time: "), h(Text, { color: "cyan" }, time || "N/A")),
        ),
        url ? h(Text, { color: "gray", dimColor: true, wrap: "truncate" }, `URL: ${url}`) : null,
        data?.attachments?.length > 0 ? h(Box, { flexDirection: "column" },
            data.attachments.map((att, i) => {
                const aurl = typeof att === "string" ? att : (att.url || att.proxy_url);
                return aurl ? h(Text, { key: i, color: "blue", wrap: "truncate" }, `Attachment: ${aurl}`) : null;
            })
        ) : null,
        // 分隔线
        h(Text, { color: "gray", dimColor: true }, sep),
        // 正文内容（可滚动）
        h(Box, { flexDirection: "column", flexGrow: 1 },
            ...visibleContent.map((line, i) => h(Text, { key: i, wrap: "wrap", color: "white" }, line || " "))
        ),
        // 滚动提示
        contentLines.length > VISIBLE
            ? h(Text, { color: "gray" }, ` Scroll: Up/Down (${scrollOffset + 1}-${Math.min(scrollOffset + VISIBLE, contentLines.length)}/${contentLines.length})`)
            : null,
        // 底部操作栏
        h(Box, { justifyContent: "center", borderStyle: "single", borderColor: "gray", borderTop: true, borderBottom: false, borderLeft: false, borderRight: false },
            h(Text, { backgroundColor: "red", color: "white", bold: true }, " ESC "),
            h(Text, { color: "gray" }, " Close  "),
            h(Text, { backgroundColor: "gray", color: "white", bold: true }, " Up/Dn "),
            h(Text, { color: "gray" }, " Scroll")
        )
    );
};

// ── Loading 屏幕（带 Spinner） ───────────────────────────────
const LoadingScreen = () => {
    const [progress, setProgress] = useState(0);
    const [dots, setDots] = useState(1);
    useEffect(() => {
        const timer = setInterval(() => setProgress(p => Math.min(95, p + Math.floor(Math.random() * 15))), 150);
        const dotTimer = setInterval(() => setDots(d => (d % 3) + 1), 400);
        return () => { clearInterval(timer); clearInterval(dotTimer); };
    }, []);
    const filled = Math.floor(progress / 5);
    const bar = "█".repeat(filled) + "░".repeat(20 - filled);
    return h(Box, { flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%" },
        h(Text, { color: "red", bold: true }, "▄▄▄      ▄▄▄             ▄▄             ▄▄   ▄▄▄▄   ▄▄             "),
        h(Text, { color: "red", bold: true }, "████▄  ▄████        ██   ██             ██ ▄██▀▀██▄ ██             "),
        h(Text, { color: "red", bold: true }, "███▀████▀███ ▄█▀█▄ ▀██▀▀ ████▄ ▄███▄ ▄████ ███  ███ ██ ▄████ ▄███▄ "),
        h(Text, { color: "red", bold: true }, "███  ▀▀  ███ ██▄█▀  ██   ██ ██ ██ ██ ██ ██ ███▀▀███ ██ ██ ██ ██ ██ "),
        h(Text, { color: "white", bold: true }, "███      ███ ▀█▄▄▄  ██   ██ ██ ▀███▀ ▀████ ███  ███ ██ ▀████ ▀███▀ "),
        h(Text, null, " "),
        h(Box, { gap: 1 },
            h(Spinner, { color: "red" }),
            h(Text, { color: "yellow" }, `Fetching Global Alpha Insights${".".repeat(dots)}`)
        ),
        h(Text, { color: "red" }, `[${bar}] ${progress}%`)
    );
};

// ── 主 Dashboard 组件 ──────────────────────────────────────
const PANELS = ["article", "breaking", "onchain", "report", "signals", "clock"];

const Dashboard = () => {
    const { exit } = useApp();
    const [loading, setLoading] = useState(true);
    const [authError, setAuthError] = useState(false);
    const [focusIdx, setFocusIdx] = useState(0);
    const [dialog, setDialog] = useState(null);
    const [caches, setCaches] = useState({ article: [], breaking: [], onchain: [], report: [], signals: [] });
    const [statusInfo, setStatusInfo] = useState({ time: "", mem: "0" });
    const dataTimerRef = useRef(null);
    const lastFetchRef = useRef(null); // 记录上次拉取时间，用于增量请求
    const lang = getLang();

    const refreshData = async () => {
        const memUsage = (process.memoryUsage().rss / 1024 / 1024).toFixed(1);
        setStatusInfo({ time: new Date().toLocaleTimeString(), mem: memUsage });
        try {
            const newsTypes = ["article", "breaking", "onchain", "report"];
            const isFirstFetch = !lastFetchRef.current;
            // 首次拉取100条基础数据，后续增量只取20条
            const newsLimit = isFirstFetch ? 100 : 20;
            const startDate = isFirstFetch ? undefined : lastFetchRef.current;
            const promises = [
                ...newsTypes.map(type => signedRequest("/mcp/news", {
                    type, limit: newsLimit, lang,
                    ...(startDate ? { startDate } : {})
                })),
                signedRequest("/mcp/signals", { channelName: "golden-pit-mtf", limit: isFirstFetch ? 50 : 15 })
            ];
            const results = await Promise.allSettled(promises);

            const authFailed = results.some(r =>
                (r.status === "rejected" && r.reason?.response?.status === 401) ||
                (r.status === "fulfilled" && r.value.data.status === false &&
                    (r.value.data.msg?.includes("auth") || r.value.data.msg?.includes("key")))
            );
            if (authFailed) { setAuthError(true); setLoading(false); if (dataTimerRef.current) clearInterval(dataTimerRef.current); return; }

            // 记录本次拉取时间，供下次增量使用
            lastFetchRef.current = new Date().toISOString();

            setCaches(prev => {
                const next = { ...prev };
                newsTypes.forEach((type, idx) => {
                    const res = results[idx];
                    if (res.status === "fulfilled" && res.value.data.status) {
                        const newData = res.value.data.data;
                        const existingTitles = new Set(prev[type].map(n => n.title?.[lang] || n.title?.en));
                        const uniqueNew = newData.filter(n => !existingTitles.has(n.title?.[lang] || n.title?.en));
                        next[type] = [...uniqueNew, ...prev[type]].slice(0, 100).map(item => {
                            const rawTitle = item.title?.[lang] || item.title?.en || "";
                            item.fullText = `Title: ${rawTitle}\n\nTime: ${item.publish_date}\n\nURL: ${item.url || "N/A"}\n\n--- Content ---\n${item.content || "No detailed content available."}`;
                            item.displayTitle = cleanText(rawTitle);
                            return item;
                        });
                    }
                });
                const sigRes = results[results.length - 1];
                if (sigRes.status === "fulfilled" && sigRes.value.data.status) {
                    const newData = sigRes.value.data.data;
                    const existingIds = new Set(prev.signals.map(s => s.id));
                    const uniqueNew = newData.filter(s => !existingIds.has(s.id));
                    next.signals = [...uniqueNew, ...prev.signals].slice(0, 50).map(item => {
                        const sig = item.signals?.[0];
                        let breakPrice = sig?.details?.BreakPrice || sig?.breakPrice || sig?.break_price || item.breakPrice || item.break_price;
                        if (!breakPrice) {
                            const fields = sig?.fields || sig?.embeds?.[0]?.fields;
                            if (fields) {
                                const field = fields.find(f => f.name?.includes("BreakPrice") || f.name?.includes("Price"));
                                if (field) breakPrice = field.value;
                            }
                        }
                        const rawTitle = sig ? sig.title : (item.title || "Signal Tip");
                        const attachments = [...(item.attachments || [])];
                        if (sig?.image) attachments.push({ url: sig.image });

                        item.fullText = `Signal: ${rawTitle}\n${breakPrice ? `BreakPrice: ${breakPrice}\n` : ""}Timestamp: ${item.timestamp}\n\n--- Details ---\n${JSON.stringify(item.signals || item, null, 2)}`;
                        item.displayTitle = cleanText(rawTitle) + (breakPrice ? ` (BP:${breakPrice})` : "");
                        item.attachments = attachments;
                        return item;
                    });
                }
                return next;
            });
        } catch (_) {}
        setLoading(false);
    };

    useEffect(() => {
        refreshData();
        dataTimerRef.current = setInterval(refreshData, 60000);
        return () => { if (dataTimerRef.current) clearInterval(dataTimerRef.current); };
    }, []);

    useInput((input, key) => {
        if (dialog) return; // 弹窗时由 DetailDialog 处理
        if (input === "q") { exit(); process.exit(0); }
        if (key.tab) setFocusIdx(f => (f + 1) % PANELS.length);
    });

    const openDetail = (type, idx) => {
        const item = caches[type]?.[idx];
        if (!item) return;
        const labels = { article: t("TYPE_ARTICLE"), breaking: t("TYPE_NEWS"), onchain: t("TYPE_ONCHAIN"), report: t("TYPE_REPORT"), signals: t("COL_SIGNALS") };
        setDialog({ data: item, category: labels[type] });
    };

    if (loading) return h(LoadingScreen, null);

    if (authError) return h(Box, { flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%" },
        h(Text, { color: "red", bold: true }, `!! ${t("ERR_AUTH_FAILED")} !!`),
        h(Text, null, t("RECONFIG_TIP")),
        h(Text, { color: "yellow" }, t("GET_API_KEY_LINK")),
        h(Text, { color: "cyan" }, "[Press Q to Quit]")
    );

    const newsTypes = ["article", "breaking", "onchain", "report"];
    const newsLabels = { article: t("TYPE_ARTICLE"), breaking: t("TYPE_NEWS"), onchain: t("TYPE_ONCHAIN"), report: t("TYPE_REPORT") };

    // 根据终端高度计算每个新闻面板的可见条目数（终端行数 - 状态栏3行 - 边框约8行，再除以4个面板）
    const termRows = process.stdout.rows || 40;
    const newsPanelVisible = Math.max(2, Math.floor((termRows - 5) / 4) - 3);
    const signalPanelVisible = Math.max(4, termRows - 7);

    // 弹窗打开时替换主界面
    if (dialog) {
        return h(DetailDialog, { data: dialog.data, category: dialog.category, onClose: () => setDialog(null) });
    }

    return h(Box, { flexDirection: "column", height: termRows },
        // 主三列布局
        h(Box, { flexGrow: 1, flexDirection: "row" },
            // 左列：四个新闻面板
            h(Box, { flexDirection: "column", width: "33%" },
                ...newsTypes.map((type, i) =>
                    h(PanelList, {
                        key: type, label: newsLabels[type], items: caches[type],
                        focused: focusIdx === i, onSelect: (idx) => openDetail(type, idx),
                        maxVisible: newsPanelVisible
                    })
                )
            ),
            // 中列：信号面板
            h(Box, { flexDirection: "column", width: "34%" },
                h(PanelList, {
                    label: t("COL_SIGNALS"), items: caches.signals,
                    focused: focusIdx === 4, onSelect: (idx) => openDetail("signals", idx),
                    maxVisible: signalPanelVisible
                })
            ),
            // 右列：时钟
            h(Box, { flexDirection: "column", width: "33%" },
                h(ClockPanel, { focused: focusIdx === 5 })
            )
        ),
        // 渐变色状态栏
        h(Box, { borderStyle: "single", borderColor: "red", height: 3, paddingX: 1 },
            ...gradientText("MethodAlgo TUI", [255, 60, 60], [255, 255, 255]),
            h(Text, { color: "gray" }, " | "),
            h(Text, { color: "white" }, "Status: "),
            h(Spinner, { color: "green" }),
            h(Text, { color: "green" }, " Running"),
            h(Text, { color: "gray" }, " | "),
            h(Text, { color: "white" }, statusInfo.time),
            h(Text, { color: "gray" }, " | "),
            h(Text, { color: "cyan" }, `${statusInfo.mem} MB`),
            h(Text, { color: "gray" }, " | "),
            h(Text, { color: "yellow" }, t("TUI_HINTS"))
        )
    );
};

// ── Commander 指令 ─────────────────────────────────────────
const dashboardCmd = new Command("dashboard")
    .description(t("DASHBOARD_DESC"))
    .addHelpText("after", `\n${t("LABEL_EXAMPLE")}\n  $ ${t("DASHBOARD_EXAMPLE")}\n`)
    .alias("top")
    .action(() => {
        render(h(Dashboard, null), { patchConsole: false });
    });

export default dashboardCmd;
