import { Head, router, useForm } from "@inertiajs/react";
import { type ReactElement, useState } from "react";
import CreateTokenDialog from "@/Components/ApiTokens/CreateTokenDialog";
import RevokeTokenDialog from "@/Components/ApiTokens/RevokeTokenDialog";
import TokenCreatedDialog from "@/Components/ApiTokens/TokenCreatedDialog";
import TokenTable from "@/Components/ApiTokens/TokenTable";
import LayoutHeader from "@/Components/Layout/LayoutHeader";
import PageHeader from "@/Components/Layout/PageHeader";
import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import type { PageProps, PersonalAccessToken, Team, User } from "@/types";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";

interface BotWithTokens extends User {
    tokens: PersonalAccessToken[];
}

interface Props extends PageProps {
    team: Team;
    bots: BotWithTokens[];
}

export default function ApiTokens({ team, bots }: Props) {
    const [botDialogOpen, setBotDialogOpen] = useState(false);
    const [tokenDialogOpen, setTokenDialogOpen] = useState(false);
    const [selectedBot, setSelectedBot] = useState<BotWithTokens | null>(null);
    const [confirmRevoke, setConfirmRevoke] = useState<{
        bot: BotWithTokens;
        tokenId: number;
    } | null>(null);
    const [confirmDeleteBot, setConfirmDeleteBot] =
        useState<BotWithTokens | null>(null);

    const botForm = useForm({ name: "" });

    const handleCreateBot = () => {
        botForm.post(route("teams.bots.store", team.slug), {
            onSuccess: () => {
                setBotDialogOpen(false);
                botForm.reset();
            },
        });
    };

    const openTokenDialog = (bot: BotWithTokens) => {
        setSelectedBot(bot);
        setTokenDialogOpen(true);
    };

    const handleRevokeToken = () => {
        if (!confirmRevoke) return;
        router.delete(
            route("teams.bots.revoke-token", [
                team.slug,
                confirmRevoke.bot.id,
                confirmRevoke.tokenId,
            ]),
            {
                onSuccess: () => setConfirmRevoke(null),
            },
        );
    };

    const handleDeleteBot = () => {
        if (!confirmDeleteBot) return;
        router.delete(
            route("teams.bots.destroy", [team.slug, confirmDeleteBot.id]),
            {
                onSuccess: () => setConfirmDeleteBot(null),
            },
        );
    };

    return (
        <>
            <Head title={`${team.name} — API Tokens`} />
            <LayoutHeader>
                <PageHeader
                    title="API Tokens"
                    breadcrumbs={[
                        { label: "Teams", href: route("teams.index") },
                        {
                            label: team.name,
                            href: route("teams.show", team.slug),
                        },
                        {
                            label: "Settings",
                            href: route("teams.settings", team.slug),
                        },
                    ]}
                />
            </LayoutHeader>

            <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <Card variant="outlined">
                    <CardContent>
                        <Box
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                mb: 2,
                            }}
                        >
                            <Box>
                                <Typography
                                    variant="subtitle1"
                                    fontWeight={600}
                                >
                                    Bot Users ({bots.length})
                                </Typography>
                                <Typography
                                    variant="body2"
                                    color="text.secondary"
                                >
                                    Create bot users to allow external tools and
                                    agents to access this team's boards via the
                                    API.
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
                            <Paper
                                variant="outlined"
                                sx={{ p: 4, textAlign: "center" }}
                            >
                                <Typography color="text.secondary">
                                    No bot users yet. Create a bot to generate
                                    API tokens for external integrations.
                                </Typography>
                            </Paper>
                        ) : (
                            bots.map((bot) => (
                                <Paper
                                    key={bot.id}
                                    variant="outlined"
                                    sx={{ mb: 2 }}
                                >
                                    <Box
                                        sx={{
                                            display: "flex",
                                            justifyContent: "space-between",
                                            alignItems: "center",
                                            p: 2,
                                            borderBottom:
                                                bot.tokens.length > 0 ? 1 : 0,
                                            borderColor: "divider",
                                        }}
                                    >
                                        <Box
                                            sx={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 1,
                                            }}
                                        >
                                            <SmartToyIcon
                                                fontSize="small"
                                                color="action"
                                            />
                                            <Typography fontWeight={600}>
                                                {bot.name}
                                            </Typography>
                                            <Chip
                                                label="Bot"
                                                size="small"
                                                color="info"
                                            />
                                        </Box>
                                        <Box sx={{ display: "flex", gap: 1 }}>
                                            <Button
                                                size="small"
                                                startIcon={<AddIcon />}
                                                onClick={() =>
                                                    openTokenDialog(bot)
                                                }
                                            >
                                                New Token
                                            </Button>
                                            <Tooltip title="Remove bot">
                                                <IconButton
                                                    size="small"
                                                    color="error"
                                                    onClick={() =>
                                                        setConfirmDeleteBot(bot)
                                                    }
                                                >
                                                    <DeleteIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                        </Box>
                                    </Box>
                                    <TokenTable
                                        tokens={bot.tokens}
                                        onRevoke={(token) =>
                                            setConfirmRevoke({
                                                bot,
                                                tokenId: token.id,
                                            })
                                        }
                                    />
                                </Paper>
                            ))
                        )}
                    </CardContent>
                </Card>
            </Box>

            {/* Create Bot Dialog */}
            <Dialog
                open={botDialogOpen}
                onClose={() => setBotDialogOpen(false)}
                maxWidth="sm"
                fullWidth
                aria-labelledby="create-bot-dialog-title"
            >
                <DialogTitle id="create-bot-dialog-title">
                    Create Bot User
                </DialogTitle>
                <DialogContent>
                    <Box
                        sx={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 2,
                            mt: 1,
                        }}
                    >
                        <Alert severity="info">
                            Bot users are special accounts for API integrations.
                            This bot will be scoped to this team only.
                        </Alert>
                        <TextField
                            label="Bot Name"
                            value={botForm.data.name}
                            onChange={(e) =>
                                botForm.setData("name", e.target.value)
                            }
                            error={!!botForm.errors.name}
                            helperText={botForm.errors.name}
                            fullWidth
                            required
                        />
                    </Box>
                </DialogContent>
                <DialogActions sx={{ px: 3, py: 2 }}>
                    <Button onClick={() => setBotDialogOpen(false)}>
                        Cancel
                    </Button>
                    <Button
                        variant="contained"
                        onClick={handleCreateBot}
                        disabled={botForm.processing}
                    >
                        Create
                    </Button>
                </DialogActions>
            </Dialog>

            <CreateTokenDialog
                open={tokenDialogOpen}
                onClose={() => setTokenDialogOpen(false)}
                ownerName={selectedBot?.name}
                submitUrl={
                    selectedBot
                        ? route("teams.bots.create-token", [
                              team.slug,
                              selectedBot.id,
                          ])
                        : null
                }
            />

            <RevokeTokenDialog
                open={!!confirmRevoke}
                onCancel={() => setConfirmRevoke(null)}
                onConfirm={handleRevokeToken}
            />

            {/* Confirm Delete Bot Dialog */}
            <Dialog
                open={!!confirmDeleteBot}
                onClose={() => setConfirmDeleteBot(null)}
                aria-labelledby="delete-bot-dialog-title"
            >
                <DialogTitle id="delete-bot-dialog-title">
                    Remove Bot User
                </DialogTitle>
                <DialogContent>
                    <Alert severity="warning" sx={{ mt: 1 }}>
                        This will deactivate the bot user, revoke all its
                        tokens, and remove it from the team. Any applications
                        using its tokens will lose access.
                    </Alert>
                </DialogContent>
                <DialogActions sx={{ px: 3, py: 2 }}>
                    <Button onClick={() => setConfirmDeleteBot(null)}>
                        Cancel
                    </Button>
                    <Button
                        variant="contained"
                        color="error"
                        onClick={handleDeleteBot}
                    >
                        Remove Bot
                    </Button>
                </DialogActions>
            </Dialog>

            <TokenCreatedDialog />
        </>
    );
}

ApiTokens.layout = (page: ReactElement<Props>) => (
    <AuthenticatedLayout currentTeam={page.props.team}>
        {page}
    </AuthenticatedLayout>
);
