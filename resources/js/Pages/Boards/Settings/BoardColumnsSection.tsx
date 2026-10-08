import ColorSwatchPicker from "@/Components/Common/ColorSwatchPicker";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Checkbox from "@mui/material/Checkbox";
import Collapse from "@mui/material/Collapse";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useMemo } from "react";
import {
    affectedTaskCount,
    moveTargetsFor,
    nearestTargetId,
} from "./columnForm";
import RemoveColumnDialog from "./RemoveColumnDialog";
import type { useBoardColumnsForm } from "./useBoardColumnsForm";

interface BoardColumnsSectionProps {
    form: ReturnType<typeof useBoardColumnsForm>;
}

const pluralTasks = (count: number) =>
    `${count} ${count === 1 ? "task" : "tasks"}`;

const COLUMN_ERROR_KEY = /^columns\.(\d+)\.(\w+)$/;
/** Errors shown beside a visible column's fields. */
const INLINE_FIELDS = new Set(["name", "wip_limit"]);

export default function BoardColumnsSection({
    form,
}: BoardColumnsSectionProps) {
    const {
        columns,
        visibleColumns,
        columnErrors,
        expandedColumn,
        savingColumns,
        isDirty,
        pendingRemoval,
        handleAddColumn,
        handleColumnChange,
        handleMoveColumn,
        handleRemoveColumn,
        handleRestoreColumn,
        handleSaveColumns,
        confirmRemoval,
        cancelRemoval,
        toggleExpandedColumn,
    } = form;

    // Errors for removed (hidden) columns, or for fields with no inline
    // spot, can't sit next to a field, so list them above the columns.
    const removalErrors = Object.entries(columnErrors)
        .filter(([key]) => {
            const match = COLUMN_ERROR_KEY.exec(key);
            if (!match) return false;
            const column = columns[Number(match[1])];
            return !!column?._destroy || !INLINE_FIELDS.has(match[2]);
        })
        .map(([key, message]) => {
            const column = columns[Number(COLUMN_ERROR_KEY.exec(key)?.[1])];
            return column?._destroy && !message.includes(column.name)
                ? `Removed column “${column.name || "Untitled"}”: ${message}`
                : message;
        });

    const pendingColumn =
        pendingRemoval !== null ? (columns[pendingRemoval] ?? null) : null;
    const dialogTargets = useMemo(
        () =>
            pendingRemoval !== null
                ? moveTargetsFor(columns, pendingRemoval)
                : [],
        [columns, pendingRemoval],
    );
    const removedColumns = columns
        .map((column, index) => ({ column, index }))
        .filter(({ column }) => column._destroy);
    const canRemove = visibleColumns.length > 1;

    const removalSummary = (index: number) => {
        const column = columns[index];
        const count = column.tasks_count ?? 0;
        if (count === 0) return "Empty column";
        if (column.move_tasks_to) {
            const target = columns.find((c) => c.id === column.move_tasks_to);
            return `${pluralTasks(count)} move to “${target?.name || "Untitled"}”`;
        }
        return `${pluralTasks(count)} will be deleted`;
    };

    return (
        <Card
            variant="outlined"
            component="section"
            aria-labelledby="columns-heading"
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
                        id="columns-heading"
                        variant="subtitle1"
                        component="h2"
                        fontWeight={600}
                    >
                        Columns
                    </Typography>
                    <Button
                        startIcon={<AddIcon />}
                        size="small"
                        onClick={handleAddColumn}
                    >
                        Add column
                    </Button>
                </Box>
                <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: 2 }}
                >
                    Rename, reorder, recolor, and set WIP limits. Changes apply
                    when you save columns.
                </Typography>

                {columnErrors.columns && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {columnErrors.columns}
                    </Alert>
                )}
                {removalErrors.length > 0 && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {removalErrors.map((message) => (
                            <Box key={message}>{message}</Box>
                        ))}
                    </Alert>
                )}

                {visibleColumns.length === 0 ? (
                    <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ py: 2 }}
                    >
                        No columns configured. Add a column to get started.
                    </Typography>
                ) : (
                    <Box
                        sx={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 2,
                        }}
                    >
                        {columns.map((column, index) => {
                            if (column._destroy) {
                                return null;
                            }

                            const visibleIndex = visibleColumns.indexOf(column);
                            const isFirst = visibleIndex === 0;
                            const isLast =
                                visibleIndex === visibleColumns.length - 1;
                            const label = column.name || "Untitled";
                            const colorPanelId = `column-color-${column.id ?? column._key ?? index}`;

                            return (
                                <Paper
                                    key={column.id ?? column._key ?? index}
                                    variant="outlined"
                                    sx={{ p: { xs: 1.5, sm: 2 } }}
                                >
                                    <Box
                                        sx={{
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: 2,
                                        }}
                                    >
                                        <Box
                                            sx={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: { xs: 1, sm: 1.5 },
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
                                                    disabled={isFirst}
                                                    onClick={() =>
                                                        handleMoveColumn(
                                                            index,
                                                            "up",
                                                        )
                                                    }
                                                    aria-label={`Move ${label} up`}
                                                    sx={{ p: 0.25 }}
                                                >
                                                    <KeyboardArrowUpIcon fontSize="small" />
                                                </IconButton>
                                                <IconButton
                                                    size="small"
                                                    disabled={isLast}
                                                    onClick={() =>
                                                        handleMoveColumn(
                                                            index,
                                                            "down",
                                                        )
                                                    }
                                                    aria-label={`Move ${label} down`}
                                                    sx={{ p: 0.25 }}
                                                >
                                                    <KeyboardArrowDownIcon fontSize="small" />
                                                </IconButton>
                                            </Box>

                                            <Tooltip title="Change color">
                                                <Box
                                                    component="button"
                                                    type="button"
                                                    aria-label={`Change color of ${label}`}
                                                    aria-expanded={
                                                        expandedColumn === index
                                                    }
                                                    aria-controls={colorPanelId}
                                                    onClick={() =>
                                                        toggleExpandedColumn(
                                                            index,
                                                        )
                                                    }
                                                    sx={{
                                                        width: 24,
                                                        height: 24,
                                                        borderRadius: "50%",
                                                        bgcolor: column.color,
                                                        border: "none",
                                                        cursor: "pointer",
                                                        p: 0,
                                                        flexShrink: 0,
                                                        transition:
                                                            "box-shadow 0.15s",
                                                        "&:hover": {
                                                            boxShadow:
                                                                "0 0 0 3px rgba(255,255,255,0.2)",
                                                        },
                                                        "&:focus-visible": {
                                                            outline:
                                                                "2px solid",
                                                            outlineColor:
                                                                "primary.main",
                                                            outlineOffset: 2,
                                                        },
                                                    }}
                                                />
                                            </Tooltip>

                                            <TextField
                                                label="Name"
                                                size="small"
                                                required
                                                value={column.name}
                                                onChange={(event) =>
                                                    handleColumnChange(
                                                        index,
                                                        "name",
                                                        event.target.value,
                                                    )
                                                }
                                                error={
                                                    !!columnErrors[
                                                        `columns.${index}.name`
                                                    ]
                                                }
                                                helperText={
                                                    columnErrors[
                                                        `columns.${index}.name`
                                                    ] ??
                                                    (column.id
                                                        ? pluralTasks(
                                                              column.tasks_count ??
                                                                  0,
                                                          )
                                                        : "New column")
                                                }
                                                sx={{ flex: 1, minWidth: 0 }}
                                            />

                                            <Tooltip
                                                title={
                                                    canRemove
                                                        ? "Remove column"
                                                        : "A board needs at least one column"
                                                }
                                            >
                                                <span>
                                                    <IconButton
                                                        size="small"
                                                        color="error"
                                                        disabled={!canRemove}
                                                        aria-label={`Remove ${label}`}
                                                        onClick={() =>
                                                            handleRemoveColumn(
                                                                index,
                                                            )
                                                        }
                                                    >
                                                        <DeleteIcon fontSize="small" />
                                                    </IconButton>
                                                </span>
                                            </Tooltip>
                                        </Box>

                                        <Collapse
                                            in={expandedColumn === index}
                                            id={colorPanelId}
                                        >
                                            <Box>
                                                <Typography
                                                    variant="caption"
                                                    color="text.secondary"
                                                    sx={{
                                                        mb: 1,
                                                        display: "block",
                                                    }}
                                                >
                                                    Color
                                                </Typography>
                                                <ColorSwatchPicker
                                                    value={column.color}
                                                    onChange={(color) =>
                                                        handleColumnChange(
                                                            index,
                                                            "color",
                                                            color,
                                                        )
                                                    }
                                                />
                                            </Box>
                                        </Collapse>

                                        <Box
                                            sx={{
                                                display: "flex",
                                                flexDirection: {
                                                    xs: "column",
                                                    sm: "row",
                                                },
                                                gap: { xs: 1, sm: 3 },
                                                alignItems: {
                                                    xs: "stretch",
                                                    sm: "flex-start",
                                                },
                                            }}
                                        >
                                            <Box sx={{ flex: 1 }}>
                                                <TextField
                                                    label="WIP limit"
                                                    size="small"
                                                    type="number"
                                                    placeholder="No limit"
                                                    fullWidth
                                                    value={column.wip_limit}
                                                    onChange={(event) =>
                                                        handleColumnChange(
                                                            index,
                                                            "wip_limit",
                                                            event.target
                                                                .value === ""
                                                                ? ""
                                                                : Number(
                                                                      event
                                                                          .target
                                                                          .value,
                                                                  ),
                                                        )
                                                    }
                                                    error={
                                                        !!columnErrors[
                                                            `columns.${index}.wip_limit`
                                                        ]
                                                    }
                                                    helperText={
                                                        columnErrors[
                                                            `columns.${index}.wip_limit`
                                                        ] ??
                                                        "Max tasks allowed in this column"
                                                    }
                                                    slotProps={{
                                                        htmlInput: {
                                                            min: 1,
                                                            step: 1,
                                                        },
                                                    }}
                                                />
                                            </Box>

                                            <Box sx={{ flex: 1, pt: 0.5 }}>
                                                <FormControlLabel
                                                    control={
                                                        <Checkbox
                                                            checked={
                                                                column.is_done_column
                                                            }
                                                            onChange={(event) =>
                                                                handleColumnChange(
                                                                    index,
                                                                    "is_done_column",
                                                                    event.target
                                                                        .checked,
                                                                )
                                                            }
                                                            size="small"
                                                        />
                                                    }
                                                    label={
                                                        <Typography variant="body2">
                                                            Mark as "Done"
                                                            column
                                                        </Typography>
                                                    }
                                                />
                                                <Typography
                                                    variant="caption"
                                                    color="text.secondary"
                                                    sx={{
                                                        pl: 3.5,
                                                        display: "block",
                                                    }}
                                                >
                                                    Tasks moved here are
                                                    considered complete
                                                </Typography>
                                            </Box>
                                        </Box>
                                    </Box>
                                </Paper>
                            );
                        })}
                    </Box>
                )}

                {removedColumns.length > 0 && (
                    <Box sx={{ mt: 2 }}>
                        <Typography
                            variant="subtitle2"
                            component="h3"
                            sx={{ mb: 1 }}
                        >
                            Removed when you save
                        </Typography>
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
                            {removedColumns.map(({ column, index }) => (
                                <Box
                                    component="li"
                                    key={column.id ?? index}
                                    sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 1.5,
                                        px: 1.5,
                                        py: 1,
                                        border: 1,
                                        borderColor: "divider",
                                        borderRadius: 1,
                                    }}
                                >
                                    <Box
                                        sx={{
                                            width: 10,
                                            height: 10,
                                            borderRadius: "50%",
                                            bgcolor: column.color,
                                            flexShrink: 0,
                                        }}
                                    />
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <Typography
                                            variant="body2"
                                            sx={{
                                                textDecoration: "line-through",
                                            }}
                                        >
                                            {column.name || "Untitled"}
                                        </Typography>
                                        <Typography
                                            variant="caption"
                                            color={
                                                column.delete_tasks
                                                    ? "error"
                                                    : "text.secondary"
                                            }
                                        >
                                            {removalSummary(index)}
                                        </Typography>
                                    </Box>
                                    <Button
                                        size="small"
                                        onClick={() =>
                                            handleRestoreColumn(index)
                                        }
                                        aria-label={`Undo removing ${column.name || "Untitled"}`}
                                    >
                                        Undo
                                    </Button>
                                </Box>
                            ))}
                        </Box>
                    </Box>
                )}

                <Divider sx={{ my: 2 }} />

                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 2,
                        flexWrap: "wrap",
                    }}
                >
                    <Button
                        variant="contained"
                        onClick={handleSaveColumns}
                        disabled={savingColumns || !isDirty}
                    >
                        {savingColumns ? "Saving columns…" : "Save columns"}
                    </Button>
                    {isDirty && !savingColumns && (
                        <Typography variant="body2" color="text.secondary">
                            Unsaved changes
                        </Typography>
                    )}
                </Box>
            </CardContent>

            <RemoveColumnDialog
                open={pendingColumn !== null}
                column={pendingColumn}
                taskCount={
                    pendingRemoval !== null
                        ? affectedTaskCount(columns, pendingRemoval)
                        : 0
                }
                targets={dialogTargets}
                defaultTargetId={
                    pendingRemoval !== null
                        ? nearestTargetId(columns, pendingRemoval)
                        : null
                }
                onCancel={cancelRemoval}
                onConfirm={confirmRemoval}
            />
        </Card>
    );
}
