import ConfirmDialog from "@/Components/Common/ConfirmDialog";
import { harbor } from "@/theme/harbor";
import type { BoardCustomField } from "@/types";
import { customFieldTypeLabel } from "@/utils/customFields";
import { router } from "@inertiajs/react";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import ViewAgendaOutlinedIcon from "@mui/icons-material/ViewAgendaOutlined";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useEffect, useState } from "react";
import CustomFieldDialog from "./CustomFieldDialog";

interface Props {
    fields: BoardCustomField[];
    teamSlug: string;
    boardSlug: string;
}

/**
 * Board settings: add, edit, reorder and delete the board's custom fields.
 * Each change saves right away (unlike columns, which save as a batch).
 */
export default function CustomFieldsSection({
    fields: serverFields,
    teamSlug,
    boardSlug,
}: Props) {
    // Local order so moves show instantly; the server's order wins on reload.
    const [fields, setFields] = useState(serverFields);
    useEffect(() => setFields(serverFields), [serverFields]);

    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<BoardCustomField | null>(null);
    const [pendingDelete, setPendingDelete] = useState<BoardCustomField | null>(
        null,
    );

    const openAdd = () => {
        setEditing(null);
        setDialogOpen(true);
    };

    const openEdit = (field: BoardCustomField) => {
        setEditing(field);
        setDialogOpen(true);
    };

    const move = (index: number, delta: -1 | 1) => {
        const next = [...fields];
        const [moved] = next.splice(index, 1);
        next.splice(index + delta, 0, moved);
        setFields(next);
        router.put(
            route("teams.boards.custom-fields.reorder", [teamSlug, boardSlug]),
            { field_ids: next.map((f) => f.id) },
            {
                preserveScroll: true,
                onError: () => setFields(serverFields),
            },
        );
    };

    const confirmDelete = () => {
        if (!pendingDelete) return;
        const field = pendingDelete;
        setPendingDelete(null);
        router.delete(
            route("teams.boards.custom-fields.destroy", [
                teamSlug,
                boardSlug,
                field.id,
            ]),
            { preserveScroll: true },
        );
    };

    return (
        <Card
            variant="outlined"
            component="section"
            aria-labelledby="custom-fields-heading"
        >
            <CardContent>
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 2,
                        mb: 0.5,
                    }}
                >
                    <Typography
                        id="custom-fields-heading"
                        variant="subtitle1"
                        component="h2"
                        fontWeight={600}
                    >
                        Custom fields
                    </Typography>
                    <Button
                        startIcon={<AddIcon />}
                        size="small"
                        onClick={openAdd}
                    >
                        Add field
                    </Button>
                </Box>
                <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: 2 }}
                >
                    Track extra details on every task on this board, like a
                    customer, a severity or a link to the spec. Fields appear in
                    the task sidebar, as list view columns and in filters.
                </Typography>

                {fields.length === 0 ? (
                    <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ py: 1 }}
                    >
                        No custom fields yet.
                    </Typography>
                ) : (
                    <Box
                        component="ul"
                        sx={{
                            listStyle: "none",
                            p: 0,
                            m: 0,
                            display: "flex",
                            flexDirection: "column",
                            gap: 1,
                        }}
                    >
                        {fields.map((field, index) => (
                            <Paper
                                component="li"
                                key={field.id}
                                variant="outlined"
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: { xs: 1, sm: 1.5 },
                                    px: { xs: 1, sm: 1.5 },
                                    py: 1,
                                }}
                            >
                                <Box
                                    sx={{
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: 0.25,
                                    }}
                                >
                                    <IconButton
                                        size="small"
                                        disabled={index === 0}
                                        onClick={() => move(index, -1)}
                                        aria-label={`Move ${field.name} up`}
                                        sx={{ p: 0.25 }}
                                    >
                                        <KeyboardArrowUpIcon fontSize="small" />
                                    </IconButton>
                                    <IconButton
                                        size="small"
                                        disabled={index === fields.length - 1}
                                        onClick={() => move(index, 1)}
                                        aria-label={`Move ${field.name} down`}
                                        sx={{ p: 0.25 }}
                                    >
                                        <KeyboardArrowDownIcon fontSize="small" />
                                    </IconButton>
                                </Box>
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Typography
                                        variant="body2"
                                        fontWeight={600}
                                        noWrap
                                    >
                                        {field.name}
                                    </Typography>
                                    <Typography
                                        variant="caption"
                                        sx={{ color: harbor.sub }}
                                    >
                                        {customFieldTypeLabel(field.type)}
                                        {field.options && field.options.length
                                            ? ` · ${field.options.length} ${field.options.length === 1 ? "option" : "options"}`
                                            : ""}
                                    </Typography>
                                </Box>
                                {field.show_on_card && (
                                    <Tooltip title="Shown on task cards">
                                        <ViewAgendaOutlinedIcon
                                            aria-label="Shown on task cards"
                                            sx={{
                                                fontSize: 18,
                                                color: harbor.sub,
                                            }}
                                        />
                                    </Tooltip>
                                )}
                                <IconButton
                                    size="small"
                                    onClick={() => openEdit(field)}
                                    aria-label={`Edit ${field.name}`}
                                >
                                    <EditIcon fontSize="small" />
                                </IconButton>
                                <IconButton
                                    size="small"
                                    color="error"
                                    onClick={() => setPendingDelete(field)}
                                    aria-label={`Delete ${field.name}`}
                                >
                                    <DeleteIcon fontSize="small" />
                                </IconButton>
                            </Paper>
                        ))}
                    </Box>
                )}
            </CardContent>

            <CustomFieldDialog
                open={dialogOpen}
                field={editing}
                teamSlug={teamSlug}
                boardSlug={boardSlug}
                onClose={() => setDialogOpen(false)}
            />

            <ConfirmDialog
                open={pendingDelete !== null}
                onClose={() => setPendingDelete(null)}
                onConfirm={confirmDelete}
                title={`Delete “${pendingDelete?.name ?? ""}”?`}
                message="The field and its value on every task on this board will be permanently removed. Saved filters that use it stop matching on it. This can’t be undone."
                confirmLabel="Delete field"
                confirmColor="error"
            />
        </Card>
    );
}
