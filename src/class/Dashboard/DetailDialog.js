import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import chalk from "chalk";
import { getLang } from "../../utils/i18n.js";
import { formatTime } from "../../utils/dashboard-utils.js";

const h = React.createElement;

export const DetailDialog = ({ data, category, type, onClose }) => {
    const [scrollOffset, setScrollOffset] = useState(0);
    const termRows = process.stdout.rows || 40;
    const termCols = process.stdout.columns || 80;
    
    const sig = data.signals?.[0] || {};
    const title = sig.title || data.displayTitle || "";
    const lines = [];
    
    if (data.analysis) lines.push(chalk.yellow(`Analysis: ${data.analysis}`));
    
    const addLine = (k, v) => v && lines.push(`${chalk.cyan(k.padEnd(16))}: ${chalk.white(v)}`);

    if (type === "tokenUnlock") {
        addLine("Market Cap", data.marketCap);
        addLine("Progress", data.progress);
        addLine("Countdown", data.countDown || data.unlockTime || data.nextUnlock);
        addLine("Quantity", data.unlockValue || data.unlockTokenVal || data.unlockQuantity);
        addLine("Percentage", data.perc ? `${data.perc}%` : null);
    } else if (sig.details && Object.keys(sig.details).length > 0) {
        Object.entries(sig.details).forEach(([k, v]) => {
            if (!v) return;
            lines.push(`${chalk.cyan(k.padEnd(16))}: ${chalk.white(v)}`);
        });
    }

    // ── Image URL ──────────────────────
    const imgUrl = data.imageUrl || data.fileUrl || data.image_url;
    if (imgUrl) addLine("Image URL", imgUrl);

    const lang = getLang();
    const description = (sig.description || data.description?.[lang] || data.description?.en || data.description || data.content || "");
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
            h(Text, null, h(Text, { color: "gray" }, "Time: "), h(Text, { color: "cyan" }, formatTime(data.publish_date || data.timestamp || "N/A"))),
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
