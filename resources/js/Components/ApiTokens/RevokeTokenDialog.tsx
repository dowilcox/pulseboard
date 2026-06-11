import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";

interface RevokeTokenDialogProps {
    open: boolean;
    onCancel: () => void;
    onConfirm: () => void;
}

export default function RevokeTokenDialog({
    open,
    onCancel,
    onConfirm,
}: RevokeTokenDialogProps) {
    return (
        <Dialog
            open={open}
            onClose={onCancel}
            aria-labelledby="revoke-token-dialog-title"
        >
            <DialogTitle id="revoke-token-dialog-title">
                Revoke Token
            </DialogTitle>
            <DialogContent>
                <Alert severity="warning" sx={{ mt: 1 }}>
                    This will immediately invalidate the token. Any applications
                    using it will lose access.
                </Alert>
            </DialogContent>
            <DialogActions sx={{ px: 3, py: 2 }}>
                <Button onClick={onCancel}>Cancel</Button>
                <Button variant="contained" color="error" onClick={onConfirm}>
                    Revoke
                </Button>
            </DialogActions>
        </Dialog>
    );
}
