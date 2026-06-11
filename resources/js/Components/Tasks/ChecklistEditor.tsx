import { harbor, harborHex } from "@/theme/harbor";
import type { Checklist, ChecklistItem } from "@/types";
import AddIcon from "@mui/icons-material/Add";
import CheckIcon from "@mui/icons-material/Check";
import DeleteIcon from "@mui/icons-material/Delete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import IconButton from "@mui/material/IconButton";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useRef, useState } from "react";

interface Props {
    checklists: Checklist[];
    onChange: (checklists: Checklist[]) => void;
}

/** Indigo text action — "+ Add item" / "+ Add checklist". */
const addActionSx = {
    color: harborHex.accent,
    fontSize: 12.5,
    fontWeight: 700,
    px: 0.5,
    minWidth: 0,
    "&:hover": { bgcolor: "transparent", textDecoration: "underline" },
} as const;

/** Harbor checkbox faces — 18px rounded square, indigo fill when checked. */
const uncheckedIcon = (
    <Box
        sx={{
            width: 18,
            height: 18,
            borderRadius: "6px",
            border: `1.5px solid ${harbor.faint}`,
            boxSizing: "border-box",
        }}
    />
);
const checkedIcon = (
    <Box
        sx={{
            width: 18,
            height: 18,
            borderRadius: "6px",
            bgcolor: harborHex.accent,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
        }}
    >
        <CheckIcon sx={{ fontSize: 13, color: "#fff" }} />
    </Box>
);

export default function ChecklistEditor({ checklists, onChange }: Props) {
    const [newChecklistTitle, setNewChecklistTitle] = useState("");
    const [addingChecklist, setAddingChecklist] = useState(false);
    const [addingItemTo, setAddingItemTo] = useState<string | null>(null);
    const [newItemText, setNewItemText] = useState("");
    const newItemRef = useRef<HTMLInputElement>(null);
    const newChecklistRef = useRef<HTMLInputElement>(null);

    const handleAddChecklist = () => {
        if (!newChecklistTitle.trim()) return;
        const newChecklist: Checklist = {
            id: crypto.randomUUID(),
            title: newChecklistTitle.trim(),
            items: [],
        };
        onChange([...checklists, newChecklist]);
        setNewChecklistTitle("");
        setAddingChecklist(false);
    };

    const handleRemoveChecklist = (checklistId: string) => {
        onChange(checklists.filter((c) => c.id !== checklistId));
    };

    const handleToggleItem = (checklistId: string, itemId: string) => {
        onChange(
            checklists.map((c) =>
                c.id === checklistId
                    ? {
                          ...c,
                          items: c.items.map((item) =>
                              item.id === itemId
                                  ? { ...item, completed: !item.completed }
                                  : item,
                          ),
                      }
                    : c,
            ),
        );
    };

    const handleAddItem = (checklistId: string) => {
        if (!newItemText.trim()) return;
        const newItem: ChecklistItem = {
            id: crypto.randomUUID(),
            text: newItemText.trim(),
            completed: false,
        };
        onChange(
            checklists.map((c) =>
                c.id === checklistId
                    ? { ...c, items: [...c.items, newItem] }
                    : c,
            ),
        );
        setNewItemText("");
        setTimeout(() => newItemRef.current?.focus(), 0);
    };

    const handleRemoveItem = (checklistId: string, itemId: string) => {
        onChange(
            checklists.map((c) =>
                c.id === checklistId
                    ? {
                          ...c,
                          items: c.items.filter((item) => item.id !== itemId),
                      }
                    : c,
            ),
        );
    };

    const handleEditItem = (
        checklistId: string,
        itemId: string,
        text: string,
    ) => {
        onChange(
            checklists.map((c) =>
                c.id === checklistId
                    ? {
                          ...c,
                          items: c.items.map((item) =>
                              item.id === itemId ? { ...item, text } : item,
                          ),
                      }
                    : c,
            ),
        );
    };

    return (
        <Box>
            {checklists.map((checklist) => {
                const total = checklist.items.length;
                const completed = checklist.items.filter(
                    (i) => i.completed,
                ).length;

                return (
                    <Box key={checklist.id} sx={{ mb: 2.25 }}>
                        {/* Checklist header — name + fraction + delete */}
                        <Box
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1.25,
                            }}
                        >
                            <Typography
                                sx={{
                                    fontSize: 14.5,
                                    fontWeight: 700,
                                    fontFamily: harbor.headingFont,
                                    color: harbor.ink,
                                }}
                            >
                                {checklist.title}
                            </Typography>
                            <Box sx={{ flex: 1 }} />
                            {total > 0 && (
                                <Typography
                                    sx={{
                                        fontSize: 12,
                                        fontWeight: 700,
                                        color: harbor.sub,
                                        fontVariantNumeric: "tabular-nums",
                                    }}
                                >
                                    {completed}/{total}
                                </Typography>
                            )}
                            <Tooltip title="Remove checklist">
                                <IconButton
                                    size="small"
                                    onClick={() =>
                                        handleRemoveChecklist(checklist.id)
                                    }
                                    aria-label={`Remove checklist ${checklist.title}`}
                                    sx={{ color: harbor.faint }}
                                >
                                    <DeleteIcon sx={{ fontSize: 15 }} />
                                </IconButton>
                            </Tooltip>
                        </Box>

                        {/* Segmented progress — one segment per item */}
                        {total > 0 && (
                            <Box
                                role="progressbar"
                                aria-label={`${checklist.title} checklist progress`}
                                aria-valuemin={0}
                                aria-valuemax={total}
                                aria-valuenow={completed}
                                sx={{
                                    display: "flex",
                                    gap: "3px",
                                    mt: 1,
                                    mb: 0.75,
                                }}
                            >
                                {checklist.items.map((item, i) => (
                                    <Box
                                        key={item.id}
                                        sx={{
                                            flex: 1,
                                            height: 5,
                                            borderRadius: "3px",
                                            bgcolor:
                                                i < completed
                                                    ? harborHex.accent
                                                    : harbor.track,
                                            transition:
                                                "background-color 150ms ease-out",
                                        }}
                                    />
                                ))}
                            </Box>
                        )}

                        {/* Items */}
                        {checklist.items.map((item) => (
                            <Box
                                key={item.id}
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 1,
                                    py: "3px",
                                }}
                            >
                                <Checkbox
                                    size="small"
                                    checked={item.completed}
                                    icon={uncheckedIcon}
                                    checkedIcon={checkedIcon}
                                    onChange={() =>
                                        handleToggleItem(checklist.id, item.id)
                                    }
                                    sx={{ p: "4px" }}
                                    slotProps={{
                                        input: {
                                            "aria-label": `Toggle ${item.text}`,
                                        },
                                    }}
                                />
                                <TextField
                                    variant="standard"
                                    size="small"
                                    fullWidth
                                    value={item.text}
                                    onChange={(e) =>
                                        handleEditItem(
                                            checklist.id,
                                            item.id,
                                            e.target.value,
                                        )
                                    }
                                    slotProps={{
                                        htmlInput: {
                                            "aria-label": `Checklist item: ${item.text}`,
                                        },
                                        input: {
                                            disableUnderline: true,
                                            sx: {
                                                fontSize: 13.5,
                                                py: "4px",
                                                fontWeight: item.completed
                                                    ? 400
                                                    : 600,
                                                textDecoration: item.completed
                                                    ? "line-through"
                                                    : "none",
                                                color: item.completed
                                                    ? harbor.faint
                                                    : harbor.ink,
                                                transition:
                                                    "color 150ms ease-out",
                                            },
                                        },
                                    }}
                                />
                                <Tooltip title="Remove item">
                                    <IconButton
                                        size="small"
                                        onClick={() =>
                                            handleRemoveItem(
                                                checklist.id,
                                                item.id,
                                            )
                                        }
                                        aria-label={`Remove item ${item.text}`}
                                        sx={{ color: harbor.faint }}
                                    >
                                        <DeleteIcon sx={{ fontSize: 14 }} />
                                    </IconButton>
                                </Tooltip>
                            </Box>
                        ))}

                        {/* Add item */}
                        {addingItemTo === checklist.id ? (
                            <Box
                                sx={{
                                    display: "flex",
                                    gap: 1,
                                    mt: 0.5,
                                    ml: 3.5,
                                }}
                            >
                                <TextField
                                    inputRef={newItemRef}
                                    size="small"
                                    fullWidth
                                    autoFocus
                                    placeholder="Item text..."
                                    slotProps={{
                                        htmlInput: {
                                            "aria-label": "New checklist item",
                                        },
                                    }}
                                    value={newItemText}
                                    onChange={(e) =>
                                        setNewItemText(e.target.value)
                                    }
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            e.preventDefault();
                                            handleAddItem(checklist.id);
                                        }
                                        if (e.key === "Escape") {
                                            setAddingItemTo(null);
                                            setNewItemText("");
                                        }
                                    }}
                                />
                                <Button
                                    size="small"
                                    onClick={() => {
                                        setAddingItemTo(null);
                                        setNewItemText("");
                                    }}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    size="small"
                                    variant="contained"
                                    onClick={() => handleAddItem(checklist.id)}
                                    disabled={!newItemText.trim()}
                                >
                                    Add
                                </Button>
                            </Box>
                        ) : (
                            <Button
                                size="small"
                                startIcon={<AddIcon sx={{ fontSize: 13 }} />}
                                onClick={() => {
                                    setAddingItemTo(checklist.id);
                                    setNewItemText("");
                                    setTimeout(
                                        () => newItemRef.current?.focus(),
                                        0,
                                    );
                                }}
                                sx={{ ...addActionSx, mt: 0.25 }}
                            >
                                Add item
                            </Button>
                        )}
                    </Box>
                );
            })}

            {/* Add checklist — behind a hairline when checklists exist */}
            <Box
                sx={
                    checklists.length > 0
                        ? {
                              borderTop: `1px solid ${harbor.cardBorder}`,
                              pt: 1.5,
                          }
                        : undefined
                }
            >
                {addingChecklist ? (
                    <Box sx={{ display: "flex", gap: 1 }}>
                        <TextField
                            inputRef={newChecklistRef}
                            size="small"
                            fullWidth
                            autoFocus
                            placeholder="Checklist title..."
                            slotProps={{
                                htmlInput: {
                                    "aria-label": "New checklist title",
                                },
                            }}
                            value={newChecklistTitle}
                            onChange={(e) =>
                                setNewChecklistTitle(e.target.value)
                            }
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    e.preventDefault();
                                    handleAddChecklist();
                                }
                                if (e.key === "Escape") {
                                    setAddingChecklist(false);
                                    setNewChecklistTitle("");
                                }
                            }}
                        />
                        <Button
                            size="small"
                            onClick={() => {
                                setAddingChecklist(false);
                                setNewChecklistTitle("");
                            }}
                        >
                            Cancel
                        </Button>
                        <Button
                            size="small"
                            variant="contained"
                            onClick={handleAddChecklist}
                            disabled={!newChecklistTitle.trim()}
                        >
                            Add
                        </Button>
                    </Box>
                ) : (
                    <Button
                        size="small"
                        startIcon={<AddIcon sx={{ fontSize: 14 }} />}
                        onClick={() => {
                            setAddingChecklist(true);
                            setTimeout(
                                () => newChecklistRef.current?.focus(),
                                0,
                            );
                        }}
                        sx={{ ...addActionSx, fontSize: 13 }}
                    >
                        Add checklist
                    </Button>
                )}
            </Box>

            {checklists.length === 0 && !addingChecklist && (
                <Typography
                    sx={{ fontSize: 12.5, color: harbor.faint, mt: 0.75 }}
                >
                    No checklists yet.
                </Typography>
            )}
        </Box>
    );
}
