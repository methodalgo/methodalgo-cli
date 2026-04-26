import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";

const h = React.createElement;

const TIME_OPTS = { hour: "2-digit", minute: "2-digit", hour12: false };
const LSE_OPTS = { ...TIME_OPTS, timeZone: "Europe/London" };
const NYSE_OPTS = { ...TIME_OPTS, timeZone: "America/New_York" };

export const ClockPanel = ({ focused }) => {
    const [now, setNow] = useState(new Date());

    useEffect(() => {
        let intervalId;
        const syncTime = () => {
            const current = new Date();
            setNow(current);
            const msUntilNextMinute = (60 - current.getSeconds()) * 1000 - current.getMilliseconds();
            intervalId = setTimeout(syncTime, msUntilNextMinute);
        };
        
        syncTime();

        return () => clearTimeout(intervalId);
    }, []);

    const bc = focused ? "red" : "white";
    const local = now.toLocaleTimeString([], TIME_OPTS);
    const lse = now.toLocaleTimeString([], LSE_OPTS);
    const nyse = now.toLocaleTimeString([], NYSE_OPTS);
    
    return h(Box, { 
        flexDirection: "column", 
        borderStyle: "single", 
        borderColor: bc, 
        width: "100%", 
        height: 4, 
        paddingX: 1, 
        overflow: "hidden",
        flexShrink: 0
    },
        h(Box, { flexDirection: "row" },
            h(Text, { bold: true, color: "yellow" }, " 🕒 Market clock")
        ),
        h(Box, { width: "100%", overflow: "hidden" },
            h(Text, { wrap: "truncate" }, `LSE: ${lse}  NYSE: ${nyse}  LOCAL: ${local}`)
        )
    );
};
