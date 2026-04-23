import { describe, expect, it } from "vitest";
import { richTextToShareMarkdown } from "@/utils/richTextMarkdown";

describe("richTextToShareMarkdown", () => {
    it("preserves existing markdown", () => {
        expect(
            richTextToShareMarkdown(
                "# Heading\n\n- item\n\n[docs](https://example.com)",
            ),
        ).toBe("# Heading\n\n- item\n\n[docs](https://example.com)");
    });

    it("converts html to markdown", () => {
        expect(
            richTextToShareMarkdown(
                '<h2>Steps</h2><p>Read <strong>carefully</strong> at <a href="https://example.com">docs</a>.</p>',
            ),
        ).toBe(
            "## Steps\n\nRead **carefully** at [docs](https://example.com).",
        );
    });

    it("copies mention spans as readable text", () => {
        expect(
            richTextToShareMarkdown(
                'Thanks <span data-type="mention" data-id="1" data-label="Ada Lovelace">@Ada Lovelace</span>',
            ),
        ).toBe("Thanks @Ada Lovelace");
    });

    it("keeps markdown intact while converting inline html", () => {
        expect(
            richTextToShareMarkdown(
                'See **important** <a href="https://example.com/docs">docs</a> for <span data-type="mention" data-id="1" data-label="Ada Lovelace">@Ada Lovelace</span>.',
            ),
        ).toBe(
            "See **important** [docs](https://example.com/docs) for @Ada Lovelace.",
        );
    });
});
