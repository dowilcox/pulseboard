import { harbor, harborHex } from "@/theme/harbor";
import type { AutosaveStatus as Status } from "@/utils/autosaveQueue";
import CheckIcon from "@mui/icons-material/Check";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Tooltip from "@mui/material/Tooltip";

interface Props {
    status: Status;
    errorMessage?: string | null;
    onRetry: () => void;
}

/**
 * "Saving…" / "Saved" / "Couldn't save · Retry" indicator for autosaved
 * fields. The text lives in a polite live region so screen readers hear
 * state changes without stealing focus.
 */
export default function AutosaveStatus({
    status,
    errorMessage,
    onRetry,
}: Props) {
    return (
        <Box
            sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 0.75,
                minHeight: status === "idle" ? 0 : 30,
                fontSize: 12.5,
                fontWeight: 700,
                whiteSpace: "nowrap",
                color: status === "error" ? harbor.dangerText : harbor.sub,
            }}
        >
            <Box
                role="status"
                aria-live="polite"
                sx={{ display: "inline-flex", alignItems: "center", gap: 0.75 }}
            >
                {status === "saving" && (
                    <>
                        <CircularProgress
                            size={12}
                            thickness={6}
                            aria-hidden
                            sx={{ color: harbor.sub }}
                        />
                        Saving…
                    </>
                )}
                {status === "saved" && (
                    <>
                        <CheckIcon
                            aria-hidden
                            sx={{ fontSize: 15, color: harborHex.success }}
                        />
                        Saved
                    </>
                )}
                {status === "error" && (
                    <Tooltip title={errorMessage ?? ""}>
                        <Box
                            component="span"
                            sx={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 0.5,
                            }}
                        >
                            <ErrorOutlineIcon
                                aria-hidden
                                sx={{ fontSize: 15 }}
                            />
                            Couldn't save
                        </Box>
                    </Tooltip>
                )}
            </Box>
            {status === "error" && (
                <>
                    <Box component="span" aria-hidden>
                        ·
                    </Box>
                    <Button
                        size="small"
                        onClick={onRetry}
                        sx={{
                            minWidth: 0,
                            px: 0.75,
                            py: 0.25,
                            fontSize: 12.5,
                            fontWeight: 700,
                            color: harborHex.accent,
                        }}
                    >
                        Retry
                    </Button>
                </>
            )}
        </Box>
    );
}
