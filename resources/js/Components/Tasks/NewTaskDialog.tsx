import { useSnackbar } from "@/Contexts/SnackbarContext";
import type { Column } from "@/types";
import { useForm } from "@inertiajs/react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { type FormEvent, useEffect, useId, useMemo } from "react";

interface Props {
    open: boolean;
    onClose: () => void;
    teamSlug: string;
    boardSlug: string;
    columns: Column[];
}

function isFull(column: Column): boolean {
    return (
        column.wip_limit != null &&
        column.wip_limit > 0 &&
        (column.tasks_count ?? column.tasks?.length ?? 0) >= column.wip_limit
    );
}

/** Board-level "New task": title + column, available from every view. */
export default function NewTaskDialog({
    open,
    onClose,
    teamSlug,
    boardSlug,
    columns,
}: Props) {
    const titleId = useId();
    const { showSnackbar } = useSnackbar();
    const firstOpenColumn = useMemo(
        () => columns.find((c) => !isFull(c)) ?? null,
        [columns],
    );

    const { data, setData, post, processing, errors, reset, clearErrors } =
        useForm({
            title: "",
            column_id: firstOpenColumn?.id ?? "",
        });

    // Re-pick the default column each time the dialog opens.
    useEffect(() => {
        if (!open) return;
        clearErrors();
        setData((prev) => ({
            ...prev,
            column_id:
                prev.column_id &&
                columns.some((c) => c.id === prev.column_id && !isFull(c))
                    ? prev.column_id
                    : (firstOpenColumn?.id ?? ""),
        }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const close = () => {
        reset("title");
        clearErrors();
        onClose();
    };

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (!data.title.trim() || !data.column_id) return;
        const column = columns.find((c) => c.id === data.column_id);

        post(route("tasks.store", [teamSlug, boardSlug, data.column_id]), {
            preserveScroll: true,
            onSuccess: () => {
                showSnackbar(
                    `Task added to ${column?.name ?? "the board"}`,
                    "success",
                );
                close();
            },
        });
    };

    const allFull = firstOpenColumn === null;

    return (
        <Dialog
            open={open}
            onClose={close}
            maxWidth="xs"
            fullWidth
            aria-labelledby={titleId}
        >
            <Box component="form" onSubmit={handleSubmit} noValidate>
                <DialogTitle id={titleId}>New task</DialogTitle>
                <DialogContent
                    sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}
                >
                    {allFull && (
                        <Typography variant="body2" color="error">
                            Every column is at its WIP limit. Move or finish a
                            task before adding another.
                        </Typography>
                    )}
                    <TextField
                        label="Title"
                        value={data.title}
                        onChange={(e) => setData("title", e.target.value)}
                        autoFocus
                        required
                        fullWidth
                        error={Boolean(errors.title)}
                        helperText={errors.title}
                        slotProps={{ htmlInput: { maxLength: 255 } }}
                        sx={{ mt: 1 }}
                    />
                    <TextField
                        select
                        label="Column"
                        value={data.column_id}
                        onChange={(e) => setData("column_id", e.target.value)}
                        fullWidth
                        disabled={allFull}
                        error={Boolean(errors.column_id)}
                        helperText={
                            errors.column_id ??
                            "Columns at their WIP limit can't take new tasks."
                        }
                    >
                        {columns.map((column) => {
                            const full = isFull(column);
                            return (
                                <MenuItem
                                    key={column.id}
                                    value={column.id}
                                    disabled={full}
                                >
                                    {column.name}
                                    {full
                                        ? ` — WIP limit reached (${column.wip_limit})`
                                        : ""}
                                </MenuItem>
                            );
                        })}
                    </TextField>
                </DialogContent>
                <DialogActions>
                    <Button onClick={close}>Cancel</Button>
                    <Button
                        type="submit"
                        variant="contained"
                        disabled={
                            processing ||
                            allFull ||
                            !data.title.trim() ||
                            !data.column_id
                        }
                    >
                        Create task
                    </Button>
                </DialogActions>
            </Box>
        </Dialog>
    );
}
