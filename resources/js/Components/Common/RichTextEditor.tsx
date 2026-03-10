import { useCallback, useEffect, useRef, useState } from "react";
import { Crepe, CrepeFeature } from "@milkdown/crepe";
import { editorViewCtx } from "@milkdown/core";
import { Milkdown, MilkdownProvider, useEditor, useInstance } from "@milkdown/react";
import { callCommand, insert } from "@milkdown/kit/utils";
import {
    toggleStrongCommand,
    toggleEmphasisCommand,
    toggleInlineCodeCommand,
    wrapInHeadingCommand,
    wrapInBlockquoteCommand,
    wrapInBulletListCommand,
    wrapInOrderedListCommand,
    createCodeBlockCommand,
    turnIntoTextCommand,
} from "@milkdown/kit/preset/commonmark";
import {
    toggleStrikethroughCommand,
} from "@milkdown/kit/preset/gfm";
import {
    undoCommand,
    redoCommand,
} from "@milkdown/kit/plugin/history";
import "@milkdown/crepe/theme/common/style.css";
import "@milkdown/crepe/theme/frame.css";
import "@milkdown/crepe/theme/frame-dark.css";
import { useThemeMode } from "@/Contexts/ThemeContext";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import FormatBold from "@mui/icons-material/FormatBold";
import FormatItalic from "@mui/icons-material/FormatItalic";
import FormatStrikethrough from "@mui/icons-material/FormatStrikethrough";
import FormatQuote from "@mui/icons-material/FormatQuote";
import CodeIcon from "@mui/icons-material/Code";
import LinkIcon from "@mui/icons-material/Link";
import FormatListBulleted from "@mui/icons-material/FormatListBulleted";
import FormatListNumbered from "@mui/icons-material/FormatListNumbered";
import Checklist from "@mui/icons-material/Checklist";
import UndoIcon from "@mui/icons-material/Undo";
import RedoIcon from "@mui/icons-material/Redo";
import DataObject from "@mui/icons-material/DataObject";
import SourceIcon from "@mui/icons-material/IntegrationInstructions";
import SvgIcon from "@mui/material/SvgIcon";
import Popover from "@mui/material/Popover";
import InputAdornment from "@mui/material/InputAdornment";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import axios from "axios";

function HeadingIcon({ fontSize }: { fontSize?: "small" | "medium" | "inherit" }) {
    return (
        <SvgIcon fontSize={fontSize}>
            <path d="M4 4v16h3v-6h6v6h3V4h-3v7H7V4z" />
        </SvgIcon>
    );
}

interface RichTextEditorProps {
    content: string;
    onChange: (markdown: string) => void;
    placeholder?: string;
    editable?: boolean;
    uploadImageUrl?: string;
    minHeight?: number;
}

interface ToolbarState {
    bold: boolean;
    italic: boolean;
    strike: boolean;
    code: boolean;
    blockquote: boolean;
    bulletList: boolean;
    orderedList: boolean;
    blockType: string; // "paragraph" | "heading-1" .. "heading-6" | "code_block" etc.
}

const defaultToolbarState: ToolbarState = {
    bold: false,
    italic: false,
    strike: false,
    code: false,
    blockquote: false,
    bulletList: false,
    orderedList: false,
    blockType: "paragraph",
};

function getToolbarState(editor: ReturnType<ReturnType<typeof useInstance>[1]>): ToolbarState {
    if (!editor) return defaultToolbarState;

    try {
        return editor.action((ctx) => {
            const view = ctx.get(editorViewCtx);
            const { state } = view;
            const { from, $from } = state.selection;

            // Check active marks
            const storedMarks = state.storedMarks || state.selection.$from.marks();
            const hasMark = (name: string) =>
                storedMarks.some((m) => m.type.name === name) ||
                state.doc.rangeHasMark(from, state.selection.to, state.schema.marks[name]!);

            // Determine block type
            const parentNode = $from.parent;
            let blockType = "paragraph";
            if (parentNode.type.name === "heading") {
                blockType = `heading-${parentNode.attrs.level as number}`;
            } else if (parentNode.type.name === "code_block") {
                blockType = "code_block";
            }

            // Check if inside blockquote or list
            let inBlockquote = false;
            let inBulletList = false;
            let inOrderedList = false;
            for (let d = $from.depth; d > 0; d--) {
                const node = $from.node(d);
                if (node.type.name === "blockquote") inBlockquote = true;
                if (node.type.name === "bullet_list") inBulletList = true;
                if (node.type.name === "ordered_list") inOrderedList = true;
            }

            return {
                bold: hasMark("strong"),
                italic: hasMark("emphasis"),
                strike: hasMark("strikethrough"),
                code: hasMark("inlineCode"),
                blockquote: inBlockquote,
                bulletList: inBulletList,
                orderedList: inOrderedList,
                blockType,
            };
        });
    } catch {
        return defaultToolbarState;
    }
}

function Toolbar({ sourceMode, onToggleSource }: { sourceMode: boolean; onToggleSource: () => void }) {
    const [loading, getInstance] = useInstance();
    const [activeState, setActiveState] = useState<ToolbarState>(defaultToolbarState);
    const rafRef = useRef<number>(0);
    const [linkAnchor, setLinkAnchor] = useState<null | HTMLElement>(null);
    const [linkUrl, setLinkUrl] = useState("https://");
    const linkInputRef = useRef<HTMLInputElement>(null);

    // Poll editor state on animation frames to track selection changes
    useEffect(() => {
        if (loading || sourceMode) return;

        let mounted = true;
        const poll = () => {
            if (!mounted) return;
            const editor = getInstance();
            if (editor) {
                const next = getToolbarState(editor);
                setActiveState((prev) => {
                    if (
                        prev.bold !== next.bold ||
                        prev.italic !== next.italic ||
                        prev.strike !== next.strike ||
                        prev.code !== next.code ||
                        prev.blockquote !== next.blockquote ||
                        prev.bulletList !== next.bulletList ||
                        prev.orderedList !== next.orderedList ||
                        prev.blockType !== next.blockType
                    ) {
                        return next;
                    }
                    return prev;
                });
            }
            rafRef.current = requestAnimationFrame(poll);
        };
        rafRef.current = requestAnimationFrame(poll);

        return () => {
            mounted = false;
            cancelAnimationFrame(rafRef.current);
        };
    }, [loading, getInstance, sourceMode]);

    const run = useCallback(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (cmd: any, payload?: any) => {
            if (loading) return;
            const editor = getInstance();
            editor?.action(callCommand(cmd, payload));
        },
        [loading, getInstance],
    );

    const activeSx = {
        color: "primary.main",
        bgcolor: "action.selected",
    };

    const preventFocus = (e: React.MouseEvent) => e.preventDefault();

    const btn = (
        label: string,
        icon: React.ReactNode,
        action: (e: React.MouseEvent<HTMLButtonElement>) => void,
        active = false,
        disabled = false,
    ) => (
        <Tooltip title={label} key={label}>
            <span>
                <IconButton
                    size="small"
                    onMouseDown={preventFocus}
                    onClick={action}
                    aria-label={label}
                    disabled={disabled}
                    sx={{
                        color: "text.secondary",
                        borderRadius: 1,
                        "&:hover": { color: "text.primary" },
                        ...(active ? activeSx : {}),
                    }}
                >
                    {icon}
                </IconButton>
            </span>
        </Tooltip>
    );

    const sep = <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />;

    const isHeading = activeState.blockType.startsWith("heading-");

    return (
        <Box
            role="toolbar"
            aria-label="Text formatting"
            sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.25,
                px: 0.5,
                py: 0.25,
            }}
        >
            {btn("Heading", <HeadingIcon fontSize="small" />, () => {
                if (isHeading) {
                    run(turnIntoTextCommand.key);
                } else {
                    run(wrapInHeadingCommand.key, 3);
                }
            }, isHeading, sourceMode)}
            {btn("Bold", <FormatBold fontSize="small" />, () =>
                run(toggleStrongCommand.key), activeState.bold, sourceMode,
            )}
            {btn("Italic", <FormatItalic fontSize="small" />, () =>
                run(toggleEmphasisCommand.key), activeState.italic, sourceMode,
            )}
            {btn("Strikethrough", <FormatStrikethrough fontSize="small" />, () =>
                run(toggleStrikethroughCommand.key), activeState.strike, sourceMode,
            )}
            {btn("Inline Code", <CodeIcon fontSize="small" />, () =>
                run(toggleInlineCodeCommand.key), activeState.code, sourceMode,
            )}
            {sep}
            {btn("Quote", <FormatQuote fontSize="small" />, () =>
                run(wrapInBlockquoteCommand.key), activeState.blockquote, sourceMode,
            )}
            {btn("Bullet List", <FormatListBulleted fontSize="small" />, () =>
                run(wrapInBulletListCommand.key), activeState.bulletList, sourceMode,
            )}
            {btn("Numbered List", <FormatListNumbered fontSize="small" />, () =>
                run(wrapInOrderedListCommand.key), activeState.orderedList, sourceMode,
            )}
            {btn("Task List", <Checklist fontSize="small" />, () => {
                if (loading) return;
                const editor = getInstance();
                if (!editor) return;
                editor.action(insert("- [ ] "));
            }, false, sourceMode)}
            {sep}
            {btn("Link", <LinkIcon fontSize="small" />, (e) => {
                setLinkUrl("https://");
                setLinkAnchor(e.currentTarget as HTMLElement);
                setTimeout(() => linkInputRef.current?.select(), 50);
            }, false, sourceMode)}
            <Popover
                open={Boolean(linkAnchor)}
                anchorEl={linkAnchor}
                onClose={() => setLinkAnchor(null)}
                anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
                transformOrigin={{ vertical: "top", horizontal: "left" }}
                slotProps={{ paper: { sx: { p: 1.5, display: "flex", gap: 1, alignItems: "center" } } }}
            >
                <TextField
                    inputRef={linkInputRef}
                    size="small"
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            e.preventDefault();
                            if (linkUrl && linkUrl !== "https://") {
                                const editor = getInstance();
                                if (editor) editor.action(insert(`[link](${linkUrl})`));
                            }
                            setLinkAnchor(null);
                        } else if (e.key === "Escape") {
                            setLinkAnchor(null);
                        }
                    }}
                    placeholder="https://example.com"
                    slotProps={{
                        input: {
                            startAdornment: (
                                <InputAdornment position="start">
                                    <LinkIcon fontSize="small" sx={{ color: "text.secondary" }} />
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
                    onClick={() => {
                        if (linkUrl && linkUrl !== "https://") {
                            const editor = getInstance();
                            if (editor) editor.action(insert(`[link](${linkUrl})`));
                        }
                        setLinkAnchor(null);
                    }}
                >
                    Insert
                </Button>
            </Popover>
            {btn("Code Block", <DataObject fontSize="small" />, () =>
                run(createCodeBlockCommand.key), false, sourceMode,
            )}
            {sep}
            {btn("Undo", <UndoIcon fontSize="small" />, () =>
                run(undoCommand.key), false, sourceMode,
            )}
            {btn("Redo", <RedoIcon fontSize="small" />, () =>
                run(redoCommand.key), false, sourceMode,
            )}
            <Box sx={{ flex: 1 }} />
            {btn("Source", <SourceIcon fontSize="small" />, onToggleSource, sourceMode)}
        </Box>
    );
}

function CrepeEditor({
    content,
    onChange,
    placeholder,
    editable,
    uploadImageUrl,
}: Omit<RichTextEditorProps, "minHeight">) {
    const imageUploadHandler = useCallback(
        async (file: File): Promise<string> => {
            if (!uploadImageUrl) {
                throw new Error("Image upload not configured");
            }
            const formData = new FormData();
            formData.append("image", file);
            const response = await axios.post(uploadImageUrl, formData, {
                headers: { "Content-Type": "multipart/form-data" },
            });
            return response.data.url;
        },
        [uploadImageUrl],
    );

    useEditor((root) => {
        const crepe = new Crepe({
            root,
            defaultValue: content,
            features: {
                [CrepeFeature.Latex]: false,
                [CrepeFeature.Toolbar]: false,
            },
            featureConfigs: {
                [CrepeFeature.Placeholder]: {
                    text: placeholder,
                },
                [CrepeFeature.ImageBlock]: uploadImageUrl
                    ? { onUpload: imageUploadHandler }
                    : undefined,
            },
        });

        if (!editable) {
            crepe.setReadonly(true);
        }

        crepe.on((listener) => {
            listener.markdownUpdated((_ctx, markdown) => {
                onChange(markdown);
            });
        });

        return crepe;
    }, []);

    return <Milkdown />;
}

export default function RichTextEditor(props: RichTextEditorProps) {
    const {
        placeholder = "Write something...",
        editable = true,
        minHeight = 200,
    } = props;
    const { resolvedMode } = useThemeMode();
    const isDark = resolvedMode === "dark";
    const [sourceMode, setSourceMode] = useState(false);
    const [sourceValue, setSourceValue] = useState("");
    const editorKey = useRef(0);

    const handleToggleSource = useCallback(() => {
        if (!sourceMode) {
            // Entering source mode — snapshot current markdown
            setSourceValue(props.content);
        } else {
            // Leaving source mode — push edits back & remount editor
            props.onChange(sourceValue);
            editorKey.current += 1;
        }
        setSourceMode((prev) => !prev);
    }, [sourceMode, sourceValue, props]);

    return (
        <Box
            className={isDark ? "dark" : ""}
            sx={{
                borderRadius: "10px",
                border: "1px solid",
                borderColor: isDark
                    ? "rgba(255,255,255,0.16)"
                    : "rgba(0,0,0,0.23)",
                overflow: "hidden",
                "&:hover": {
                    borderColor: isDark
                        ? "rgba(255,255,255,0.30)"
                        : "rgba(0,0,0,0.40)",
                },
                "&:focus-within": {
                    borderColor: isDark ? "#818cf8" : "#6366f1",
                    boxShadow: isDark
                        ? "0 0 0 1px #818cf8"
                        : "0 0 0 1px #6366f1",
                },
                "& .milkdown": {
                    "--crepe-color-background": isDark
                        ? "#1f1f1f"
                        : "#ffffff",
                    "--crepe-color-on-background": isDark
                        ? "rgba(255,255,255,0.87)"
                        : "rgba(0,0,0,0.87)",
                    "--crepe-color-surface": isDark ? "#262626" : "#f5f5f5",
                    "--crepe-color-surface-low": isDark
                        ? "#1a1a1a"
                        : "#fafafa",
                    "--crepe-color-on-surface": isDark
                        ? "rgba(255,255,255,0.70)"
                        : "rgba(0,0,0,0.70)",
                    "--crepe-color-on-surface-variant": isDark
                        ? "rgba(255,255,255,0.55)"
                        : "rgba(0,0,0,0.55)",
                    "--crepe-color-outline": isDark
                        ? "rgba(255,255,255,0.16)"
                        : "rgba(0,0,0,0.23)",
                    "--crepe-color-primary": isDark ? "#818cf8" : "#6366f1",
                    "--crepe-color-secondary": isDark
                        ? "rgba(129,140,248,0.15)"
                        : "rgba(99,102,241,0.10)",
                    "--crepe-color-on-secondary": isDark
                        ? "#a5b4fc"
                        : "#4f46e5",
                    "--crepe-color-inverse": isDark ? "#e5e5e5" : "#1a1a1a",
                    "--crepe-color-on-inverse": isDark
                        ? "#1a1a1a"
                        : "#e5e5e5",
                    "--crepe-color-inline-code": isDark
                        ? "#a5b4fc"
                        : "#6366f1",
                    "--crepe-color-error": isDark ? "#f87171" : "#dc2626",
                    "--crepe-color-hover": isDark ? "#2e2e2e" : "#f0f0f0",
                    "--crepe-color-selected": isDark
                        ? "rgba(129,140,248,0.18)"
                        : "rgba(99,102,241,0.12)",
                    "--crepe-color-inline-area": isDark
                        ? "#2b2b2b"
                        : "#e8e8e8",
                    "--crepe-font-title":
                        '"Inter", "Helvetica Neue", "Arial", sans-serif',
                    "--crepe-font-default":
                        '"Inter", "Helvetica Neue", "Arial", sans-serif',
                    "--crepe-font-code":
                        '"Fira Code", "JetBrains Mono", monospace',
                    border: "none",
                    borderRadius: 0,
                    overflow: "visible",
                },
                "& .milkdown .editor": {
                    minHeight,
                    padding: "16px",
                },
                "& .milkdown .editor h1, & .milkdown .editor h2, & .milkdown .editor h3, & .milkdown .editor h4, & .milkdown .editor h5, & .milkdown .editor h6":
                    {
                        "&:first-child": { marginTop: 0 },
                        marginTop: "12px",
                    },
            }}
        >
            <MilkdownProvider>
                {editable && (
                    <Box
                        sx={{
                            bgcolor: isDark ? "#1a1a1a" : "#fafafa",
                            borderBottom: 1,
                            borderColor: isDark
                                ? "rgba(255,255,255,0.10)"
                                : "rgba(0,0,0,0.12)",
                        }}
                    >
                        <Toolbar
                            sourceMode={sourceMode}
                            onToggleSource={handleToggleSource}
                        />
                    </Box>
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
                                    fontFamily: '"Fira Code", "JetBrains Mono", monospace',
                                    fontSize: 13,
                                    lineHeight: 1.6,
                                    minHeight,
                                    alignItems: "flex-start",
                                    p: 2,
                                },
                            },
                        }}
                        sx={{
                            "& .MuiOutlinedInput-notchedOutline": { border: "none" },
                        }}
                    />
                ) : (
                    <CrepeEditor
                        key={editorKey.current}
                        {...props}
                        placeholder={placeholder}
                        editable={editable}
                    />
                )}
            </MilkdownProvider>
        </Box>
    );
}
