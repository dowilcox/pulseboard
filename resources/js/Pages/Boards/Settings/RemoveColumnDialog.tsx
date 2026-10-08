import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import MenuItem from "@mui/material/MenuItem";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useEffect, useId, useRef, useState } from "react";
import type { ColumnFormData } from "./types";

interface RemoveColumnDialogProps {
    open: boolean;
    column: ColumnFormData | null;
    taskCount: number;
    /** Surviving, saved columns the tasks can move to, in board order. */
    targets: ColumnFormData[];
    /** Preselected target (the nearest column). */
    defaultTargetId: string | null;
    onCancel: () => void;
    onConfirm: (moveTo: string | null) => void;
}

const pluralTasks = (count: number) =>
    `${count} ${count === 1 ? "task" : "tasks"}`;

export default function RemoveColumnDialog({
    open,
    column,
    taskCount,
    targets,
    defaultTargetId,
    onCancel,
    onConfirm,
}: RemoveColumnDialogProps) {
    const titleId = useId();
    const [choice, setChoice] = useState<"move" | "delete">("move");
    const [targetId, setTargetId] = useState("");

    // Reset to the safe default each time the dialog opens.
    useEffect(() => {
        if (open) {
            setChoice(defaultTargetId ? "move" : "delete");
            setTargetId(defaultTargetId ?? "");
        }
    }, [open, defaultTargetId]);

    // Keep showing the last column while the dialog animates closed.
    const shown = useRef({ column, taskCount });
    if (open && column) {
        shown.current = { column, taskCount };
    }

    const tasks = pluralTasks(shown.current.taskCount);
    const moving = choice === "move" && !!targetId;

    return (
        <Dialog
            open={open}
            onClose={onCancel}
            maxWidth="xs"
            fullWidth
            aria-labelledby={titleId}
        >
            <DialogTitle id={titleId}>
                Remove “{shown.current.column?.name || "Untitled"}”?
            </DialogTitle>
            <DialogContent>
                <DialogContentText sx={{ mb: 2 }}>
                    This column has {tasks}. Choose what happens to{" "}
                    {shown.current.taskCount === 1 ? "it" : "them"}. Nothing changes until you
                    save columns.
                </DialogContentText>

                <RadioGroup
                    aria-label="What happens to the column's tasks"
                    value={choice}
                    onChange={(event) =>
                        setChoice(event.target.value as "move" | "delete")
                    }
                >
                    <FormControlLabel
                        value="move"
                        disabled={targets.length === 0}
                        control={<Radio />}
                        label={`Move ${tasks} to another column`}
                    />
                    <Box sx={{ pl: 4, pb: 1.5 }}>
                        {targets.length > 0 ? (
                            <TextField
                                select
                                size="small"
                                fullWidth
                                label="Move to"
                                value={targetId}
                                disabled={choice !== "move"}
                                onChange={(event) =>
                                    setTargetId(event.target.value)
                                }
                            >
                                {targets.map((target) => (
                                    <MenuItem key={target.id} value={target.id}>
                                        {target.name || "Untitled"}
                                    </MenuItem>
                                ))}
                            </TextField>
                        ) : (
                            <Typography
                                variant="caption"
                                color="text.secondary"
                            >
                                Save your new columns first to move tasks into
                                them.
                            </Typography>
                        )}
                    </Box>
                    <FormControlLabel
                        value="delete"
                        control={<Radio color="error" />}
                        label={
                            <Typography variant="body2" color="error">
                                Delete {tasks} permanently
                            </Typography>
                        }
                    />
                    <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ pl: 4, display: "block" }}
                    >
                        Their comments, attachments and history are deleted too.
                        This can’t be undone.
                    </Typography>
                </RadioGroup>
            </DialogContent>
            <DialogActions>
                <Button onClick={onCancel}>Cancel</Button>
                <Button
                    variant="contained"
                    color={moving ? "primary" : "error"}
                    disabled={choice === "move" && !targetId}
                    onClick={() => onConfirm(moving ? targetId : null)}
                >
                    {moving ? "Remove column" : `Remove and delete ${tasks}`}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
