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
            ? h(Box, { flexGrow: 1, alignItems: "center", justifyContent: "center" }, 
                ...gradientText("Loading...", [255, 60, 60], [255, 255, 255]))
            : visibleItems.map((item, vi) => {
                const realIdx = scrollTop + vi;
                const isFocused = realIdx === selectedIdx && focused;
                
                // 颜色逻辑：选中状态保持红色背景，非选中状态根据方向上色
                let textColor = "white";
                if (!isFocused && item.direction === "bear") textColor = "red";
                
                return h(Text, {
                    key: realIdx,
                    backgroundColor: isFocused ? "red" : undefined,
                    color: textColor,
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
    const title = data.displayTitle || data.title?.[getLang()] || data.title?.en || data.title || "Detail";
    const time = data?.publish_date || data?.timestamp || "";
    const rawUrl = data?.url || "";
    const url = (rawUrl === "N/A" || !rawUrl) ? "" : rawUrl;
    
    let content = data?.content || data?.fullText || "";
    if (content.includes("No detailed content available.") || content === "No detailed content") content = "";
    
    const contentLines = content ? content.split("\n") : [];
    const HEADER = 8;
    const FOOTER = 3;
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
        // Category Label (Large)
        h(Box, { marginBottom: 1 },
            h(Text, { backgroundColor: "red", color: "white", bold: true }, `  ${(category || "Detail").toUpperCase()}  `)
        ),
        // Title (Bold)
        h(Text, { color: "yellow", bold: true, wrap: "wrap" }, title),
        h(Box, { height: 1 }), // Spacer
        // Metadata
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
        
        // Content Section
        content ? h(Box, { flexDirection: "column", flexGrow: 1, marginTop: 1 },
            h(Text, { color: "gray", dimColor: true }, sep),
            ...visibleContent.map((line, i) => h(Text, { key: i, wrap: "wrap", color: "white" }, line || " "))
        ) : h(Box, { flexGrow: 1 }),

        // Scroll Info
        contentLines.length > VISIBLE
            ? h(Text, { color: "gray" }, ` Scroll: Up/Down (${scrollOffset + 1}-${Math.min(scrollOffset + VISIBLE, contentLines.length)}/${contentLines.length})`)
            : null,
        // Toolbar
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
    const [dots, setDots] = useState(1);
    useEffect(() => {
        const timer = setInterval(() => setDots(d => (d % 3) + 1), 400);
        return () => clearInterval(timer);
    }, []);
    return h(Box, { flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%" },
        h(Text, { color: "red", bold: true }, "▄▄▄      ▄▄▄             ▄▄             ▄▄   ▄▄▄▄   ▄▄             "),
        h(Text, { color: "red", bold: true }, "████▄  ▄████        ██   ██             ██ ▄██▀▀██▄ ██             "),
        h(Text, { color: "red", bold: true }, "███▀████▀███ ▄█▀█▄ ▀██▀▀ ████▄ ▄███▄ ▄████ ███  ███ ██ ▄████ ▄███▄ "),
        h(Text, { color: "red", bold: true }, "███  ▀▀  ███ ██▄█▀  ██   ██ ██ ██ ██ ██ ██ ███▀▀███ ██ ██ ██ ██ ██ "),
        h(Text, { color: "white", bold: true }, "███      ███ ▀█▄▄▄  ██   ██ ██ ▀███▀ ▀████ ███  ███ ██ ▀████ ▀███▀ "),
        h(Text, null, " "),
        h(Box, { gap: 1 },
            h(Spinner, { color: "red" }),
            ...gradientText(`Fetching Global Alpha Insights${".".repeat(dots)}`, [255, 60, 60], [255, 255, 255])
        )
    );
};

// ── 主 Dashboard 组件 ──────────────────────────────────────
const PANELS = ["article", "breaking", "onchain", "report", "breakout", "exhaustion", "goldenPit", "liquidation", "clock", "marketToday", "tokenUnlock"];

const Dashboard = () => {
    const { exit } = useApp();
    const [loading, setLoading] = useState(true);
    const [authError, setAuthError] = useState(false);
    const [focusIdx, setFocusIdx] = useState(0);
    const [dialog, setDialog] = useState(null);
    const [caches, setCaches] = useState({
        article: [], breaking: [], onchain: [], report: [],
        breakout: [], exhaustion: [], goldenPit: [], liquidation: [],
        marketToday: [], tokenUnlock: []
    });
    const [statusInfo, setStatusInfo] = useState({ time: "", mem: "0", error: null });
    const dataTimerRef = useRef(null);
    const lastFetchRef = useRef(null); // 记录上次拉取时间，用于增量请求
    const isFetchingRef = useRef(false);  // 防止并发重入
    const refreshRef = useRef(null);      // 始终持有最新 refreshData 引用
    const lang = getLang();

    const scheduleRefresh = (delay = 60000) => {
        if (dataTimerRef.current) clearTimeout(dataTimerRef.current);
        dataTimerRef.current = setTimeout(() => refreshRef.current?.(), delay);
    };

    const refreshData = async () => {
        if (isFetchingRef.current) return; // 防止并发
        isFetchingRef.current = true;
        const memUsage = (process.memoryUsage().rss / 1024 / 1024).toFixed(1);
        try {
            const newsTypes = ["article", "breaking", "onchain", "report"];
            const signalChannels = ["breakout-mtf", "exhaustion-buyer", "exhaustion-seller", "golden-pit-ltf", "golden-pit-mtf", "liquidation", "market-today", "token-unlock"];
            const isFirstFetch = !lastFetchRef.current;
            const newsLimit = isFirstFetch ? 100 : 20;
            const sigLimit = isFirstFetch ? 50 : 15;
            const startDate = isFirstFetch ? undefined : lastFetchRef.current;

            const promises = [
                ...newsTypes.map(type => signedRequest("/mcp/news", { type, limit: newsLimit, lang, ...(startDate ? { startDate } : {}) })),
                ...signalChannels.map(channelName => signedRequest("/mcp/signals", { channelName, limit: sigLimit }))
            ];
            const results = await Promise.allSettled(promises);

            const authFailed = results.some(r =>
                (r.status === "rejected" && r.reason?.response?.status === 401) ||
                (r.status === "fulfilled" && r.value.data.status === false &&
                    (r.value.data.msg?.includes("auth") || r.value.data.msg?.includes("key")))
            );
            if (authFailed) { setAuthError(true); setLoading(false); if (dataTimerRef.current) clearTimeout(dataTimerRef.current); return; }

            lastFetchRef.current = new Date().toISOString();

            setCaches(prev => {
                const next = { ...prev };
                // Process News
                newsTypes.forEach((type, idx) => {
                    const res = results[idx];
                    if (res.status === "fulfilled" && res.value.data.status) {
                        const newData = res.value.data.data;
                        const existingTitles = new Set(prev[type].map(n => n.title?.[lang] || n.title?.en));
                        const uniqueNew = newData.filter(n => !existingTitles.has(n.title?.[lang] || n.title?.en));
                        next[type] = [...uniqueNew, ...prev[type]].slice(0, 100).map(item => {
                            const rawTitle = (typeof item.title === "object" && item.title !== null) ? (item.title[lang] || item.title.en || "") : (item.title || "");
                            const rawContent = item.content || item.summary || item.excerpt || item.description || "";
                            const content = (typeof rawContent === "object" && rawContent !== null) ? (rawContent[lang] || rawContent.en || JSON.stringify(rawContent)) : (rawContent || "No detailed content available.");
                            
                            item.fullText = `Title: ${rawTitle}\n\nTime: ${item.publish_date}\n\nURL: ${item.url || "N/A"}\n\n--- Content ---\n${content}`;
                            item.displayTitle = cleanText(rawTitle);
                            return item;
                        });
                    }
                });

                // Process Signals & Info
                const sigStartIndex = newsTypes.length;
                const getSigData = (channelOffset) => {
                    const res = results[sigStartIndex + channelOffset];
                    return (res?.status === "fulfilled" && res.value.data.status) ? res.value.data.data : [];
                };

                const formatSig = (rawItem, overrideDir, type) => {
                    const item = { ...rawItem }; // 浅拷贝，避免直接修改原始数据
                    const sig = item.signals?.[0];
                    let breakPrice = sig?.details?.BreakPrice || sig?.breakPrice || sig?.break_price || item.breakPrice || item.break_price;
                    if (!breakPrice && sig?.fields) {
                        const field = sig.fields.find(f => f.name?.includes("BreakPrice") || f.name?.includes("Price"));
                        if (field) breakPrice = field.value;
                    }
                    let rawTitle = sig ? sig.title : (item.title || "Signal Tip");
                    const attachments = [...(item.attachments || [])];
                    if (sig?.image) attachments.push({ url: sig.image });
                    
                    // 方向检测改进
                    let direction = overrideDir || item.direction || "";
                    const side = (sig?.side || sig?.details?.Side || "").toLowerCase();

                    if (!direction) {
                        const searchStr = `${rawTitle} ${sig?.description || ""} ${item.title || ""}`.toLowerCase();
                        if (side === "buy" || side === "up" || searchStr.includes("bull") || searchStr.includes("up") || searchStr.includes("exhaustion seller") || (type === "liquidation" && side === "buy")) {
                            direction = "bull";
                        } else if (side === "sell" || side === "down" || searchStr.includes("bear") || searchStr.includes("down") || searchStr.includes("exhaustion buyer") || (type === "liquidation" && side === "sell")) {
                            direction = "bear";
                        } else if (searchStr.includes("long")) {
                            direction = type === "liquidation" ? "bear" : "bull";
                        } else if (searchStr.includes("short")) {
                            direction = type === "liquidation" ? "bull" : "bear";
                        }
                    }
                    item.direction = direction;

                    // 标题重写逻辑 (根据需求精调)
                    let symbol = sig?.symbol || item.symbol || "";
                    if (!symbol) {
                        const m = rawTitle.match(/\s(?:[Ff]or|[Oo]n)\s+([A-Z0-9.]+)/);
                        if (m) symbol = m[1];
                        else {
                            const m2 = rawTitle.match(/\b([A-Z0-9.]+)[^\w]*$/);
                            if (m2) symbol = m2[1];
                        }
                    }

                    if (type === "goldenPit") {
                        const prefix = direction === "bull" ? t("GOLDEN_PIT_BULL") : t("GOLDEN_PIT_BEAR");
                        rawTitle = `${prefix} For ${symbol}`;
                    } else if (type === "breakout") {
                        const prefix = direction === "bull" ? t("BREAKOUT_UP") : t("BREAKOUT_DOWN");
                        rawTitle = `${prefix} For ${symbol}`;
                    } else if (type === "liquidation") {
                        const prefix = direction === "bull" ? t("LIQUIDATION_SHORT") : t("LIQUIDATION_LONG");
                        rawTitle = `${prefix} For ${symbol}`;
                    }
                    
                    // Special Content Cleanup
                    let detailsText = JSON.stringify(item.signals || item, null, 2);
                    if (type === "marketToday" && sig?.description) {
                        const lines = sig.description.split("\n").filter(line => !line.trim().startsWith("http")).filter(line => !line.includes("Season Index"));
                        detailsText = lines.join("\n").trim();
                    } else if (type === "tokenUnlock" && sig?.description) {
                        detailsText = sig.description.split("\n").filter(l => !l.trim().startsWith("http")).join("\n").trim();
                        const tokens = [...detailsText.matchAll(/Token:\s*(\w+)/g)].map(m => m[1]);
                        if (tokens.length > 0) rawTitle = `Unlock: ${tokens.slice(0, 3).join(", ")}${tokens.length > 3 ? "..." : ""}`;
                    }

                    item.fullText = `Signal: ${rawTitle}\n${breakPrice ? `BreakPrice: ${breakPrice}\n` : ""}Timestamp: ${item.timestamp}\n\n--- Details ---\n${detailsText}`;
                    item.displayTitle = cleanText(rawTitle) + (breakPrice ? ` (BP:${breakPrice})` : "");
                    item.attachments = attachments;
                    return item;
                };

                const mergeAndSort = (items, existing, overrideDir, type, preferNew = false) => {
                    const existingIds = new Set(existing.map(e => e.id)); // 提前构建 Set，避免 O(n²)
                    const combined = preferNew ? [...items, ...existing] : [...items.filter(i => !existingIds.has(i.id)), ...existing];
                    const unique = Array.from(new Map(combined.map(item => [item.id, item])).values());
                    return unique.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 50).map(i => formatSig(i, overrideDir, type));
                };

                next.breakout = mergeAndSort(getSigData(0), prev.breakout, null, "breakout");
                next.exhaustion = mergeAndSort([
                    ...getSigData(1).map(i => ({ ...i, direction: "bear" })),
                    ...getSigData(2).map(i => ({ ...i, direction: "bull" }))
                ], prev.exhaustion, null, "exhaustion");
                next.goldenPit = mergeAndSort(getSigData(3).concat(getSigData(4)), prev.goldenPit, null, "goldenPit");
                next.liquidation = mergeAndSort(getSigData(5), prev.liquidation, null, "liquidation");
                
                // 处理 Market Today (本地化情绪)
                const rawMarketToday = getSigData(6);
                const processedMarketToday = [];
                rawMarketToday.forEach(item => {
                    item.signals?.forEach(sig => {
                        const title = sig.title || "";
                        const desc = sig.description || "";
                        if (title.includes("Fear") || title.includes("Greed") || desc.includes("Fear And Greed")) {
                            const today = desc.match(/Today:\s*(\d+)/)?.[1] || sig.details?.Today || sig.details?.["Today Index"] || "";
                            const rawSentiment = desc.match(/Sentiment:\s*([^\n]+)/)?.[1]?.replace("```", "").trim() || sig.details?.Sentiment || "";
                            
                            // 本地化情绪字符串
                            let sentiment = rawSentiment;
                            if (getLang() === "zh") {
                                const sMap = { "Extreme Fear": "SENTIMENT_EXTREME_FEAR", "Fear": "SENTIMENT_FEAR", "Neutral": "SENTIMENT_NEUTRAL", "Greed": "SENTIMENT_GREED", "Extreme Greed": "SENTIMENT_EXTREME_GREED" };
                                sentiment = t(sMap[rawSentiment] || rawSentiment);
                            }

                            const suffix = today ? `: ${today} (${sentiment})` : "";
                            const lines = desc.split("\n").filter(l => !l.trim().startsWith("http"));
                            processedMarketToday.push({
                                ...item,
                                id: `${item.id}-fg`,
                                timestamp: item.timestamp,
                                signals: [{ ...sig, title: `${t("LABEL_FEAR_GREED")}${suffix}`, description: lines.join("\n").trim() }]
                            });
                        }
                    });
                });
                next.marketToday = mergeAndSort(processedMarketToday, prev.marketToday, null, "marketToday", true);

                // 解锁内容分拆
                const rawTokenUnlock = getSigData(7);
                const processedTokenUnlock = [];
                rawTokenUnlock.forEach(item => {
                    const sig = item.signals?.[0];
                    if (!sig?.description) { processedTokenUnlock.push(item); return; }
                    
                    if (typeof sig.description === "object" && sig.description !== null) {
                        const entries = Object.entries(sig.description);
                        if (entries.length === 0) { processedTokenUnlock.push(item); return; }
                        entries.forEach(([label, value], idx) => {
                            processedTokenUnlock.push({
                                ...item,
                                id: `${item.id}-${idx}`,
                                signals: [{
                                    ...sig,
                                    title: `Unlock: ${label.split("\n")[0].trim()}`,
                                    description: `${label}\n${typeof value === "string" ? value.replace(/```/g, "") : JSON.stringify(value)}`
                                }]
                            });
                        });
                    } else if (typeof sig.description === "string") {
                        const parts = sig.description.split(/\[\d+\]\s+Token:/g);
                        if (parts.length <= 1) { processedTokenUnlock.push(item); return; }
                        parts.forEach((p, idx) => {
                            if (idx === 0 || !p.trim()) return;
                            const tokenName = p.trim().split("\n")[0].trim();
                            processedTokenUnlock.push({ ...item, id: `${item.id}-${idx}`, signals: [{ ...sig, title: `Unlock: ${tokenName}`, description: `Token: ${tokenName}\n${p.trim()}` }] });
                        });
                    } else {
                        processedTokenUnlock.push(item);
                    }
                });
                next.tokenUnlock = mergeAndSort(processedTokenUnlock, prev.tokenUnlock, null, "tokenUnlock", true);

                return next;
            });
            setStatusInfo({ time: new Date().toLocaleTimeString(), mem: memUsage, error: null });
            scheduleRefresh(60000);
        } catch (error) {
            if (error.status === 429) {
                const secMatch = error.message.match(/(\d+)\s+seconds/);
                const minMatch = error.message.match(/(\d+)\s+minutes/);
                let delay = 60000;
                if (secMatch) delay = parseInt(secMatch[1]) * 1000 + 2000;
                else if (minMatch) delay = parseInt(minMatch[1]) * 60000 + 2000;
                setStatusInfo(prev => ({ ...prev, error: `Rate Limited (Retry in ${Math.round(delay / 1000)}s)` }));
                scheduleRefresh(delay);
            } else {
                setStatusInfo(prev => ({ ...prev, error: `Err: ${error.message.substring(0, 20)}` }));
                scheduleRefresh(60000);
            }
        } finally {
            isFetchingRef.current = false;
            setLoading(false); // 确保任何路径退出都会重置 loading
        }
    };
    refreshRef.current = refreshData; // 每次渲染后同步最新引用

    useEffect(() => {
        refreshRef.current(); // 挂载时首次拉取（ref 已在渲染体 L476 同步）
        return () => { if (dataTimerRef.current) clearTimeout(dataTimerRef.current); };
    }, []); // 仅挂载执行一次，后续刷新由 scheduleRefresh + refreshRef 统一管理

    useInput((input, key) => {
        if (dialog) return; // 弹窗时由 DetailDialog 处理
        if (input === "q") { exit(); process.exit(0); }
        if (key.tab) {
            if (key.shift) setFocusIdx(f => (f - 1 + PANELS.length) % PANELS.length);
            else setFocusIdx(f => (f + 1) % PANELS.length);
        }
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

    if (loading) return h(LoadingScreen, null);

    if (authError) return h(Box, { flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%" },
        h(Text, { color: "red", bold: true }, `!! ${t("ERR_AUTH_FAILED")} !!`),
        h(Text, null, t("RECONFIG_TIP")),
        h(Text, { color: "yellow" }, t("GET_API_KEY_LINK")),
        h(Text, { color: "cyan" }, "[Press Q to Quit]")
    );

    const newsTypes = ["article", "breaking", "onchain", "report"];
    const newsLabels = { article: t("TYPE_ARTICLE"), breaking: t("TYPE_NEWS"), onchain: t("TYPE_ONCHAIN"), report: t("TYPE_REPORT") };

    const signalTypes = ["breakout", "exhaustion", "goldenPit", "liquidation"];
    const signalLabels = { breakout: t("LABEL_BREAKOUT"), exhaustion: t("LABEL_EXHAUSTION"), goldenPit: t("LABEL_GOLDEN_PIT"), liquidation: t("LABEL_LIQUIDATION") };

    const infoTypes = ["marketToday", "tokenUnlock"];
    const infoLabels = { marketToday: t("LABEL_MARKET_TODAY"), tokenUnlock: t("LABEL_TOKEN_UNLOCK") };

    const termRows = process.stdout.rows || 40;
    // Calculate visible rows for panels (Available height / panels per column)
    const panelVisible = Math.max(2, Math.floor((termRows - 6) / 4) - 2);
    const infoPanelVisible = Math.max(2, Math.floor((termRows - 10) / 2) - 2);

    if (dialog) return h(DetailDialog, { data: dialog.data, category: dialog.category, onClose: () => setDialog(null) });

    return h(Box, { flexDirection: "column", height: termRows },
        h(Box, { flexGrow: 1, flexDirection: "row" },
            // Left: News (4)
            h(Box, { flexDirection: "column", width: "33%" },
                ...newsTypes.map((type, i) =>
                    h(PanelList, {
                        key: type, label: newsLabels[type], items: caches[type],
                        focused: focusIdx === i, onSelect: (idx) => openDetail(type, idx),
                        maxVisible: panelVisible
                    })
                )
            ),
            // Middle: Signals (4)
            h(Box, { flexDirection: "column", width: "34%" },
                ...signalTypes.map((type, i) =>
                    h(PanelList, {
                        key: type, label: signalLabels[type], items: caches[type],
                        focused: focusIdx === i + 4, onSelect: (idx) => openDetail(type, idx),
                        maxVisible: panelVisible
                    })
                )
            ),
            // Right: Info (3)
            h(Box, { flexDirection: "column", width: "33%" },
                h(ClockPanel, { focused: focusIdx === 8 }),
                ...infoTypes.map((type, i) =>
                    h(PanelList, {
                        key: type, label: infoLabels[type], items: caches[type],
                        focused: focusIdx === i + 9, onSelect: (idx) => openDetail(type, idx),
                        maxVisible: infoPanelVisible
                    })
                )
            )
        ),
        h(Box, { borderStyle: "single", borderColor: "red", height: 3, paddingX: 1 },
            ...gradientText("MethodAlgo TUI", [255, 60, 60], [255, 255, 255]),
            h(Text, { color: "gray" }, " | "),
            h(Text, { color: "white" }, "Status: "),
            h(Spinner, { color: "green" }),
            h(Text, { color: "green" }, " Running"),
            statusInfo.error ? h(Text, { color: "red", bold: true }, ` [${statusInfo.error}]`) : null,
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
