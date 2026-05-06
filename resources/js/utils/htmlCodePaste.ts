function longestBacktickRun(value: string) {
    const runs = value.match(/`+/g) ?? [];

    return runs.reduce((longest, run) => Math.max(longest, run.length), 0);
}

export function looksLikeHtmlSource(value: string) {
    const trimmed = value.trim();

    if (trimmed === "") {
        return false;
    }

    if (/^<>\s*[\s\S]*<\/>$/.test(trimmed)) {
        return true;
    }

    if (/^<!doctype\s+html[\s>]/i.test(trimmed)) {
        return true;
    }

    if (/^<\?xml[\s>]/i.test(trimmed)) {
        return true;
    }

    if (/^<!--[\s\S]*-->$/.test(trimmed)) {
        return true;
    }

    return /^<\/?[a-z][a-z0-9:-]*(?:\s|\/?>)/i.test(trimmed);
}

export function htmlSourceToMarkdownCode(value: string) {
    if (!looksLikeHtmlSource(value)) {
        return null;
    }

    const source = value.trim();
    const fence = "`".repeat(Math.max(3, longestBacktickRun(source) + 1));

    return `${fence}html\n${source}\n${fence}`;
}
