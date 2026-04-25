import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ReactRenderer, useEditor, EditorContent } from "@tiptap/react";
import Paragraph from "@tiptap/extension-paragraph";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Underline from "@tiptap/extension-underline";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableCell } from "@tiptap/extension-table-cell";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import Mention from "@tiptap/extension-mention";
import { Markdown } from "tiptap-markdown";
import { createLowlight, common } from "lowlight";
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";
import tippy, { type Instance as TippyInstance } from "tippy.js";
import MentionList, {
    type MentionListRef,
} from "@/Components/Common/MentionList";
import { sanitizeRichText } from "@/utils/sanitizeRichText";
import type { User } from "@/types";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import TextField from "@mui/material/TextField";
import { useTheme } from "@mui/material/styles";
import FormatBold from "@mui/icons-material/FormatBold";
import FormatItalic from "@mui/icons-material/FormatItalic";
import FormatUnderlined from "@mui/icons-material/FormatUnderlined";
import FormatStrikethrough from "@mui/icons-material/FormatStrikethrough";
import Title from "@mui/icons-material/Title";
import FormatListBulleted from "@mui/icons-material/FormatListBulleted";
import FormatListNumbered from "@mui/icons-material/FormatListNumbered";
import Checklist from "@mui/icons-material/Checklist";
import CodeIcon from "@mui/icons-material/Code";
import LinkIcon from "@mui/icons-material/Link";
import ImageIcon from "@mui/icons-material/Image";
import GridOnIcon from "@mui/icons-material/GridOn";
import SourceIcon from "@mui/icons-material/IntegrationInstructions";
import Popover from "@mui/material/Popover";
import InputAdornment from "@mui/material/InputAdornment";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import axios from "axios";

const lowlight = createLowlight(common);

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

/**
 * Custom paragraph extension that serializes empty paragraphs as <br> in
 * markdown so blank lines survive the save/reload roundtrip.  The default
 * prosemirror-markdown paragraph serializer silently discards them.
 */
const MarkdownParagraph = Paragraph.extend({
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
 * Custom Mention extension that serializes to HTML in markdown so mentions
 * survive the save/reload roundtrip.  The default Mention extension's
 * parseHTML rules recognise `<span data-type="mention">` which means the
 * HTML embedded in the markdown is parsed back into proper mention nodes.
 */
const MentionWithMarkdown = Mention.extend({
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

function createMentionSuggestion(users: User[]) {
    return {
        items: ({ query }: { query: string }) =>
            users
                .filter((u) =>
                    u.name.toLowerCase().includes(query.toLowerCase()),
                )
                .slice(0, 8),
        render: () => {
            let component: ReactRenderer<MentionListRef>;
            let popup: TippyInstance[];

            return {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                onStart: (props: any) => {
                    component = new ReactRenderer(MentionList, {
                        props,
                        editor: props.editor,
                    });
                    popup = tippy("body", {
                        getReferenceClientRect: props.clientRect,
                        appendTo: () => document.body,
                        content: component.element,
                        showOnCreate: true,
                        interactive: true,
                        trigger: "manual",
                        placement: "bottom-start",
                    });
                },
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                onUpdate: (props: any) => {
                    component.updateProps(props);
                    if (props.clientRect) {
                        popup[0].setProps({
                            getReferenceClientRect: props.clientRect,
                        });
                    }
                },
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                onKeyDown: (props: any) => {
                    if (props.event.key === "Escape") {
                        popup[0].hide();
                        return true;
                    }
                    return component.ref?.onKeyDown(props) ?? false;
                },
                onExit: () => {
                    popup[0].destroy();
                    component.destroy();
                },
            };
        },
    };
}

interface RichTextEditorProps {
    content: string;
    onChange: (markdown: string) => void;
    placeholder?: string;
    editable?: boolean;
    uploadImageUrl?: string;
    minHeight?: number;
    autoFocus?: boolean;
    mentionableUsers?: User[];
}

export default function RichTextEditor({
    content,
    onChange,
    placeholder = "Write something...",
    editable = true,
    uploadImageUrl,
    minHeight = 200,
    autoFocus = false,
    mentionableUsers = [],
}: RichTextEditorProps) {
    const theme = useTheme();
    const sanitizedContent = useMemo(
        () => sanitizeRichText(content),
        [content],
    );
    const fileInputRef = useRef<HTMLInputElement>(null);
    const turndown = useMemo(() => createTurndownService(), []);
    const [sourceMode, setSourceMode] = useState(false);
    const [sourceValue, setSourceValue] = useState("");
    const [linkAnchor, setLinkAnchor] = useState<null | HTMLElement>(null);
    const [linkUrl, setLinkUrl] = useState("https://");
    const linkInputRef = useRef<HTMLInputElement>(null);
    const [, setTick] = useState(0);
    const [imageUploadError, setImageUploadError] = useState<string | null>(
        null,
    );

    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                paragraph: false,
                codeBlock: false,
                underline: false,
            }),
            MarkdownParagraph,
            Image,
            Link.configure({
                openOnClick: false,
                autolink: true,
                linkOnPaste: true,
                defaultProtocol: "https",
            }),
            Placeholder.configure({ placeholder }),
            TaskList,
            TaskItem.configure({ nested: true }),
            Underline,
            Table.configure({ resizable: false }),
            TableRow,
            TableHeader,
            TableCell,
            CodeBlockLowlight.configure({ lowlight }),
            ...(mentionableUsers.length > 0
                ? [
                      MentionWithMarkdown.configure({
                          HTMLAttributes: { class: "mention" },
                          suggestion: createMentionSuggestion(mentionableUsers),
                      }),
                  ]
                : []),
            Markdown.configure({
                html: true,
                transformPastedText: true,
                transformCopiedText: true,
            }),
        ],
        content: sanitizedContent,
        editable,
        autofocus: autoFocus ? "end" : false,
        onUpdate: ({ editor: ed }) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const storage = ed.storage as any;
            const md = storage.markdown?.getMarkdown?.() ?? ed.getHTML();
            onChange(md);
        },
        editorProps: {
            attributes: {
                role: "textbox",
                "aria-multiline": "true",
                "aria-label": placeholder,
            },
            handlePaste: (_view, event) => {
                const clipboard = event.clipboardData;
                if (!clipboard) return false;

                // Handle image pastes
                for (const item of clipboard.items) {
                    if (item.type.startsWith("image/")) {
                        if (!uploadImageUrl) return false;
                        event.preventDefault();
                        const file = item.getAsFile();
                        if (file) uploadImage(file);
                        return true;
                    }
                }

                if (!editor) return false;

                // If clipboard has rich HTML (from web pages, GitLab, etc.),
                // convert to markdown first via Turndown.
                const html = clipboard.getData("text/html");
                const text = clipboard.getData("text/plain");
                let md: string | null = null;

                if (html) {
                    const hasRichContent =
                        /<(h[1-6]|ul|ol|li|pre|code|table|blockquote|img|a\s|strong|em|del|s)\b/i.test(
                            html,
                        );
                    if (hasRichContent) {
                        md = turndown.turndown(html);
                    }
                }

                // Use the plain text as markdown if no HTML conversion happened
                if (!md && text) {
                    // Check if the text looks like it contains markdown
                    const hasMarkdown =
                        /^(#{1,6}\s|[-*+]\s|\d+\.\s|```|>\s|\|.+\|)/m.test(
                            text,
                        );
                    if (hasMarkdown) {
                        md = text;
                    }
                }

                if (md) {
                    event.preventDefault();
                    // Parse markdown to HTML via the storage parser,
                    // then insert as HTML so TipTap creates proper nodes
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const storage = editor.storage as any;
                    const parsed = storage.markdown?.parser?.parse?.(md);
                    if (parsed) {
                        editor.commands.insertContent(parsed);
                    }
                    return true;
                }

                return false;
            },
            handleDrop: (_view, event, _slice, moved) => {
                if (moved || !uploadImageUrl) return false;
                const files = event.dataTransfer?.files;
                if (!files?.length) return false;
                const images = Array.from(files).filter((f) =>
                    f.type.startsWith("image/"),
                );
                if (!images.length) return false;
                event.preventDefault();
                images.forEach((file) => uploadImage(file));
                return true;
            },
        },
    });

    // Force toolbar re-render on selection changes so active states stay in sync
    useEffect(() => {
        if (!editor) return;
        const handler = () => setTick((t) => t + 1);
        editor.on("selectionUpdate", handler);
        return () => {
            editor.off("selectionUpdate", handler);
        };
    }, [editor]);

    const uploadImage = useCallback(
        async (file: File) => {
            if (!uploadImageUrl || !editor) return;
            const formData = new FormData();
            formData.append("image", file);
            try {
                const response = await axios.post(uploadImageUrl, formData, {
                    headers: { "Content-Type": "multipart/form-data" },
                });
                const url = response.data.url;
                if (url) {
                    editor.chain().focus().setImage({ src: url }).run();
                }
            } catch {
                setImageUploadError("Image upload failed. Please try again.");
            }
        },
        [uploadImageUrl, editor],
    );

    const handleLinkClick = useCallback(
        (e: React.MouseEvent<HTMLButtonElement>) => {
            if (!editor) return;
            const existing = editor.getAttributes("link").href;
            setLinkUrl(existing || "https://");
            setLinkAnchor(e.currentTarget);
            setTimeout(() => linkInputRef.current?.select(), 50);
        },
        [editor],
    );

    const insertLink = useCallback(() => {
        if (!editor) return;
        if (linkUrl && linkUrl !== "https://") {
            const { empty } = editor.state.selection;
            if (empty) {
                editor
                    .chain()
                    .focus()
                    .insertContent(`[link](${linkUrl})`)
                    .run();
            } else {
                editor
                    .chain()
                    .focus()
                    .extendMarkRange("link")
                    .setLink({ href: linkUrl })
                    .run();
            }
        }
        setLinkAnchor(null);
        editor.commands.focus();
    }, [linkUrl, editor]);

    const handleToggleSource = useCallback(() => {
        if (!sourceMode) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const storage = editor?.storage as any;
            const md =
                storage?.markdown?.getMarkdown?.() ?? editor?.getHTML() ?? "";
            setSourceValue(sanitizeRichText(md));
        } else if (editor) {
            const sanitizedSource = sanitizeRichText(sourceValue);
            editor.commands.setContent(sanitizedSource);
            onChange(sanitizedSource);
        }
        setSourceMode((prev) => !prev);
    }, [sourceMode, sourceValue, editor, onChange]);

    if (!editor && !sourceMode) return null;

    const toolbarButton = (
        label: string,
        icon: React.ReactNode,
        action: (e: React.MouseEvent<HTMLButtonElement>) => void,
        isActive: boolean,
    ) => (
        <Tooltip title={label} key={label}>
            <IconButton
                size="small"
                onClick={action}
                aria-label={label}
                aria-pressed={isActive}
                sx={{
                    color: isActive ? "primary.main" : "text.secondary",
                    bgcolor: isActive ? "action.selected" : "transparent",
                    borderRadius: 1,
                }}
            >
                {icon}
            </IconButton>
        </Tooltip>
    );

    return (
        <Box
            sx={{
                border: 1,
                borderColor:
                    theme.palette.mode === "dark"
                        ? "rgba(255,255,255,0.16)"
                        : "divider",
                borderRadius: 1,
                overflow: "hidden",
                bgcolor: "background.paper",
                "&:hover": {
                    borderColor:
                        theme.palette.mode === "dark"
                            ? "rgba(255,255,255,0.30)"
                            : "text.primary",
                },
                "&:focus-within": {
                    borderColor: "primary.main",
                    boxShadow: `0 0 0 1px ${theme.palette.primary.main}`,
                },
                "& .tiptap": {
                    p: 2,
                    minHeight,
                    outline: "none",
                    "& p.is-editor-empty:first-of-type::before": {
                        content: "attr(data-placeholder)",
                        color: "text.disabled",
                        float: "left",
                        height: 0,
                        pointerEvents: "none",
                    },
                    "& h1": { ...theme.typography.h4, mt: 2, mb: 1 },
                    "& h2": { ...theme.typography.h5, mt: 2, mb: 1 },
                    "& h3": { ...theme.typography.h6, mt: 2, mb: 1 },
                    "& p": { ...theme.typography.body1, my: 0.5 },
                    "&:not(:focus-within) > :not(:only-child):last-child:has(.ProseMirror-trailingBreak)":
                        {
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
                        cursor: "default",
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
            {editable && (
                <Box
                    role="toolbar"
                    aria-label="Text formatting"
                    sx={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 0.25,
                        p: 0.5,
                        bgcolor: "background.paper",
                        borderBottom: 1,
                        borderColor: "divider",
                    }}
                >
                    {toolbarButton(
                        "Bold",
                        <FormatBold fontSize="small" />,
                        () => editor.chain().focus().toggleBold().run(),
                        editor.isActive("bold"),
                    )}
                    {toolbarButton(
                        "Italic",
                        <FormatItalic fontSize="small" />,
                        () => editor.chain().focus().toggleItalic().run(),
                        editor.isActive("italic"),
                    )}
                    {toolbarButton(
                        "Underline",
                        <FormatUnderlined fontSize="small" />,
                        () => editor.chain().focus().toggleUnderline().run(),
                        editor.isActive("underline"),
                    )}
                    {toolbarButton(
                        "Strikethrough",
                        <FormatStrikethrough fontSize="small" />,
                        () => editor.chain().focus().toggleStrike().run(),
                        editor.isActive("strike"),
                    )}
                    {toolbarButton(
                        "Heading 1",
                        <Title fontSize="small" />,
                        () =>
                            editor
                                .chain()
                                .focus()
                                .toggleHeading({ level: 1 })
                                .run(),
                        editor.isActive("heading", { level: 1 }),
                    )}
                    {toolbarButton(
                        "Heading 2",
                        <Title fontSize="small" sx={{ fontSize: "1.1rem" }} />,
                        () =>
                            editor
                                .chain()
                                .focus()
                                .toggleHeading({ level: 2 })
                                .run(),
                        editor.isActive("heading", { level: 2 }),
                    )}
                    {toolbarButton(
                        "Heading 3",
                        <Title fontSize="small" sx={{ fontSize: "0.95rem" }} />,
                        () =>
                            editor
                                .chain()
                                .focus()
                                .toggleHeading({ level: 3 })
                                .run(),
                        editor.isActive("heading", { level: 3 }),
                    )}
                    {toolbarButton(
                        "Bullet List",
                        <FormatListBulleted fontSize="small" />,
                        () => editor.chain().focus().toggleBulletList().run(),
                        editor.isActive("bulletList"),
                    )}
                    {toolbarButton(
                        "Ordered List",
                        <FormatListNumbered fontSize="small" />,
                        () => editor.chain().focus().toggleOrderedList().run(),
                        editor.isActive("orderedList"),
                    )}
                    {toolbarButton(
                        "Task List",
                        <Checklist fontSize="small" />,
                        () => editor.chain().focus().toggleTaskList().run(),
                        editor.isActive("taskList"),
                    )}
                    {toolbarButton(
                        "Code Block",
                        <CodeIcon fontSize="small" />,
                        () => editor.chain().focus().toggleCodeBlock().run(),
                        editor.isActive("codeBlock"),
                    )}
                    {toolbarButton(
                        "Table",
                        <GridOnIcon fontSize="small" />,
                        () =>
                            editor
                                .chain()
                                .focus()
                                .insertTable({
                                    rows: 3,
                                    cols: 3,
                                    withHeaderRow: true,
                                })
                                .run(),
                        editor.isActive("table"),
                    )}
                    {toolbarButton(
                        "Link",
                        <LinkIcon fontSize="small" />,
                        handleLinkClick,
                        editor.isActive("link"),
                    )}
                    <Popover
                        open={Boolean(linkAnchor)}
                        anchorEl={linkAnchor}
                        onClose={() => {
                            setLinkAnchor(null);
                            editor.commands.focus();
                        }}
                        anchorOrigin={{
                            vertical: "bottom",
                            horizontal: "left",
                        }}
                        transformOrigin={{
                            vertical: "top",
                            horizontal: "left",
                        }}
                        slotProps={{
                            paper: {
                                sx: {
                                    p: 1.5,
                                    display: "flex",
                                    gap: 1,
                                    alignItems: "center",
                                },
                            },
                        }}
                    >
                        <TextField
                            inputRef={linkInputRef}
                            size="small"
                            value={linkUrl}
                            onChange={(e) => setLinkUrl(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    e.preventDefault();
                                    insertLink();
                                } else if (e.key === "Escape") {
                                    setLinkAnchor(null);
                                    editor.commands.focus();
                                }
                            }}
                            placeholder="https://example.com"
                            slotProps={{
                                input: {
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <LinkIcon
                                                fontSize="small"
                                                sx={{
                                                    color: "text.secondary",
                                                }}
                                            />
                                        </InputAdornment>
                                    ),
                                    sx: { fontSize: 13 },
                                },
                            }}
                            sx={{ width: 280 }}
                            autoFocus
                        />
                        <Button
                            size="small"
                            variant="contained"
                            disableElevation
                            onClick={insertLink}
                        >
                            Insert
                        </Button>
                        {editor.isActive("link") && (
                            <Button
                                size="small"
                                color="error"
                                onClick={() => {
                                    editor
                                        .chain()
                                        .focus()
                                        .extendMarkRange("link")
                                        .unsetLink()
                                        .run();
                                    setLinkAnchor(null);
                                }}
                            >
                                Remove
                            </Button>
                        )}
                    </Popover>
                    {uploadImageUrl &&
                        toolbarButton(
                            "Image",
                            <ImageIcon fontSize="small" />,
                            () => fileInputRef.current?.click(),
                            false,
                        )}
                    <Box sx={{ flex: 1 }} />
                    {toolbarButton(
                        "View Source",
                        <SourceIcon fontSize="small" />,
                        handleToggleSource,
                        sourceMode,
                    )}
                </Box>
            )}
            {imageUploadError && (
                <Alert
                    severity="error"
                    onClose={() => setImageUploadError(null)}
                    sx={{ m: 1 }}
                >
                    {imageUploadError}
                </Alert>
            )}
            {sourceMode ? (
                <TextField
                    multiline
                    fullWidth
                    value={sourceValue}
                    onChange={(e) => setSourceValue(e.target.value)}
                    placeholder={placeholder}
                    slotProps={{
                        input: {
                            sx: {
                                fontFamily:
                                    '"Fira Code", "JetBrains Mono", monospace',
                                fontSize: 13,
                                lineHeight: 1.6,
                                minHeight,
                                alignItems: "flex-start",
                                p: 2,
                            },
                        },
                    }}
                    sx={{
                        "& .MuiOutlinedInput-notchedOutline": {
                            border: "none",
                        },
                    }}
                />
            ) : (
                <EditorContent editor={editor} />
            )}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                        uploadImage(file);
                        e.target.value = "";
                    }
                }}
                style={{ display: "none" }}
            />
        </Box>
    );
}
