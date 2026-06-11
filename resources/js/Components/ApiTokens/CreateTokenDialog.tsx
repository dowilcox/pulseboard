import { useForm } from "@inertiajs/react";
import { useEffect } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

interface CreateTokenDialogProps {
    open: boolean;
    onClose: () => void;
    /** Name of the bot/user the token is created for (shown in the title). */
    ownerName?: string;
    /** Resolved URL to POST the new token to. */
    submitUrl: string | null;
}

export default function CreateTokenDialog({
    open,
    onClose,
    ownerName,
    submitUrl,
}: CreateTokenDialogProps) {
    const form = useForm({
        name: "",
        abilities: ["read"] as string[],
    });

    // Reset the form each time the dialog opens.
    useEffect(() => {
        if (open) {
            form.reset();
            form.clearErrors();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const handleAbilityChange = (ability: string, checked: boolean) => {
        if (ability === "write" && checked) {
            form.setData("abilities", ["read", "write"]);
        } else if (ability === "write" && !checked) {
            form.setData("abilities", ["read"]);
        }
    };

    const handleSubmit = () => {
        if (!submitUrl) return;
        form.post(submitUrl, {
            onSuccess: () => onClose(),
        });
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="sm"
            fullWidth
            aria-labelledby="create-token-dialog-title"
        >
            <DialogTitle id="create-token-dialog-title">
                Create API Token{ownerName ? ` for ${ownerName}` : ""}
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
                        The token will only be shown once after creation. Copy
                        it immediately.
                    </Alert>
                    <TextField
                        label="Token Name"
                        value={form.data.name}
                        onChange={(e) => form.setData("name", e.target.value)}
                        error={!!form.errors.name}
                        helperText={form.errors.name}
                        fullWidth
                        required
                    />
                    <Box>
                        <Typography
                            variant="body2"
                            fontWeight={500}
                            sx={{ mb: 1 }}
                        >
                            Abilities
                        </Typography>
                        <FormControlLabel
                            control={<Checkbox checked disabled />}
                            label="read - Read access to boards, tasks, and comments"
                        />
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={form.data.abilities.includes(
                                        "write",
                                    )}
                                    onChange={(e) =>
                                        handleAbilityChange(
                                            "write",
                                            e.target.checked,
                                        )
                                    }
                                />
                            }
                            label="write - Create/update tasks, comments, and assignments"
                        />
                    </Box>
                </Box>
            </DialogContent>
            <DialogActions sx={{ px: 3, py: 2 }}>
                <Button onClick={onClose}>Cancel</Button>
                <Button
                    variant="contained"
                    onClick={handleSubmit}
                    disabled={form.processing}
                >
                    Create Token
                </Button>
            </DialogActions>
        </Dialog>
    );
}
