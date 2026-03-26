import { Command } from "commander";
import chalk from "chalk";
import { signedRequest } from "../utils/api.js";
import logger from "../utils/logger.js";
import { t, getLang } from "../utils/i18n.js";

const signalsCmd = new Command("signals")
    .description(t("SIGNALS_DESC"))
    .argument("[channel]", t("ARG_CHANNEL_DESC") || "Channel name")
    .addHelpText("after", `\n${t("LABEL_EXAMPLE")}\n  $ ${t("SIGNALS_EXAMPLE")}\n\n${t("SIGNALS_CHANNELS")}`)
    .option("-l, --limit <number>", t("OPT_LIMIT_DESC"), "10")
    .option("-a, --after <id>", t("OPT_AFTER_DESC"))
    .option("--json", "Output raw JSON data")
    .addHelpText("after", `\n${t("SIGNALS_LIMIT_NOTE")}`)
    .action(async (channel, options) => {
        if (!channel) {
            signalsCmd.help();
            return;
        }
        try {
            const res = await signedRequest("/mcp/signals", { 
                channelName: channel, 
                limit: options.limit,
                after: options.after
            });
            const { status, data, message } = res.data;

            if (!status) {
                logger.error(`${t("ERR_NETWORK")}: ${message}`);
                return;
            }

            if (options.json) {
                if (channel === "token-unlock") {
                    const cleanData = data.map(item => {
                        const sig = item.signals && item.signals[0];
                        if (!sig) return item;
                        
                        const baseTime = new Date(item.timestamp).getTime();
                        const tokens = [];
                        for (const [key, value] of Object.entries(sig.details || {})) {
                            const keyMatch = key.match(/(.+)\s*-\s*(.+)\s*\n\s*In\s+(.+)/i);
                            if (!keyMatch) continue;

                            const symbol = keyMatch[1].trim();
                            const percent = keyMatch[2].trim();
                            const offsetStr = keyMatch[3].trim();

                            let offsetMs = 0;
                            const timeParts = offsetStr.match(/(\d+)\s*(Day|Hour|Min)/gi);
                            if (timeParts) {
                                timeParts.forEach(part => {
                                    const m = part.match(/(\d+)\s*(d|h|m)/i);
                                    if (m) {
                                        const v = parseInt(m[1]);
                                        const u = m[2].toLowerCase();
                                        if (u.startsWith("d")) offsetMs += v * 24 * 60 * 60 * 1000;
                                        else if (u.startsWith("h")) offsetMs += v * 60 * 60 * 1000;
                                        else if (u.startsWith("m")) offsetMs += v * 60 * 1000;
                                    }
                                });
                            }
                            const unlockTime = new Date(baseTime + offsetMs);
                            const diff = unlockTime.getTime() - Date.now();
                            let remaining = "Unlocked";
                            if (diff > 0) {
                                const rd = Math.floor(diff / (1000 * 60 * 60 * 24));
                                const rh = Math.floor((diff / (1000 * 60 * 60)) % 24);
                                const rm = Math.floor((diff / (1000 * 60)) % 60);
                                remaining = `In ${rd > 0 ? `${rd}d ` : ""}${rh > 0 ? `${rh}h ` : ""}${rm}m`;
                            }

                            let mcapPercent = "";
                            const vLines = value.replace(/```/g, "").trim().split("\n");
                            const circulationSupply = (vLines.find(l => l.includes("🔋")) || "").replace("🔋", "").trim();
                            const unlockingProgress = (vLines.find(l => l.includes("⌛")) || "").replace("⌛", "").trim();
                            const unlockingAmount = (vLines.find(l => l.includes("🔑")) || "").replace("🔑", "").trim();
                            const unlockingValueLine = vLines.find(l => l.includes("💰")) || "";
                            const vMatch = unlockingValueLine.match(/\((.+)\)/);
                            if (vMatch) mcapPercent = vMatch[1].replace("of M.Cap", "").trim();
                            const unlockingValue = unlockingValueLine.replace("💰", "").replace(/\s*\(.+\)/, "").trim();

                            tokens.push({
                                symbol, percent, unlockAt: unlockTime.toISOString(), remaining,
                                circulationSupply, unlockingProgress, unlockingAmount, unlockingValue, mcapPercent
                            });
                        }
                        return { ...item, tokens, signals: undefined }; // Simplify JSON
                    });
                    logger.json(cleanData);
                } else {
                    logger.json(data);
                }
            } else {
                logger.success(t("FETCH_SUCCESS", { count: data.length }));
                data.forEach((item, index) => {
                    const signals = (item.signals && item.signals.length > 0) ? item.signals : [{ title: item.title || item.content?.substring(0, 50) + "...", description: "", details: {} }];
                    const lang = getLang();
                    const date = new Date(item.timestamp).toLocaleString(lang === "zh" ? "zh-CN" : "en-US", {
                        hour12: false, month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit"
                    }).replace(/\//g, "-");

                    // 打印项目头部（如果只有一个信号且标题相同，可简化，但此处为了通用性保留索引）
                    if (channel !== "token-unlock") {
                        console.log(`\n${chalk.bold(`[${index + 1}]`)} ${chalk.dim(`(${date})`)}`);
                    }

                    signals.forEach((sig, sigIndex) => {
                        const title = sig.title;
                        const desc = sig.description || "";
                        const indent = channel === "token-unlock" ? "" : "    ";

                        if (channel !== "token-unlock") {
                            console.log(`${indent}${chalk.bold(title)}`);
                        }

                        if (channel.startsWith("breakout")) {
                            const breakPrice = sig?.details?.BreakPrice || sig?.breakPrice || sig?.break_price;
                            if (breakPrice) console.log(`${indent}    ${chalk.yellow(`BreakPrice: ${breakPrice}`)}`);
                        } else if (channel.startsWith("exhaustion")) {
                            const symbol = title.includes(" for ") ? title.split(" for ").pop()?.trim() : "";
                            if (symbol) console.log(`${indent}    ${chalk.green(`Symbol: ${symbol}`)}`);
                            const timeframe = sig?.details?.Timeframe || sig?.details?.timeframe;
                            const exhaustionSide = sig?.details?.["Exhaustion Side"] || sig?.details?.exhaustion_side;
                            if (timeframe) console.log(`${indent}    ${chalk.cyan(`Timeframe: ${timeframe}`)}`);
                            if (exhaustionSide) console.log(`${indent}    ${chalk.magenta(`Exhaustion Side: ${exhaustionSide}`)}`);
                        }
                        
                        if (channel === "token-unlock") {
                            // Token Unlock 特有逻辑（保持原样，但适配遍历环境）
                            if (sigIndex === 0) console.log(`\n${chalk.bold(`[${index + 1}] ${title}`)} ${chalk.dim(`(${date})`)}`);
                            const baseTime = new Date(item.timestamp).getTime();
                            let subIndex = 1;
                            for (const [key, value] of Object.entries(sig.details || {})) {
                                const keyMatch = key.match(/(.+)\s*-\s*(.+)\s*\n\s*In\s+(.+)/i);
                                if (!keyMatch) continue;
                                const token = keyMatch[1].trim();
                                const percent = keyMatch[2].trim();
                                const offsetStr = keyMatch[3].trim();
                                let offsetMs = 0;
                                const timeParts = offsetStr.match(/(\d+)\s*(Day|Hour|Min)/gi);
                                if (timeParts) {
                                    timeParts.forEach(part => {
                                        const m = part.match(/(\d+)\s*(d|h|m)/i);
                                        if (m) {
                                            const v = parseInt(m[1]);
                                            const u = m[2].toLowerCase();
                                            if (u.startsWith("d")) offsetMs += v * 24 * 60 * 60 * 1000;
                                            else if (u.startsWith("h")) offsetMs += v * 60 * 60 * 1000;
                                            else if (u.startsWith("m")) offsetMs += v * 60 * 1000;
                                        }
                                    });
                                }
                                const unlockTime = new Date(baseTime + offsetMs);
                                const diff = unlockTime.getTime() - Date.now();
                                let remainingStr = "";
                                if (diff <= 0) remainingStr = chalk.red("Unlocked / Ongoing");
                                else {
                                    const rd = Math.floor(diff / (1000 * 60 * 60 * 24));
                                    const rh = Math.floor((diff / (1000 * 60 * 60)) % 24);
                                    const rm = Math.floor((diff / (1000 * 60)) % 60);
                                    remainingStr = "In " + (rd > 0 ? `${rd}d ` : "") + (rh > 0 ? `${rh}h ` : "") + `${rm}m`;
                                }
                                let percentOfMCap = "";
                                const formattedValue = value.replace(/```/g, "").trim().split("\n")
                                    .map(line => {
                                        let l = line.trim();
                                        if (l.includes("💰") && l.includes("(") && l.includes(")")) {
                                            const pMatch = l.match(/\((.+)\)/);
                                            if (pMatch) {
                                                percentOfMCap = pMatch[1].replace("of M.Cap", "").trim();
                                                l = l.replace(/\s*\(.+\)/, "");
                                            }
                                        }
                                        l = l.replace(/🔋/g, "Circulation supply:  ")
                                             .replace(/⌛/g, "Unlocking progress:   ")
                                             .replace(/🔑/g, "Unlocking amount:     ")
                                             .replace(/💰/g, "Unlocking value:      ");
                                        return `    ${l}`;
                                    }).join("\n");
                                console.log(`\n    ${chalk.yellow.bold(`[${subIndex++}] Token: ${token}`)}`);
                                console.log(`    ${chalk.dim("Unlock At:")}            ${chalk.white(unlockTime.toLocaleString(lang === "zh" ? "zh-CN" : "en-US", { hour12: false, month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).replace(/\//g, "-"))} (${chalk.cyan(remainingStr)})`);
                                console.log(chalk.white(formattedValue));
                                if (percentOfMCap) console.log(`    ${chalk.white(`Percent:               ${percentOfMCap} of its Market Cap`)}`);
                            }
                        } else if (channel === "market-today") {
                            // Market Today 精细清洗逻辑
                            if (title === "Fear And Greed Index") {
                                if (sig?.details) {
                                    for (const [k, v] of Object.entries(sig.details)) {
                                        console.log(`${indent}    ${chalk.cyan(`${k}:`)} ${chalk.white(v)}`);
                                    }
                                }
                            } else if (sig?.details) {
                                // 其他子信号（如果有）显示 details
                                for (const [k, v] of Object.entries(sig.details)) {
                                    console.log(`${indent}    ${chalk.cyan(`${k}:`)} ${chalk.white(v)}`);
                                }
                            }
                        } else if (channel === "etf-tracker") {
                            if (sig?.details) {
                                for (const [k, v] of Object.entries(sig.details)) {
                                    console.log(`${indent}    ${chalk.cyan(`${k}:`)} ${chalk.white(v)}`);
                                }
                            }
                        }

                        // 描述处理：token-unlock 已处理
                        if (desc && channel !== "token-unlock") {
                            const cleanDesc = desc.replace(/```/g, "").trim().split("\n").map(l => `${indent}    ${l}`).join("\n");
                            if (cleanDesc) console.log(chalk.gray(cleanDesc));
                        }

                        // 图片/附件处理
                        const attachments = [...(sig.image ? [sig.image] : [])];
                        if (sigIndex === signals.length - 1 && item.attachments) {
                            attachments.push(...item.attachments);
                        }
                        if (attachments.length > 0) {
                            attachments.forEach(att => {
                                const url = typeof att === "string" ? att : (att.url || att.proxy_url);
                                if (url) console.log(`${indent}    ${chalk.blue.underline(url)}`);
                            });
                        }
                    });
                });
                console.log("");
            }
        } catch (error) {
            logger.error(`Signals Error: ${error.message}`);
        }
    });

export default signalsCmd;
