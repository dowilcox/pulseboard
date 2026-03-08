import { Head, router, useForm, usePage } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import PageHeader from '@/Components/Layout/PageHeader';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import type { PageProps, PersonalAccessToken, Team, User } from '@/types';
import AddIcon from '@mui/icons-material/Add';
import CheckIcon from '@mui/icons-material/Check';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteIcon from '@mui/icons-material/Delete';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Checkbox from '@mui/material/Checkbox';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Paper from '@mui/material/Paper';
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

interface BotWithTokens extends User {
    tokens: PersonalAccessToken[];
}

interface Props extends PageProps {
    team: Team;
    bots: BotWithTokens[];
}

export default function ApiTokens({ team, bots }: Props) {
    const { flash } = usePage<PageProps>().props;
    const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' });
    const [botDialogOpen, setBotDialogOpen] = useState(false);
    const [tokenDialogOpen, setTokenDialogOpen] = useState(false);
    const [selectedBot, setSelectedBot] = useState<BotWithTokens | null>(null);
    const [confirmRevoke, setConfirmRevoke] = useState<{ bot: BotWithTokens; tokenId: number } | null>(null);
    const [confirmDeleteBot, setConfirmDeleteBot] = useState<BotWithTokens | null>(null);
    const [createdToken, setCreatedToken] = useState<string | null>(null);
    const [tokenCopied, setTokenCopied] = useState(false);

    useEffect(() => {
        if (flash?.success) {
            if (flash.success.startsWith('Token created: ')) {
                setCreatedToken(flash.success.replace('Token created: ', ''));
                setTokenCopied(false);
            } else {
                setSnackbar({ open: true, message: flash.success, severity: 'success' });
            }
        } else if (flash?.error) {
            setSnackbar({ open: true, message: flash.error, severity: 'error' });
        }
    }, [flash?.success, flash?.error]);

    const botForm = useForm({ name: '' });

    const tokenForm = useForm({
        name: '',
        abilities: ['read'] as string[],
    });

    const handleCreateBot = () => {
        botForm.post(route('teams.bots.store', team.id), {
            onSuccess: () => {
                setBotDialogOpen(false);
                botForm.reset();
            },
        });
    };

    const openTokenDialog = (bot: BotWithTokens) => {
        setSelectedBot(bot);
        tokenForm.reset();
        tokenForm.clearErrors();
        setTokenDialogOpen(true);
    };

    const handleCreateToken = () => {
        if (!selectedBot) return;
        tokenForm.post(route('teams.bots.create-token', [team.id, selectedBot.id]), {
            onSuccess: () => {
                setTokenDialogOpen(false);
                tokenForm.reset();
            },
        });
    };

    const handleRevokeToken = () => {
        if (!confirmRevoke) return;
        router.delete(route('teams.bots.revoke-token', [team.id, confirmRevoke.bot.id, confirmRevoke.tokenId]), {
            onSuccess: () => setConfirmRevoke(null),
        });
    };

    const handleDeleteBot = () => {
        if (!confirmDeleteBot) return;
        router.delete(route('teams.bots.destroy', [team.id, confirmDeleteBot.id]), {
            onSuccess: () => setConfirmDeleteBot(null),
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
            currentTeam={team}
            header={
                <PageHeader
                    title="API Tokens"
                    breadcrumbs={[
                        { label: 'Teams', href: route('teams.index') },
                        { label: team.name, href: route('teams.show', team.id) },
                        { label: 'Settings', href: route('teams.settings', team.id) },
                    ]}
                />
            }
        >
            <Head title={`${team.name} — API Tokens`} />

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <Card variant="outlined">
                    <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                            <Box>
                                <Typography variant="subtitle1" fontWeight={600}>
                                    Bot Users ({bots.length})
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Create bot users to allow external tools and agents to access this team's boards via the API.
                                </Typography>
                            </Box>
                            <Button
                                variant="contained"
                                startIcon={<SmartToyIcon />}
                                onClick={() => {
                                    botForm.reset();
                                    botForm.clearErrors();
                                    setBotDialogOpen(true);
                                }}
                            >
                                Create Bot
                            </Button>
                        </Box>

                        {bots.length === 0 ? (
                            <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
                                <Typography color="text.secondary">
                                    No bot users yet. Create a bot to generate API tokens for external integrations.
                                </Typography>
                            </Paper>
                        ) : (
                            bots.map((bot) => (
                                <Paper key={bot.id} variant="outlined" sx={{ mb: 2 }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2, borderBottom: bot.tokens.length > 0 ? 1 : 0, borderColor: 'divider' }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <SmartToyIcon fontSize="small" color="action" />
                                            <Typography fontWeight={600}>{bot.name}</Typography>
                                            <Chip label="Bot" size="small" color="info" />
                                        </Box>
                                        <Box sx={{ display: 'flex', gap: 1 }}>
                                            <Button
                                                size="small"
                                                startIcon={<AddIcon />}
                                                onClick={() => openTokenDialog(bot)}
                                            >
                                                New Token
                                            </Button>
                                            <Tooltip title="Remove bot">
                                                <IconButton
                                                    size="small"
                                                    color="error"
                                                    onClick={() => setConfirmDeleteBot(bot)}
                                                >
                                                    <DeleteIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                        </Box>
                                    </Box>
                                    {bot.tokens.length > 0 && (
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
                                                    {bot.tokens.map((token) => (
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
                                                                        onClick={() => setConfirmRevoke({ bot, tokenId: token.id })}
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
                    </CardContent>
                </Card>
            </Box>

            {/* Create Bot Dialog */}
            <Dialog open={botDialogOpen} onClose={() => setBotDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Create Bot User</DialogTitle>
                <DialogContent>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                        <Alert severity="info">
                            Bot users are special accounts for API integrations. This bot will be scoped to this team only.
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
                <DialogTitle>Create API Token for {selectedBot?.name}</DialogTitle>
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

            {/* Confirm Revoke Token Dialog */}
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

            {/* Confirm Delete Bot Dialog */}
            <Dialog open={!!confirmDeleteBot} onClose={() => setConfirmDeleteBot(null)}>
                <DialogTitle>Remove Bot User</DialogTitle>
                <DialogContent>
                    <Alert severity="warning" sx={{ mt: 1 }}>
                        This will deactivate the bot user, revoke all its tokens, and remove it from the team. Any applications using its tokens will lose access.
                    </Alert>
                </DialogContent>
                <DialogActions sx={{ px: 3, py: 2 }}>
                    <Button onClick={() => setConfirmDeleteBot(null)}>Cancel</Button>
                    <Button variant="contained" color="error" onClick={handleDeleteBot}>
                        Remove Bot
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Token Created Dialog */}
            <Dialog open={!!createdToken} maxWidth="sm" fullWidth>
                <DialogTitle>API Token Created</DialogTitle>
                <DialogContent>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                        <Alert severity="warning">
                            Copy this token now. It will not be shown again.
                        </Alert>
                        <TextField
                            value={createdToken ?? ''}
                            fullWidth
                            slotProps={{
                                input: {
                                    readOnly: true,
                                    sx: { fontFamily: 'monospace', fontSize: '0.85rem' },
                                    endAdornment: (
                                        <InputAdornment position="end">
                                            <Tooltip title={tokenCopied ? 'Copied!' : 'Copy to clipboard'}>
                                                <IconButton
                                                    onClick={() => {
                                                        if (createdToken) {
                                                            navigator.clipboard.writeText(createdToken);
                                                            setTokenCopied(true);
                                                        }
                                                    }}
                                                    edge="end"
                                                >
                                                    {tokenCopied ? <CheckIcon color="success" /> : <ContentCopyIcon />}
                                                </IconButton>
                                            </Tooltip>
                                        </InputAdornment>
                                    ),
                                },
                            }}
                            onClick={(e) => (e.target as HTMLInputElement).select()}
                        />
                    </Box>
                </DialogContent>
                <DialogActions sx={{ px: 3, py: 2 }}>
                    <Button
                        variant="contained"
                        onClick={() => setCreatedToken(null)}
                    >
                        Done
                    </Button>
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
