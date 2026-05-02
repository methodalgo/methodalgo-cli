import React, { useEffect, useState } from "react";
import { Box, Text, useInput } from "ink";
import { t } from "../../utils/i18n.js";

const h = React.createElement;

export const CommandPalette = ({ commands = [], onClose }) => {
    const [query, setQuery] = useState("");
    const [selectedIdx, setSelectedIdx] = useState(0);
    const filteredCommands = filterPaletteCommands(commands, query);
    const visibleCommands = filteredCommands.slice(0, 10);

    useEffect(() => {
        setSelectedIdx(idx => clampPaletteIndex(idx, visibleCommands.length));
    }, [visibleCommands.length]);

    useInput((input, key) => {
        if (key.escape) {
            onClose?.();
            return;
        }
        if (key.backspace || key.delete) {
            setQuery(value => value.slice(0, -1));
            return;
        }
        if (key.upArrow) {
            setSelectedIdx(idx => clampPaletteIndex(idx - 1, visibleCommands.length));
            return;
        }
        if (key.downArrow) {
            setSelectedIdx(idx => clampPaletteIndex(idx + 1, visibleCommands.length));
            return;
        }
        if (key.return) {
            const command = visibleCommands[selectedIdx];
            if (command) {
                command.run?.();
                onClose?.();
            }
            return;
        }
        if (input && !key.ctrl && !key.meta && input.length === 1) {
            setQuery(value => `${value}${input}`);
        }
    });

    return h(Box, {
        flexDirection: "column",
        borderStyle: "single",
        borderColor: "red",
        paddingX: 1,
        height: Math.min(process.stdout.rows || 18, 18),
        width: "100%",
        overflow: "hidden"
    },
        h(Text, { bold: true, color: "red" }, t("TUI_PALETTE_TITLE")),
        h(Box, { borderStyle: "single", borderColor: "gray", height: 3, paddingX: 1, alignItems: "center" },
            h(Text, { color: query ? "white" : "gray", wrap: "truncate" }, `> ${query || t("TUI_PALETTE_PLACEHOLDER")}`)
        ),
        filteredCommands.length === 0
            ? h(Box, { flexGrow: 1, alignItems: "center", justifyContent: "center" },
                h(Text, { color: "gray" }, t("TUI_PALETTE_EMPTY"))
            )
            : visibleCommands.map((command, idx) => {
                const selected = idx === selectedIdx;
                return h(Box, { key: command.id, width: "100%", overflow: "hidden" },
                    h(Text, {
                        backgroundColor: selected ? "red" : undefined,
                        color: selected ? "white" : "white",
                        wrap: "truncate-end"
                    }, ` ${command.hint ? `[${command.hint}] ` : ""}${command.label}`)
                );
            }),
        h(Box, { marginTop: 1 },
            h(Text, { color: "gray" }, t("TUI_PALETTE_FOOTER"))
        )
    );
};

export function filterPaletteCommands(commands, query = "") {
    if (!Array.isArray(commands)) return [];
    const normalized = String(query || "").trim().toLowerCase();
    if (!normalized) return commands;
    const terms = normalized.split(/\s+/u).filter(Boolean);
    return commands.filter(command => {
        const haystack = [
            command.id,
            command.label,
            command.hint,
            command.keywords
        ].filter(Boolean).join(" ").toLowerCase();
        return terms.every(term => haystack.includes(term));
    });
}

export function clampPaletteIndex(index, length) {
    if (length <= 0) return 0;
    if (index < 0) return length - 1;
    if (index >= length) return 0;
    return index;
}
