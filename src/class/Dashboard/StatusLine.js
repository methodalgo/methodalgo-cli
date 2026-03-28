import React from "react";
import { Box, Text } from "ink";
import { t } from "../../utils/i18n.js";

const h = React.createElement;

export const StatusLine = ({ statusInfo }) => (
    h(Box, { borderStyle: "single", borderColor: "red", height: 3, paddingX: 1, alignItems: "center" },
        h(Text, { color: "red", bold: true }, "MethodAlgo Dashboard"),
        h(Text, { color: "gray" }, " | "),
        h(Text, null, `${statusInfo.time} | ${statusInfo.mem} MB`),
        h(Text, { color: "gray" }, " | "),
        h(Text, { color: "yellow" }, t("TUI_HINTS")),
        statusInfo.error && h(Text, { color: "red", wrap: "truncate" }, ` | ${statusInfo.error}`)
    )
);
