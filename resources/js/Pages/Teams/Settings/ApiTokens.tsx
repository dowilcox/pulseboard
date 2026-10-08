import ConfirmDialog from "@/Components/Common/ConfirmDialog";
import CreateTokenDialog from "@/Components/ApiTokens/CreateTokenDialog";
import RevokeTokenDialog from "@/Components/ApiTokens/RevokeTokenDialog";
import TokenCreatedDialog from "@/Components/ApiTokens/TokenCreatedDialog";
import TokenTable from "@/Components/ApiTokens/TokenTable";
import type { PersonalAccessToken, Team, User } from "@/types";
import { Link, router, useForm } from "@inertiajs/react";
import RouterLink from "@/Components/Common/RouterLink";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import MuiLink from "@mui/material/Link";
import Paper from "@mui/material/Paper";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { type FormEvent, useState } from "react";
import SectionCard from "./SectionCard";

export interface BotWithTokens extends User {
    tokens: PersonalAccessToken[];
}

interface Props {
    team: Team;
    bots: BotWithTokens[];
}

/** Bot users and their API tokens ("API & bots" tab of team settings). */
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

    const handleCreateBot = (e: FormEvent) => {
        e.preventDefault();
        botForm.post(route("teams.bots.store", team.slug), {
            preserveScroll: true,
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
                preserveScroll: true,
                onSuccess: () => setConfirmRevoke(null),
            },
        );
    };

    const handleDeleteBot = () => {
        if (!confirmDeleteBot) return;
        router.delete(
            route("teams.bots.destroy", [team.slug, confirmDeleteBot.id]),
            {
                preserveScroll: true,
                onSuccess: () => setConfirmDeleteBot(null),
            },
        );
    };

    const hasProfileTokens = route().has("profile.tokens.index");

    return (
        <>
            <SectionCard
                title={`Bot users (${bots.length})`}
                description={
                    <>
                        Bots are service accounts that belong to this team. Give
                        a bot an API token so scripts, CI jobs or agents can use
                        the PulseBoard REST API (<code>/api/v1</code>) with
                        access to this team's boards only.
                        {hasProfileTokens && (
                            <>
                                {" "}
                                To use the API as yourself, create a{" "}
                                <MuiLink
                                    component={RouterLink}
                                    href={route("profile.tokens.index")}
                                >
                                    personal token
                                </MuiLink>{" "}
                                instead.
                            </>
                        )}
                    </>
                }
                action={
                    <Button
                        variant="outlined"
                        size="small"
                        startIcon={<SmartToyIcon />}
                        onClick={() => {
                            botForm.reset();
                            botForm.clearErrors();
                            setBotDialogOpen(true);
                        }}
                    >
                        Create bot
                    </Button>
                }
            >
                {bots.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                        No bot users yet. Create a bot to generate API tokens
                        for external integrations.
                    </Typography>
                ) : (
                    bots.map((bot) => (
                        <Paper
                            key={bot.id}
                            variant="outlined"
                            component="section"
                            aria-label={`Bot ${bot.name}`}
                            sx={{ mb: 2, "&:last-of-type": { mb: 0 } }}
                        >
                            <Box
                                sx={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    flexWrap: "wrap",
                                    gap: 1,
                                    p: 2,
                                    borderBottom: bot.tokens.length > 0 ? 1 : 0,
                                    borderColor: "divider",
                                }}
                            >
                                <Box
                                    sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 1,
                                        minWidth: 0,
                                    }}
                                >
                                    <SmartToyIcon
                                        fontSize="small"
                                        color="action"
                                    />
                                    <Typography
                                        component="h3"
                                        variant="subtitle2"
                                        fontWeight={700}
                                        noWrap
                                    >
                                        {bot.name}
                                    </Typography>
                                    <Chip
                                        label={`${bot.tokens.length} token${bot.tokens.length === 1 ? "" : "s"}`}
                                        size="small"
                                        variant="outlined"
                                    />
                                </Box>
                                <Box sx={{ display: "flex", gap: 1 }}>
                                    <Button
                                        size="small"
                                        startIcon={<AddIcon />}
                                        onClick={() => openTokenDialog(bot)}
                                    >
                                        New token
                                    </Button>
                                    <Tooltip title="Remove bot">
                                        <IconButton
                                            size="small"
                                            color="error"
                                            aria-label={`Remove bot ${bot.name}`}
                                            onClick={() =>
                                                setConfirmDeleteBot(bot)
                                            }
                                        >
                                            <DeleteOutlineIcon fontSize="small" />
                                        </IconButton>
                                    </Tooltip>
                                </Box>
                            </Box>
                            <Box sx={{ overflowX: "auto" }}>
                                <TokenTable
                                    tokens={bot.tokens}
                                    onRevoke={(token) =>
                                        setConfirmRevoke({
                                            bot,
                                            tokenId: token.id,
                                        })
                                    }
                                />
                            </Box>
                        </Paper>
                    ))
                )}
            </SectionCard>

            {/* Create Bot Dialog */}
            <Dialog
                open={botDialogOpen}
                onClose={
                    botForm.processing
                        ? undefined
                        : () => setBotDialogOpen(false)
                }
                maxWidth="sm"
                fullWidth
                aria-labelledby="create-bot-dialog-title"
            >
                <form onSubmit={handleCreateBot}>
                    <DialogTitle id="create-bot-dialog-title">
                        Create bot user
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
                                Bot users are special accounts for API
                                integrations. This bot will be scoped to this
                                team only.
                            </Alert>
                            <TextField
                                label="Bot name"
                                autoFocus
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
                        <Button
                            onClick={() => setBotDialogOpen(false)}
                            disabled={botForm.processing}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            variant="contained"
                            disabled={
                                botForm.processing || !botForm.data.name.trim()
                            }
                        >
                            {botForm.processing ? "Creating…" : "Create bot"}
                        </Button>
                    </DialogActions>
                </form>
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

            <ConfirmDialog
                open={!!confirmDeleteBot}
                onClose={() => setConfirmDeleteBot(null)}
                onConfirm={handleDeleteBot}
                title={`Remove bot “${confirmDeleteBot?.name ?? ""}”?`}
                message="This deactivates the bot, revokes all of its tokens and removes it from the team. Anything using its tokens will lose access immediately."
                confirmLabel="Remove bot"
                confirmColor="error"
            />

            <TokenCreatedDialog />
        </>
    );
}
