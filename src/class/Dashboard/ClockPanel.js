import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";

const h = React.createElement;

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
        
        syncTime(); // Initialize the first timeout

        return () => clearTimeout(intervalId);
    }, []);

    const opts = { hour: "2-digit", minute: "2-digit", hour12: false };
    const bc = focused ? "red" : "white";
    const local = now.toLocaleTimeString("zh-CN", opts);
    const lse = now.toLocaleTimeString("en-GB", { ...opts, timeZone: "Europe/London" });
    const nyse = now.toLocaleTimeString("en-US", { ...opts, timeZone: "America/New_York" });
    
    return h(Box, { 
        flexDirection: "column", borderStyle: "single", borderColor: bc, 
        width: "100%", height: 4, paddingX: 1, overflow: "hidden" 
    },
        h(Box, { flexDirection: "row" },
            h(Text, { bold: true, color: "yellow" }, " 🕒 Market clock")
        ),
        h(Box, { width: "100%", overflow: "hidden" },
            h(Text, { wrap: "truncate" }, `${local} (L)  ${lse} (E)  ${nyse} (N)`)
        )
    );
};
