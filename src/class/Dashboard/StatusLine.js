import React from "react";
import { Box, Text } from "ink";
import { t } from "../../utils/i18n.js";
import { gradientText } from "../../utils/dashboard-utils.js";

const h = React.createElement;

export const StatusLine = ({ statusInfo }) => (
    h(Box, { borderStyle: "single", borderColor: "red", height: 3, paddingX: 1, alignItems: "center" },
        h(Text, null, gradientText("MethodAlgo Dashboard", [255, 0, 0], [255, 255, 255])),
        h(Text, { color: "gray" }, " | "),
        h(Text, { color: "cyan" }, `📡 Updated: ${statusInfo.time}`),
        h(Text, { color: "gray" }, " | Mem: "),
        h(Text, null, `${statusInfo.mem} MB`),
        h(Text, { color: "gray" }, " | "),
        h(Text, { color: "yellow" }, t("TUI_HINTS")),
        statusInfo.error && h(Text, { color: "red", wrap: "truncate" }, ` | ${statusInfo.error}`)
    )
);
