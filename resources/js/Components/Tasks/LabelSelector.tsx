import type { Label, Task } from '@/types';
import { router } from '@inertiajs/react';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import TextField from '@mui/material/TextField';

interface Props {
    task: Task;
    labels: Label[];
    teamId: string;
    boardId: string;
}

export default function LabelSelector({ task, labels, teamId, boardId }: Props) {
    const currentLabels = task.labels ?? [];

    const handleChange = (_: unknown, newValue: Label[]) => {
        router.put(
            route('tasks.labels.update', [teamId, boardId, task.id]),
            { label_ids: newValue.map((l) => l.id) },
            { preserveScroll: true }
        );
    };

    return (
        <Autocomplete
            multiple
            options={labels}
            value={currentLabels}
            onChange={handleChange}
            getOptionLabel={(option) => option.name}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            renderInput={(params) => (
                <TextField {...params} size="small" placeholder="Add labels..." />
            )}
            renderOption={(props, option) => (
                <Box component="li" {...props} key={option.id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box
                        sx={{
                            width: 14,
                            height: 14,
                            borderRadius: '50%',
                            bgcolor: option.color,
                            flexShrink: 0,
                        }}
                    />
                    {option.name}
                </Box>
            )}
            renderTags={(value, getTagProps) =>
                value.map((label, index) => {
                    const { key, ...rest } = getTagProps({ index });
                    return (
                        <Chip
                            key={key}
                            {...rest}
                            label={label.name}
                            size="small"
                            sx={{
                                bgcolor: label.color,
                                color: '#fff',
                            }}
                        />
                    );
                })
            }
        />
    );
}
