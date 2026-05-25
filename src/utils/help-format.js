import chalk from "chalk";

const helpChalk = new chalk.Instance({ level: 1 });

export function helpSection(title, body = "") {
    return `${helpChalk.yellow(title)}${body ? `\n${body}` : ""}`;
}

export function helpExample(command) {
    return `  ${helpChalk.gray("$")} ${helpChalk.cyan(command)}`;
}

export function helpList(items) {
    return items.map(([key, value]) => `  ${helpChalk.yellow(key)}${value ? ` ${helpChalk.gray(value)}` : ""}`).join("\n");
}
