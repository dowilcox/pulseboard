import { richTextToShareMarkdown } from "@/utils/richTextMarkdown";
import CheckIcon from "@mui/icons-material/Check";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import IconButton, { type IconButtonProps } from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import { useEffect, useMemo, useRef, useState } from "react";

interface CopyMarkdownButtonProps extends Omit<
    IconButtonProps,
    "content" | "onClick"
> {
    content: string | null | undefined;
    "aria-label": string;
    tooltip?: string;
}

async function copyText(text: string) {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return;
    }

    if (typeof document === "undefined") {
        throw new Error("Clipboard is unavailable");
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.top = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    try {
        if (!document.execCommand("copy")) {
            throw new Error("Copy command failed");
        }
    } finally {
        document.body.removeChild(textarea);
    }
}

export default function CopyMarkdownButton({
    content,
    tooltip = "Copy Markdown",
    disabled,
    size = "small",
    ...buttonProps
}: CopyMarkdownButtonProps) {
    const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">(
        "idle",
    );
    const resetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const markdown = useMemo(() => richTextToShareMarkdown(content), [content]);
    const isDisabled = disabled || markdown.length === 0;

    useEffect(() => {
        return () => {
            if (resetTimeoutRef.current) {
                clearTimeout(resetTimeoutRef.current);
            }
        };
    }, []);

    const handleCopy = async () => {
        if (!markdown) return;

        try {
            await copyText(markdown);
            setCopyState("copied");
        } catch {
            setCopyState("failed");
        }

        if (resetTimeoutRef.current) {
            clearTimeout(resetTimeoutRef.current);
        }
        resetTimeoutRef.current = setTimeout(() => {
            setCopyState("idle");
            resetTimeoutRef.current = null;
        }, 1600);
    };

    const title =
        copyState === "copied"
            ? "Copied"
            : copyState === "failed"
              ? "Copy failed"
              : tooltip;

    return (
        <Tooltip title={title}>
            <span>
                <IconButton
                    {...buttonProps}
                    size={size}
                    disabled={isDisabled}
                    onClick={handleCopy}
                >
                    {copyState === "copied" ? (
                        <CheckIcon
                            color="success"
                            sx={{ fontSize: size === "small" ? 16 : 20 }}
                        />
                    ) : (
                        <ContentCopyIcon
                            sx={{ fontSize: size === "small" ? 16 : 20 }}
                        />
                    )}
                </IconButton>
            </span>
        </Tooltip>
    );
}
