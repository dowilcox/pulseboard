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
import { getCrepeThemeVars, crepeHeadingSx } from "./crepeTheme";
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
    heading: boolean;
}

const defaultToolbarState: ToolbarState = {
    bold: false,
    italic: false,
    strike: false,
    code: false,
    blockquote: false,
    bulletList: false,
    orderedList: false,
    heading: false,
};

function getToolbarState(editor: ReturnType<ReturnType<typeof useInstance>[1]>): ToolbarState {
    if (!editor) return defaultToolbarState;

    try {
        return editor.action((ctx) => {
            const view = ctx.get(editorViewCtx);
            const { state } = view;
            const { from, $from } = state.selection;

            const storedMarks = state.storedMarks || $from.marks();
            const hasMark = (name: string) => {
                const markType = state.schema.marks[name];
                if (!markType) return false;
                return (
                    storedMarks.some((m) => m.type.name === name) ||
                    state.doc.rangeHasMark(from, state.selection.to, markType)
                );
            };

            const parentNode = $from.parent;
            const heading = parentNode.type.name === "heading";

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
                heading,
            };
        });
    } catch {
        return defaultToolbarState;
    }
}

function Toolbar({ sourceMode, onToggleSource }: { sourceMode: boolean; onToggleSource: () => void }) {
    const [loading, getInstance] = useInstance();
    const [activeState, setActiveState] = useState<ToolbarState>(defaultToolbarState);
    const [linkAnchor, setLinkAnchor] = useState<null | HTMLElement>(null);
    const [linkUrl, setLinkUrl] = useState("https://");
    const linkInputRef = useRef<HTMLInputElement>(null);

    const updateState = useCallback(() => {
        const editor = getInstance();
        if (!editor) return;
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
                prev.heading !== next.heading
            ) {
                return next;
            }
            return prev;
        });
    }, [getInstance]);

    // Event-driven state updates instead of RAF polling
    useEffect(() => {
        if (loading || sourceMode) return;

        document.addEventListener("selectionchange", updateState);
        document.addEventListener("keyup", updateState);
        updateState();

        return () => {
            document.removeEventListener("selectionchange", updateState);
            document.removeEventListener("keyup", updateState);
        };
    }, [loading, updateState, sourceMode]);

    const focusEditor = useCallback(() => {
        const editor = getInstance();
        if (!editor) return;
        try {
            editor.action((ctx) => ctx.get(editorViewCtx).focus());
        } catch { /* editor may not be ready */ }
    }, [getInstance]);

    const run = useCallback(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (cmd: any, payload?: any) => {
            if (loading) return;
            const editor = getInstance();
            editor?.action(callCommand(cmd, payload));
            requestAnimationFrame(updateState);
        },
        [loading, getInstance, updateState],
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

    const insertLink = useCallback(() => {
        if (linkUrl && linkUrl !== "https://") {
            const editor = getInstance();
            if (editor) editor.action(insert(`[link](${linkUrl})`));
        }
        setLinkAnchor(null);
        requestAnimationFrame(focusEditor);
    }, [linkUrl, getInstance, focusEditor]);

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
                if (activeState.heading) {
                    run(turnIntoTextCommand.key);
                } else {
                    run(wrapInHeadingCommand.key, 3);
                }
            }, activeState.heading, sourceMode)}
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
                requestAnimationFrame(updateState);
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
                onClose={() => {
                    setLinkAnchor(null);
                    requestAnimationFrame(focusEditor);
                }}
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
                            insertLink();
                        } else if (e.key === "Escape") {
                            setLinkAnchor(null);
                            requestAnimationFrame(focusEditor);
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
                    onClick={insertLink}
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
    // Use ref for onChange so the Milkdown listener always calls the latest callback
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;

    const [, getInstance] = useInstance();

    const imageUploadHandler = useCallback(
        async (file: File): Promise<string> => {
            if (!uploadImageUrl) {
                throw new Error("Image upload not configured");
            }
            const formData = new FormData();
            formData.append("image", file);
            const response = await axios.post(uploadImageUrl, formData);
            return response.data.url;
        },
        [uploadImageUrl],
    );

    const handleImageFiles = useCallback(
        async (files: FileList) => {
            if (!uploadImageUrl) return false;
            const imageFiles = Array.from(files).filter((f) =>
                f.type.startsWith("image/"),
            );
            if (imageFiles.length === 0) return false;

            for (const file of imageFiles) {
                try {
                    const url = await imageUploadHandler(file);
                    const editor = getInstance();
                    if (editor) {
                        editor.action(insert(`![${file.name}](${url})`));
                    }
                } catch (err) {
                    console.error("Image upload failed:", err);
                }
            }
            return true;
        },
        [uploadImageUrl, imageUploadHandler, getInstance],
    );

    const hasImageFiles = (files: FileList) =>
        uploadImageUrl && Array.from(files).some((f) => f.type.startsWith("image/"));

    const handleDrop = useCallback(
        (e: React.DragEvent) => {
            if (!e.dataTransfer?.files.length || !hasImageFiles(e.dataTransfer.files)) return;
            e.preventDefault();
            e.stopPropagation();
            handleImageFiles(e.dataTransfer.files);
        },
        [handleImageFiles, hasImageFiles],
    );

    const handlePaste = useCallback(
        (e: React.ClipboardEvent) => {
            if (!e.clipboardData?.files.length || !hasImageFiles(e.clipboardData.files)) return;
            e.preventDefault();
            e.stopPropagation();
            handleImageFiles(e.clipboardData.files);
        },
        [handleImageFiles, hasImageFiles],
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
                onChangeRef.current(markdown);
            });
        });

        return crepe;
    }, []);

    return (
        <div onDrop={handleDrop} onPaste={handlePaste}>
            <Milkdown />
        </div>
    );
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
    const pendingContent = useRef(props.content);

    // Keep pendingContent in sync with props when not in source mode
    useEffect(() => {
        if (!sourceMode) {
            pendingContent.current = props.content;
        }
    }, [props.content, sourceMode]);

    const handleToggleSource = useCallback(() => {
        if (!sourceMode) {
            setSourceValue(props.content);
        } else {
            props.onChange(sourceValue);
            pendingContent.current = sourceValue;
            editorKey.current += 1;
        }
        setSourceMode((prev) => !prev);
    }, [sourceMode, sourceValue, props.content, props.onChange]);

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
                    ...getCrepeThemeVars(isDark),
                    border: "none",
                    borderRadius: 0,
                    overflow: "visible",
                },
                "& .milkdown .editor": {
                    minHeight,
                    padding: "16px",
                },
                "& .milkdown .editor h1, & .milkdown .editor h2, & .milkdown .editor h3, & .milkdown .editor h4, & .milkdown .editor h5, & .milkdown .editor h6":
                    crepeHeadingSx,
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
                        content={pendingContent.current}
                        placeholder={placeholder}
                        editable={editable}
                    />
                )}
            </MilkdownProvider>
        </Box>
    );
}
