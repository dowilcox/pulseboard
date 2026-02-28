import { Head, router, useForm } from '@inertiajs/react';
import { useState } from 'react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import AdminNav from '@/Components/Admin/AdminNav';
import type { PageProps, User } from '@/types';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import LockResetIcon from '@mui/icons-material/LockReset';
import PersonOffIcon from '@mui/icons-material/PersonOff';
import PersonIcon from '@mui/icons-material/Person';
import SearchIcon from '@mui/icons-material/Search';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Paper from '@mui/material/Paper';
import Switch from '@mui/material/Switch';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TablePagination from '@mui/material/TablePagination';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

interface PaginatedUsers {
    data: User[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
}

interface Props extends PageProps {
    users: PaginatedUsers;
    filters: { search: string | null };
}

interface UserFormData {
    name: string;
    email: string;
    password: string;
    is_admin: boolean;
}

interface EditFormData {
    name: string;
    email: string;
    is_admin: boolean;
}

export default function Users({ users, filters }: Props) {
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [search, setSearch] = useState(filters.search ?? '');
    const [confirmAction, setConfirmAction] = useState<{ user: User; action: 'toggle' | 'reset' } | null>(null);

    const createForm = useForm<UserFormData>({
        name: '',
        email: '',
        password: '',
        is_admin: false,
    });

    const editForm = useForm<EditFormData>({
        name: '',
        email: '',
        is_admin: false,
    });

    const openCreateDialog = () => {
        setEditingUser(null);
        createForm.reset();
        createForm.clearErrors();
        setDialogOpen(true);
    };

    const openEditDialog = (user: User) => {
        setEditingUser(user);
        editForm.setData({
            name: user.name,
            email: user.email,
            is_admin: user.is_admin,
        });
        editForm.clearErrors();
        setDialogOpen(true);
    };

    const handleSubmit = () => {
        if (editingUser) {
            editForm.put(route('admin.users.update', editingUser.id), {
                onSuccess: () => setDialogOpen(false),
            });
        } else {
            createForm.post(route('admin.users.store'), {
                onSuccess: () => setDialogOpen(false),
            });
        }
    };

    const handleSearch = () => {
        router.get(route('admin.users.index'), { search: search || undefined }, { preserveState: true });
    };

    const handleToggleActive = (user: User) => {
        router.post(route('admin.users.toggle-active', user.id), {}, {
            onSuccess: () => setConfirmAction(null),
        });
    };

    const handleResetPassword = (user: User) => {
        router.post(route('admin.users.reset-password', user.id), {}, {
            onSuccess: () => setConfirmAction(null),
        });
    };

    const handlePageChange = (_: unknown, page: number) => {
        router.get(route('admin.users.index'), { page: page + 1, search: filters.search || undefined }, { preserveState: true });
    };

    return (
        <AuthenticatedLayout
            header={
                <Typography variant="h6" component="h2" fontWeight={600}>
                    User Management
                </Typography>
            }
        >
            <Head title="User Management" />

            <Box sx={{ display: 'flex' }}>
                <AdminNav />

                <Box sx={{ flex: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, gap: 2 }}>
                        <TextField
                            size="small"
                            placeholder="Search users..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            slotProps={{
                                input: {
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <SearchIcon fontSize="small" />
                                        </InputAdornment>
                                    ),
                                },
                            }}
                            sx={{ minWidth: 250 }}
                        />
                        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateDialog}>
                            Add User
                        </Button>
                    </Box>

                    <TableContainer component={Paper} variant="outlined">
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell>Name</TableCell>
                                    <TableCell>Email</TableCell>
                                    <TableCell>Auth Provider</TableCell>
                                    <TableCell>Role</TableCell>
                                    <TableCell>Status</TableCell>
                                    <TableCell>Created</TableCell>
                                    <TableCell align="right">Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {users.data.map((user) => (
                                    <TableRow key={user.id}>
                                        <TableCell>
                                            <Typography fontWeight={500}>{user.name}</Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Typography variant="body2" color="text.secondary">
                                                {user.email}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Chip label={user.auth_provider} size="small" variant="outlined" />
                                        </TableCell>
                                        <TableCell>
                                            <Chip
                                                label={user.is_admin ? 'Admin' : 'User'}
                                                color={user.is_admin ? 'primary' : 'default'}
                                                size="small"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Chip
                                                label={user.deactivated_at ? 'Deactivated' : 'Active'}
                                                color={user.deactivated_at ? 'error' : 'success'}
                                                size="small"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Typography variant="body2" color="text.secondary">
                                                {new Date(user.created_at).toLocaleDateString()}
                                            </Typography>
                                        </TableCell>
                                        <TableCell align="right">
                                            <Tooltip title="Edit">
                                                <IconButton size="small" onClick={() => openEditDialog(user)}>
                                                    <EditIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip title={user.deactivated_at ? 'Reactivate' : 'Deactivate'}>
                                                <IconButton
                                                    size="small"
                                                    color={user.deactivated_at ? 'success' : 'warning'}
                                                    onClick={() => setConfirmAction({ user, action: 'toggle' })}
                                                >
                                                    {user.deactivated_at ? <PersonIcon fontSize="small" /> : <PersonOffIcon fontSize="small" />}
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip title="Reset Password">
                                                <IconButton
                                                    size="small"
                                                    onClick={() => setConfirmAction({ user, action: 'reset' })}
                                                >
                                                    <LockResetIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                        <TablePagination
                            component="div"
                            count={users.total}
                            page={users.current_page - 1}
                            rowsPerPage={users.per_page}
                            onPageChange={handlePageChange}
                            rowsPerPageOptions={[25]}
                        />
                    </TableContainer>
                </Box>
            </Box>

            {/* Create/Edit Dialog */}
            <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>{editingUser ? 'Edit User' : 'Create User'}</DialogTitle>
                <DialogContent>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                        <TextField
                            label="Name"
                            value={editingUser ? editForm.data.name : createForm.data.name}
                            onChange={(e) =>
                                editingUser
                                    ? editForm.setData('name', e.target.value)
                                    : createForm.setData('name', e.target.value)
                            }
                            error={!!(editingUser ? editForm.errors.name : createForm.errors.name)}
                            helperText={editingUser ? editForm.errors.name : createForm.errors.name}
                            fullWidth
                            required
                        />
                        <TextField
                            label="Email"
                            type="email"
                            value={editingUser ? editForm.data.email : createForm.data.email}
                            onChange={(e) =>
                                editingUser
                                    ? editForm.setData('email', e.target.value)
                                    : createForm.setData('email', e.target.value)
                            }
                            error={!!(editingUser ? editForm.errors.email : createForm.errors.email)}
                            helperText={editingUser ? editForm.errors.email : createForm.errors.email}
                            fullWidth
                            required
                        />
                        {!editingUser && (
                            <TextField
                                label="Password"
                                type="password"
                                value={createForm.data.password}
                                onChange={(e) => createForm.setData('password', e.target.value)}
                                error={!!createForm.errors.password}
                                helperText={createForm.errors.password}
                                fullWidth
                                required
                            />
                        )}
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={editingUser ? editForm.data.is_admin : createForm.data.is_admin}
                                    onChange={(e) =>
                                        editingUser
                                            ? editForm.setData('is_admin', e.target.checked)
                                            : createForm.setData('is_admin', e.target.checked)
                                    }
                                />
                            }
                            label="Administrator"
                        />
                    </Box>
                </DialogContent>
                <DialogActions sx={{ px: 3, py: 2 }}>
                    <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
                    <Button
                        variant="contained"
                        onClick={handleSubmit}
                        disabled={editingUser ? editForm.processing : createForm.processing}
                    >
                        {editingUser ? 'Update' : 'Create'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Confirm Action Dialog */}
            <Dialog open={!!confirmAction} onClose={() => setConfirmAction(null)}>
                <DialogTitle>
                    {confirmAction?.action === 'toggle'
                        ? confirmAction.user.deactivated_at ? 'Reactivate User' : 'Deactivate User'
                        : 'Reset Password'}
                </DialogTitle>
                <DialogContent>
                    {confirmAction?.action === 'toggle' ? (
                        <Alert severity={confirmAction.user.deactivated_at ? 'info' : 'warning'} sx={{ mt: 1 }}>
                            {confirmAction.user.deactivated_at
                                ? `Reactivate ${confirmAction.user.name}? They will be able to log in again.`
                                : `Deactivate ${confirmAction.user.name}? They will be logged out and unable to access the system.`}
                        </Alert>
                    ) : (
                        <Alert severity="info" sx={{ mt: 1 }}>
                            Send a password reset link to {confirmAction?.user.email}?
                        </Alert>
                    )}
                </DialogContent>
                <DialogActions sx={{ px: 3, py: 2 }}>
                    <Button onClick={() => setConfirmAction(null)}>Cancel</Button>
                    <Button
                        variant="contained"
                        color={confirmAction?.action === 'toggle' && !confirmAction.user.deactivated_at ? 'warning' : 'primary'}
                        onClick={() => {
                            if (!confirmAction) return;
                            if (confirmAction.action === 'toggle') {
                                handleToggleActive(confirmAction.user);
                            } else {
                                handleResetPassword(confirmAction.user);
                            }
                        }}
                    >
                        Confirm
                    </Button>
                </DialogActions>
            </Dialog>
        </AuthenticatedLayout>
    );
}
