import { describe, expect, it } from "vitest";
import { htmlSourceToMarkdownCode, looksLikeHtmlSource } from "./htmlCodePaste";

describe("htmlCodePaste", () => {
    it("wraps pasted html source in a markdown code fence", () => {
        expect(
            htmlSourceToMarkdownCode(
                '<div class="card" id="main" data-state="open" aria-label="Dashboard"></div>',
            ),
        ).toBe(
            '```html\n<div class="card" id="main" data-state="open" aria-label="Dashboard"></div>\n```',
        );
    });

    it("supports jsx fragments and upper-case component tags", () => {
        expect(looksLikeHtmlSource('<><Button variant="solid" /></>')).toBe(
            true,
        );
        expect(looksLikeHtmlSource('<TaskCard data-id="123" />')).toBe(true);
    });

    it("does not treat markdown autolinks or comparisons as html source", () => {
        expect(looksLikeHtmlSource("<https://example.com/docs>")).toBe(false);
        expect(looksLikeHtmlSource("count < limit > warning")).toBe(false);
    });

    it("uses a longer fence when the pasted source contains backticks", () => {
        expect(htmlSourceToMarkdownCode("<div>```</div>")).toBe(
            "````html\n<div>```</div>\n````",
        );
    });
});
