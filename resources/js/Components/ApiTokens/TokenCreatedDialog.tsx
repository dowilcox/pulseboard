import { usePage } from "@inertiajs/react";
import { useEffect, useState } from "react";
import CheckIcon from "@mui/icons-material/Check";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import type { PageProps } from "@/types";

/**
 * Watches the `flash.token` shared prop and shows the newly created API
 * token in a copy-once dialog. Self-contained: just render it on any page
 * whose backend flashes `token` after creating one.
 */
export default function TokenCreatedDialog() {
    const { flash } = usePage<PageProps>().props;
    const [token, setToken] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (flash?.token) {
            setToken(flash.token);
            setCopied(false);
        }
    }, [flash?.token]);

    return (
        <Dialog
            open={!!token}
            maxWidth="sm"
            fullWidth
            aria-labelledby="token-created-dialog-title"
        >
            <DialogTitle id="token-created-dialog-title">
                API Token Created
            </DialogTitle>
            <DialogContent>
                <Box
                    sx={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 2,
                        mt: 1,
                    }}
                >
                    <Alert severity="warning">
                        Copy this token now. It will not be shown again.
                    </Alert>
                    <TextField
                        value={token ?? ""}
                        fullWidth
                        slotProps={{
                            input: {
                                readOnly: true,
                                sx: {
                                    fontFamily: "monospace",
                                    fontSize: "0.85rem",
                                },
                                endAdornment: (
                                    <InputAdornment position="end">
                                        <Tooltip
                                            title={
                                                copied
                                                    ? "Copied!"
                                                    : "Copy to clipboard"
                                            }
                                        >
                                            <IconButton
                                                onClick={() => {
                                                    if (token) {
                                                        navigator.clipboard.writeText(
                                                            token,
                                                        );
                                                        setCopied(true);
                                                    }
                                                }}
                                                edge="end"
                                            >
                                                {copied ? (
                                                    <CheckIcon color="success" />
                                                ) : (
                                                    <ContentCopyIcon />
                                                )}
                                            </IconButton>
                                        </Tooltip>
                                    </InputAdornment>
                                ),
                            },
                        }}
                        onClick={(e) => (e.target as HTMLInputElement).select()}
                    />
                </Box>
            </DialogContent>
            <DialogActions sx={{ px: 3, py: 2 }}>
                <Button variant="contained" onClick={() => setToken(null)}>
                    Done
                </Button>
            </DialogActions>
        </Dialog>
    );
}
