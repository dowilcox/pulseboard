const VOID_TAGS = new Set(["br", "hr", "img", "input"]);

const ALLOWED_TAGS: Record<string, string[]> = {
    a: ["href", "target", "rel"],
    blockquote: [],
    br: [],
    code: [],
    del: [],
    div: [],
    em: [],
    h1: [],
    h2: [],
    h3: [],
    h4: [],
    h5: [],
    h6: [],
    hr: [],
    img: ["src", "alt", "title"],
    input: ["type", "checked"],
    label: [],
    li: ["data-type", "data-checked"],
    ol: [],
    p: [],
    pre: [],
    s: [],
    span: ["data-type", "data-id", "data-label"],
    strong: [],
    table: [],
    tbody: [],
    td: [],
    th: [],
    thead: [],
    tr: [],
    u: [],
    ul: ["data-type"],
};

function escapeAttribute(value: string) {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll('"', "&quot;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
}

const NAMED_ENTITIES: Record<string, string> = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    nbsp: "\u00a0",
    Tab: "\t",
    NewLine: "\n",
};

function decodeHtmlEntities(value: string): string {
    return value.replace(
        /&(#[xX][0-9a-fA-F]+|#[0-9]+|[a-zA-Z][a-zA-Z0-9]+);/g,
        (match, entity: string) => {
            if (entity.charAt(0) === "#") {
                const isHex = entity.charAt(1) === "x" || entity.charAt(1) === "X";
                const codePoint = isHex
                    ? parseInt(entity.slice(2), 16)
                    : parseInt(entity.slice(1), 10);

                if (!Number.isFinite(codePoint) || codePoint < 0 || codePoint > 0x10ffff) {
                    return match;
                }

                try {
                    return String.fromCodePoint(codePoint);
                } catch {
                    return match;
                }
            }

            const named = NAMED_ENTITIES[entity];
            return named !== undefined ? named : match;
        },
    );
}

function isSafeUrl(value: string) {
    const normalized = decodeHtmlEntities(value.trim()).trim();

    if (
        normalized === "" ||
        normalized.startsWith("#") ||
        normalized.startsWith("/")
    ) {
        return true;
    }

    return /^(https?:|mailto:|tel:)/i.test(normalized);
}

function sanitizeAttributes(tag: string, rawAttributes: string) {
    const allowedAttributes = ALLOWED_TAGS[tag] ?? [];
    const attributes: string[] = [];
    const attributeRegex =
        /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

    let match: RegExpExecArray | null;
    while ((match = attributeRegex.exec(rawAttributes)) !== null) {
        const name = match[1].toLowerCase();
        const value = match[2] ?? match[3] ?? match[4] ?? "";

        if (!allowedAttributes.includes(name) || name.startsWith("on")) {
            continue;
        }

        if (
            (tag === "a" && name === "href") ||
            (tag === "img" && name === "src")
        ) {
            if (!isSafeUrl(value)) {
                continue;
            }
        }

        if (tag === "a" && name === "target") {
            if (value !== "_blank" && value !== "_self") {
                continue;
            }
        }

        if (tag === "input") {
            if (name === "type" && value.toLowerCase() !== "checkbox") {
                continue;
            }

            if (
                name === "checked" &&
                value !== "" &&
                value.toLowerCase() !== "checked" &&
                value.toLowerCase() !== "true"
            ) {
                continue;
            }
        }

        if (name === "checked" && value === "") {
            attributes.push("checked");
            continue;
        }

        attributes.push(`${name}="${escapeAttribute(value)}"`);
    }

    if (tag === "a" && attributes.includes('target="_blank"')) {
        attributes.push('rel="noopener noreferrer"');
    }

    if (tag === "input") {
        if (!attributes.includes('type="checkbox"')) {
            return [];
        }

        attributes.push("disabled");
    }

    return [...new Set(attributes)];
}

export function sanitizeRichText(content: string | null | undefined) {
    if (content == null || content === "") {
        return content ?? "";
    }

    const withoutDangerousBlocks = content
        .replace(/\0/g, "")
        .replace(
            /<\s*(script|style|iframe|object|embed|meta|link|base)\b[^>]*>.*?<\s*\/\s*\1\s*>/gis,
            "",
        )
        .replace(/<!--.*?-->/gs, "");

    return withoutDangerousBlocks.replace(
        /<\s*(\/?)\s*([a-zA-Z0-9:-]+)([^>]*)>/gs,
        (_match, closing: string, rawTag: string, rawAttributes: string) => {
            const tag = rawTag.toLowerCase();

            if (!(tag in ALLOWED_TAGS)) {
                return "";
            }

            if (closing === "/") {
                return VOID_TAGS.has(tag) ? "" : `</${tag}>`;
            }

            const attributes = sanitizeAttributes(tag, rawAttributes ?? "");
            const attributeString =
                attributes.length > 0 ? ` ${attributes.join(" ")}` : "";

            return `<${tag}${attributeString}>`;
        },
    );
}
