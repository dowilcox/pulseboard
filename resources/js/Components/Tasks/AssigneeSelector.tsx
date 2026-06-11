import { harbor, harborAvatarColor } from "@/theme/harbor";
import type { Task, User } from "@/types";
import { router } from "@inertiajs/react";
import Autocomplete from "@mui/material/Autocomplete";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

interface Props {
    task: Task;
    members: User[];
    teamSlug: string;
    boardSlug: string;
}

export default function AssigneeSelector({
    task,
    members,
    teamSlug,
    boardSlug,
}: Props) {
    const currentAssignees = task.assignees ?? [];

    const handleChange = (_: unknown, newValue: User[]) => {
        router.put(
            route("tasks.assignees.update", [teamSlug, boardSlug, task.slug]),
            { user_ids: newValue.map((u) => u.id) },
            { preserveScroll: true },
        );
    };

    return (
        <Autocomplete
            multiple
            options={members}
            value={currentAssignees}
            onChange={handleChange}
            getOptionLabel={(option) => option.name}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            slotProps={{
                popupIndicator: { "aria-label": "Open assignee options" },
            }}
            renderInput={(params) => (
                <TextField
                    {...params}
                    size="small"
                    placeholder="Add assignees..."
                    inputProps={{
                        ...params.inputProps,
                        "aria-label": "Add assignees",
                    }}
                />
            )}
            renderOption={(props, option) => (
                <Box
                    component="li"
                    {...props}
                    key={option.id}
                    sx={{ display: "flex", alignItems: "center", gap: 1 }}
                >
                    <Avatar
                        alt=""
                        sx={{ width: 24, height: 24, fontSize: "0.7rem" }}
                        src={option.avatar_url}
                    >
                        {option.name.charAt(0).toUpperCase()}
                    </Avatar>
                    <Typography variant="body2">{option.name}</Typography>
                </Box>
            )}
            renderTags={(value, getTagProps) =>
                value.map((user, index) => {
                    const { key, ...rest } = getTagProps({ index });
                    return (
                        <Chip
                            key={key}
                            {...rest}
                            avatar={
                                <Avatar
                                    alt=""
                                    sx={{
                                        fontSize: "0.65rem",
                                        bgcolor: harborAvatarColor(user.id),
                                        color: "#fff",
                                    }}
                                    src={user.avatar_url}
                                >
                                    {user.name.charAt(0).toUpperCase()}
                                </Avatar>
                            }
                            label={user.name}
                            size="small"
                            sx={{
                                height: "auto",
                                py: "4px",
                                pl: "4px",
                                // Card-on-countBg so the pill reads as a pill
                                // against the selector field it sits in
                                bgcolor: harbor.card,
                                boxShadow: harbor.chipShadow,
                                color: harbor.ink,
                                fontSize: 12.5,
                                fontWeight: 700,
                                "& .MuiChip-avatar": {
                                    width: 22,
                                    height: 22,
                                    ml: 0,
                                },
                                "& .MuiChip-deleteIcon": {
                                    color: harbor.faint,
                                    "&:hover": { color: harbor.ink },
                                },
                            }}
                        />
                    );
                })
            }
        />
    );
}
