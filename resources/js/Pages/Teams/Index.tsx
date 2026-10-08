import LayoutHeader from "@/Components/Layout/LayoutHeader";
import PageHeader from "@/Components/Layout/PageHeader";
import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import { Head, Link, useForm } from "@inertiajs/react";
import { type ReactElement, useMemo, useState } from "react";
import type { Board, Team } from "@/types";
import { useSidebar } from "@/Contexts/SidebarContext";
import { harbor, harborAvatarColor } from "@/theme/harbor";
import { nameInitials } from "@/utils/sidebarNav";
import AddIcon from "@mui/icons-material/Add";
import GroupsIcon from "@mui/icons-material/Groups";
import ViewModuleOutlinedIcon from "@mui/icons-material/ViewModuleOutlined";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import Divider from "@mui/material/Divider";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Grid from "@mui/material/Grid2";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

interface IndexTeam extends Team {
    members_count?: number;
    boards_count?: number;
}

interface Props {
    pageTeams: IndexTeam[];
}

const BOARD_PREVIEW_LIMIT = 4;

function plural(count: number, noun: string) {
    return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

/** A few of the team's boards as direct links, plus "+N more". */
function TeamBoardLinks({ team, boards }: { team: Team; boards: Board[] }) {
    if (boards.length === 0) {
        return (
            <Typography
                variant="body2"
                sx={{ px: 2, py: 1.5, color: harbor.sub }}
            >
                No boards yet
            </Typography>
        );
    }

    const hidden = boards.length - BOARD_PREVIEW_LIMIT;

    return (
        <List dense aria-label={`${team.name} boards`} sx={{ px: 1, py: 0.75 }}>
            {boards.slice(0, BOARD_PREVIEW_LIMIT).map((board) => (
                <li key={board.id}>
                    <ListItemButton
                        component={Link}
                        href={route("teams.boards.show", [
                            team.slug,
                            board.slug,
                        ])}
                        sx={{ gap: 1, borderRadius: 1.5, py: 0.5 }}
                    >
                        {board.image_url ? (
                            <Box
                                component="img"
                                src={board.image_url}
                                alt=""
                                sx={{
                                    width: 20,
                                    height: 20,
                                    borderRadius: "4px",
                                    objectFit: "cover",
                                    flexShrink: 0,
                                }}
                            />
                        ) : (
                            <ViewModuleOutlinedIcon
                                aria-hidden
                                sx={{ fontSize: 18, color: harbor.sub }}
                            />
                        )}
                        <Typography variant="body2" noWrap fontWeight={600}>
                            {board.name}
                        </Typography>
                    </ListItemButton>
                </li>
            ))}
            {hidden > 0 && (
                <li>
                    <ListItemButton
                        component={Link}
                        href={route("teams.show", team.slug)}
                        aria-label={`${hidden} more ${team.name} boards`}
                        sx={{ borderRadius: 1.5, py: 0.5 }}
                    >
                        <Typography
                            variant="body2"
                            fontWeight={700}
                            color="primary"
                        >
                            +{hidden} more
                        </Typography>
                    </ListItemButton>
                </li>
            )}
        </List>
    );
}

export default function TeamsIndex({ pageTeams: teams }: Props) {
    const [createOpen, setCreateOpen] = useState(false);
    // The shared sidebar data carries each team's active boards in the
    // user's saved order.
    const { teams: sidebarTeams } = useSidebar();
    const boardsByTeam = useMemo(
        () => new Map(sidebarTeams.map((team) => [team.id, team.boards ?? []])),
        [sidebarTeams],
    );

    const { data, setData, post, processing, errors, reset } = useForm({
        name: "",
        description: "",
    });

    const handleCreate = (e: React.FormEvent) => {
        e.preventDefault();
        post(route("teams.store"), {
            onSuccess: () => {
                setCreateOpen(false);
                reset();
            },
        });
    };

    const handleClose = () => {
        setCreateOpen(false);
        reset();
    };

    return (
        <>
            <Head title="Teams" />
            <LayoutHeader>
                <PageHeader
                    title="Teams"
                    actions={
                        <Button
                            variant="contained"
                            startIcon={<AddIcon />}
                            size="small"
                            onClick={() => setCreateOpen(true)}
                        >
                            Create Team
                        </Button>
                    }
                />
            </LayoutHeader>

            {teams.length === 0 ? (
                <Box
                    sx={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        py: 8,
                    }}
                >
                    <GroupsIcon
                        sx={{ fontSize: 64, color: "text.disabled", mb: 2 }}
                    />
                    <Typography
                        variant="h6"
                        color="text.secondary"
                        gutterBottom
                    >
                        No teams yet
                    </Typography>
                    <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ mb: 3 }}
                    >
                        Create your first team to start collaborating.
                    </Typography>
                    <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={() => setCreateOpen(true)}
                    >
                        Create Team
                    </Button>
                </Box>
            ) : (
                <Grid container spacing={3}>
                    {teams.map((team) => {
                        const boards = boardsByTeam.get(team.id) ?? [];
                        const memberCount =
                            team.members_count ?? team.members?.length ?? 0;
                        const boardCount = team.boards_count ?? boards.length;
                        const role = team.pivot?.role;
                        return (
                            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={team.id}>
                                <Card
                                    variant="outlined"
                                    sx={{
                                        height: "100%",
                                        display: "flex",
                                        flexDirection: "column",
                                        transition:
                                            "border-color 150ms ease, background-color 150ms ease",
                                        "&:hover": {
                                            borderColor: "action.selected",
                                        },
                                    }}
                                >
                                    <CardActionArea
                                        component={Link}
                                        href={route("teams.show", team.slug)}
                                        sx={{
                                            flexGrow: 1,
                                            display: "flex",
                                            flexDirection: "column",
                                            alignItems: "stretch",
                                            justifyContent: "flex-start",
                                        }}
                                    >
                                        <CardContent>
                                            <Box
                                                sx={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    mb: 1,
                                                    minWidth: 0,
                                                }}
                                            >
                                                <Avatar
                                                    src={
                                                        team.image_url ??
                                                        undefined
                                                    }
                                                    alt=""
                                                    sx={{
                                                        width: 32,
                                                        height: 32,
                                                        fontSize: "0.875rem",
                                                        fontWeight: 800,
                                                        mr: 1.5,
                                                        bgcolor:
                                                            harborAvatarColor(
                                                                team.name,
                                                            ),
                                                        color: "#ffffff",
                                                    }}
                                                >
                                                    {nameInitials(team.name, 1)}
                                                </Avatar>
                                                <Typography
                                                    variant="h6"
                                                    component="h2"
                                                    fontWeight={600}
                                                    noWrap
                                                    sx={{
                                                        flex: 1,
                                                        minWidth: 0,
                                                    }}
                                                >
                                                    {team.name}
                                                </Typography>
                                                {role && (
                                                    <Chip
                                                        label={role}
                                                        size="small"
                                                        variant="outlined"
                                                        color={
                                                            role === "owner"
                                                                ? "primary"
                                                                : role ===
                                                                    "admin"
                                                                  ? "secondary"
                                                                  : "default"
                                                        }
                                                        sx={{ ml: 1 }}
                                                    />
                                                )}
                                            </Box>

                                            {team.description && (
                                                <Typography
                                                    variant="body2"
                                                    color="text.secondary"
                                                    sx={{
                                                        mb: 2,
                                                        overflow: "hidden",
                                                        textOverflow:
                                                            "ellipsis",
                                                        display: "-webkit-box",
                                                        WebkitLineClamp: 2,
                                                        WebkitBoxOrient:
                                                            "vertical",
                                                    }}
                                                >
                                                    {team.description}
                                                </Typography>
                                            )}

                                            <Box
                                                sx={{ display: "flex", gap: 2 }}
                                            >
                                                <Typography
                                                    variant="caption"
                                                    color="text.secondary"
                                                >
                                                    {plural(
                                                        memberCount,
                                                        "member",
                                                    )}
                                                </Typography>
                                                <Typography
                                                    variant="caption"
                                                    color="text.secondary"
                                                >
                                                    {plural(
                                                        boardCount,
                                                        "board",
                                                    )}
                                                </Typography>
                                            </Box>
                                        </CardContent>
                                    </CardActionArea>
                                    <Divider />
                                    <TeamBoardLinks
                                        team={team}
                                        boards={boards}
                                    />
                                </Card>
                            </Grid>
                        );
                    })}
                </Grid>
            )}

            {/* Create Team Dialog */}
            <Dialog
                open={createOpen}
                onClose={handleClose}
                maxWidth="sm"
                fullWidth
                aria-labelledby="create-team-dialog-title"
            >
                <form onSubmit={handleCreate}>
                    <DialogTitle id="create-team-dialog-title">
                        Create Team
                    </DialogTitle>
                    <DialogContent>
                        <TextField
                            autoFocus
                            label="Team Name"
                            fullWidth
                            required
                            value={data.name}
                            onChange={(e) => setData("name", e.target.value)}
                            error={!!errors.name}
                            helperText={errors.name}
                            sx={{ mt: 1, mb: 2 }}
                        />
                        <TextField
                            label="Description"
                            fullWidth
                            multiline
                            rows={3}
                            value={data.description}
                            onChange={(e) =>
                                setData("description", e.target.value)
                            }
                            error={!!errors.description}
                            helperText={errors.description}
                        />
                    </DialogContent>
                    <DialogActions sx={{ px: 3, py: 2 }}>
                        <Button onClick={handleClose}>Cancel</Button>
                        <Button
                            type="submit"
                            variant="contained"
                            disabled={processing}
                        >
                            Create
                        </Button>
                    </DialogActions>
                </form>
            </Dialog>
        </>
    );
}

TeamsIndex.layout = (page: ReactElement) => (
    <AuthenticatedLayout>{page}</AuthenticatedLayout>
);
