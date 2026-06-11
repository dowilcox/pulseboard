import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import type { ButtonProps } from "@mui/material/Button";
import type { ReactNode } from "react";
import { useId } from "react";

interface ConfirmDialogProps {
    open: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: ReactNode;
    confirmLabel?: string;
    confirmColor?: ButtonProps["color"];
}

/**
 * Lightweight confirmation dialog for simple destructive or irreversible
 * actions. For high-impact deletions that should require typing DELETE,
 * use ConfirmDeleteDialog instead.
 */
export default function ConfirmDialog({
    open,
    onClose,
    onConfirm,
    title,
    message,
    confirmLabel = "Confirm",
    confirmColor = "primary",
}: ConfirmDialogProps) {
    const titleId = useId();

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="xs"
            aria-labelledby={titleId}
        >
            <DialogTitle id={titleId}>{title}</DialogTitle>
            <DialogContent>
                <DialogContentText>{message}</DialogContentText>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
                <Button
                    onClick={onConfirm}
                    color={confirmColor}
                    variant="contained"
                >
                    {confirmLabel}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
