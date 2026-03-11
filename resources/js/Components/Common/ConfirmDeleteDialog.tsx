import { useState, useEffect } from "react";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import TextField from "@mui/material/TextField";
import Alert from "@mui/material/Alert";

interface ConfirmDeleteDialogProps {
    open: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    description: string;
    itemName: string;
    processing?: boolean;
}

export default function ConfirmDeleteDialog({
    open,
    onClose,
    onConfirm,
    title,
    description,
    itemName,
    processing = false,
}: ConfirmDeleteDialogProps) {
    const [confirmText, setConfirmText] = useState("");

    useEffect(() => {
        setConfirmText("");
    }, [open]);

    const isConfirmEnabled = confirmText === "DELETE" && !processing;

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="xs"
            fullWidth
            aria-labelledby="confirm-delete-dialog-title"
        >
            <DialogTitle id="confirm-delete-dialog-title">{title}</DialogTitle>
            <DialogContent>
                <Alert severity="error" sx={{ mb: 2 }}>
                    {description} <strong>{itemName}</strong>
                </Alert>
                <DialogContentText sx={{ mb: 2 }}>
                    To confirm, type <strong>DELETE</strong> below:
                </DialogContentText>
                <TextField
                    autoFocus
                    fullWidth
                    size="small"
                    placeholder="DELETE"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    disabled={processing}
                />
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={processing}>
                    Cancel
                </Button>
                <Button
                    onClick={onConfirm}
                    color="error"
                    variant="contained"
                    disabled={!isConfirmEnabled}
                >
                    {processing ? "Deleting..." : "Delete"}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
