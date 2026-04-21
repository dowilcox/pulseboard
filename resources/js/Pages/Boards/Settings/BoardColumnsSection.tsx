import ColorSwatchPicker from "@/Components/Common/ColorSwatchPicker";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
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
import type { ColumnFormData } from "./types";

interface BoardColumnsSectionProps {
    columns: ColumnFormData[];
    visibleColumns: ColumnFormData[];
    columnErrors: Record<string, string>;
    expandedColumn: number | null;
    savingColumns: boolean;
    onAddColumn: () => void;
    onColumnChange: (
        index: number,
        field: keyof ColumnFormData,
        value: string | number | boolean | "",
    ) => void;
    onMoveColumn: (index: number, direction: "up" | "down") => void;
    onRemoveColumn: (index: number) => void;
    onSaveColumns: () => void;
    onToggleExpandedColumn: (index: number) => void;
}

export default function BoardColumnsSection({
    columns,
    visibleColumns,
    columnErrors,
    expandedColumn,
    savingColumns,
    onAddColumn,
    onColumnChange,
    onMoveColumn,
    onRemoveColumn,
    onSaveColumns,
    onToggleExpandedColumn,
}: BoardColumnsSectionProps) {
    return (
        <Card variant="outlined">
            <CardContent>
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        mb: 2,
                    }}
                >
                    <Typography variant="subtitle1" fontWeight={600}>
                        Columns
                    </Typography>
                    <Button
                        startIcon={<AddIcon />}
                        size="small"
                        onClick={onAddColumn}
                    >
                        Add Column
                    </Button>
                </Box>

                {columnErrors.columns && (
                    <Typography color="error" variant="body2" sx={{ mb: 2 }}>
                        {columnErrors.columns}
                    </Typography>
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

                            return (
                                <Paper
                                    key={column.id ?? `new-${index}`}
                                    variant="outlined"
                                    sx={{ p: 2 }}
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
                                                gap: 1.5,
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
                                                        onMoveColumn(
                                                            index,
                                                            "up",
                                                        )
                                                    }
                                                    aria-label="Move column up"
                                                    sx={{ p: 0.25 }}
                                                >
                                                    <KeyboardArrowUpIcon fontSize="small" />
                                                </IconButton>
                                                <IconButton
                                                    size="small"
                                                    disabled={isLast}
                                                    onClick={() =>
                                                        onMoveColumn(
                                                            index,
                                                            "down",
                                                        )
                                                    }
                                                    aria-label="Move column down"
                                                    sx={{ p: 0.25 }}
                                                >
                                                    <KeyboardArrowDownIcon fontSize="small" />
                                                </IconButton>
                                            </Box>

                                            <Tooltip title="Click to change color">
                                                <Box
                                                    component="button"
                                                    type="button"
                                                    onClick={() =>
                                                        onToggleExpandedColumn(
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
                                                    }}
                                                />
                                            </Tooltip>

                                            <TextField
                                                label="Name"
                                                size="small"
                                                required
                                                value={column.name}
                                                onChange={(event) =>
                                                    onColumnChange(
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
                                                    ]
                                                }
                                                sx={{ flex: 1 }}
                                            />

                                            <Tooltip title="Remove column">
                                                <IconButton
                                                    size="small"
                                                    color="error"
                                                    onClick={() =>
                                                        onRemoveColumn(index)
                                                    }
                                                >
                                                    <DeleteIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                        </Box>

                                        <Collapse in={expandedColumn === index}>
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
                                                        onColumnChange(
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
                                                gap: 3,
                                                alignItems: "flex-start",
                                            }}
                                        >
                                            <Box sx={{ flex: 1 }}>
                                                <TextField
                                                    label="WIP Limit"
                                                    size="small"
                                                    type="number"
                                                    placeholder="No limit"
                                                    fullWidth
                                                    value={column.wip_limit}
                                                    onChange={(event) =>
                                                        onColumnChange(
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
                                                    helperText="Max tasks allowed in this column"
                                                    slotProps={{
                                                        htmlInput: {
                                                            min: 1,
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
                                                                onColumnChange(
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

                <Divider sx={{ my: 2 }} />

                <Button
                    variant="contained"
                    onClick={onSaveColumns}
                    disabled={savingColumns}
                >
                    Save Columns
                </Button>
            </CardContent>
        </Card>
    );
}
