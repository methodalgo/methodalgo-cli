import { Command } from "commander";
import blessed from "blessed";
import { exec } from "child_process";
import { signedRequest } from "../utils/api.js";
import { t, getLang } from "../utils/i18n.js";

const dashboardCmd = new Command("dashboard")
    .description(t("DASHBOARD_DESC"))
    .addHelpText("after", `\n${t("LABEL_EXAMPLE")}\n  $ ${t("DASHBOARD_EXAMPLE")}\n`)
    .alias("top")
    .action(async () => {
        const screen = blessed.screen({
            smartCSR: true,
            title: "MethodAlgo Dashboard",
            fullUnicode: true,
            style: { bg: "black" }
        });

        screen.enableMouse();

        // --- Loading 页面设计 ---
        const loadingBox = blessed.box({
            parent: screen, top: "center", left: "center", width: "100%", height: "100%",
            style: { bg: "black" }, tags: true, align: "center", valign: "middle", zIndex: 100
        });

        const logoText = 
            "{red-fg}{bold}▄▄▄      ▄▄▄             ▄▄             ▄▄   ▄▄▄▄   ▄▄             {/bold}{/red-fg}\n" +
            "{red-fg}{bold}████▄  ▄████        ██   ██             ██ ▄██▀▀██▄ ██             {/bold}{/red-fg}\n" +
            "{red-fg}{bold}███▀████▀███ ▄█▀█▄ ▀██▀▀ ████▄ ▄███▄ ▄████ ███  ███ ██ ▄████ ▄███▄ {/bold}{/red-fg}\n" +
            "{red-fg}{bold}███  ▀▀  ███ ██▄█▀  ██   ██ ██ ██ ██ ██ ██ ███▀▀███ ██ ██ ██ ██ ██ {/bold}{/red-fg}\n" +
            "{white-fg}{bold}███      ███ ▀█▄▄▄  ██   ██ ██ ▀███▀ ▀████ ███  ███ ██ ▀████ ▀███▀ {/bold}{/white-fg}\n" +
            "{white-fg}{bold}                                                          ██       {/bold}{/white-fg}\n" +
            "{white-fg}{bold}                                                        ▀▀▀        {/bold}{/white-fg}\n";

        const loadText = blessed.text({
            parent: loadingBox, top: "70%", left: "center", content: "Initializing Connection to MethodAlgo Cloud...",
            tags: true, style: { fg: "yellow", bg: "black" }
        });

        const progressBar = blessed.text({
            parent: loadingBox, top: "75%", left: "center", content: "[                    ] 0%",
            tags: true, style: { fg: "red", bg: "black" }
        });

        const logoBox = blessed.box({
            parent: loadingBox, top: "30%", left: "center", width: "shrink", height: "shrink",
            content: logoText, tags: true, style: { bg: "black" }
        });

        let progress = 0;
        const progressInterval = setInterval(() => {
            progress += Math.floor(Math.random() * 15);
            if (progress > 95) progress = 95;
            const filled = Math.floor(progress / 5);
            const bar = "█".repeat(filled) + " ".repeat(20 - filled);
            progressBar.setContent(`[${bar}] ${progress}%`);
            loadText.setContent(`Fetching Global Alpha Insights${".".repeat((progress % 3) + 1)}`);
            debouncedRender();
        }, 150);

        // --- 主 UI 容器 ---
        const caches = { article: [], breaking: [], onchain: [], report: [], signals: [] };
        const getBaseStyle = (label) => ({
            label: label, border: "line",
            style: {
                border: { fg: "white" }, label: { fg: "white" },
                selected: { bg: "red", fg: "white", bold: true }, item: { fg: "white" }
            },
            tags: true
        });

        const mainArea = blessed.box({ parent: screen, top: 0, left: 0, width: "100%", height: "92%", hidden: true });
        const statusBox = blessed.box({ parent: screen, bottom: 0, left: 0, width: "100%", height: "8%", ...getBaseStyle(t("COL_STATUS")), hidden: true });

        const newsCol = blessed.box({ parent: mainArea, top: 0, left: 0, width: "33.5%", height: "100%" });
        const newsWidgets = {
            article: blessed.list({ parent: newsCol, top: 0, left: 0, width: "100%", height: "25%", keys: true, mouse: true, vi: true, ...getBaseStyle(t("TYPE_ARTICLE")) }),
            breaking: blessed.list({ parent: newsCol, top: "25%", left: 0, width: "100%", height: "25%", keys: true, mouse: true, vi: true, ...getBaseStyle(t("TYPE_NEWS")) }),
            onchain: blessed.list({ parent: newsCol, top: "50%", left: 0, width: "100%", height: "25%", keys: true, mouse: true, vi: true, ...getBaseStyle(t("TYPE_ONCHAIN")) }),
            report: blessed.list({ parent: newsCol, top: "75%", left: 0, width: "100%", height: "25%+1", keys: true, mouse: true, vi: true, ...getBaseStyle(t("TYPE_REPORT")) })
        };

        const signalsList = blessed.list({
            parent: mainArea, top: 0, left: "33.5%", width: "33.5%", height: "100%",
            keys: true, mouse: true, vi: true, scrollbar: { ch: " ", track: { bg: "red" }, style: { inverse: true } },
            ...getBaseStyle(t("COL_SIGNALS"))
        });

        const clockContainer = blessed.box({ parent: mainArea, top: 0, left: "67%", width: "33%", height: "100%", ...getBaseStyle("World Clocks") });
        const clocks = {
            local: blessed.text({ parent: clockContainer, top: 2, left: "center", content: "", tags: true, align: "center" }),
            london: blessed.text({ parent: clockContainer, top: 8, left: "center", content: "", tags: true, align: "center" }),
            ny: blessed.text({ parent: clockContainer, top: 14, left: "center", content: "", tags: true, align: "center" })
        };

        const focusables = [...Object.values(newsWidgets), signalsList, clockContainer];

        const updateScrollbar = (list, items) => {
            if (!list.scrollbar) return;
            const height = list.height - 2;
            if (items.length > height) list.scrollbar.show();
            else list.scrollbar.hide();
        };

        let renderPending = false;
        const debouncedRender = () => {
            if (renderPending) return;
            renderPending = true;
            setTimeout(() => {
                screen.render();
                renderPending = false;
            }, 10);
        };

        const updateFocusStyles = () => {
            [...focusables, statusBox].forEach(w => {
                if (w.style && w.style.border) w.style.border.fg = (screen.focused === w) ? "red" : "white";
            });
            debouncedRender();
        };

        focusables.forEach(w => {
            w.on("focus", updateFocusStyles);
            w.on("blur", updateFocusStyles);
        });

        const updateClocks = () => {
            const options = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
            const now = new Date();
            clocks.local.setContent(`{yellow-fg}LOCAL TIME{/yellow-fg}\n{white-fg}{bold}${now.toLocaleTimeString('zh-CN', options)}{/bold}{/white-fg}`);
            clocks.london.setContent(`{yellow-fg}LONDON (GMT){/yellow-fg}\n{white-fg}{bold}${now.toLocaleTimeString('en-GB', { ...options, timeZone: 'Europe/London' })}{/bold}{/white-fg}`);
            debouncedRender();
        };

        const cleanText = (text) => {
            if (!text) return "";
            return text.replace(/[\uD83C|\uD83D|\uD83E][\uDC00-\uDFFF]|[\u2600-\u27BF]|[\uD83C][\uDDE6-\uDDFF][\uD83C][\uDDE6-\uDDFF]/g, "").trim();
        };

        let activeDialog = null;

        const showDetail = (data, categoryName) => {
            if (activeDialog) {
                activeDialog.destroy();
                activeDialog = null;
            }

            const dialog = blessed.box({
                parent: screen,
                top: "center",
                left: "center",
                width: "75%",
                height: "70%",
                border: "line",
                label: ` {bold}${categoryName || "Detail"}{/bold} `,
                style: {
                    border: { fg: "red" },
                    bg: "black"
                },
                shadow: true,
                tags: true,
                keys: true,
                vi: true,
                padding: 1,
                zIndex: 200
            });

            activeDialog = dialog;

            const content = blessed.scrollabletext({
                parent: dialog,
                top: 0,
                left: 0,
                width: "100%-2",
                height: "100%-3",
                content: data.fullText,
                tags: true,
                keys: true,
                vi: true,
                wrap: true, // 开启换行防止溢出
                scrollbar: { ch: " ", track: { bg: "red" }, style: { inverse: true } }
            });

            const closeBtn = blessed.box({
                parent: dialog,
                bottom: 0,
                left: "center",
                width: 14,
                height: 1,
                content: " CLOSE [ESC] ",
                align: "center",
                style: {
                    bg: "red",
                    fg: "white",
                    bold: true
                },
                tags: true
            });

            const close = () => {
                if (!activeDialog) return;
                activeDialog.destroy();
                activeDialog = null;
                debouncedRender();
            };

            dialog.key(["escape", "enter"], close);
            
            dialog.focus();
            debouncedRender();
        };

        const getLabels = () => ({
            article: t("TYPE_ARTICLE"),
            breaking: t("TYPE_NEWS"),
            onchain: t("TYPE_ONCHAIN"),
            report: t("TYPE_REPORT")
        });

        const refreshData = async () => {
            const memUsage = (process.memoryUsage().rss / 1024 / 1024).toFixed(1);
            const lang = getLang();
            const statusStr = `{white-fg}{bold}MethodAlgo TUI{/bold}{/white-fg} | ` +
                `{white-fg}Status:{/white-fg} {green-fg}Running{/green-fg} | ` +
                `{white-fg}Update:{/white-fg} ${new Date().toLocaleTimeString()} | ` +
                `{white-fg}${lang === "zh" ? "内存" : "Memory"}:{/white-fg} {cyan-fg}${memUsage} MB{/cyan-fg} | ` +
                `{yellow-fg}${t("TUI_HINTS")}{/yellow-fg}`;
            statusBox.setContent(statusStr);

            try {
                const promises = [
                    ...Object.keys(newsWidgets).map(type => signedRequest("/mcp/news", { type, limit: 15, lang })),
                    signedRequest("/mcp/signals", { channelName: "golden-pit-mtf", limit: 15 })
                ];
                const results = await Promise.allSettled(promises);

                // 检查授权失败 (401 或 status=false 且包含 Auth 关键字)
                const authFailed = results.some(r => 
                    (r.status === "rejected" && r.reason?.response?.status === 401) ||
                    (r.status === "fulfilled" && r.value.data.status === false && (r.value.data.msg?.includes("auth") || r.value.data.msg?.includes("key")))
                );

                if (authFailed) {
                    clearInterval(progressInterval);
                    if (dataTimer) clearInterval(dataTimer);
                    loadingBox.removeAll();
                    loadingBox.append(logoBox);
                    blessed.text({
                        parent: loadingBox, top: "65%", left: "center", align: "center",
                        content: `{red-fg}{bold}!! ${t("ERR_AUTH_FAILED")} !!{/bold}{/red-fg}\n\n` +
                                 `{white-fg}${t("RECONFIG_TIP")}{/white-fg}\n\n` +
                                 `{yellow-fg}${t("GET_API_KEY_LINK")}{/yellow-fg}\n\n` +
                                 `{cyan-fg}[Press Q to Quit]{/cyan-fg}`,
                        tags: true
                    });
                    debouncedRender();
                    return;
                }

                Object.keys(newsWidgets).forEach((type, idx) => {
                    const res = results[idx];
                    if (res.status === "fulfilled" && res.value.data.status) {
                        const newData = res.value.data.data;
                        const existingTitles = new Set(caches[type].map(n => n.title[lang] || n.title["en"]));
                        const uniqueNew = newData.filter(n => !existingTitles.has(n.title[lang] || n.title["en"]));
                        caches[type] = [...uniqueNew, ...caches[type]].slice(0, 30);
                        const items = caches[type].map(item => {
                            const rawTitle = item.title[lang] || item.title["en"];
                            item.fullText = `Title: ${rawTitle}\n\nTime: ${item.publish_date}\n\nURL: ${item.url || "N/A"}\n\n--- Content ---\n${item.content || "No detailed content available."}`;
                            const title = cleanText(rawTitle);
                            item.displayTitle = title;
                            const time = new Date(item.publish_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                            return `{white-fg}[${time}]{/white-fg} ${title}`;
                        });
                        newsWidgets[type].setItems(items);
                        updateScrollbar(newsWidgets[type], items);
                    }
                });

                const sigRes = results[results.length - 1];
                if (sigRes.status === "fulfilled" && sigRes.value.data.status) {
                    const newData = sigRes.value.data.data;
                    const existingIds = new Set(caches.signals.map(s => s.id));
                    const uniqueNew = newData.filter(s => !existingIds.has(s.id));
                    caches.signals = [...uniqueNew, ...caches.signals].slice(0, 50);
                    const items = caches.signals.map(item => {
                        const sig = item.signals && item.signals[0];
                        const rawTitle = sig ? sig.title : (item.title || "Signal Tip");
                        item.fullText = `Signal: ${rawTitle}\n\nTimestamp: ${item.timestamp}\n\n--- Details ---\n${JSON.stringify(item.signals || item, null, 2)}`;
                        const title = cleanText(rawTitle);
                        item.displayTitle = title;
                        const time = new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        return `{white-fg}[${time}]{/white-fg} ${title}`;
                    });
                    signalsList.setItems(items);
                    updateScrollbar(signalsList, items);
                }
            } catch (err) {}

            if (!loadingBox.hidden) {
                clearInterval(progressInterval);
                loadingBox.hide(); mainArea.show(); statusBox.show();
                newsWidgets.article.focus();
            }
            debouncedRender();
        };

        // 事件绑定
        Object.keys(newsWidgets).forEach(type => {
            newsWidgets[type].on("select", (item) => {
                const index = newsWidgets[type].getItemIndex(item);
                const data = caches[type][index];
                const labels = getLabels();
                if (data) showDetail(data, labels[type]);
            });

            let lastClick = 0;
            newsWidgets[type].on("click", (data) => {
                const now = Date.now();
                if (now - lastClick < 300) {
                    const index = newsWidgets[type].selected;
                    const itemData = caches[type][index];
                    const labels = getLabels();
                    if (itemData) showDetail(itemData, labels[type]);
                }
                lastClick = now;
            });
        });
        
        let lastSigClick = 0;
        signalsList.on("click", (data) => {
            const now = Date.now();
            if (now - lastSigClick < 300) {
                const index = signalsList.selected;
                const itemData = caches.signals[index];
                if (itemData) showDetail(itemData, t("COL_SIGNALS"));
            }
            lastSigClick = now;
        });

        signalsList.on("select", (item) => {
            const index = signalsList.getItemIndex(item);
            const data = caches.signals[index];
            if (data) showDetail(data, t("COL_SIGNALS"));
        });

        screen.key(["escape", "q", "C-c"], () => {
            if (activeDialog) {
                activeDialog.destroy();
                activeDialog = null;
                debouncedRender();
                return;
            }
            process.exit(0);
        });
        screen.key(["tab"], () => {
            const currentIdx = focusables.indexOf(screen.focused);
            const nextIdx = (currentIdx + 1) % focusables.length;
            focusables[nextIdx].focus();
        });

        await refreshData();
        updateClocks();
        const dataTimer = setInterval(refreshData, 60000);
        const clockTimer = setInterval(updateClocks, 1000);
        screen.on("destroy", () => { clearInterval(dataTimer); clearInterval(clockTimer); });
        debouncedRender();
    });

export default dashboardCmd;
