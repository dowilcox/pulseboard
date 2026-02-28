import type { Checklist, ChecklistItem } from '@/types';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useRef, useState } from 'react';

interface Props {
    checklists: Checklist[];
    onChange: (checklists: Checklist[]) => void;
}

export default function ChecklistEditor({ checklists, onChange }: Props) {
    const [newChecklistTitle, setNewChecklistTitle] = useState('');
    const [addingChecklist, setAddingChecklist] = useState(false);
    const [addingItemTo, setAddingItemTo] = useState<string | null>(null);
    const [newItemText, setNewItemText] = useState('');
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
        setNewChecklistTitle('');
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
                              item.id === itemId ? { ...item, completed: !item.completed } : item,
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
                c.id === checklistId ? { ...c, items: [...c.items, newItem] } : c,
            ),
        );
        setNewItemText('');
        setTimeout(() => newItemRef.current?.focus(), 0);
    };

    const handleRemoveItem = (checklistId: string, itemId: string) => {
        onChange(
            checklists.map((c) =>
                c.id === checklistId
                    ? { ...c, items: c.items.filter((item) => item.id !== itemId) }
                    : c,
            ),
        );
    };

    const handleEditItem = (checklistId: string, itemId: string, text: string) => {
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
                const completed = checklist.items.filter((i) => i.completed).length;
                const progress = total > 0 ? (completed / total) * 100 : 0;

                return (
                    <Box key={checklist.id} sx={{ mb: 2 }}>
                        {/* Checklist header */}
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                            <Typography variant="body2" fontWeight={600}>
                                {checklist.title}
                            </Typography>
                            <Tooltip title="Remove checklist">
                                <IconButton
                                    size="small"
                                    onClick={() => handleRemoveChecklist(checklist.id)}
                                    aria-label={`Remove checklist ${checklist.title}`}
                                >
                                    <DeleteIcon fontSize="small" />
                                </IconButton>
                            </Tooltip>
                        </Box>

                        {/* Progress */}
                        {total > 0 && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                <LinearProgress
                                    variant="determinate"
                                    value={progress}
                                    sx={{ flex: 1, height: 6, borderRadius: 3 }}
                                />
                                <Typography variant="caption" color="text.secondary">
                                    {completed}/{total}
                                </Typography>
                            </Box>
                        )}

                        {/* Items */}
                        {checklist.items.map((item) => (
                            <Box
                                key={item.id}
                                sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: -1 }}
                            >
                                <Checkbox
                                    size="small"
                                    checked={item.completed}
                                    onChange={() => handleToggleItem(checklist.id, item.id)}
                                    aria-label={`Toggle ${item.text}`}
                                />
                                <TextField
                                    variant="standard"
                                    size="small"
                                    fullWidth
                                    value={item.text}
                                    onChange={(e) => handleEditItem(checklist.id, item.id, e.target.value)}
                                    slotProps={{
                                        input: {
                                            disableUnderline: true,
                                            sx: {
                                                fontSize: '0.875rem',
                                                textDecoration: item.completed ? 'line-through' : 'none',
                                                color: item.completed ? 'text.disabled' : 'text.primary',
                                            },
                                        },
                                    }}
                                />
                                <Tooltip title="Remove item">
                                    <IconButton
                                        size="small"
                                        onClick={() => handleRemoveItem(checklist.id, item.id)}
                                        aria-label={`Remove item ${item.text}`}
                                        sx={{ opacity: 0.5, '&:hover': { opacity: 1 } }}
                                    >
                                        <DeleteIcon sx={{ fontSize: 14 }} />
                                    </IconButton>
                                </Tooltip>
                            </Box>
                        ))}

                        {/* Add item */}
                        {addingItemTo === checklist.id ? (
                            <Box sx={{ display: 'flex', gap: 1, mt: 0.5, ml: 3.5 }}>
                                <TextField
                                    inputRef={newItemRef}
                                    size="small"
                                    fullWidth
                                    autoFocus
                                    placeholder="Item text..."
                                    value={newItemText}
                                    onChange={(e) => setNewItemText(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleAddItem(checklist.id);
                                        }
                                        if (e.key === 'Escape') {
                                            setAddingItemTo(null);
                                            setNewItemText('');
                                        }
                                    }}
                                />
                                <Button
                                    size="small"
                                    variant="contained"
                                    onClick={() => handleAddItem(checklist.id)}
                                    disabled={!newItemText.trim()}
                                >
                                    Add
                                </Button>
                                <Button
                                    size="small"
                                    onClick={() => {
                                        setAddingItemTo(null);
                                        setNewItemText('');
                                    }}
                                >
                                    Cancel
                                </Button>
                            </Box>
                        ) : (
                            <Button
                                size="small"
                                startIcon={<AddIcon />}
                                onClick={() => {
                                    setAddingItemTo(checklist.id);
                                    setNewItemText('');
                                    setTimeout(() => newItemRef.current?.focus(), 0);
                                }}
                                sx={{ ml: 3, mt: 0.5, textTransform: 'none', color: 'text.secondary' }}
                            >
                                Add item
                            </Button>
                        )}
                    </Box>
                );
            })}

            {/* Add checklist */}
            {addingChecklist ? (
                <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                    <TextField
                        inputRef={newChecklistRef}
                        size="small"
                        fullWidth
                        autoFocus
                        placeholder="Checklist title..."
                        value={newChecklistTitle}
                        onChange={(e) => setNewChecklistTitle(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddChecklist();
                            }
                            if (e.key === 'Escape') {
                                setAddingChecklist(false);
                                setNewChecklistTitle('');
                            }
                        }}
                    />
                    <Button
                        size="small"
                        variant="contained"
                        onClick={handleAddChecklist}
                        disabled={!newChecklistTitle.trim()}
                    >
                        Add
                    </Button>
                    <Button
                        size="small"
                        onClick={() => {
                            setAddingChecklist(false);
                            setNewChecklistTitle('');
                        }}
                    >
                        Cancel
                    </Button>
                </Box>
            ) : (
                <Button
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={() => {
                        setAddingChecklist(true);
                        setTimeout(() => newChecklistRef.current?.focus(), 0);
                    }}
                    sx={{ mt: 1, textTransform: 'none' }}
                >
                    Add checklist
                </Button>
            )}

            {checklists.length === 0 && !addingChecklist && (
                <Typography variant="body2" color="text.secondary">
                    No checklists yet.
                </Typography>
            )}
        </Box>
    );
}
