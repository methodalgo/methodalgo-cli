import React from "react";
import { Box, Text } from "ink";
import { t } from "../../utils/i18n.js";
import { gradientText } from "../../utils/dashboard-utils.js";

const h = React.createElement;

const CACHED_GRADIENT = gradientText("MethodAlgo Dashboard", [255, 0, 0], [255, 255, 255]);

export const StatusLine = ({ statusInfo }) => {
    const hints = t("TUI_HINTS");
    const safeStatus = statusInfo || {};
    const mem = safeStatus.mem ?? "0";
    
    return h(Box, { 
        borderStyle: "single", 
        borderColor: "red", 
        height: 3, 
        paddingX: 1, 
        alignItems: "center",
        overflow: "hidden"
    },
        h(Text, null, CACHED_GRADIENT),
        h(Text, { color: "gray" }, " | "),
        h(Text, { color: "cyan" }, `📡 Updated: ${safeStatus.time || "--"}`),
        h(Text, { color: "gray" }, " | Mem: "),
        h(Text, null, `${mem} MB`),
        h(Text, { color: "gray" }, " | "),
        h(Text, { color: "yellow" }, hints),
        safeStatus.error && h(Text, { color: "red", wrap: "truncate" }, ` | ${safeStatus.error}`)
    );
};
