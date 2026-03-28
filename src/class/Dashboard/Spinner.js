import React, { useState, useEffect } from "react";
import { Text } from "ink";

const h = React.createElement;
const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export const Spinner = ({ color = "red" }) => {
    const [frame, setFrame] = useState(0);
    useEffect(() => {
        const t = setInterval(() => setFrame(f => (f + 1) % SPINNER_FRAMES.length), 80);
        return () => clearInterval(t);
    }, []);
    return h(Text, { color, bold: true }, SPINNER_FRAMES[frame]);
};
