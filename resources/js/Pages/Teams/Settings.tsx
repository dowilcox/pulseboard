import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, router, useForm } from '@inertiajs/react';
import { useState } from 'react';
import type { Label, Team } from '@/types';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

interface Props {
    team: Team;
    labels: Label[];
}

export default function TeamSettings({ team, labels }: Props) {
    const [addOpen, setAddOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [editColor, setEditColor] = useState('');
    const [deleteLabel, setDeleteLabel] = useState<Label | null>(null);

    const addForm = useForm({ name: '', color: '#9e9e9e' });

    const handleAdd = (e: React.FormEvent) => {
        e.preventDefault();
        addForm.post(route('labels.store', team.id), {
            onSuccess: () => {
                setAddOpen(false);
                addForm.reset();
            },
        });
    };

    const handleAddClose = () => {
        setAddOpen(false);
        addForm.reset();
    };

    const startEdit = (label: Label) => {
        setEditingId(label.id);
        setEditName(label.name);
        setEditColor(label.color);
    };

    const cancelEdit = () => {
        setEditingId(null);
    };

    const saveEdit = (label: Label) => {
        router.put(route('labels.update', [team.id, label.id]), {
            name: editName,
            color: editColor,
        }, {
            onSuccess: () => setEditingId(null),
        });
    };

    const confirmDelete = () => {
        if (!deleteLabel) return;
        router.delete(route('labels.destroy', [team.id, deleteLabel.id]), {
            onSuccess: () => setDeleteLabel(null),
        });
    };

    return (
        <AuthenticatedLayout
            currentTeam={team}
            header={
                <Typography variant="h6" component="h2" fontWeight={600}>
                    {team.name} Settings
                </Typography>
            }
        >
            <Head title={`Settings - ${team.name}`} />

            <Box sx={{ maxWidth: 800, display: 'flex', flexDirection: 'column', gap: 3 }}>
                {/* Labels */}
                <Card variant="outlined">
                    <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                            <Typography variant="subtitle1" fontWeight={600}>
                                Labels
                            </Typography>
                            <Button
                                startIcon={<AddIcon />}
                                size="small"
                                onClick={() => setAddOpen(true)}
                            >
                                Add Label
                            </Button>
                        </Box>

                        {labels.length === 0 ? (
                            <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                                No labels yet. Add a label to categorize tasks.
                            </Typography>
                        ) : (
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                {labels.map((label) => (
                                    <Box
                                        key={label.id}
                                        sx={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 2,
                                            py: 1,
                                            px: 1.5,
                                            borderRadius: 1,
                                            '&:hover': { bgcolor: 'action.hover' },
                                        }}
                                    >
                                        {editingId === label.id ? (
                                            <>
                                                <TextField
                                                    size="small"
                                                    value={editName}
                                                    onChange={(e) => setEditName(e.target.value)}
                                                    sx={{ flex: 1 }}
                                                    slotProps={{
                                                        htmlInput: { maxLength: 50 },
                                                    }}
                                                />
                                                <TextField
                                                    size="small"
                                                    type="color"
                                                    value={editColor}
                                                    onChange={(e) => setEditColor(e.target.value)}
                                                    sx={{ width: 80 }}
                                                    slotProps={{
                                                        input: { sx: { cursor: 'pointer' } },
                                                    }}
                                                />
                                                <Button
                                                    size="small"
                                                    variant="contained"
                                                    onClick={() => saveEdit(label)}
                                                    disabled={!editName.trim()}
                                                >
                                                    Save
                                                </Button>
                                                <Tooltip title="Cancel">
                                                    <IconButton size="small" onClick={cancelEdit}>
                                                        <CloseIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            </>
                                        ) : (
                                            <>
                                                <Box
                                                    sx={{
                                                        width: 16,
                                                        height: 16,
                                                        borderRadius: '50%',
                                                        bgcolor: label.color,
                                                        flexShrink: 0,
                                                    }}
                                                />
                                                <Typography variant="body2" sx={{ flex: 1 }}>
                                                    {label.name}
                                                </Typography>
                                                <Tooltip title="Edit">
                                                    <IconButton size="small" onClick={() => startEdit(label)}>
                                                        <EditIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title="Delete">
                                                    <IconButton
                                                        size="small"
                                                        color="error"
                                                        onClick={() => setDeleteLabel(label)}
                                                    >
                                                        <DeleteIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            </>
                                        )}
                                    </Box>
                                ))}
                            </Box>
                        )}
                    </CardContent>
                </Card>
            </Box>

            {/* Add Label Dialog */}
            <Dialog open={addOpen} onClose={handleAddClose} maxWidth="xs" fullWidth>
                <form onSubmit={handleAdd}>
                    <DialogTitle>Add Label</DialogTitle>
                    <DialogContent>
                        <TextField
                            autoFocus
                            label="Name"
                            fullWidth
                            required
                            value={addForm.data.name}
                            onChange={(e) => addForm.setData('name', e.target.value)}
                            error={!!addForm.errors.name}
                            helperText={addForm.errors.name}
                            sx={{ mt: 1, mb: 2 }}
                            slotProps={{
                                htmlInput: { maxLength: 50 },
                            }}
                        />
                        <TextField
                            label="Color"
                            fullWidth
                            type="color"
                            value={addForm.data.color}
                            onChange={(e) => addForm.setData('color', e.target.value)}
                            error={!!addForm.errors.color}
                            helperText={addForm.errors.color}
                            slotProps={{
                                input: { sx: { cursor: 'pointer' } },
                            }}
                        />
                    </DialogContent>
                    <DialogActions sx={{ px: 3, py: 2 }}>
                        <Button onClick={handleAddClose}>Cancel</Button>
                        <Button
                            type="submit"
                            variant="contained"
                            disabled={addForm.processing}
                        >
                            Add
                        </Button>
                    </DialogActions>
                </form>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={!!deleteLabel} onClose={() => setDeleteLabel(null)} maxWidth="xs">
                <DialogTitle>Delete Label</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Are you sure you want to delete "{deleteLabel?.name}"? It will be removed from all tasks.
                    </DialogContentText>
                </DialogContent>
                <DialogActions sx={{ px: 3, py: 2 }}>
                    <Button onClick={() => setDeleteLabel(null)}>Cancel</Button>
                    <Button onClick={confirmDelete} color="error" variant="contained">
                        Delete
                    </Button>
                </DialogActions>
            </Dialog>
        </AuthenticatedLayout>
    );
}
