import { harbor, harborAvatarColor, harborHex } from "@/theme/harbor";
import type { Task } from "@/types";
import { Link as InertiaLink, router, useForm } from "@inertiajs/react";
import AddIcon from "@mui/icons-material/Add";
import Avatar from "@mui/material/Avatar";
import AvatarGroup from "@mui/material/AvatarGroup";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import LinearProgress from "@mui/material/LinearProgress";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { type FormEvent, useRef, useState } from "react";

interface Props {
    task: Task;
    teamSlug: string;
    boardSlug: string;
    columnId: string;
    /** Open the "new subtask" input straight away. */
    autoStartAdding?: boolean;
    /** Called when the new-subtask input closes while there are no subtasks. */
    onDismiss?: () => void;
}

export default function SubtaskList({
    task,
    teamSlug,
    boardSlug,
    columnId,
    autoStartAdding = false,
    onDismiss,
}: Props) {
    const subtasks = task.subtasks ?? [];
    const total = subtasks.length;
    const completed = subtasks.filter(
        (s) => s.completed_at !== null && s.completed_at !== undefined,
    ).length;
    const progress = total > 0 ? (completed / total) * 100 : 0;

    const [showForm, setShowForm] = useState(autoStartAdding);
    const inputRef = useRef<HTMLInputElement>(null);

    const { data, setData, post, processing, reset } = useForm({
        title: "",
        parent_task_id: task.id,
    });

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (!data.title.trim()) return;

        post(route("tasks.store", [teamSlug, boardSlug, columnId]), {
            preserveScroll: true,
            onSuccess: () => {
                reset("title");
                inputRef.current?.focus();
            },
        });
    };

    const closeForm = () => {
        setShowForm(false);
        reset("title");
        if (total === 0) onDismiss?.();
    };

    const handleToggleComplete = (subtask: Task) => {
        router.patch(
            route("tasks.toggle-complete", [teamSlug, boardSlug, subtask.slug]),
            {},
            { preserveScroll: true },
        );
    };

    return (
        <Box>
            {total > 0 && (
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                        mb: 1,
                    }}
                >
                    <LinearProgress
                        variant="determinate"
                        value={progress}
                        sx={{ flex: 1, height: 5, borderRadius: 3 }}
                    />
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
                </Box>
            )}

            {total === 0 && !showForm && (
                <Typography sx={{ fontSize: 12.5, color: harbor.faint }}>
                    No subtasks yet.
                </Typography>
            )}

            <List dense disablePadding>
                {subtasks.map((subtask) => {
                    const isCompleted =
                        subtask.completed_at !== null &&
                        subtask.completed_at !== undefined;
                    const assignees = subtask.assignees ?? [];
                    const number = subtask.task_number
                        ? `#${subtask.task_number} `
                        : "";
                    return (
                        <ListItem
                            key={subtask.id}
                            disablePadding
                            sx={{ alignItems: "center" }}
                        >
                            {/* Checkbox sits outside the link so both stay
                                independently focusable. */}
                            <Checkbox
                                size="small"
                                checked={isCompleted}
                                onChange={() => handleToggleComplete(subtask)}
                                slotProps={{
                                    input: {
                                        "aria-label": `Mark ${subtask.title} as ${isCompleted ? "incomplete" : "complete"}`,
                                    },
                                }}
                                sx={{ p: "6px", mr: 0.25 }}
                            />
                            <ListItemButton
                                component={InertiaLink}
                                href={route("tasks.show", [
                                    teamSlug,
                                    boardSlug,
                                    subtask.slug ?? subtask.id,
                                ])}
                                dense
                                sx={{ borderRadius: "8px", minWidth: 0 }}
                            >
                                <ListItemText
                                    primary={`${number}${subtask.title}`}
                                    primaryTypographyProps={{
                                        variant: "body2",
                                        noWrap: true,
                                        sx: {
                                            textDecoration: isCompleted
                                                ? "line-through"
                                                : "none",
                                            color: isCompleted
                                                ? "text.disabled"
                                                : "text.primary",
                                        },
                                    }}
                                />
                                {assignees.length > 0 && (
                                    <AvatarGroup
                                        max={3}
                                        sx={{
                                            ml: 1,
                                            "& .MuiAvatar-root": {
                                                width: 22,
                                                height: 22,
                                                fontSize: "0.65rem",
                                            },
                                        }}
                                    >
                                        {assignees.map((user) => (
                                            <Tooltip
                                                key={user.id}
                                                title={user.name}
                                            >
                                                <Avatar
                                                    src={user.avatar_url}
                                                    alt={user.name}
                                                    sx={{
                                                        bgcolor:
                                                            harborAvatarColor(
                                                                user.name,
                                                            ),
                                                        color: "#fff",
                                                    }}
                                                >
                                                    {user.name
                                                        ?.charAt(0)
                                                        .toUpperCase()}
                                                </Avatar>
                                            </Tooltip>
                                        ))}
                                    </AvatarGroup>
                                )}
                            </ListItemButton>
                        </ListItem>
                    );
                })}
            </List>

            {showForm ? (
                <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1 }}>
                    <TextField
                        inputRef={inputRef}
                        size="small"
                        fullWidth
                        autoFocus
                        placeholder="Subtask title..."
                        slotProps={{
                            htmlInput: { "aria-label": "New subtask title" },
                        }}
                        value={data.title}
                        onChange={(e) => setData("title", e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Escape") closeForm();
                        }}
                        onBlur={() => {
                            if (!data.title.trim()) closeForm();
                        }}
                        disabled={processing}
                    />
                </Box>
            ) : (
                <Button
                    size="small"
                    startIcon={<AddIcon sx={{ fontSize: 13 }} />}
                    onClick={() => {
                        setShowForm(true);
                        setTimeout(() => inputRef.current?.focus(), 0);
                    }}
                    sx={{
                        mt: 0.5,
                        px: 0.5,
                        minWidth: 0,
                        color: harborHex.accent,
                        fontSize: 12.5,
                        fontWeight: 700,
                        "&:hover": {
                            bgcolor: "transparent",
                            textDecoration: "underline",
                        },
                    }}
                >
                    Add subtask
                </Button>
            )}
        </Box>
    );
}
