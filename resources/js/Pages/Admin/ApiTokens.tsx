import { Head, router, useForm, usePage } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import PageHeader from '@/Components/Layout/PageHeader';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import AdminNav from '@/Components/Admin/AdminNav';
import type { PageProps, User } from '@/types';
import AddIcon from '@mui/icons-material/Add';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteIcon from '@mui/icons-material/Delete';
import SmartToyIcon from '@mui/icons-material/SmartToy';
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
import Paper from '@mui/material/Paper';
import Checkbox from '@mui/material/Checkbox';
import Snackbar from '@mui/material/Snackbar';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

interface PersonalAccessToken {
    id: number;
    name: string;
    abilities: string[];
    last_used_at: string | null;
    created_at: string;
}

interface UserWithTokens extends User {
    tokens: PersonalAccessToken[];
}

interface Props extends PageProps {
    users: UserWithTokens[];
    botUsers: User[];
}

export default function ApiTokens({ users, botUsers }: Props) {
    const { flash } = usePage<PageProps>().props;
    const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' });
    const [botDialogOpen, setBotDialogOpen] = useState(false);
    const [tokenDialogOpen, setTokenDialogOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<UserWithTokens | null>(null);
    const [confirmRevoke, setConfirmRevoke] = useState<{ user: UserWithTokens; tokenId: number } | null>(null);

    useEffect(() => {
        if (flash?.success) {
            setSnackbar({ open: true, message: flash.success, severity: 'success' });
        } else if (flash?.error) {
            setSnackbar({ open: true, message: flash.error, severity: 'error' });
        }
    }, [flash?.success, flash?.error]);

    const botForm = useForm({
        name: '',
    });

    const tokenForm = useForm({
        name: '',
        abilities: ['read'] as string[],
    });

    const handleCreateBot = () => {
        botForm.post(route('admin.api-tokens.store-bot'), {
            onSuccess: () => {
                setBotDialogOpen(false);
                botForm.reset();
            },
        });
    };

    const openTokenDialog = (user: UserWithTokens) => {
        setSelectedUser(user);
        tokenForm.reset();
        tokenForm.clearErrors();
        setTokenDialogOpen(true);
    };

    const handleCreateToken = () => {
        if (!selectedUser) return;
        tokenForm.post(route('admin.api-tokens.create-token', selectedUser.id), {
            onSuccess: () => {
                setTokenDialogOpen(false);
                tokenForm.reset();
            },
        });
    };

    const handleRevokeToken = () => {
        if (!confirmRevoke) return;
        router.delete(route('admin.api-tokens.revoke-token', [confirmRevoke.user.id, confirmRevoke.tokenId]), {
            onSuccess: () => setConfirmRevoke(null),
        });
    };

    const handleAbilityChange = (ability: string, checked: boolean) => {
        if (ability === 'write' && checked) {
            tokenForm.setData('abilities', ['read', 'write']);
        } else if (ability === 'write' && !checked) {
            tokenForm.setData('abilities', ['read']);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setSnackbar({ open: true, message: 'Copied to clipboard', severity: 'success' });
    };

    return (
        <AuthenticatedLayout
            header={
                <PageHeader
                    title="API Tokens"
                    breadcrumbs={[{ label: 'Admin', href: route('admin.dashboard') }]}
                />
            }
        >
            <Head title="API Tokens" />

            <Box sx={{ display: 'flex' }}>
                <AdminNav />

                <Box sx={{ flex: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="body2" color="text.secondary">
                            Manage API tokens for bot users and regular users. Tokens authenticate external API access.
                        </Typography>
                        <Button
                            variant="contained"
                            startIcon={<SmartToyIcon />}
                            onClick={() => {
                                botForm.reset();
                                botForm.clearErrors();
                                setBotDialogOpen(true);
                            }}
                        >
                            Create Bot User
                        </Button>
                    </Box>

                    {users.length === 0 ? (
                        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
                            <Typography color="text.secondary">
                                No users with API tokens yet. Create a bot user to get started.
                            </Typography>
                        </Paper>
                    ) : (
                        users.map((user) => (
                            <Paper key={user.id} variant="outlined" sx={{ mb: 2 }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2, borderBottom: user.tokens.length > 0 ? 1 : 0, borderColor: 'divider' }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Typography fontWeight={600}>{user.name}</Typography>
                                        {!user.is_bot && <Typography variant="body2" color="text.secondary">{user.email}</Typography>}
                                        {user.is_bot && <Chip label="Bot" size="small" color="info" icon={<SmartToyIcon />} />}
                                    </Box>
                                    <Button
                                        size="small"
                                        startIcon={<AddIcon />}
                                        onClick={() => openTokenDialog(user)}
                                    >
                                        New Token
                                    </Button>
                                </Box>
                                {user.tokens.length > 0 && (
                                    <TableContainer>
                                        <Table size="small">
                                            <TableHead>
                                                <TableRow>
                                                    <TableCell>Name</TableCell>
                                                    <TableCell>Abilities</TableCell>
                                                    <TableCell>Last Used</TableCell>
                                                    <TableCell>Created</TableCell>
                                                    <TableCell align="right">Actions</TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {user.tokens.map((token) => (
                                                    <TableRow key={token.id}>
                                                        <TableCell>
                                                            <Typography variant="body2" fontWeight={500}>{token.name}</Typography>
                                                        </TableCell>
                                                        <TableCell>
                                                            {token.abilities.map((ability) => (
                                                                <Chip
                                                                    key={ability}
                                                                    label={ability}
                                                                    size="small"
                                                                    variant="outlined"
                                                                    sx={{ mr: 0.5 }}
                                                                />
                                                            ))}
                                                        </TableCell>
                                                        <TableCell>
                                                            <Typography variant="body2" color="text.secondary">
                                                                {token.last_used_at
                                                                    ? new Date(token.last_used_at).toLocaleDateString()
                                                                    : 'Never'}
                                                            </Typography>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Typography variant="body2" color="text.secondary">
                                                                {new Date(token.created_at).toLocaleDateString()}
                                                            </Typography>
                                                        </TableCell>
                                                        <TableCell align="right">
                                                            <Tooltip title="Revoke">
                                                                <IconButton
                                                                    size="small"
                                                                    color="error"
                                                                    onClick={() => setConfirmRevoke({ user, tokenId: token.id })}
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
                            </Paper>
                        ))
                    )}
                </Box>
            </Box>

            {/* Create Bot Dialog */}
            <Dialog open={botDialogOpen} onClose={() => setBotDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Create Bot User</DialogTitle>
                <DialogContent>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                        <Alert severity="info">
                            Bot users are special accounts for API integrations. Add them to teams as regular members.
                        </Alert>
                        <TextField
                            label="Bot Name"
                            value={botForm.data.name}
                            onChange={(e) => botForm.setData('name', e.target.value)}
                            error={!!botForm.errors.name}
                            helperText={botForm.errors.name}
                            fullWidth
                            required
                        />
                    </Box>
                </DialogContent>
                <DialogActions sx={{ px: 3, py: 2 }}>
                    <Button onClick={() => setBotDialogOpen(false)}>Cancel</Button>
                    <Button variant="contained" onClick={handleCreateBot} disabled={botForm.processing}>
                        Create
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Create Token Dialog */}
            <Dialog open={tokenDialogOpen} onClose={() => setTokenDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Create API Token for {selectedUser?.name}</DialogTitle>
                <DialogContent>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                        <Alert severity="warning">
                            The token will only be shown once after creation. Copy it immediately.
                        </Alert>
                        <TextField
                            label="Token Name"
                            value={tokenForm.data.name}
                            onChange={(e) => tokenForm.setData('name', e.target.value)}
                            error={!!tokenForm.errors.name}
                            helperText={tokenForm.errors.name}
                            fullWidth
                            required
                        />
                        <Box>
                            <Typography variant="body2" fontWeight={500} sx={{ mb: 1 }}>Abilities</Typography>
                            <FormControlLabel
                                control={<Checkbox checked disabled />}
                                label="read - Read access to boards, tasks, and comments"
                            />
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={tokenForm.data.abilities.includes('write')}
                                        onChange={(e) => handleAbilityChange('write', e.target.checked)}
                                    />
                                }
                                label="write - Create/update tasks, comments, and assignments"
                            />
                        </Box>
                    </Box>
                </DialogContent>
                <DialogActions sx={{ px: 3, py: 2 }}>
                    <Button onClick={() => setTokenDialogOpen(false)}>Cancel</Button>
                    <Button variant="contained" onClick={handleCreateToken} disabled={tokenForm.processing}>
                        Create Token
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Confirm Revoke Dialog */}
            <Dialog open={!!confirmRevoke} onClose={() => setConfirmRevoke(null)}>
                <DialogTitle>Revoke Token</DialogTitle>
                <DialogContent>
                    <Alert severity="warning" sx={{ mt: 1 }}>
                        This will immediately invalidate the token. Any applications using it will lose access.
                    </Alert>
                </DialogContent>
                <DialogActions sx={{ px: 3, py: 2 }}>
                    <Button onClick={() => setConfirmRevoke(null)}>Cancel</Button>
                    <Button variant="contained" color="error" onClick={handleRevokeToken}>
                        Revoke
                    </Button>
                </DialogActions>
            </Dialog>

            <Snackbar
                open={snackbar.open}
                autoHideDuration={6000}
                onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert
                    onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
                    severity={snackbar.severity}
                    variant="filled"
                    sx={{ width: '100%' }}
                    action={
                        snackbar.message.startsWith('Token created:') ? (
                            <IconButton size="small" color="inherit" onClick={() => copyToClipboard(snackbar.message.replace('Token created: ', ''))}>
                                <ContentCopyIcon fontSize="small" />
                            </IconButton>
                        ) : undefined
                    }
                >
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </AuthenticatedLayout>
    );
}
