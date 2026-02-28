import { Head, router, useForm } from '@inertiajs/react';
import { useState } from 'react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import type { GitlabConnection, PageProps } from '@/types';
import AddIcon from '@mui/icons-material/Add';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import ErrorIcon from '@mui/icons-material/Error';
import SyncIcon from '@mui/icons-material/Sync';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Switch from '@mui/material/Switch';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

interface Props extends PageProps {
    connections: GitlabConnection[];
}

interface ConnectionFormData {
    name: string;
    base_url: string;
    api_token: string;
    is_active: boolean;
}

interface TestResult {
    success: boolean;
    message: string;
}

export default function GitlabConnections({ connections }: Props) {
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingConnection, setEditingConnection] = useState<GitlabConnection | null>(null);
    const [testResults, setTestResults] = useState<Record<string, TestResult>>({});
    const [testingIds, setTestingIds] = useState<Set<string>>(new Set());
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

    const form = useForm<ConnectionFormData>({
        name: '',
        base_url: '',
        api_token: '',
        is_active: true,
    });

    const openCreateDialog = () => {
        setEditingConnection(null);
        form.reset();
        form.clearErrors();
        setDialogOpen(true);
    };

    const openEditDialog = (connection: GitlabConnection) => {
        setEditingConnection(connection);
        form.setData({
            name: connection.name,
            base_url: connection.base_url,
            api_token: '',
            is_active: connection.is_active,
        });
        form.clearErrors();
        setDialogOpen(true);
    };

    const handleSubmit = () => {
        if (editingConnection) {
            form.put(route('admin.gitlab-connections.update', editingConnection.id), {
                onSuccess: () => setDialogOpen(false),
            });
        } else {
            form.post(route('admin.gitlab-connections.store'), {
                onSuccess: () => setDialogOpen(false),
            });
        }
    };

    const handleDelete = (id: string) => {
        router.delete(route('admin.gitlab-connections.destroy', id), {
            onSuccess: () => setDeleteConfirmId(null),
        });
    };

    const handleTestConnection = async (connection: GitlabConnection) => {
        setTestingIds((prev) => new Set(prev).add(connection.id));
        setTestResults((prev) => {
            const next = { ...prev };
            delete next[connection.id];
            return next;
        });

        try {
            const response = await fetch(
                route('admin.gitlab-connections.test', connection.id),
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-TOKEN': document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? '',
                        Accept: 'application/json',
                    },
                },
            );
            const data = await response.json();
            setTestResults((prev) => ({ ...prev, [connection.id]: data }));
        } catch {
            setTestResults((prev) => ({
                ...prev,
                [connection.id]: { success: false, message: 'Network error' },
            }));
        } finally {
            setTestingIds((prev) => {
                const next = new Set(prev);
                next.delete(connection.id);
                return next;
            });
        }
    };

    return (
        <AuthenticatedLayout
            header={
                <Typography variant="h6" component="h2" fontWeight={600}>
                    GitLab Connections
                </Typography>
            }
        >
            <Head title="GitLab Connections" />

            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={openCreateDialog}
                >
                    Add Connection
                </Button>
            </Box>

            {connections.length === 0 ? (
                <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
                    <Typography color="text.secondary">
                        No GitLab connections configured yet. Add one to get started.
                    </Typography>
                </Paper>
            ) : (
                <TableContainer component={Paper} variant="outlined">
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell>Name</TableCell>
                                <TableCell>Base URL</TableCell>
                                <TableCell>Status</TableCell>
                                <TableCell>Test</TableCell>
                                <TableCell align="right">Actions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {connections.map((connection) => (
                                <TableRow key={connection.id}>
                                    <TableCell>
                                        <Typography fontWeight={500}>
                                            {connection.name}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Typography variant="body2" color="text.secondary">
                                            {connection.base_url}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Chip
                                            label={connection.is_active ? 'Active' : 'Inactive'}
                                            color={connection.is_active ? 'success' : 'default'}
                                            size="small"
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <Tooltip title="Test connection">
                                                <span>
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => handleTestConnection(connection)}
                                                        disabled={testingIds.has(connection.id)}
                                                    >
                                                        {testingIds.has(connection.id) ? (
                                                            <CircularProgress size={18} />
                                                        ) : (
                                                            <SyncIcon fontSize="small" />
                                                        )}
                                                    </IconButton>
                                                </span>
                                            </Tooltip>
                                            {testResults[connection.id] && (
                                                <Chip
                                                    icon={
                                                        testResults[connection.id].success ? (
                                                            <CheckCircleIcon />
                                                        ) : (
                                                            <ErrorIcon />
                                                        )
                                                    }
                                                    label={testResults[connection.id].message}
                                                    color={
                                                        testResults[connection.id].success
                                                            ? 'success'
                                                            : 'error'
                                                    }
                                                    size="small"
                                                    variant="outlined"
                                                />
                                            )}
                                        </Box>
                                    </TableCell>
                                    <TableCell align="right">
                                        <Tooltip title="Edit">
                                            <IconButton
                                                size="small"
                                                onClick={() => openEditDialog(connection)}
                                            >
                                                <EditIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                        <Tooltip title="Delete">
                                            <IconButton
                                                size="small"
                                                color="error"
                                                onClick={() => setDeleteConfirmId(connection.id)}
                                            >
                                                <DeleteIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            {/* Create/Edit Dialog */}
            <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>
                    {editingConnection ? 'Edit Connection' : 'Add GitLab Connection'}
                </DialogTitle>
                <DialogContent>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                        <TextField
                            label="Name"
                            value={form.data.name}
                            onChange={(e) => form.setData('name', e.target.value)}
                            error={!!form.errors.name}
                            helperText={form.errors.name}
                            fullWidth
                            required
                        />
                        <TextField
                            label="Base URL"
                            value={form.data.base_url}
                            onChange={(e) => form.setData('base_url', e.target.value)}
                            error={!!form.errors.base_url}
                            helperText={form.errors.base_url || 'e.g. https://gitlab.example.com'}
                            fullWidth
                            required
                        />
                        <TextField
                            label={editingConnection ? 'API Token (leave blank to keep current)' : 'API Token'}
                            value={form.data.api_token}
                            onChange={(e) => form.setData('api_token', e.target.value)}
                            error={!!form.errors.api_token}
                            helperText={form.errors.api_token}
                            type="password"
                            fullWidth
                            required={!editingConnection}
                        />
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Switch
                                checked={form.data.is_active}
                                onChange={(e) => form.setData('is_active', e.target.checked)}
                            />
                            <Typography>Active</Typography>
                        </Box>
                    </Box>
                </DialogContent>
                <DialogActions sx={{ px: 3, py: 2 }}>
                    <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
                    <Button
                        variant="contained"
                        onClick={handleSubmit}
                        disabled={form.processing}
                    >
                        {editingConnection ? 'Update' : 'Create'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={!!deleteConfirmId} onClose={() => setDeleteConfirmId(null)}>
                <DialogTitle>Delete Connection</DialogTitle>
                <DialogContent>
                    <Alert severity="warning" sx={{ mt: 1 }}>
                        This will remove the connection and all linked projects. Webhooks will be cleaned up from GitLab.
                    </Alert>
                </DialogContent>
                <DialogActions sx={{ px: 3, py: 2 }}>
                    <Button onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
                    <Button
                        variant="contained"
                        color="error"
                        onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
                    >
                        Delete
                    </Button>
                </DialogActions>
            </Dialog>
        </AuthenticatedLayout>
    );
}
