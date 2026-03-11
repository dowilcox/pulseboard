import { Head, router } from "@inertiajs/react";
import { useState } from "react";
import ConfirmDeleteDialog from "@/Components/Common/ConfirmDeleteDialog";
import PageHeader from "@/Components/Layout/PageHeader";
import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import AdminNav from "@/Components/Admin/AdminNav";
import type { Board, PageProps, Team, UserWithTeamPivot } from "@/types";
import DeleteIcon from "@mui/icons-material/Delete";
import GroupsIcon from "@mui/icons-material/Groups";
import ViewKanbanIcon from "@mui/icons-material/ViewKanban";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";

interface TeamWithCounts extends Team {
    members_count: number;
    boards_count: number;
}

interface TeamDetail extends Team {
    members: UserWithTeamPivot[];
    boards: Board[];
}

interface Props extends PageProps {
    adminTeams: TeamWithCounts[];
}

export default function Teams({ adminTeams: teams }: Props) {
    const [detailOpen, setDetailOpen] = useState(false);
    const [teamDetail, setTeamDetail] = useState<TeamDetail | null>(null);
    const [loading, setLoading] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const handleRowClick = async (team: TeamWithCounts) => {
        setDetailOpen(true);
        setLoading(true);
        setTeamDetail(null);

        try {
            const response = await fetch(route("admin.teams.show", team.id), {
                headers: { Accept: "application/json" },
            });
            const data = await response.json();
            setTeamDetail(data);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteTeam = () => {
        if (!teamDetail) return;
        setDeleting(true);
        router.delete(route("admin.teams.destroy", teamDetail.id), {
            data: { confirmation: "DELETE" },
            onSuccess: () => {
                setDeleteOpen(false);
                setDetailOpen(false);
            },
            onFinish: () => setDeleting(false),
        });
    };

    return (
        <AuthenticatedLayout
            header={
                <PageHeader
                    title="Team Oversight"
                    breadcrumbs={[
                        { label: "Admin", href: route("admin.dashboard") },
                    ]}
                />
            }
        >
            <Head title="Team Oversight" />

            <Box sx={{ display: "flex" }}>
                <AdminNav />

                <Box sx={{ flex: 1 }}>
                    {teams.length === 0 ? (
                        <Paper
                            variant="outlined"
                            sx={{ p: 4, textAlign: "center" }}
                        >
                            <Typography color="text.secondary">
                                No teams have been created yet.
                            </Typography>
                        </Paper>
                    ) : (
                        <TableContainer component={Paper} variant="outlined">
                            <Table>
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Name</TableCell>
                                        <TableCell>Members</TableCell>
                                        <TableCell>Boards</TableCell>
                                        <TableCell>Created</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {teams.map((team) => (
                                        <TableRow
                                            key={team.id}
                                            hover
                                            tabIndex={0}
                                            sx={{ cursor: "pointer" }}
                                            onClick={() => handleRowClick(team)}
                                            onKeyDown={(e) => {
                                                if (
                                                    e.key === "Enter" ||
                                                    e.key === " "
                                                ) {
                                                    e.preventDefault();
                                                    handleRowClick(team);
                                                }
                                            }}
                                            aria-label={`View details for team ${team.name}`}
                                        >
                                            <TableCell>
                                                <Typography fontWeight={500}>
                                                    {team.name}
                                                </Typography>
                                                {team.description && (
                                                    <Typography
                                                        variant="body2"
                                                        color="text.secondary"
                                                        noWrap
                                                        sx={{ maxWidth: 300 }}
                                                    >
                                                        {team.description}
                                                    </Typography>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <Chip
                                                    icon={<GroupsIcon />}
                                                    label={team.members_count}
                                                    size="small"
                                                    variant="outlined"
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Chip
                                                    icon={<ViewKanbanIcon />}
                                                    label={team.boards_count}
                                                    size="small"
                                                    variant="outlined"
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Typography
                                                    variant="body2"
                                                    color="text.secondary"
                                                >
                                                    {new Date(
                                                        team.created_at,
                                                    ).toLocaleDateString()}
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

            {/* Team Detail Dialog */}
            <Dialog
                open={detailOpen}
                onClose={() => setDetailOpen(false)}
                maxWidth="sm"
                fullWidth
                aria-labelledby="team-detail-dialog-title"
            >
                <DialogTitle id="team-detail-dialog-title">
                    {teamDetail?.name ?? "Team Details"}
                </DialogTitle>
                <DialogContent>
                    {loading ? (
                        <Box
                            sx={{
                                display: "flex",
                                justifyContent: "center",
                                py: 4,
                            }}
                            role="status"
                            aria-live="polite"
                        >
                            <CircularProgress aria-label="Loading team details" />
                        </Box>
                    ) : teamDetail ? (
                        <Box>
                            <Typography
                                variant="subtitle2"
                                gutterBottom
                                sx={{ mt: 1 }}
                            >
                                Members ({teamDetail.members.length})
                            </Typography>
                            <List dense disablePadding>
                                {teamDetail.members.map((member) => (
                                    <ListItem key={member.id} disableGutters>
                                        <ListItemText
                                            primary={member.name}
                                            secondary={member.email}
                                        />
                                        <Chip
                                            label={member.pivot.role}
                                            size="small"
                                            variant="outlined"
                                            color={
                                                member.pivot.role === "owner"
                                                    ? "primary"
                                                    : member.pivot.role ===
                                                        "admin"
                                                      ? "secondary"
                                                      : "default"
                                            }
                                        />
                                    </ListItem>
                                ))}
                            </List>

                            <Divider sx={{ my: 2 }} />

                            <Typography variant="subtitle2" gutterBottom>
                                Boards ({teamDetail.boards.length})
                            </Typography>
                            <List dense disablePadding>
                                {teamDetail.boards.map((board) => (
                                    <ListItem key={board.id} disableGutters>
                                        <ListItemText
                                            primary={board.name}
                                            secondary={`Created ${new Date(board.created_at).toLocaleDateString()}`}
                                        />
                                        {board.is_archived && (
                                            <Chip
                                                label="Archived"
                                                size="small"
                                                color="default"
                                            />
                                        )}
                                    </ListItem>
                                ))}
                                {teamDetail.boards.length === 0 && (
                                    <Typography
                                        variant="body2"
                                        color="text.secondary"
                                    >
                                        No boards yet.
                                    </Typography>
                                )}
                            </List>

                            <Divider sx={{ my: 2 }} />

                            <Button
                                variant="outlined"
                                color="error"
                                startIcon={<DeleteIcon />}
                                onClick={() => setDeleteOpen(true)}
                                fullWidth
                            >
                                Delete Team
                            </Button>
                        </Box>
                    ) : null}
                </DialogContent>
            </Dialog>

            {/* Delete Team Confirmation Dialog */}
            <ConfirmDeleteDialog
                open={deleteOpen}
                onClose={() => setDeleteOpen(false)}
                onConfirm={handleDeleteTeam}
                title="Delete Team"
                description="This will permanently delete this team and all its boards, tasks, comments, attachments, and integrations."
                itemName={teamDetail?.name ?? ""}
                processing={deleting}
            />
        </AuthenticatedLayout>
    );
}
