import axios from "axios";
import ImageUpload from "@/Components/Common/ImageUpload";
import ColorSwatchPicker from "@/Components/Common/ColorSwatchPicker";
import ConfirmDeleteDialog from "@/Components/Common/ConfirmDeleteDialog";
import { LABEL_COLORS } from "@/constants/labelColors";
import PageHeader from "@/Components/Layout/PageHeader";
import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import type { Label, PageProps, Team, User, UserWithTeamPivot } from "@/types";
import { getContrastText } from "@/utils/colorContrast";
import { Head, Link, router, useForm, usePage } from "@inertiajs/react";
import { useCallback, useState } from "react";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import KeyIcon from "@mui/icons-material/Key";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import PersonRemoveIcon from "@mui/icons-material/PersonRemove";
import Autocomplete from "@mui/material/Autocomplete";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import FormControl from "@mui/material/FormControl";
import IconButton from "@mui/material/IconButton";
import InputLabel from "@mui/material/InputLabel";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemAvatar from "@mui/material/ListItemAvatar";
import ListItemText from "@mui/material/ListItemText";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";

interface Props {
    team: Team;
    sidebarBoards?: Team["boards"];
    labels: Label[];
    members: UserWithTeamPivot[];
    canManageMembers: boolean;
    canManageAdmins: boolean;
}

const roleColor = (role: string) =>
    role === "owner" ? "primary" : role === "admin" ? "secondary" : "default";

export default function TeamSettings({
    team,
    sidebarBoards = [],
    labels,
    members,
    canManageMembers,
    canManageAdmins,
}: Props) {
    const { auth } = usePage<PageProps>().props;
    const currentUserId = auth.user.id;

    // Label state
    const [addLabelOpen, setAddLabelOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState("");
    const [editColor, setEditColor] = useState("");
    const [deleteLabel, setDeleteLabel] = useState<Label | null>(null);

    const addLabelForm = useForm({
        name: "",
        color: LABEL_COLORS[0] as string,
    });

    // Member state
    const [addMemberOpen, setAddMemberOpen] = useState(false);
    const [removeMember, setRemoveMember] = useState<UserWithTeamPivot | null>(
        null,
    );
    const [userSearchResults, setUserSearchResults] = useState<
        Pick<User, "id" | "name" | "email" | "is_bot">[]
    >([]);
    const [userSearchLoading, setUserSearchLoading] = useState(false);
    const [selectedUser, setSelectedUser] = useState<Pick<
        User,
        "id" | "name" | "email" | "is_bot"
    > | null>(null);

    const addMemberForm = useForm({ user_id: "", role: "member" as string });

    // Delete team state
    const [deleteTeamOpen, setDeleteTeamOpen] = useState(false);
    const [deletingTeam, setDeletingTeam] = useState(false);

    const isOwner =
        members.find((m) => m.id === currentUserId)?.pivot.role === "owner";

    // Label handlers
    const handleAddLabel = (e: React.FormEvent) => {
        e.preventDefault();
        addLabelForm.post(route("labels.store", team.slug), {
            onSuccess: () => {
                setAddLabelOpen(false);
                addLabelForm.reset();
            },
        });
    };

    const handleAddLabelClose = () => {
        setAddLabelOpen(false);
        addLabelForm.reset();
    };

    const startEdit = (label: Label) => {
        setEditingId(label.id);
        setEditName(label.name);
        setEditColor(label.color);
    };

    const cancelEdit = () => {
        setEditingId(null);
    };

    const saveEdit = (label: Label) => {
        router.put(
            route("labels.update", [team.slug, label.id]),
            {
                name: editName,
                color: editColor,
            },
            {
                onSuccess: () => setEditingId(null),
            },
        );
    };

    const confirmDeleteLabel = () => {
        if (!deleteLabel) return;
        router.delete(route("labels.destroy", [team.slug, deleteLabel.id]), {
            onSuccess: () => setDeleteLabel(null),
        });
    };

    // Member handlers
    const searchUsers = useCallback(
        (query: string) => {
            if (query.length < 2) {
                setUserSearchResults([]);
                return;
            }
            setUserSearchLoading(true);
            axios
                .get(route("teams.members.search", team.slug), {
                    params: { q: query },
                })
                .then(({ data }) => setUserSearchResults(data))
                .finally(() => setUserSearchLoading(false));
        },
        [team.id],
    );

    const handleAddMember = (e: React.FormEvent) => {
        e.preventDefault();
        addMemberForm.post(route("teams.members.store", team.slug), {
            onSuccess: () => {
                setAddMemberOpen(false);
                addMemberForm.reset();
                setSelectedUser(null);
                setUserSearchResults([]);
            },
        });
    };

    const handleAddMemberClose = () => {
        setAddMemberOpen(false);
        addMemberForm.reset();
        setSelectedUser(null);
        setUserSearchResults([]);
    };

    const handleRoleChange = (member: UserWithTeamPivot, newRole: string) => {
        router.put(route("teams.members.update", [team.slug, member.id]), {
            role: newRole,
        });
    };

    const confirmRemoveMember = () => {
        if (!removeMember) return;
        router.delete(
            route("teams.members.destroy", [team.slug, removeMember.id]),
            {
                onSuccess: () => setRemoveMember(null),
            },
        );
    };

    const handleDeleteTeam = () => {
        setDeletingTeam(true);
        router.delete(route("teams.destroy", team.slug), {
            data: { confirmation: "DELETE" },
            onFinish: () => setDeletingTeam(false),
        });
    };

    return (
        <AuthenticatedLayout
            currentTeam={team}
            sidebarBoards={sidebarBoards}
            header={
                <PageHeader
                    title="Settings"
                    breadcrumbs={[
                        { label: "Teams", href: route("teams.index") },
                        {
                            label: team.name,
                            href: route("teams.show", team.slug),
                        },
                    ]}
                />
            }
        >
            <Head title={`Settings - ${team.name}`} />

            <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {/* Team Image */}
                <ImageUpload
                    title="Team Image"
                    description="Upload an image to use as the team avatar in the sidebar. Recommended size: 128×128px. Max file size: 2MB."
                    imageUrl={team.image_url}
                    altText={team.name}
                    uploadRoute={route("teams.upload-image", team.slug)}
                    deleteRoute={route("teams.delete-image", team.slug)}
                />

                {/* Members */}
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
                            <Typography variant="subtitle1" fontWeight={600}>
                                Members ({members.length})
                            </Typography>
                            {canManageMembers && (
                                <Button
                                    startIcon={<PersonAddIcon />}
                                    size="small"
                                    onClick={() => setAddMemberOpen(true)}
                                >
                                    Add Member
                                </Button>
                            )}
                        </Box>

                        <List dense disablePadding>
                            {members.map((member) => {
                                const isCurrentUser =
                                    member.id === currentUserId;
                                const isElevated =
                                    member.pivot.role === "admin" ||
                                    member.pivot.role === "owner";
                                const canEdit =
                                    canManageMembers &&
                                    !isCurrentUser &&
                                    (canManageAdmins || !isElevated);

                                return (
                                    <ListItem
                                        key={member.id}
                                        disableGutters
                                        sx={{
                                            py: 0.75,
                                            px: 1,
                                            borderRadius: 1,
                                            "&:hover": {
                                                bgcolor: "action.hover",
                                            },
                                        }}
                                        secondaryAction={
                                            canEdit ? (
                                                <Tooltip title="Remove member">
                                                    <IconButton
                                                        edge="end"
                                                        size="small"
                                                        color="error"
                                                        onClick={() =>
                                                            setRemoveMember(
                                                                member,
                                                            )
                                                        }
                                                    >
                                                        <PersonRemoveIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            ) : undefined
                                        }
                                    >
                                        <ListItemAvatar sx={{ minWidth: 40 }}>
                                            <Avatar
                                                sx={{
                                                    width: 32,
                                                    height: 32,
                                                    fontSize: "0.85rem",
                                                    fontWeight: 600,
                                                }}
                                            >
                                                {member.name
                                                    .charAt(0)
                                                    .toUpperCase()}
                                            </Avatar>
                                        </ListItemAvatar>
                                        <ListItemText
                                            primary={
                                                <Box
                                                    sx={{
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: 0.5,
                                                    }}
                                                >
                                                    <Typography
                                                        variant="body2"
                                                        fontWeight={500}
                                                    >
                                                        {member.name}
                                                    </Typography>
                                                    {isCurrentUser && (
                                                        <Typography
                                                            variant="caption"
                                                            color="text.secondary"
                                                        >
                                                            (you)
                                                        </Typography>
                                                    )}
                                                </Box>
                                            }
                                            secondary={member.email}
                                            secondaryTypographyProps={{
                                                variant: "caption",
                                            }}
                                        />
                                        {canEdit ? (
                                            <FormControl
                                                size="small"
                                                sx={{ minWidth: 100, mr: 4 }}
                                            >
                                                <Select
                                                    value={member.pivot.role}
                                                    onChange={(e) =>
                                                        handleRoleChange(
                                                            member,
                                                            e.target.value,
                                                        )
                                                    }
                                                    variant="outlined"
                                                    sx={{
                                                        fontSize: "0.8rem",
                                                        height: 28,
                                                    }}
                                                >
                                                    <MenuItem value="member">
                                                        Member
                                                    </MenuItem>
                                                    <MenuItem value="admin">
                                                        Admin
                                                    </MenuItem>
                                                    {canManageAdmins && (
                                                        <MenuItem value="owner">
                                                            Owner
                                                        </MenuItem>
                                                    )}
                                                </Select>
                                            </FormControl>
                                        ) : (
                                            <Chip
                                                label={member.pivot.role}
                                                size="small"
                                                variant="outlined"
                                                color={roleColor(
                                                    member.pivot.role,
                                                )}
                                                sx={{
                                                    mr: canManageMembers
                                                        ? 4
                                                        : 0,
                                                }}
                                            />
                                        )}
                                    </ListItem>
                                );
                            })}
                        </List>
                    </CardContent>
                </Card>

                {/* Labels */}
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
                            <Typography variant="subtitle1" fontWeight={600}>
                                Labels
                            </Typography>
                            <Button
                                startIcon={<AddIcon />}
                                size="small"
                                onClick={() => setAddLabelOpen(true)}
                            >
                                Add Label
                            </Button>
                        </Box>

                        {labels.length === 0 ? (
                            <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{ py: 2 }}
                            >
                                No labels yet. Add a label to categorize tasks.
                            </Typography>
                        ) : (
                            <Box
                                sx={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 1,
                                }}
                            >
                                {labels.map((label) => (
                                    <Box
                                        key={label.id}
                                        sx={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 2,
                                            py: 1,
                                            px: 1.5,
                                            borderRadius: 1,
                                            "&:hover": {
                                                bgcolor: "action.hover",
                                            },
                                        }}
                                    >
                                        {editingId === label.id ? (
                                            <Box
                                                sx={{
                                                    display: "flex",
                                                    flexDirection: "column",
                                                    gap: 1.5,
                                                    width: "100%",
                                                }}
                                            >
                                                <Box
                                                    sx={{
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: 1,
                                                    }}
                                                >
                                                    <TextField
                                                        size="small"
                                                        value={editName}
                                                        onChange={(e) =>
                                                            setEditName(
                                                                e.target.value,
                                                            )
                                                        }
                                                        sx={{ flex: 1 }}
                                                        slotProps={{
                                                            htmlInput: {
                                                                maxLength: 50,
                                                            },
                                                        }}
                                                    />
                                                    <Button
                                                        size="small"
                                                        variant="contained"
                                                        onClick={() =>
                                                            saveEdit(label)
                                                        }
                                                        disabled={
                                                            !editName.trim()
                                                        }
                                                    >
                                                        Save
                                                    </Button>
                                                    <Tooltip title="Cancel">
                                                        <IconButton
                                                            size="small"
                                                            onClick={cancelEdit}
                                                        >
                                                            <CloseIcon fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                </Box>
                                                <ColorSwatchPicker
                                                    value={editColor}
                                                    onChange={setEditColor}
                                                />
                                            </Box>
                                        ) : (
                                            <>
                                                <Box
                                                    sx={{
                                                        width: 16,
                                                        height: 16,
                                                        borderRadius: "50%",
                                                        bgcolor: label.color,
                                                        flexShrink: 0,
                                                    }}
                                                />
                                                <Typography
                                                    variant="body2"
                                                    sx={{ flex: 1 }}
                                                >
                                                    {label.name}
                                                </Typography>
                                                <Tooltip title="Edit">
                                                    <IconButton
                                                        size="small"
                                                        onClick={() =>
                                                            startEdit(label)
                                                        }
                                                    >
                                                        <EditIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title="Delete">
                                                    <IconButton
                                                        size="small"
                                                        color="error"
                                                        onClick={() =>
                                                            setDeleteLabel(
                                                                label,
                                                            )
                                                        }
                                                    >
                                                        <DeleteIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            </>
                                        )}
                                    </Box>
                                ))}
                            </Box>
                        )}
                    </CardContent>
                </Card>

                {/* API Tokens */}
                {canManageMembers && (
                    <Card variant="outlined">
                        <CardContent>
                            <Box
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                }}
                            >
                                <Box>
                                    <Typography
                                        variant="subtitle1"
                                        fontWeight={600}
                                    >
                                        API Tokens
                                    </Typography>
                                    <Typography
                                        variant="body2"
                                        color="text.secondary"
                                    >
                                        Create bot users and manage API tokens
                                        for external integrations.
                                    </Typography>
                                </Box>
                                <Button
                                    component={Link}
                                    href={route("teams.bots.index", team.slug)}
                                    startIcon={<KeyIcon />}
                                    size="small"
                                >
                                    Manage
                                </Button>
                            </Box>
                        </CardContent>
                    </Card>
                )}

                {/* Danger Zone */}
                {isOwner && (
                    <Card variant="outlined" sx={{ borderColor: "error.main" }}>
                        <CardContent>
                            <Box
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 1,
                                    mb: 1,
                                }}
                            >
                                <WarningAmberIcon
                                    color="error"
                                    fontSize="small"
                                />
                                <Typography
                                    variant="subtitle1"
                                    fontWeight={600}
                                    color="error"
                                >
                                    Danger Zone
                                </Typography>
                            </Box>
                            <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{ mb: 2 }}
                            >
                                Permanently delete this team and all its boards,
                                tasks, comments, and attachments. This action
                                cannot be undone.
                            </Typography>
                            <Button
                                variant="outlined"
                                color="error"
                                startIcon={<DeleteIcon />}
                                onClick={() => setDeleteTeamOpen(true)}
                            >
                                Delete Team
                            </Button>
                        </CardContent>
                    </Card>
                )}
            </Box>

            {/* Add Member Dialog */}
            <Dialog
                open={addMemberOpen}
                onClose={handleAddMemberClose}
                maxWidth="xs"
                fullWidth
                aria-labelledby="add-member-dialog-title"
            >
                <form onSubmit={handleAddMember}>
                    <DialogTitle id="add-member-dialog-title">
                        Add Member
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
                            onChange={(_e, value) => {
                                setSelectedUser(value);
                                addMemberForm.setData(
                                    "user_id",
                                    value?.id ?? "",
                                );
                            }}
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
                                    error={!!addMemberForm.errors.user_id}
                                    helperText={addMemberForm.errors.user_id}
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
                                                    {
                                                        params.InputProps
                                                            .endAdornment
                                                    }
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
                                value={addMemberForm.data.role}
                                onChange={(e) =>
                                    addMemberForm.setData(
                                        "role",
                                        e.target.value,
                                    )
                                }
                            >
                                <MenuItem value="member">Member</MenuItem>
                                <MenuItem value="admin">Admin</MenuItem>
                                {canManageAdmins && (
                                    <MenuItem value="owner">Owner</MenuItem>
                                )}
                            </Select>
                        </FormControl>
                    </DialogContent>
                    <DialogActions sx={{ px: 3, py: 2 }}>
                        <Button onClick={handleAddMemberClose}>Cancel</Button>
                        <Button
                            type="submit"
                            variant="contained"
                            disabled={addMemberForm.processing || !selectedUser}
                        >
                            Add
                        </Button>
                    </DialogActions>
                </form>
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
                        Are you sure you want to remove {removeMember?.name}{" "}
                        from this team? They will lose access to all team
                        boards.
                    </DialogContentText>
                </DialogContent>
                <DialogActions sx={{ px: 3, py: 2 }}>
                    <Button onClick={() => setRemoveMember(null)}>
                        Cancel
                    </Button>
                    <Button
                        onClick={confirmRemoveMember}
                        color="error"
                        variant="contained"
                    >
                        Remove
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Add Label Dialog */}
            <Dialog
                open={addLabelOpen}
                onClose={handleAddLabelClose}
                maxWidth="xs"
                fullWidth
                aria-labelledby="add-label-dialog-title"
            >
                <form onSubmit={handleAddLabel}>
                    <DialogTitle id="add-label-dialog-title">
                        Add Label
                    </DialogTitle>
                    <DialogContent>
                        <TextField
                            autoFocus
                            label="Name"
                            fullWidth
                            required
                            value={addLabelForm.data.name}
                            onChange={(e) =>
                                addLabelForm.setData("name", e.target.value)
                            }
                            error={!!addLabelForm.errors.name}
                            helperText={addLabelForm.errors.name}
                            sx={{ mt: 1, mb: 2 }}
                            slotProps={{
                                htmlInput: { maxLength: 50 },
                            }}
                        />
                        <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ mb: 1 }}
                        >
                            Color
                        </Typography>
                        <ColorSwatchPicker
                            value={addLabelForm.data.color}
                            onChange={(color) =>
                                addLabelForm.setData("color", color)
                            }
                        />
                        {addLabelForm.errors.color && (
                            <Typography
                                variant="caption"
                                color="error"
                                sx={{ mt: 0.5 }}
                            >
                                {addLabelForm.errors.color}
                            </Typography>
                        )}
                        {addLabelForm.data.name && (
                            <Box sx={{ mt: 2 }}>
                                <Typography
                                    variant="caption"
                                    color="text.secondary"
                                >
                                    Preview
                                </Typography>
                                <Box sx={{ mt: 0.5 }}>
                                    <Chip
                                        label={addLabelForm.data.name}
                                        size="small"
                                        sx={{
                                            fontWeight: 600,
                                            bgcolor: addLabelForm.data.color,
                                            color: getContrastText(
                                                addLabelForm.data.color,
                                            ),
                                        }}
                                    />
                                </Box>
                            </Box>
                        )}
                    </DialogContent>
                    <DialogActions sx={{ px: 3, py: 2 }}>
                        <Button onClick={handleAddLabelClose}>Cancel</Button>
                        <Button
                            type="submit"
                            variant="contained"
                            disabled={addLabelForm.processing}
                        >
                            Add
                        </Button>
                    </DialogActions>
                </form>
            </Dialog>

            {/* Delete Label Confirmation Dialog */}
            <Dialog
                open={!!deleteLabel}
                onClose={() => setDeleteLabel(null)}
                maxWidth="xs"
                aria-labelledby="delete-label-dialog-title"
            >
                <DialogTitle id="delete-label-dialog-title">
                    Delete Label
                </DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Are you sure you want to delete "{deleteLabel?.name}"?
                        It will be removed from all tasks.
                    </DialogContentText>
                </DialogContent>
                <DialogActions sx={{ px: 3, py: 2 }}>
                    <Button onClick={() => setDeleteLabel(null)}>Cancel</Button>
                    <Button
                        onClick={confirmDeleteLabel}
                        color="error"
                        variant="contained"
                    >
                        Delete
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Delete Team Confirmation Dialog */}
            <ConfirmDeleteDialog
                open={deleteTeamOpen}
                onClose={() => setDeleteTeamOpen(false)}
                onConfirm={handleDeleteTeam}
                title="Delete Team"
                description="This will permanently delete this team and all its boards, tasks, comments, attachments, and integrations."
                itemName={team.name}
                processing={deletingTeam}
            />
        </AuthenticatedLayout>
    );
}
