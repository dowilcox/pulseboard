import ColorSwatchPicker from "@/Components/Common/ColorSwatchPicker";
import ConfirmDialog from "@/Components/Common/ConfirmDialog";
import { LABEL_COLORS } from "@/constants/labelColors";
import type { Label, Team } from "@/types";
import { getContrastText } from "@/utils/colorContrast";
import { router, useForm } from "@inertiajs/react";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditIcon from "@mui/icons-material/Edit";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { type FormEvent, useState } from "react";
import SectionCard from "./SectionCard";

interface Props {
    team: Team;
    labels: Label[];
    canManage: boolean;
}

const NAME_MAX = 50;

function LabelPreview({ name, color }: { name: string; color: string }) {
    return (
        <Chip
            label={name}
            size="small"
            sx={{
                fontWeight: 600,
                bgcolor: color,
                color: getContrastText(color),
                maxWidth: "100%",
            }}
        />
    );
}

export default function LabelsSection({ team, labels, canManage }: Props) {
    const [addOpen, setAddOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [deleteLabel, setDeleteLabel] = useState<Label | null>(null);

    const addForm = useForm({ name: "", color: LABEL_COLORS[0] as string });
    const editForm = useForm({ name: "", color: "" });

    const handleAdd = (e: FormEvent) => {
        e.preventDefault();
        addForm.post(route("labels.store", team.slug), {
            preserveScroll: true,
            onSuccess: () => setAddOpen(false),
        });
    };

    const startEdit = (label: Label) => {
        editForm.clearErrors();
        editForm.setData({ name: label.name, color: label.color });
        setEditingId(label.id);
    };

    const saveEdit = (e: FormEvent, label: Label) => {
        e.preventDefault();
        editForm.put(route("labels.update", [team.slug, label.id]), {
            preserveScroll: true,
            onSuccess: () => setEditingId(null),
        });
    };

    const confirmDelete = () => {
        if (!deleteLabel) return;
        router.delete(route("labels.destroy", [team.slug, deleteLabel.id]), {
            preserveScroll: true,
            onSuccess: () => setDeleteLabel(null),
        });
    };

    return (
        <>
            <SectionCard
                title={`Labels (${labels.length})`}
                description="Labels are shared by every board in this team and help categorize and filter tasks."
                action={
                    canManage ? (
                        <Button
                            startIcon={<AddIcon />}
                            size="small"
                            variant="outlined"
                            onClick={() => setAddOpen(true)}
                        >
                            Add label
                        </Button>
                    ) : undefined
                }
            >
                {labels.length === 0 ? (
                    <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ py: 1 }}
                    >
                        {canManage
                            ? "No labels yet. Add a label to categorize tasks."
                            : "No labels yet. Team owners and admins can add them."}
                    </Typography>
                ) : (
                    <Box component="ul" sx={{ listStyle: "none", m: 0, p: 0 }}>
                        {labels.map((label) => (
                            <Box
                                component="li"
                                key={label.id}
                                sx={{
                                    py: 1,
                                    borderTop: 1,
                                    borderColor: "divider",
                                    "&:first-of-type": { borderTop: 0 },
                                }}
                            >
                                {editingId === label.id ? (
                                    <Box
                                        component="form"
                                        onSubmit={(e: FormEvent) =>
                                            saveEdit(e, label)
                                        }
                                        sx={{
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: 1.5,
                                        }}
                                    >
                                        <Box
                                            sx={{
                                                display: "flex",
                                                alignItems: "flex-start",
                                                gap: 1,
                                                flexWrap: "wrap",
                                            }}
                                        >
                                            <TextField
                                                size="small"
                                                label="Label name"
                                                autoFocus
                                                value={editForm.data.name}
                                                onChange={(e) =>
                                                    editForm.setData(
                                                        "name",
                                                        e.target.value,
                                                    )
                                                }
                                                error={!!editForm.errors.name}
                                                helperText={
                                                    editForm.errors.name
                                                }
                                                sx={{ flex: "1 1 180px" }}
                                                slotProps={{
                                                    htmlInput: {
                                                        maxLength: NAME_MAX,
                                                    },
                                                }}
                                            />
                                            <Button
                                                type="submit"
                                                size="small"
                                                variant="contained"
                                                disabled={
                                                    !editForm.data.name.trim() ||
                                                    editForm.processing
                                                }
                                                sx={{ mt: 0.5 }}
                                            >
                                                Save
                                            </Button>
                                            <Tooltip title="Cancel editing">
                                                <IconButton
                                                    size="small"
                                                    aria-label="Cancel editing"
                                                    onClick={() =>
                                                        setEditingId(null)
                                                    }
                                                    sx={{ mt: 0.25 }}
                                                >
                                                    <CloseIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                        </Box>
                                        <ColorSwatchPicker
                                            value={editForm.data.color}
                                            onChange={(color) =>
                                                editForm.setData("color", color)
                                            }
                                        />
                                    </Box>
                                ) : (
                                    <Box
                                        sx={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 1,
                                            minHeight: 34,
                                        }}
                                    >
                                        <Box sx={{ flex: 1, minWidth: 0 }}>
                                            <LabelPreview
                                                name={label.name}
                                                color={label.color}
                                            />
                                        </Box>
                                        {canManage && (
                                            <>
                                                <Tooltip title="Edit label">
                                                    <IconButton
                                                        size="small"
                                                        aria-label={`Edit label ${label.name}`}
                                                        onClick={() =>
                                                            startEdit(label)
                                                        }
                                                    >
                                                        <EditIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title="Delete label">
                                                    <IconButton
                                                        size="small"
                                                        color="error"
                                                        aria-label={`Delete label ${label.name}`}
                                                        onClick={() =>
                                                            setDeleteLabel(
                                                                label,
                                                            )
                                                        }
                                                    >
                                                        <DeleteOutlineIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            </>
                                        )}
                                    </Box>
                                )}
                            </Box>
                        ))}
                    </Box>
                )}
            </SectionCard>

            {canManage && (
                <Dialog
                    open={addOpen}
                    onClose={
                        addForm.processing ? undefined : () => setAddOpen(false)
                    }
                    maxWidth="xs"
                    fullWidth
                    aria-labelledby="add-label-dialog-title"
                    slotProps={{
                        transition: {
                            onExited: () => {
                                addForm.reset();
                                addForm.clearErrors();
                            },
                        },
                    }}
                >
                    <form onSubmit={handleAdd}>
                        <DialogTitle id="add-label-dialog-title">
                            Add label
                        </DialogTitle>
                        <DialogContent>
                            <TextField
                                autoFocus
                                label="Name"
                                fullWidth
                                required
                                value={addForm.data.name}
                                onChange={(e) =>
                                    addForm.setData("name", e.target.value)
                                }
                                error={!!addForm.errors.name}
                                helperText={addForm.errors.name}
                                sx={{ mt: 1, mb: 2 }}
                                slotProps={{
                                    htmlInput: { maxLength: NAME_MAX },
                                }}
                            />
                            <Typography
                                id="add-label-color-label"
                                variant="body2"
                                color="text.secondary"
                                sx={{ mb: 1 }}
                            >
                                Color
                            </Typography>
                            <ColorSwatchPicker
                                value={addForm.data.color}
                                onChange={(color) =>
                                    addForm.setData("color", color)
                                }
                            />
                            {addForm.errors.color && (
                                <Typography
                                    variant="caption"
                                    color="error"
                                    sx={{ mt: 0.5, display: "block" }}
                                >
                                    {addForm.errors.color}
                                </Typography>
                            )}
                            {addForm.data.name && (
                                <Box sx={{ mt: 2 }}>
                                    <Typography
                                        variant="caption"
                                        color="text.secondary"
                                        component="div"
                                    >
                                        Preview
                                    </Typography>
                                    <Box sx={{ mt: 0.5 }}>
                                        <LabelPreview
                                            name={addForm.data.name}
                                            color={addForm.data.color}
                                        />
                                    </Box>
                                </Box>
                            )}
                        </DialogContent>
                        <DialogActions sx={{ px: 3, py: 2 }}>
                            <Button
                                onClick={() => setAddOpen(false)}
                                disabled={addForm.processing}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                variant="contained"
                                disabled={
                                    addForm.processing ||
                                    !addForm.data.name.trim()
                                }
                            >
                                {addForm.processing ? "Adding…" : "Add label"}
                            </Button>
                        </DialogActions>
                    </form>
                </Dialog>
            )}

            <ConfirmDialog
                open={!!deleteLabel}
                onClose={() => setDeleteLabel(null)}
                onConfirm={confirmDelete}
                title={`Delete label “${deleteLabel?.name ?? ""}”?`}
                message="It will be removed from every task that uses it. This can't be undone."
                confirmLabel="Delete label"
                confirmColor="error"
            />
        </>
    );
}
