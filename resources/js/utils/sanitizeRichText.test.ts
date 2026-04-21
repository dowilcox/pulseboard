import { describe, expect, it } from "vitest";
import { sanitizeRichText } from "./sanitizeRichText";

describe("sanitizeRichText", () => {
    it("removes dangerous blocks and event handlers", () => {
        expect(
            sanitizeRichText(
                '<p onclick="alert(1)">safe</p><script>alert(1)</script>',
            ),
        ).toBe("<p>safe</p>");
    });

    it("drops unsafe urls from links and images", () => {
        expect(
            sanitizeRichText(
                '<a href="javascript:alert(1)" target="_blank">bad</a>' +
                    '<img src="data:text/html;base64,boom" alt="x">',
            ),
        ).toBe(
            '<a target="_blank" rel="noopener noreferrer">bad</a><img alt="x">',
        );
    });

    it("preserves safe links and locks checkboxes down", () => {
        expect(
            sanitizeRichText(
                '<a href="https://example.com" target="_blank">docs</a>' +
                    '<input type="checkbox" checked>',
            ),
        ).toBe(
            '<a href="https://example.com" target="_blank" rel="noopener noreferrer">docs</a>' +
                '<input type="checkbox" checked disabled>',
        );
    });

    it("preserves safe relative links", () => {
        expect(
            sanitizeRichText(
                '<a href="./replies">replies</a>' +
                    '<a href="../history">history</a>' +
                    '<a href="?comment=1">thread</a>',
            ),
        ).toBe(
            '<a href="./replies">replies</a>' +
                '<a href="../history">history</a>' +
                '<a href="?comment=1">thread</a>',
        );
    });

    it("preserves markdown autolinks", () => {
        expect(
            sanitizeRichText(
                "Visit <https://example.com/docs> or <http://localhost:8000/test>.",
            ),
        ).toBe(
            "Visit <https://example.com/docs> or <http://localhost:8000/test>.",
        );
    });
});
