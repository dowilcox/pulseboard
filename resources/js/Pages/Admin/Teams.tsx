import { Head, router } from "@inertiajs/react";
import { useCallback, useState } from "react";
import ConfirmDeleteDialog from "@/Components/Common/ConfirmDeleteDialog";
import PageHeader from "@/Components/Layout/PageHeader";
import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import AdminNav from "@/Components/Admin/AdminNav";
import type { Board, PageProps, Team, User, UserWithTeamPivot } from "@/types";
import DeleteIcon from "@mui/icons-material/Delete";
import GroupsIcon from "@mui/icons-material/Groups";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import PersonRemoveIcon from "@mui/icons-material/PersonRemove";
import ViewKanbanIcon from "@mui/icons-material/ViewKanban";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import FormControl from "@mui/material/FormControl";
import IconButton from "@mui/material/IconButton";
import InputLabel from "@mui/material/InputLabel";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
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

const roleColor = (role: string) =>
    role === "owner" ? "primary" : role === "admin" ? "secondary" : "default";

export default function Teams({ adminTeams: teams }: Props) {
    const [detailOpen, setDetailOpen] = useState(false);
    const [teamDetail, setTeamDetail] = useState<TeamDetail | null>(null);
    const [loading, setLoading] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [deleting, setDeleting] = useState(false);

    // Add member state
    const [addMemberOpen, setAddMemberOpen] = useState(false);
    const [userSearchResults, setUserSearchResults] = useState<
        Pick<User, "id" | "name" | "email" | "is_bot">[]
    >([]);
    const [userSearchLoading, setUserSearchLoading] = useState(false);
    const [selectedUser, setSelectedUser] = useState<Pick<
        User,
        "id" | "name" | "email" | "is_bot"
    > | null>(null);
    const [selectedRole, setSelectedRole] = useState("member");
    const [addingMember, setAddingMember] = useState(false);

    // Remove member state
    const [removeMember, setRemoveMember] = useState<UserWithTeamPivot | null>(
        null,
    );
    const [removingMember, setRemovingMember] = useState(false);

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

    const searchUsers = useCallback(
        (query: string) => {
            if (!teamDetail || query.length < 2) {
                setUserSearchResults([]);
                return;
            }
            setUserSearchLoading(true);
            fetch(
                route("admin.teams.members.search", teamDetail.id) +
                    "?q=" +
                    encodeURIComponent(query),
                {
                    headers: {
                        Accept: "application/json",
                        "X-Requested-With": "XMLHttpRequest",
                    },
                },
            )
                .then((res) => res.json())
                .then((data) => setUserSearchResults(data))
                .finally(() => setUserSearchLoading(false));
        },
        [teamDetail?.id],
    );

    const handleAddMember = async () => {
        if (!teamDetail || !selectedUser) return;
        setAddingMember(true);
        try {
            const csrfToken = document
                .querySelector('meta[name="csrf-token"]')
                ?.getAttribute("content");
            const response = await fetch(
                route("admin.teams.members.store", teamDetail.id),
                {
                    method: "POST",
                    headers: {
                        Accept: "application/json",
                        "Content-Type": "application/json",
                        "X-Requested-With": "XMLHttpRequest",
                        ...(csrfToken ? { "X-CSRF-TOKEN": csrfToken } : {}),
                    },
                    body: JSON.stringify({
                        user_id: selectedUser.id,
                        role: selectedRole,
                    }),
                },
            );
            if (response.ok) {
                const updatedMembers = await response.json();
                setTeamDetail((prev) =>
                    prev ? { ...prev, members: updatedMembers } : prev,
                );
                setAddMemberOpen(false);
                setSelectedUser(null);
                setSelectedRole("member");
                setUserSearchResults([]);
            }
        } finally {
            setAddingMember(false);
        }
    };

    const handleRemoveMember = async () => {
        if (!teamDetail || !removeMember) return;
        setRemovingMember(true);
        try {
            const csrfToken = document
                .querySelector('meta[name="csrf-token"]')
                ?.getAttribute("content");
            const response = await fetch(
                route("admin.teams.members.destroy", [
                    teamDetail.id,
                    removeMember.id,
                ]),
                {
                    method: "DELETE",
                    headers: {
                        Accept: "application/json",
                        "X-Requested-With": "XMLHttpRequest",
                        ...(csrfToken ? { "X-CSRF-TOKEN": csrfToken } : {}),
                    },
                },
            );
            if (response.ok) {
                const updatedMembers = await response.json();
                setTeamDetail((prev) =>
                    prev ? { ...prev, members: updatedMembers } : prev,
                );
                setRemoveMember(null);
            }
        } finally {
            setRemovingMember(false);
        }
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
                            <Box
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    mt: 1,
                                    mb: 1,
                                }}
                            >
                                <Typography variant="subtitle2">
                                    Members ({teamDetail.members.length})
                                </Typography>
                                <Button
                                    startIcon={<PersonAddIcon />}
                                    size="small"
                                    onClick={() => setAddMemberOpen(true)}
                                >
                                    Add Member
                                </Button>
                            </Box>
                            <List dense disablePadding>
                                {teamDetail.members.map((member) => (
                                    <ListItem
                                        key={member.id}
                                        disableGutters
                                        secondaryAction={
                                            <Tooltip title="Remove member">
                                                <IconButton
                                                    edge="end"
                                                    size="small"
                                                    color="error"
                                                    onClick={() =>
                                                        setRemoveMember(member)
                                                    }
                                                >
                                                    <PersonRemoveIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                        }
                                    >
                                        <ListItemText
                                            primary={member.name}
                                            secondary={member.email}
                                        />
                                        <Chip
                                            label={member.pivot.role}
                                            size="small"
                                            variant="outlined"
                                            color={roleColor(member.pivot.role)}
                                            sx={{ mr: 1 }}
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

            {/* Add Member Dialog */}
            <Dialog
                open={addMemberOpen}
                onClose={() => {
                    setAddMemberOpen(false);
                    setSelectedUser(null);
                    setSelectedRole("member");
                    setUserSearchResults([]);
                }}
                maxWidth="xs"
                fullWidth
                aria-labelledby="add-member-dialog-title"
            >
                <DialogTitle id="add-member-dialog-title">
                    Add Member to {teamDetail?.name}
                </DialogTitle>
                <DialogContent>
                    <Autocomplete
                        options={userSearchResults}
                        getOptionLabel={(option) => option.name}
                        filterOptions={(x) => x}
                        value={selectedUser}
                        loading={userSearchLoading}
                        onInputChange={(_e, value, reason) => {
                            if (reason === "input") searchUsers(value);
                        }}
                        onChange={(_e, value) => setSelectedUser(value)}
                        isOptionEqualToValue={(option, value) =>
                            option.id === value.id
                        }
                        renderOption={(props, option) => (
                            <li {...props} key={option.id}>
                                <Box
                                    sx={{
                                        display: "flex",
                                        flexDirection: "column",
                                    }}
                                >
                                    <Typography
                                        variant="body2"
                                        fontWeight={500}
                                    >
                                        {option.name}
                                        {option.is_bot ? " (Bot)" : ""}
                                    </Typography>
                                    {!option.is_bot && (
                                        <Typography
                                            variant="caption"
                                            color="text.secondary"
                                        >
                                            {option.email}
                                        </Typography>
                                    )}
                                </Box>
                            </li>
                        )}
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                autoFocus
                                label="Search users"
                                placeholder="Type a name or email..."
                                slotProps={{
                                    input: {
                                        ...params.InputProps,
                                        endAdornment: (
                                            <>
                                                {userSearchLoading ? (
                                                    <CircularProgress
                                                        size={20}
                                                    />
                                                ) : null}
                                                {params.InputProps.endAdornment}
                                            </>
                                        ),
                                    },
                                }}
                            />
                        )}
                        noOptionsText="No users found"
                        sx={{ mt: 1, mb: 2 }}
                    />
                    <FormControl fullWidth>
                        <InputLabel>Role</InputLabel>
                        <Select
                            label="Role"
                            value={selectedRole}
                            onChange={(e) => setSelectedRole(e.target.value)}
                        >
                            <MenuItem value="member">Member</MenuItem>
                            <MenuItem value="admin">Admin</MenuItem>
                            <MenuItem value="owner">Owner</MenuItem>
                        </Select>
                    </FormControl>
                </DialogContent>
                <DialogActions sx={{ px: 3, py: 2 }}>
                    <Button
                        onClick={() => {
                            setAddMemberOpen(false);
                            setSelectedUser(null);
                            setSelectedRole("member");
                            setUserSearchResults([]);
                        }}
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="contained"
                        disabled={!selectedUser || addingMember}
                        onClick={handleAddMember}
                    >
                        {addingMember ? "Adding..." : "Add"}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Remove Member Confirmation Dialog */}
            <Dialog
                open={!!removeMember}
                onClose={() => setRemoveMember(null)}
                maxWidth="xs"
                aria-labelledby="remove-member-dialog-title"
            >
                <DialogTitle id="remove-member-dialog-title">
                    Remove Member
                </DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Are you sure you want to remove{" "}
                        <strong>{removeMember?.name}</strong> from{" "}
                        <strong>{teamDetail?.name}</strong>? They will lose
                        access to all team boards.
                    </DialogContentText>
                </DialogContent>
                <DialogActions sx={{ px: 3, py: 2 }}>
                    <Button onClick={() => setRemoveMember(null)}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleRemoveMember}
                        color="error"
                        variant="contained"
                        disabled={removingMember}
                    >
                        {removingMember ? "Removing..." : "Remove"}
                    </Button>
                </DialogActions>
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
