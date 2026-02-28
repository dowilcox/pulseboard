import type { TaskTemplate } from '@/types';
import { router, useForm } from '@inertiajs/react';
import AddIcon from '@mui/icons-material/Add';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { type FormEvent, type KeyboardEvent, useRef, useState } from 'react';

interface Props {
    teamId: string;
    boardId: string;
    columnId: string;
    templates?: TaskTemplate[];
}

export default function QuickCreateTask({ teamId, boardId, columnId, templates = [] }: Props) {
    const [isCreating, setIsCreating] = useState(false);
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
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

    const handleCreateFromTemplate = (template: TaskTemplate) => {
        setAnchorEl(null);
        router.post(
            route('tasks.from-template', [teamId, boardId, columnId, template.id]),
            {},
            { preserveScroll: true },
        );
    };

    if (!isCreating) {
        return (
            <Box sx={{ display: 'flex', gap: 0.5 }}>
                <Button
                    startIcon={<AddIcon />}
                    size="small"
                    onClick={() => {
                        setIsCreating(true);
                        setTimeout(() => inputRef.current?.focus(), 0);
                    }}
                    sx={{
                        flex: 1,
                        justifyContent: 'flex-start',
                        color: 'text.secondary',
                        textTransform: 'none',
                        '&:hover': { bgcolor: 'action.hover' },
                    }}
                >
                    Add task
                </Button>
                {templates.length > 0 && (
                    <>
                        <Button
                            size="small"
                            onClick={(e) => setAnchorEl(e.currentTarget)}
                            sx={{
                                minWidth: 'auto',
                                color: 'text.secondary',
                                '&:hover': { bgcolor: 'action.hover' },
                            }}
                            aria-label="Create from template"
                        >
                            <ContentCopyIcon sx={{ fontSize: 16 }} />
                        </Button>
                        <Menu
                            anchorEl={anchorEl}
                            open={Boolean(anchorEl)}
                            onClose={() => setAnchorEl(null)}
                        >
                            <MenuItem disabled>
                                <Typography variant="caption" color="text.secondary">
                                    From template
                                </Typography>
                            </MenuItem>
                            {templates.map((tpl) => (
                                <MenuItem key={tpl.id} onClick={() => handleCreateFromTemplate(tpl)}>
                                    {tpl.name}
                                </MenuItem>
                            ))}
                        </Menu>
                    </>
                )}
            </Box>
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
