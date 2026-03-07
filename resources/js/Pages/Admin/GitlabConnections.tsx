import { Head, router, useForm, usePage } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import PageHeader from '@/Components/Layout/PageHeader';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import AdminNav from '@/Components/Admin/AdminNav';
import type { GitlabConnection, PageProps } from '@/types';
import AddIcon from '@mui/icons-material/Add';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import ErrorIcon from '@mui/icons-material/Error';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import LinkIcon from '@mui/icons-material/Link';
import SyncIcon from '@mui/icons-material/Sync';
import WebhookIcon from '@mui/icons-material/Webhook';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Snackbar from '@mui/material/Snackbar';
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

interface LinkedProject {
    id: string;
    name: string;
    path_with_namespace: string;
    web_url: string;
    default_branch: string;
    webhook_id: number | null;
    last_synced_at: string | null;
    team_name: string;
    team_id: string;
}

interface ConnectionDetail {
    connection: GitlabConnection;
    projects: LinkedProject[];
    stats: {
        total_projects: number;
        projects_with_webhooks: number;
    };
}

export default function GitlabConnections({ connections }: Props) {
    const { flash } = usePage<PageProps>().props;
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingConnection, setEditingConnection] = useState<GitlabConnection | null>(null);
    const [testResults, setTestResults] = useState<Record<string, TestResult>>({});
    const [testingIds, setTestingIds] = useState<Set<string>>(new Set());
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
    const [detailOpen, setDetailOpen] = useState(false);
    const [detailLoading, setDetailLoading] = useState(false);
    const [connectionDetail, setConnectionDetail] = useState<ConnectionDetail | null>(null);
    const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' });

    useEffect(() => {
        if (flash?.success) {
            setSnackbar({ open: true, message: flash.success, severity: 'success' });
        } else if (flash?.error) {
            setSnackbar({ open: true, message: flash.error, severity: 'error' });
        }
    }, [flash?.success, flash?.error]);

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

    const openDetailDialog = async (connection: GitlabConnection) => {
        setDetailOpen(true);
        setDetailLoading(true);
        setConnectionDetail(null);

        try {
            const response = await fetch(
                route('admin.gitlab-connections.show', connection.id),
                {
                    headers: {
                        Accept: 'application/json',
                        'X-CSRF-TOKEN': document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? '',
                    },
                },
            );
            const data: ConnectionDetail = await response.json();
            setConnectionDetail(data);
        } catch {
            setSnackbar({ open: true, message: 'Failed to load connection details', severity: 'error' });
            setDetailOpen(false);
        } finally {
            setDetailLoading(false);
        }
    };

    const formatDate = (dateStr: string | null | undefined): string => {
        if (!dateStr) return 'Never';
        return new Date(dateStr).toLocaleString();
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
                <PageHeader
                    title="GitLab Connections"
                    breadcrumbs={[{ label: 'Admin', href: route('admin.dashboard') }]}
                />
            }
        >
            <Head title="GitLab Connections" />

            <Box sx={{ display: 'flex' }}>
                <AdminNav />

                <Box sx={{ flex: 1 }}>
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
                                                <Typography
                                                    fontWeight={500}
                                                    sx={{
                                                        cursor: 'pointer',
                                                        '&:hover': { textDecoration: 'underline' },
                                                        color: 'primary.main',
                                                    }}
                                                    onClick={() => openDetailDialog(connection)}
                                                >
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
                                                <Tooltip title="View Details">
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => openDetailDialog(connection)}
                                                    >
                                                        <InfoOutlinedIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
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
                </Box>
            </Box>

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

            {/* Detail Dialog */}
            <Dialog
                open={detailOpen}
                onClose={() => setDetailOpen(false)}
                maxWidth="md"
                fullWidth
            >
                <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        Connection Details
                        {connectionDetail && (
                            <Chip
                                label={connectionDetail.connection.is_active ? 'Active' : 'Inactive'}
                                color={connectionDetail.connection.is_active ? 'success' : 'default'}
                                size="small"
                            />
                        )}
                    </Box>
                    <IconButton size="small" onClick={() => setDetailOpen(false)}>
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>
                <DialogContent>
                    {detailLoading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                            <CircularProgress />
                        </Box>
                    ) : connectionDetail ? (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            {/* Connection Info */}
                            <Box>
                                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                    Connection Information
                                </Typography>
                                <Paper variant="outlined" sx={{ p: 2 }}>
                                    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                                        <Box>
                                            <Typography variant="caption" color="text.secondary">
                                                Name
                                            </Typography>
                                            <Typography variant="body2" fontWeight={500}>
                                                {connectionDetail.connection.name}
                                            </Typography>
                                        </Box>
                                        <Box>
                                            <Typography variant="caption" color="text.secondary">
                                                Base URL
                                            </Typography>
                                            <Typography variant="body2">
                                                {connectionDetail.connection.base_url}
                                            </Typography>
                                        </Box>
                                        <Box>
                                            <Typography variant="caption" color="text.secondary">
                                                Created
                                            </Typography>
                                            <Typography variant="body2">
                                                {formatDate(connectionDetail.connection.created_at)}
                                            </Typography>
                                        </Box>
                                        <Box>
                                            <Typography variant="caption" color="text.secondary">
                                                Last Updated
                                            </Typography>
                                            <Typography variant="body2">
                                                {formatDate(connectionDetail.connection.updated_at)}
                                            </Typography>
                                        </Box>
                                    </Box>
                                </Paper>
                            </Box>

                            {/* Summary Stats */}
                            <Box>
                                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                    Summary
                                </Typography>
                                <Box sx={{ display: 'flex', gap: 2 }}>
                                    <Paper variant="outlined" sx={{ p: 2, flex: 1, textAlign: 'center' }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 0.5 }}>
                                            <LinkIcon fontSize="small" color="primary" />
                                            <Typography variant="h5" fontWeight={600}>
                                                {connectionDetail.stats.total_projects}
                                            </Typography>
                                        </Box>
                                        <Typography variant="caption" color="text.secondary">
                                            Linked Projects
                                        </Typography>
                                    </Paper>
                                    <Paper variant="outlined" sx={{ p: 2, flex: 1, textAlign: 'center' }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 0.5 }}>
                                            <WebhookIcon fontSize="small" color="success" />
                                            <Typography variant="h5" fontWeight={600}>
                                                {connectionDetail.stats.projects_with_webhooks}
                                            </Typography>
                                        </Box>
                                        <Typography variant="caption" color="text.secondary">
                                            Active Webhooks
                                        </Typography>
                                    </Paper>
                                </Box>
                            </Box>

                            <Divider />

                            {/* Linked Projects */}
                            <Box>
                                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                    Linked Projects
                                </Typography>
                                {connectionDetail.projects.length === 0 ? (
                                    <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
                                        <Typography color="text.secondary" variant="body2">
                                            No projects linked to this connection yet.
                                        </Typography>
                                    </Paper>
                                ) : (
                                    <TableContainer component={Paper} variant="outlined">
                                        <Table size="small">
                                            <TableHead>
                                                <TableRow>
                                                    <TableCell>Project</TableCell>
                                                    <TableCell>Team</TableCell>
                                                    <TableCell>Default Branch</TableCell>
                                                    <TableCell>Webhook</TableCell>
                                                    <TableCell>Last Synced</TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {connectionDetail.projects.map((project) => (
                                                    <TableRow key={project.id}>
                                                        <TableCell>
                                                            <Box>
                                                                <Typography variant="body2" fontWeight={500}>
                                                                    {project.name}
                                                                </Typography>
                                                                <Typography variant="caption" color="text.secondary">
                                                                    {project.path_with_namespace}
                                                                </Typography>
                                                            </Box>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Typography variant="body2">
                                                                {project.team_name}
                                                            </Typography>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Typography variant="body2" fontFamily="monospace" fontSize="0.8rem">
                                                                {project.default_branch}
                                                            </Typography>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Chip
                                                                label={project.webhook_id ? 'Active' : 'None'}
                                                                color={project.webhook_id ? 'success' : 'default'}
                                                                size="small"
                                                                variant="outlined"
                                                            />
                                                        </TableCell>
                                                        <TableCell>
                                                            <Typography variant="body2" color="text.secondary">
                                                                {formatDate(project.last_synced_at)}
                                                            </Typography>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </TableContainer>
                                )}
                            </Box>
                        </Box>
                    ) : null}
                </DialogContent>
                <DialogActions sx={{ px: 3, py: 2 }}>
                    <Button onClick={() => setDetailOpen(false)}>Close</Button>
                </DialogActions>
            </Dialog>

            <Snackbar
                open={snackbar.open}
                autoHideDuration={4000}
                onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert
                    onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
                    severity={snackbar.severity}
                    variant="filled"
                    sx={{ width: '100%' }}
                >
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </AuthenticatedLayout>
    );
}
