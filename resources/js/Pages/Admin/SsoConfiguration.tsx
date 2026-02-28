import { Head, router, useForm } from '@inertiajs/react';
import { useState } from 'react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import AdminNav from '@/Components/Admin/AdminNav';
import type { PageProps, SsoConfiguration } from '@/types';
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
    configurations: SsoConfiguration[];
}

interface SsoFormData {
    name: string;
    entity_id: string;
    login_url: string;
    logout_url: string;
    certificate: string;
    metadata_url: string;
    attribute_mapping: {
        email: string;
        name: string;
    };
    is_active: boolean;
}

interface TestResult {
    success: boolean;
    message: string;
}

const defaultFormData: SsoFormData = {
    name: '',
    entity_id: '',
    login_url: '',
    logout_url: '',
    certificate: '',
    metadata_url: '',
    attribute_mapping: {
        email: 'urn:oid:0.9.2342.19200300.100.1.3',
        name: 'urn:oid:2.16.840.1.113730.3.1.241',
    },
    is_active: false,
};

export default function SsoConfigurationPage({ configurations }: Props) {
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<SsoConfiguration | null>(null);
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
    const [testResults, setTestResults] = useState<Record<string, TestResult>>({});
    const [testingIds, setTestingIds] = useState<Set<string>>(new Set());

    const form = useForm<SsoFormData>({ ...defaultFormData });

    const openCreateDialog = () => {
        setEditing(null);
        form.setData({ ...defaultFormData });
        form.clearErrors();
        setDialogOpen(true);
    };

    const openEditDialog = (config: SsoConfiguration) => {
        setEditing(config);
        form.setData({
            name: config.name,
            entity_id: config.entity_id,
            login_url: config.login_url,
            logout_url: config.logout_url ?? '',
            certificate: '',
            metadata_url: config.metadata_url ?? '',
            attribute_mapping: {
                email: config.attribute_mapping?.email ?? '',
                name: config.attribute_mapping?.name ?? '',
            },
            is_active: config.is_active,
        });
        form.clearErrors();
        setDialogOpen(true);
    };

    const handleSubmit = () => {
        if (editing) {
            form.put(route('admin.sso.update', editing.id), {
                onSuccess: () => setDialogOpen(false),
            });
        } else {
            form.post(route('admin.sso.store'), {
                onSuccess: () => setDialogOpen(false),
            });
        }
    };

    const handleDelete = (id: string) => {
        router.delete(route('admin.sso.destroy', id), {
            onSuccess: () => setDeleteConfirmId(null),
        });
    };

    const handleTest = async (config: SsoConfiguration) => {
        setTestingIds((prev) => new Set(prev).add(config.id));
        setTestResults((prev) => {
            const next = { ...prev };
            delete next[config.id];
            return next;
        });

        try {
            const response = await fetch(route('admin.sso.test', config.id), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? '',
                    Accept: 'application/json',
                },
            });
            const data = await response.json();
            setTestResults((prev) => ({ ...prev, [config.id]: data }));
        } catch {
            setTestResults((prev) => ({
                ...prev,
                [config.id]: { success: false, message: 'Network error' },
            }));
        } finally {
            setTestingIds((prev) => {
                const next = new Set(prev);
                next.delete(config.id);
                return next;
            });
        }
    };

    return (
        <AuthenticatedLayout
            header={
                <Typography variant="h6" component="h2" fontWeight={600}>
                    SSO Configuration
                </Typography>
            }
        >
            <Head title="SSO Configuration" />

            <Box sx={{ display: 'flex' }}>
                <AdminNav />

                <Box sx={{ flex: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="body2" color="text.secondary">
                            Configure SAML2 Single Sign-On providers for enterprise authentication.
                        </Typography>
                        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateDialog}>
                            Add Provider
                        </Button>
                    </Box>

                    {configurations.length === 0 ? (
                        <Paper elevation={1} sx={{ p: 4, textAlign: 'center' }}>
                            <Typography color="text.secondary">
                                No SSO providers configured. Add one to enable enterprise single sign-on.
                            </Typography>
                        </Paper>
                    ) : (
                        <TableContainer component={Paper} elevation={1}>
                            <Table>
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Name</TableCell>
                                        <TableCell>Entity ID</TableCell>
                                        <TableCell>Status</TableCell>
                                        <TableCell>Test</TableCell>
                                        <TableCell align="right">Actions</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {configurations.map((config) => (
                                        <TableRow key={config.id}>
                                            <TableCell>
                                                <Typography fontWeight={500}>{config.name}</Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: 300 }}>
                                                    {config.entity_id}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Chip
                                                    label={config.is_active ? 'Active' : 'Inactive'}
                                                    color={config.is_active ? 'success' : 'default'}
                                                    size="small"
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    <Tooltip title="Test configuration">
                                                        <span>
                                                            <IconButton
                                                                size="small"
                                                                onClick={() => handleTest(config)}
                                                                disabled={testingIds.has(config.id)}
                                                            >
                                                                {testingIds.has(config.id) ? (
                                                                    <CircularProgress size={18} />
                                                                ) : (
                                                                    <SyncIcon fontSize="small" />
                                                                )}
                                                            </IconButton>
                                                        </span>
                                                    </Tooltip>
                                                    {testResults[config.id] && (
                                                        <Chip
                                                            icon={testResults[config.id].success ? <CheckCircleIcon /> : <ErrorIcon />}
                                                            label={testResults[config.id].message}
                                                            color={testResults[config.id].success ? 'success' : 'error'}
                                                            size="small"
                                                            variant="outlined"
                                                        />
                                                    )}
                                                </Box>
                                            </TableCell>
                                            <TableCell align="right">
                                                <Tooltip title="Edit">
                                                    <IconButton size="small" onClick={() => openEditDialog(config)}>
                                                        <EditIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title="Delete">
                                                    <IconButton size="small" color="error" onClick={() => setDeleteConfirmId(config.id)}>
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
            <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
                <DialogTitle>{editing ? 'Edit SSO Provider' : 'Add SAML2 Provider'}</DialogTitle>
                <DialogContent>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                        <TextField
                            label="Provider Name"
                            value={form.data.name}
                            onChange={(e) => form.setData('name', e.target.value)}
                            error={!!form.errors.name}
                            helperText={form.errors.name || 'e.g. Okta, Azure AD, OneLogin'}
                            fullWidth
                            required
                        />
                        <TextField
                            label="IdP Entity ID"
                            value={form.data.entity_id}
                            onChange={(e) => form.setData('entity_id', e.target.value)}
                            error={!!form.errors.entity_id}
                            helperText={form.errors.entity_id}
                            fullWidth
                            required
                        />
                        <TextField
                            label="SSO Login URL"
                            value={form.data.login_url}
                            onChange={(e) => form.setData('login_url', e.target.value)}
                            error={!!form.errors.login_url}
                            helperText={form.errors.login_url}
                            fullWidth
                            required
                        />
                        <TextField
                            label="SSO Logout URL"
                            value={form.data.logout_url}
                            onChange={(e) => form.setData('logout_url', e.target.value)}
                            error={!!form.errors.logout_url}
                            helperText={form.errors.logout_url || 'Optional'}
                            fullWidth
                        />
                        <TextField
                            label={editing ? 'IdP Certificate (leave blank to keep current)' : 'IdP Certificate'}
                            value={form.data.certificate}
                            onChange={(e) => form.setData('certificate', e.target.value)}
                            error={!!form.errors.certificate}
                            helperText={form.errors.certificate || 'Paste the X.509 certificate from your IdP'}
                            multiline
                            rows={4}
                            fullWidth
                            required={!editing}
                        />
                        <TextField
                            label="Metadata URL"
                            value={form.data.metadata_url}
                            onChange={(e) => form.setData('metadata_url', e.target.value)}
                            error={!!form.errors.metadata_url}
                            helperText={form.errors.metadata_url || 'Optional IdP metadata URL'}
                            fullWidth
                        />

                        <Typography variant="subtitle2" sx={{ mt: 1 }}>
                            Attribute Mapping
                        </Typography>
                        <TextField
                            label="Email Attribute"
                            value={form.data.attribute_mapping.email}
                            onChange={(e) => form.setData('attribute_mapping', { ...form.data.attribute_mapping, email: e.target.value })}
                            helperText="SAML attribute for user email"
                            fullWidth
                            size="small"
                        />
                        <TextField
                            label="Name Attribute"
                            value={form.data.attribute_mapping.name}
                            onChange={(e) => form.setData('attribute_mapping', { ...form.data.attribute_mapping, name: e.target.value })}
                            helperText="SAML attribute for user display name"
                            fullWidth
                            size="small"
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
                <DialogActions>
                    <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
                    <Button variant="contained" onClick={handleSubmit} disabled={form.processing}>
                        {editing ? 'Update' : 'Create'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={!!deleteConfirmId} onClose={() => setDeleteConfirmId(null)}>
                <DialogTitle>Delete SSO Provider</DialogTitle>
                <DialogContent>
                    <Alert severity="warning" sx={{ mt: 1 }}>
                        This will remove the SSO provider. Users authenticated via this provider will need to reset their password or use another authentication method.
                    </Alert>
                </DialogContent>
                <DialogActions>
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
