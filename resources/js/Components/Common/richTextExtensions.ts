import Paragraph from "@tiptap/extension-paragraph";
import Mention from "@tiptap/extension-mention";

/**
 * Paragraph node that serializes empty paragraphs as `<br>` so blank lines
 * survive the markdown round-trip. Shared by the editor and the read-only
 * display so both produce identical markdown for the same document.
 */
export const MarkdownParagraph = Paragraph.extend({
    addStorage() {
        return {
            markdown: {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                serialize(state: any, node: any) {
                    const isEmpty =
                        node.childCount === 0 ||
                        (node.childCount === 1 &&
                            node.firstChild?.type.name === "hardBreak");
                    if (isEmpty) {
                        state.write("<br>");
                        state.closeBlock(node);
                    } else {
                        state.renderInline(node);
                        state.closeBlock(node);
                    }
                },
                parse: {
                    // handled by markdown-it
                },
            },
        };
    },
});

/**
 * Mention node that serializes to the `<span data-type="mention">` HTML
 * form that `MentionParser` expects on the server.
 */
export const MentionWithMarkdown = Mention.extend({
    addStorage() {
        return {
            markdown: {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                serialize(state: any, node: any) {
                    const id = node.attrs.id ?? "";
                    const label = node.attrs.label ?? "";
                    state.write(
                        `<span data-type="mention" data-id="${id}" data-label="${label}">@${label}</span>`,
                    );
                },
                parse: {
                    // HTML parsing handled by Mention.parseHTML + html:true
                },
            },
        };
    },
});
