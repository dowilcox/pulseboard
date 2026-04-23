import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";
import { sanitizeRichText } from "@/utils/sanitizeRichText";

const HTML_TAG_PATTERN =
    /<\/?(?:a|blockquote|br|code|del|div|em|h[1-6]|hr|img|input|label|li|ol|p|pre|s|span|strong|table|tbody|td|th|thead|tr|u|ul)\b[^>]*>/i;
const BLOCK_HTML_TAG_PATTERN =
    /<\/?(?:blockquote|div|h[1-6]|li|ol|p|pre|table|tbody|td|th|thead|tr|ul)\b[^>]*>/i;

function createTurndownService(): TurndownService {
    const td = new TurndownService({
        headingStyle: "atx",
        codeBlockStyle: "fenced",
        fence: "```",
        bulletListMarker: "-",
        emDelimiter: "*",
        strongDelimiter: "**",
    });
    td.use(gfm);
    td.addRule("removeEmptyLinks", {
        filter: (node) =>
            node.nodeName === "A" &&
            !node.textContent?.trim() &&
            !node.querySelector("img"),
        replacement: () => "",
    });
    return td;
}

const turndown = createTurndownService();

function decodeHtmlEntities(value: string) {
    if (typeof document === "undefined") {
        return value;
    }

    const textarea = document.createElement("textarea");
    textarea.innerHTML = value;
    return textarea.value;
}

function stripHtml(value: string) {
    return decodeHtmlEntities(value.replace(/<[^>]*>/g, "")).trim();
}

function attributeValue(markup: string, attribute: string) {
    const match = markup.match(
        new RegExp(`\\b${attribute}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i"),
    );
    return match ? decodeHtmlEntities(match[2] ?? match[3] ?? "") : "";
}

function replaceMentionSpans(content: string) {
    return content.replace(
        /<span\b(?=[^>]*\bdata-type\s*=\s*["']mention["'])[^>]*>[\s\S]*?<\/span>/gi,
        (markup) => {
            const visibleText = stripHtml(markup);
            if (visibleText) {
                return visibleText;
            }

            const label = attributeValue(markup, "data-label").replace(
                /^@/,
                "",
            );
            return label ? `@${label}` : "";
        },
    );
}

function escapeLinkText(value: string) {
    return value.replace(/([\\\]])/g, "\\$1");
}

function replaceInlineHtml(content: string) {
    return content
        .replace(/<img\b[^>]*>/gi, (markup) => {
            const src = attributeValue(markup, "src");
            if (!src) {
                return "";
            }

            const alt = attributeValue(markup, "alt");
            return `![${escapeLinkText(alt)}](${src})`;
        })
        .replace(/<a\b[^>]*>[\s\S]*?<\/a>/gi, (markup) => {
            const href = attributeValue(markup, "href");
            const text = stripHtml(markup);

            if (!href) {
                return text;
            }

            return `[${escapeLinkText(text || href)}](${href})`;
        })
        .replace(
            /<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/gi,
            (_markup, _tag, value: string) => `**${stripHtml(value)}**`,
        )
        .replace(
            /<(em|i)\b[^>]*>([\s\S]*?)<\/\1>/gi,
            (_markup, _tag, value: string) => `*${stripHtml(value)}*`,
        )
        .replace(
            /<(del|s)\b[^>]*>([\s\S]*?)<\/\1>/gi,
            (_markup, _tag, value: string) => `~~${stripHtml(value)}~~`,
        )
        .replace(
            /<code\b[^>]*>([\s\S]*?)<\/code>/gi,
            (_markup, value: string) => `\`${stripHtml(value)}\``,
        )
        .replace(/<\/?u\b[^>]*>/gi, "");
}

export function richTextToShareMarkdown(content: string | null | undefined) {
    const sanitized = sanitizeRichText(content);
    if (!sanitized.trim()) {
        return "";
    }

    const readableMarkdown = replaceMentionSpans(sanitized).replace(
        /<br\s*\/?>/gi,
        "\n",
    );

    if (!HTML_TAG_PATTERN.test(readableMarkdown)) {
        return readableMarkdown.trim();
    }

    const trimmedMarkdown = readableMarkdown.trim();
    if (
        trimmedMarkdown.startsWith("<") ||
        BLOCK_HTML_TAG_PATTERN.test(trimmedMarkdown)
    ) {
        return turndown.turndown(readableMarkdown).trim();
    }

    return replaceInlineHtml(readableMarkdown).trim();
}
