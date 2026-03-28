import React from "react";
import { Box, Text } from "ink";
import { Spinner } from "./Spinner.js";
import { gradientText } from "../../utils/dashboard-utils.js";
import { BANNER } from "../../utils/constants.js";

const h = React.createElement;

export const LoadingScreen = () => (
    h(Box, { flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%" },
        h(Box, { marginBottom: 1 }, h(Text, null, BANNER)),
        h(Spinner, { color: "red" }),
        h(Box, { gap: 1, marginTop: 1 },
            ...gradientText("MethodAlgo Market Intelligence Dashboard...", [255, 60, 60], [255, 255, 255])
        )
    )
);
