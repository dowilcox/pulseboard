import type { Task, User } from '@/types';
import { router } from '@inertiajs/react';
import Autocomplete from '@mui/material/Autocomplete';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

interface Props {
    task: Task;
    members: User[];
    teamId: string;
    boardId: string;
}

export default function AssigneeSelector({ task, members, teamId, boardId }: Props) {
    const currentAssignees = task.assignees ?? [];

    const handleChange = (_: unknown, newValue: User[]) => {
        router.put(
            route('tasks.assignees.update', [teamId, boardId, task.id]),
            { user_ids: newValue.map((u) => u.id) },
            { preserveScroll: true }
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
            renderInput={(params) => (
                <TextField {...params} size="small" placeholder="Add assignees..." />
            )}
            renderOption={(props, option) => (
                <Box component="li" {...props} key={option.id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Avatar sx={{ width: 24, height: 24, fontSize: '0.7rem' }} src={option.avatar_url}>
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
                                <Avatar sx={{ width: 20, height: 20, fontSize: '0.6rem' }} src={user.avatar_url}>
                                    {user.name.charAt(0).toUpperCase()}
                                </Avatar>
                            }
                            label={user.name}
                            size="small"
                        />
                    );
                })
            }
        />
    );
}
