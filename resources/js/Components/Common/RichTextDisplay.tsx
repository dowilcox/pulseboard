import { useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableCell } from "@tiptap/extension-table-cell";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import Mention from "@tiptap/extension-mention";
import { Markdown } from "tiptap-markdown";
import { createLowlight, common } from "lowlight";
import { sanitizeRichText } from "@/utils/sanitizeRichText";
import Box from "@mui/material/Box";
import { useTheme } from "@mui/material/styles";

const lowlight = createLowlight(common);

interface RichTextDisplayProps {
    content: string;
}

export default function RichTextDisplay({ content }: RichTextDisplayProps) {
    const theme = useTheme();
    const sanitizedContent = sanitizeRichText(content);

    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                codeBlock: false,
                link: { openOnClick: true },
            }),
            Image,
            TaskList,
            TaskItem.configure({ nested: true }),
            Table,
            TableRow,
            TableHeader,
            TableCell,
            CodeBlockLowlight.configure({ lowlight }),
            Mention.configure({ HTMLAttributes: { class: "mention" } }),
            Markdown.configure({ html: true }),
        ],
        content: sanitizedContent,
        editable: false,
    });

    useEffect(() => {
        if (editor && sanitizedContent !== undefined) {
            editor.commands.setContent(sanitizedContent);
        }
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
                            "& label": { mt: 0.25 },
                            '& input[type="checkbox"]': {
                                accentColor: theme.palette.primary.main,
                                width: 16,
                                height: 16,
                                mt: 0.5,
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
                        color: "primary.main",
                        bgcolor: "primary.50",
                        borderRadius: "4px",
                        px: 0.25,
                        fontWeight: 600,
                        ...(theme.palette.mode === "dark" && {
                            bgcolor: "rgba(25, 118, 210, 0.15)",
                        }),
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
