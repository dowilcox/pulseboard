import ConfirmDialog from "@/Components/Common/ConfirmDialog";
import TokenCreatedDialog from "@/Components/ApiTokens/TokenCreatedDialog";
import type { PersonalAccessToken } from "@/types";
import { formatTimestamp } from "@/utils/formatTimestamp";
import { router, useForm } from "@inertiajs/react";
import AddIcon from "@mui/icons-material/Add";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormLabel from "@mui/material/FormLabel";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import axios from "axios";
import { type FormEvent, useCallback, useEffect, useId, useState } from "react";

type AccessLevel = "read" | "write";

const ACCESS_LEVELS: { value: AccessLevel; label: string; help: string }[] = [
    {
        value: "read",
        label: "Read only",
        help: "View teams, boards, tasks and comments you can already see.",
    },
    {
        value: "write",
        label: "Read and write",
        help: "Also create and update tasks, comments, attachments and notifications.",
    },
];

function CreateProfileTokenDialog({
    open,
    onClose,
}: {
    open: boolean;
    onClose: (created: boolean) => void;
}) {
    const titleId = useId();
    const form = useForm<{ name: string; abilities: string[] }>({
        name: "",
        abilities: ["read"],
    });
    const access: AccessLevel = form.data.abilities.includes("write")
        ? "write"
        : "read";

    useEffect(() => {
        if (open) {
            form.reset();
            form.clearErrors();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const submit = (e: FormEvent) => {
        e.preventDefault();
        form.post(route("profile.tokens.store"), {
            preserveScroll: true,
            onSuccess: () => onClose(true),
        });
    };

    return (
        <Dialog
            open={open}
            onClose={() => onClose(false)}
            maxWidth="sm"
            fullWidth
            aria-labelledby={titleId}
        >
            <Box component="form" onSubmit={submit} noValidate>
                <DialogTitle id={titleId}>Create API token</DialogTitle>
                <DialogContent>
                    <Box
                        sx={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 2.5,
                            pt: 1,
                        }}
                    >
                        <TextField
                            label="Token name"
                            value={form.data.name}
                            onChange={(e) =>
                                form.setData("name", e.target.value)
                            }
                            error={!!form.errors.name}
                            helperText={
                                form.errors.name ??
                                "Something to recognise it by, e.g. “CLI on my laptop”."
                            }
                            required
                            autoFocus
                            fullWidth
                            size="small"
                            slotProps={{ htmlInput: { maxLength: 255 } }}
                        />
                        <FormControl>
                            <FormLabel id={`${titleId}-access`}>
                                Access
                            </FormLabel>
                            <RadioGroup
                                aria-labelledby={`${titleId}-access`}
                                value={access}
                                onChange={(e) =>
                                    form.setData(
                                        "abilities",
                                        e.target.value === "write"
                                            ? ["read", "write"]
                                            : ["read"],
                                    )
                                }
                            >
                                {ACCESS_LEVELS.map((level) => (
                                    <FormControlLabel
                                        key={level.value}
                                        value={level.value}
                                        control={<Radio />}
                                        sx={{ alignItems: "flex-start", mt: 1 }}
                                        label={
                                            <Box sx={{ pt: 1 }}>
                                                <Typography
                                                    variant="body2"
                                                    fontWeight={600}
                                                >
                                                    {level.label}
                                                </Typography>
                                                <Typography
                                                    variant="body2"
                                                    color="text.secondary"
                                                >
                                                    {level.help}
                                                </Typography>
                                            </Box>
                                        }
                                    />
                                ))}
                            </RadioGroup>
                        </FormControl>
                        {form.errors.abilities && (
                            <Alert severity="error">
                                {form.errors.abilities}
                            </Alert>
                        )}
                        <Alert severity="info">
                            The token is shown only once, right after you create
                            it.
                        </Alert>
                    </Box>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => onClose(false)}>Cancel</Button>
                    <Button
                        type="submit"
                        variant="contained"
                        disabled={form.processing || !form.data.name.trim()}
                    >
                        Create token
                    </Button>
                </DialogActions>
            </Box>
        </Dialog>
    );
}

export default function ApiTokensSection() {
    const [tokens, setTokens] = useState<PersonalAccessToken[] | null>(null);
    const [loadFailed, setLoadFailed] = useState(false);
    const [createOpen, setCreateOpen] = useState(false);
    const [revokeTarget, setRevokeTarget] =
        useState<PersonalAccessToken | null>(null);
    // Kept separately from the target so the dialog text doesn't blank out
    // while it animates closed.
    const [revokeOpen, setRevokeOpen] = useState(false);
    const [revoking, setRevoking] = useState(false);

    const loadTokens = useCallback(() => {
        axios
            .get<{ data: PersonalAccessToken[] }>(route("profile.tokens.index"))
            .then((response) => {
                setTokens(response.data.data);
                setLoadFailed(false);
            })
            .catch(() => setLoadFailed(true));
    }, []);

    useEffect(() => {
        loadTokens();
    }, [loadTokens]);

    const openRevoke = (token: PersonalAccessToken) => {
        setRevokeTarget(token);
        setRevokeOpen(true);
    };

    const confirmRevoke = () => {
        if (!revokeTarget || revoking) return;
        setRevoking(true);
        router.delete(route("profile.tokens.destroy", revokeTarget.id), {
            preserveScroll: true,
            onSuccess: () => loadTokens(),
            onFinish: () => {
                setRevoking(false);
                setRevokeOpen(false);
            },
        });
    };

    const apiBase = `${window.location.origin}/api/v1`;

    return (
        <Box component="section" aria-labelledby="api-tokens-heading">
            <Box
                sx={{
                    display: "flex",
                    alignItems: { xs: "flex-start", sm: "center" },
                    justifyContent: "space-between",
                    flexDirection: { xs: "column", sm: "row" },
                    gap: 2,
                    mb: 1,
                }}
            >
                <Typography id="api-tokens-heading" variant="h6" component="h2">
                    API Tokens
                </Typography>
                <Button
                    variant="outlined"
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={() => setCreateOpen(true)}
                >
                    Create token
                </Button>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Personal access tokens let scripts and tools use the PulseBoard
                REST API as you. Send them as{" "}
                <Box
                    component="code"
                    sx={{ fontSize: "0.85em", overflowWrap: "anywhere" }}
                >
                    Authorization: Bearer &lt;token&gt;
                </Box>{" "}
                to{" "}
                <Box
                    component="code"
                    sx={{ fontSize: "0.85em", overflowWrap: "anywhere" }}
                >
                    {apiBase}
                </Box>
                .
            </Typography>

            {loadFailed && (
                <Alert
                    severity="error"
                    action={
                        <Button
                            color="inherit"
                            size="small"
                            onClick={loadTokens}
                        >
                            Retry
                        </Button>
                    }
                >
                    Couldn&apos;t load your tokens.
                </Alert>
            )}

            {!loadFailed && tokens === null && (
                <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
                    <CircularProgress size={24} aria-label="Loading tokens" />
                </Box>
            )}

            {tokens !== null && tokens.length === 0 && (
                <Typography variant="body2" color="text.secondary">
                    You don&apos;t have any API tokens yet.
                </Typography>
            )}

            {tokens !== null && tokens.length > 0 && (
                <Box
                    component="ul"
                    aria-label="Your API tokens"
                    sx={{ listStyle: "none", m: 0, p: 0 }}
                >
                    {tokens.map((token) => (
                        <Box
                            component="li"
                            key={token.id}
                            sx={{
                                display: "flex",
                                alignItems: { xs: "flex-start", sm: "center" },
                                flexDirection: { xs: "column", sm: "row" },
                                gap: { xs: 1, sm: 2 },
                                py: 1.5,
                                borderTop: 1,
                                borderColor: "divider",
                            }}
                        >
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Box
                                    sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        flexWrap: "wrap",
                                        gap: 1,
                                    }}
                                >
                                    <Typography
                                        variant="body2"
                                        fontWeight={600}
                                        sx={{ overflowWrap: "anywhere" }}
                                    >
                                        {token.name}
                                    </Typography>
                                    {token.abilities.map((ability) => (
                                        <Chip
                                            key={ability}
                                            label={ability}
                                            size="small"
                                            variant="outlined"
                                        />
                                    ))}
                                </Box>
                                <Typography
                                    variant="body2"
                                    color="text.secondary"
                                    sx={{ mt: 0.5 }}
                                >
                                    Created {formatTimestamp(token.created_at)}{" "}
                                    · Last used{" "}
                                    {token.last_used_at
                                        ? formatTimestamp(token.last_used_at)
                                        : "never"}
                                </Typography>
                            </Box>
                            <Button
                                color="error"
                                size="small"
                                onClick={() => openRevoke(token)}
                                aria-label={`Revoke ${token.name}`}
                            >
                                Revoke
                            </Button>
                        </Box>
                    ))}
                </Box>
            )}

            <CreateProfileTokenDialog
                open={createOpen}
                onClose={(created) => {
                    setCreateOpen(false);
                    if (created) loadTokens();
                }}
            />

            <ConfirmDialog
                open={revokeOpen}
                onClose={() => setRevokeOpen(false)}
                onConfirm={confirmRevoke}
                title="Revoke API token?"
                message={
                    <>
                        <strong>{revokeTarget?.name}</strong> will stop working
                        immediately. Anything using it will lose access to the
                        API.
                    </>
                }
                confirmLabel="Revoke token"
                confirmColor="error"
            />

            <TokenCreatedDialog />
        </Box>
    );
}
