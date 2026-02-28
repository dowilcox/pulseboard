import { useForm } from '@inertiajs/react';
import AddIcon from '@mui/icons-material/Add';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import { type FormEvent, type KeyboardEvent, useRef, useState } from 'react';

interface Props {
    teamId: string;
    boardId: string;
    columnId: string;
}

export default function QuickCreateTask({ teamId, boardId, columnId }: Props) {
    const [isCreating, setIsCreating] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const { data, setData, post, processing, reset } = useForm({
        title: '',
    });

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (!data.title.trim()) return;

        post(route('tasks.store', [teamId, boardId, columnId]), {
            preserveScroll: true,
            onSuccess: () => {
                reset('title');
                inputRef.current?.focus();
            },
        });
    };

    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            setIsCreating(false);
            reset('title');
        }
    };

    if (!isCreating) {
        return (
            <Button
                startIcon={<AddIcon />}
                size="small"
                onClick={() => {
                    setIsCreating(true);
                    setTimeout(() => inputRef.current?.focus(), 0);
                }}
                sx={{
                    width: '100%',
                    justifyContent: 'flex-start',
                    color: 'text.secondary',
                    textTransform: 'none',
                    '&:hover': { bgcolor: 'action.hover' },
                }}
            >
                Add task
            </Button>
        );
    }

    return (
        <Box component="form" onSubmit={handleSubmit}>
            <TextField
                inputRef={inputRef}
                size="small"
                fullWidth
                autoFocus
                placeholder="Task title..."
                value={data.title}
                onChange={(e) => setData('title', e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={() => {
                    if (!data.title.trim()) {
                        setIsCreating(false);
                        reset('title');
                    }
                }}
                disabled={processing}
                sx={{
                    '& .MuiOutlinedInput-root': {
                        bgcolor: 'background.paper',
                    },
                }}
            />
        </Box>
    );
}
