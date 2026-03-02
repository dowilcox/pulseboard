import ColorSwatchPicker from '@/Components/Common/ColorSwatchPicker';
import { LABEL_COLORS } from '@/constants/labelColors';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import type { Label, PageProps, Team, UserWithTeamPivot } from '@/types';
import { getContrastText } from '@/utils/colorContrast';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import { useState } from 'react';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import PersonRemoveIcon from '@mui/icons-material/PersonRemove';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import FormControl from '@mui/material/FormControl';
import IconButton from '@mui/material/IconButton';
import InputLabel from '@mui/material/InputLabel';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import ListItemText from '@mui/material/ListItemText';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

interface Props {
    team: Team;
    labels: Label[];
    members: UserWithTeamPivot[];
    canManageMembers: boolean;
    canManageAdmins: boolean;
}

const roleColor = (role: string) =>
    role === 'owner' ? 'primary' : role === 'admin' ? 'secondary' : 'default';

export default function TeamSettings({ team, labels, members, canManageMembers, canManageAdmins }: Props) {
    const { auth } = usePage<PageProps>().props;
    const currentUserId = auth.user.id;

    // Label state
    const [addLabelOpen, setAddLabelOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [editColor, setEditColor] = useState('');
    const [deleteLabel, setDeleteLabel] = useState<Label | null>(null);

    const addLabelForm = useForm({ name: '', color: LABEL_COLORS[0] as string });

    // Member state
    const [addMemberOpen, setAddMemberOpen] = useState(false);
    const [removeMember, setRemoveMember] = useState<UserWithTeamPivot | null>(null);

    const addMemberForm = useForm({ email: '', role: 'member' as string });

    // Label handlers
    const handleAddLabel = (e: React.FormEvent) => {
        e.preventDefault();
        addLabelForm.post(route('labels.store', team.id), {
            onSuccess: () => {
                setAddLabelOpen(false);
                addLabelForm.reset();
            },
        });
    };

    const handleAddLabelClose = () => {
        setAddLabelOpen(false);
        addLabelForm.reset();
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

    const confirmDeleteLabel = () => {
        if (!deleteLabel) return;
        router.delete(route('labels.destroy', [team.id, deleteLabel.id]), {
            onSuccess: () => setDeleteLabel(null),
        });
    };

    // Member handlers
    const handleAddMember = (e: React.FormEvent) => {
        e.preventDefault();
        addMemberForm.post(route('teams.members.store', team.id), {
            onSuccess: () => {
                setAddMemberOpen(false);
                addMemberForm.reset();
            },
        });
    };

    const handleAddMemberClose = () => {
        setAddMemberOpen(false);
        addMemberForm.reset();
    };

    const handleRoleChange = (member: UserWithTeamPivot, newRole: string) => {
        router.put(route('teams.members.update', [team.id, member.id]), {
            role: newRole,
        });
    };

    const confirmRemoveMember = () => {
        if (!removeMember) return;
        router.delete(route('teams.members.destroy', [team.id, removeMember.id]), {
            onSuccess: () => setRemoveMember(null),
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
                {/* Members */}
                <Card variant="outlined">
                    <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                            <Typography variant="subtitle1" fontWeight={600}>
                                Members ({members.length})
                            </Typography>
                            {canManageMembers && (
                                <Button
                                    startIcon={<PersonAddIcon />}
                                    size="small"
                                    onClick={() => setAddMemberOpen(true)}
                                >
                                    Add Member
                                </Button>
                            )}
                        </Box>

                        <List dense disablePadding>
                            {members.map((member) => {
                                const isCurrentUser = member.id === currentUserId;
                                const isElevated = member.pivot.role === 'admin' || member.pivot.role === 'owner';
                                const canEdit = canManageMembers && !isCurrentUser
                                    && (canManageAdmins || !isElevated);

                                return (
                                    <ListItem
                                        key={member.id}
                                        disableGutters
                                        sx={{
                                            py: 0.75,
                                            px: 1,
                                            borderRadius: 1,
                                            '&:hover': { bgcolor: 'action.hover' },
                                        }}
                                        secondaryAction={
                                            canEdit ? (
                                                <Tooltip title="Remove member">
                                                    <IconButton
                                                        edge="end"
                                                        size="small"
                                                        color="error"
                                                        onClick={() => setRemoveMember(member)}
                                                    >
                                                        <PersonRemoveIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            ) : undefined
                                        }
                                    >
                                        <ListItemAvatar sx={{ minWidth: 40 }}>
                                            <Avatar sx={{ width: 32, height: 32, fontSize: '0.85rem', fontWeight: 600 }}>
                                                {member.name.charAt(0).toUpperCase()}
                                            </Avatar>
                                        </ListItemAvatar>
                                        <ListItemText
                                            primary={
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                    <Typography variant="body2" fontWeight={500}>
                                                        {member.name}
                                                    </Typography>
                                                    {isCurrentUser && (
                                                        <Typography variant="caption" color="text.secondary">
                                                            (you)
                                                        </Typography>
                                                    )}
                                                </Box>
                                            }
                                            secondary={member.email}
                                            secondaryTypographyProps={{ variant: 'caption' }}
                                        />
                                        {canEdit ? (
                                            <FormControl size="small" sx={{ minWidth: 100, mr: 4 }}>
                                                <Select
                                                    value={member.pivot.role}
                                                    onChange={(e) => handleRoleChange(member, e.target.value)}
                                                    variant="outlined"
                                                    sx={{ fontSize: '0.8rem', height: 28 }}
                                                >
                                                    <MenuItem value="member">Member</MenuItem>
                                                    <MenuItem value="admin">Admin</MenuItem>
                                                    {canManageAdmins && (
                                                        <MenuItem value="owner">Owner</MenuItem>
                                                    )}
                                                </Select>
                                            </FormControl>
                                        ) : (
                                            <Chip
                                                label={member.pivot.role}
                                                size="small"
                                                variant="outlined"
                                                color={roleColor(member.pivot.role)}
                                                sx={{ mr: canManageMembers ? 4 : 0 }}
                                            />
                                        )}
                                    </ListItem>
                                );
                            })}
                        </List>
                    </CardContent>
                </Card>

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
                                onClick={() => setAddLabelOpen(true)}
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
                                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, width: '100%' }}>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    <TextField
                                                        size="small"
                                                        value={editName}
                                                        onChange={(e) => setEditName(e.target.value)}
                                                        sx={{ flex: 1 }}
                                                        slotProps={{
                                                            htmlInput: { maxLength: 50 },
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
                                                </Box>
                                                <ColorSwatchPicker
                                                    value={editColor}
                                                    onChange={setEditColor}
                                                />
                                            </Box>
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

            {/* Add Member Dialog */}
            <Dialog open={addMemberOpen} onClose={handleAddMemberClose} maxWidth="xs" fullWidth>
                <form onSubmit={handleAddMember}>
                    <DialogTitle>Add Member</DialogTitle>
                    <DialogContent>
                        <TextField
                            autoFocus
                            label="Email Address"
                            type="email"
                            fullWidth
                            required
                            value={addMemberForm.data.email}
                            onChange={(e) => addMemberForm.setData('email', e.target.value)}
                            error={!!addMemberForm.errors.email}
                            helperText={addMemberForm.errors.email}
                            sx={{ mt: 1, mb: 2 }}
                        />
                        <FormControl fullWidth>
                            <InputLabel>Role</InputLabel>
                            <Select
                                label="Role"
                                value={addMemberForm.data.role}
                                onChange={(e) => addMemberForm.setData('role', e.target.value)}
                            >
                                <MenuItem value="member">Member</MenuItem>
                                <MenuItem value="admin">Admin</MenuItem>
                                {canManageAdmins && (
                                    <MenuItem value="owner">Owner</MenuItem>
                                )}
                            </Select>
                        </FormControl>
                    </DialogContent>
                    <DialogActions sx={{ px: 3, py: 2 }}>
                        <Button onClick={handleAddMemberClose}>Cancel</Button>
                        <Button
                            type="submit"
                            variant="contained"
                            disabled={addMemberForm.processing}
                        >
                            Add
                        </Button>
                    </DialogActions>
                </form>
            </Dialog>

            {/* Remove Member Confirmation Dialog */}
            <Dialog open={!!removeMember} onClose={() => setRemoveMember(null)} maxWidth="xs">
                <DialogTitle>Remove Member</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Are you sure you want to remove {removeMember?.name} from this team? They will lose access to all team boards.
                    </DialogContentText>
                </DialogContent>
                <DialogActions sx={{ px: 3, py: 2 }}>
                    <Button onClick={() => setRemoveMember(null)}>Cancel</Button>
                    <Button onClick={confirmRemoveMember} color="error" variant="contained">
                        Remove
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Add Label Dialog */}
            <Dialog open={addLabelOpen} onClose={handleAddLabelClose} maxWidth="xs" fullWidth>
                <form onSubmit={handleAddLabel}>
                    <DialogTitle>Add Label</DialogTitle>
                    <DialogContent>
                        <TextField
                            autoFocus
                            label="Name"
                            fullWidth
                            required
                            value={addLabelForm.data.name}
                            onChange={(e) => addLabelForm.setData('name', e.target.value)}
                            error={!!addLabelForm.errors.name}
                            helperText={addLabelForm.errors.name}
                            sx={{ mt: 1, mb: 2 }}
                            slotProps={{
                                htmlInput: { maxLength: 50 },
                            }}
                        />
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                            Color
                        </Typography>
                        <ColorSwatchPicker
                            value={addLabelForm.data.color}
                            onChange={(color) => addLabelForm.setData('color', color)}
                        />
                        {addLabelForm.errors.color && (
                            <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>
                                {addLabelForm.errors.color}
                            </Typography>
                        )}
                        {addLabelForm.data.name && (
                            <Box sx={{ mt: 2 }}>
                                <Typography variant="caption" color="text.secondary">
                                    Preview
                                </Typography>
                                <Box sx={{ mt: 0.5 }}>
                                    <Chip
                                        label={addLabelForm.data.name}
                                        size="small"
                                        sx={{
                                            fontWeight: 600,
                                            bgcolor: addLabelForm.data.color,
                                            color: getContrastText(addLabelForm.data.color),
                                        }}
                                    />
                                </Box>
                            </Box>
                        )}
                    </DialogContent>
                    <DialogActions sx={{ px: 3, py: 2 }}>
                        <Button onClick={handleAddLabelClose}>Cancel</Button>
                        <Button
                            type="submit"
                            variant="contained"
                            disabled={addLabelForm.processing}
                        >
                            Add
                        </Button>
                    </DialogActions>
                </form>
            </Dialog>

            {/* Delete Label Confirmation Dialog */}
            <Dialog open={!!deleteLabel} onClose={() => setDeleteLabel(null)} maxWidth="xs">
                <DialogTitle>Delete Label</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Are you sure you want to delete "{deleteLabel?.name}"? It will be removed from all tasks.
                    </DialogContentText>
                </DialogContent>
                <DialogActions sx={{ px: 3, py: 2 }}>
                    <Button onClick={() => setDeleteLabel(null)}>Cancel</Button>
                    <Button onClick={confirmDeleteLabel} color="error" variant="contained">
                        Delete
                    </Button>
                </DialogActions>
            </Dialog>
        </AuthenticatedLayout>
    );
}
