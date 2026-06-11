import { Head, router } from "@inertiajs/react";
import { type ReactElement, useState } from "react";
import AdminNav from "@/Components/Admin/AdminNav";
import CreateTokenDialog from "@/Components/ApiTokens/CreateTokenDialog";
import RevokeTokenDialog from "@/Components/ApiTokens/RevokeTokenDialog";
import TokenCreatedDialog from "@/Components/ApiTokens/TokenCreatedDialog";
import TokenTable from "@/Components/ApiTokens/TokenTable";
import LayoutHeader from "@/Components/Layout/LayoutHeader";
import PageHeader from "@/Components/Layout/PageHeader";
import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import type { PageProps, PersonalAccessToken, Team, User } from "@/types";
import AddIcon from "@mui/icons-material/Add";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";

interface UserWithTokens extends User {
    tokens: PersonalAccessToken[];
    created_by_team?: Pick<Team, "id" | "name">;
}

interface Props extends PageProps {
    users: UserWithTokens[];
}

export default function ApiTokens({ users }: Props) {
    const [tokenDialogOpen, setTokenDialogOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<UserWithTokens | null>(
        null,
    );
    const [confirmRevoke, setConfirmRevoke] = useState<{
        user: UserWithTokens;
        tokenId: number;
    } | null>(null);

    const openTokenDialog = (user: UserWithTokens) => {
        setSelectedUser(user);
        setTokenDialogOpen(true);
    };

    const handleRevokeToken = () => {
        if (!confirmRevoke) return;
        router.delete(
            route("admin.api-tokens.revoke-token", [
                confirmRevoke.user.id,
                confirmRevoke.tokenId,
            ]),
            {
                onSuccess: () => setConfirmRevoke(null),
            },
        );
    };

    return (
        <>
            <Head title="API Tokens" />
            <LayoutHeader>
                <PageHeader
                    title="API Tokens"
                    breadcrumbs={[
                        { label: "Admin", href: route("admin.dashboard") },
                    ]}
                />
            </LayoutHeader>

            <Box sx={{ display: "flex" }}>
                <AdminNav />

                <Box sx={{ flex: 1 }}>
                    <Box sx={{ mb: 2 }}>
                        <Typography variant="body2" color="text.secondary">
                            Overview of all API tokens across the platform. Bot
                            users are now created and managed within team
                            settings.
                        </Typography>
                    </Box>

                    {users.length === 0 ? (
                        <Paper
                            variant="outlined"
                            sx={{ p: 4, textAlign: "center" }}
                        >
                            <Typography color="text.secondary">
                                No users with API tokens yet. Teams can create
                                bot users from their settings page.
                            </Typography>
                        </Paper>
                    ) : (
                        users.map((user) => (
                            <Paper
                                key={user.id}
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
                                            user.tokens.length > 0 ? 1 : 0,
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
                                        <Typography fontWeight={600}>
                                            {user.name}
                                        </Typography>
                                        {!user.is_bot && (
                                            <Typography
                                                variant="body2"
                                                color="text.secondary"
                                            >
                                                {user.email}
                                            </Typography>
                                        )}
                                        {user.is_bot && (
                                            <Chip
                                                label="Bot"
                                                size="small"
                                                color="info"
                                                icon={<SmartToyIcon />}
                                            />
                                        )}
                                        {user.is_bot &&
                                            user.created_by_team && (
                                                <Chip
                                                    label={
                                                        user.created_by_team
                                                            .name
                                                    }
                                                    size="small"
                                                    variant="outlined"
                                                />
                                            )}
                                        {user.is_bot &&
                                            !user.created_by_team && (
                                                <Chip
                                                    label="No team"
                                                    size="small"
                                                    variant="outlined"
                                                    color="warning"
                                                />
                                            )}
                                    </Box>
                                    <Button
                                        size="small"
                                        startIcon={<AddIcon />}
                                        onClick={() => openTokenDialog(user)}
                                    >
                                        New Token
                                    </Button>
                                </Box>
                                <TokenTable
                                    tokens={user.tokens}
                                    onRevoke={(token) =>
                                        setConfirmRevoke({
                                            user,
                                            tokenId: token.id,
                                        })
                                    }
                                />
                            </Paper>
                        ))
                    )}
                </Box>
            </Box>

            <CreateTokenDialog
                open={tokenDialogOpen}
                onClose={() => setTokenDialogOpen(false)}
                ownerName={selectedUser?.name}
                submitUrl={
                    selectedUser
                        ? route(
                              "admin.api-tokens.create-token",
                              selectedUser.id,
                          )
                        : null
                }
            />

            <RevokeTokenDialog
                open={!!confirmRevoke}
                onCancel={() => setConfirmRevoke(null)}
                onConfirm={handleRevokeToken}
            />

            <TokenCreatedDialog />
        </>
    );
}

ApiTokens.layout = (page: ReactElement) => (
    <AuthenticatedLayout>{page}</AuthenticatedLayout>
);
