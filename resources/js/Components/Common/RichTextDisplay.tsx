import { useEffect, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableCell } from "@tiptap/extension-table-cell";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import {
    MarkdownParagraph,
    MentionWithMarkdown,
} from "@/Components/Common/richTextExtensions";
import { Markdown } from "tiptap-markdown";
import { createLowlight, common } from "lowlight";
import { sanitizeRichText } from "@/utils/sanitizeRichText";
import { harborHex } from "@/theme/harbor";
import Box from "@mui/material/Box";
import { useTheme } from "@mui/material/styles";

const lowlight = createLowlight(common);

interface RichTextDisplayProps {
    content: string;
    ariaLabel?: string;
    /**
     * When provided, task list checkboxes become interactive in the read-only
     * view and this is called with the updated markdown after each toggle.
     */
    onChange?: (markdown: string) => void;
}

export default function RichTextDisplay({
    content,
    ariaLabel = "Rich text content",
    onChange,
}: RichTextDisplayProps) {
    const theme = useTheme();
    const sanitizedContent = sanitizeRichText(content);

    // The editor is created once; keep the latest callback reachable from
    // the extension/editorProps closures.
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;
    // Markdown we last emitted from a checkbox toggle. When the parent echoes
    // it back as `content`, the doc is already in that state and a full
    // setContent would only rebuild every node view.
    const lastEmittedRef = useRef<string | null>(null);

    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                paragraph: false,
                codeBlock: false,
                link: false,
            }),
            MarkdownParagraph,
            Image,
            Link.configure({
                openOnClick: true,
                autolink: true,
                linkOnPaste: true,
                defaultProtocol: "https",
            }),
            TaskList,
            TaskItem.configure({
                nested: true,
                // TipTap reverts the checkbox in read-only mode unless this
                // returns true. The document update itself happens in the
                // `change` DOM handler below, which knows which item fired.
                onReadOnlyChecked: () => Boolean(onChangeRef.current),
            }),
            Table,
            TableRow,
            TableHeader,
            TableCell,
            CodeBlockLowlight.configure({ lowlight }),
            MentionWithMarkdown.configure({
                HTMLAttributes: { class: "mention" },
            }),
            Markdown.configure({ html: true }),
        ],
        content: sanitizedContent,
        editable: false,
        // Fires for the checkbox transaction dispatched below (the editor is
        // read-only, so nothing else mutates the doc).
        onUpdate: ({ editor: ed }) => {
            const handler = onChangeRef.current;
            if (!handler) return;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const md: string = (ed.storage as any).markdown.getMarkdown();
            lastEmittedRef.current = sanitizeRichText(md);
            handler(md);
        },
        editorProps: {
            attributes: {
                "aria-label": ariaLabel,
            },
            handleDOMEvents: {
                change: (view, event) => {
                    const target = event.target;
                    if (
                        !onChangeRef.current ||
                        !(target instanceof HTMLInputElement) ||
                        target.type !== "checkbox"
                    ) {
                        return false;
                    }

                    // The TaskItem node view renders a bare <li data-checked>
                    // (no data-type), so match the nearest list item and
                    // confirm the node type from the resolved position.
                    const item = target.closest("li");
                    if (!item) return false;

                    try {
                        const $pos = view.state.doc.resolve(
                            view.posAtDOM(item, 0),
                        );
                        let itemPos: number | null = null;
                        for (let depth = $pos.depth; depth > 0; depth--) {
                            if ($pos.node(depth).type.name === "taskItem") {
                                itemPos = $pos.before(depth);
                                break;
                            }
                        }
                        const node =
                            itemPos === null
                                ? null
                                : view.state.doc.nodeAt(itemPos);
                        if (itemPos === null || !node) {
                            throw new Error("task item not found");
                        }

                        view.dispatch(
                            view.state.tr.setNodeMarkup(itemPos, undefined, {
                                ...node.attrs,
                                checked: target.checked,
                            }),
                        );
                        return true;
                    } catch {
                        // Keep the DOM in step with the document: the node
                        // view already accepted the click via
                        // onReadOnlyChecked, so undo it.
                        target.checked = !target.checked;
                        return false;
                    }
                },
            },
        },
    });

    const interactive = Boolean(onChange);

    useEffect(() => {
        if (!editor || sanitizedContent === undefined) return;
        if (sanitizedContent === lastEmittedRef.current) return;
        lastEmittedRef.current = null;
        editor.commands.setContent(sanitizedContent, { emitUpdate: false });
    }, [sanitizedContent, editor]);

    if (content == null) return null;

    return (
        <Box
            sx={{
                "& .tiptap": {
                    outline: "none",
                    "& h1": {
                        ...theme.typography.h4,
                        mt: 2,
                        mb: 1,
                        "&:first-of-type": { mt: 0 },
                    },
                    "& h2": {
                        ...theme.typography.h5,
                        mt: 2,
                        mb: 1,
                        "&:first-of-type": { mt: 0 },
                    },
                    "& h3": {
                        ...theme.typography.h6,
                        mt: 2,
                        mb: 1,
                        "&:first-of-type": { mt: 0 },
                    },
                    "& p": { ...theme.typography.body1, my: 0.5 },
                    "& p:last-child:has(.ProseMirror-trailingBreak)": {
                        display: "none",
                    },
                    "& ul, & ol": { pl: 3 },
                    '& ul[data-type="taskList"]': {
                        listStyle: "none",
                        pl: 0,
                        "& li": {
                            display: "flex",
                            alignItems: "flex-start",
                            gap: 1,
                            "& label": { mt: 0.25, flexShrink: 0 },
                            "& > div": { flex: 1, minWidth: 0 },
                            '& input[type="checkbox"]': {
                                accentColor: theme.palette.primary.main,
                                width: 16,
                                height: 16,
                                mt: 0.5,
                                cursor: interactive ? "pointer" : "default",
                            },
                        },
                    },
                    "& pre": {
                        bgcolor: "action.hover",
                        fontFamily: "monospace",
                        p: 2,
                        borderRadius: 1,
                        overflow: "auto",
                        "& code": {
                            background: "none",
                            p: 0,
                            fontSize: "0.875rem",
                        },
                    },
                    "& code": {
                        bgcolor: "action.hover",
                        px: 0.5,
                        py: 0.25,
                        borderRadius: 0.5,
                        fontFamily: "monospace",
                        fontSize: "0.875rem",
                    },
                    "& img": { maxWidth: "100%", borderRadius: "4px" },
                    "& a": {
                        color: "primary.main",
                        textDecoration: "underline",
                    },
                    "& .mention": {
                        // Audited pair — primary.main on the tint falls just
                        // short of 4.5:1, so use the darker indigo
                        color: harborHex.accentDark,
                        bgcolor: "rgba(57, 89, 166, 0.12)",
                        borderRadius: "4px",
                        px: 0.25,
                        fontWeight: 600,
                    },
                    "& blockquote": {
                        borderLeft: 3,
                        borderColor: "divider",
                        pl: 2,
                        ml: 0,
                        color: "text.secondary",
                    },
                    "& hr": { borderColor: "divider", my: 2 },
                    "& table": {
                        borderCollapse: "collapse",
                        width: "100%",
                        my: 1,
                        "& th, & td": {
                            border: 1,
                            borderColor: "divider",
                            px: 1.5,
                            py: 0.75,
                            textAlign: "left",
                            verticalAlign: "top",
                        },
                        "& th": {
                            fontWeight: 600,
                            bgcolor: "action.hover",
                        },
                    },
                },
            }}
        >
            <EditorContent editor={editor} />
        </Box>
    );
}
