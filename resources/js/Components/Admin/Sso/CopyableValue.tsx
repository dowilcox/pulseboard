import { copyText } from "@/Components/Common/CopyMarkdownButton";
import CheckIcon from "@mui/icons-material/Check";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import { useEffect, useRef, useState } from "react";

interface CopyableValueProps {
    label: string;
    value: string;
    helperText?: string;
}

/**
 * Read-only, monospace field with a copy button: for values the admin has
 * to paste into their identity provider (redirect URI, ACS URL...).
 */
export default function CopyableValue({
    label,
    value,
    helperText,
}: CopyableValueProps) {
    const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, []);

    const handleCopy = async () => {
        try {
            await copyText(value);
            setState("copied");
        } catch {
            setState("failed");
        }

        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => setState("idle"), 2000);
    };

    const tooltip =
        state === "copied"
            ? "Copied!"
            : state === "failed"
              ? "Copy failed"
              : "Copy to clipboard";

    return (
        <TextField
            label={label}
            value={value}
            helperText={helperText}
            fullWidth
            size="small"
            onFocus={(e) => e.target.select()}
            slotProps={{
                input: {
                    readOnly: true,
                    sx: { fontFamily: "monospace", fontSize: "0.85rem" },
                    endAdornment: (
                        <InputAdornment position="end">
                            <Tooltip title={tooltip}>
                                <IconButton
                                    onClick={handleCopy}
                                    edge="end"
                                    size="small"
                                    aria-label={`Copy ${label}`}
                                >
                                    {state === "copied" ? (
                                        <CheckIcon
                                            fontSize="small"
                                            color="success"
                                        />
                                    ) : (
                                        <ContentCopyIcon fontSize="small" />
                                    )}
                                </IconButton>
                            </Tooltip>
                        </InputAdornment>
                    ),
                },
            }}
        />
    );
}
