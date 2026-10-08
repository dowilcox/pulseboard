import ConfirmDialog from "@/Components/Common/ConfirmDialog";
import { harborAvatarColor, harborHex } from "@/theme/harbor";
import type { Team, User, UserWithTeamPivot } from "@/types";
import { router, useForm } from "@inertiajs/react";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import PersonRemoveIcon from "@mui/icons-material/PersonRemove";
import Autocomplete from "@mui/material/Autocomplete";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControl from "@mui/material/FormControl";
import IconButton from "@mui/material/IconButton";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import axios from "axios";
import { type FormEvent, useCallback, useRef, useState } from "react";
import {
    ROLE_LABELS,
    roleChangeConfirmation,
    type RoleChangeConfirmation,
    type TeamRole,
} from "./roleChange";
import SectionCard from "./SectionCard";

type SearchUser = Pick<User, "id" | "name" | "email" | "is_bot">;

interface Props {
    team: Team;
    members: UserWithTeamPivot[];
    deactivatedMembers: UserWithTeamPivot[];
    currentUserId: string;
    canManageMembers: boolean;
    canManageAdmins: boolean;
}

interface PendingRoleChange {
    member: UserWithTeamPivot;
    toRole: TeamRole;
    confirmation: RoleChangeConfirmation;
}

const isElevated = (role: TeamRole) => role === "owner" || role === "admin";

export function MemberAvatar({
    user,
    size = 36,
}: {
    user: Pick<User, "name" | "avatar_url">;
    size?: number;
}) {
    return (
        <Avatar
            src={user.avatar_url}
            // The name is always shown next to the avatar.
            alt=""
            sx={{
                width: size,
                height: size,
                fontSize: size * 0.4,
                fontWeight: 600,
                bgcolor: harborAvatarColor(user.name),
                color: "#fff",
                flexShrink: 0,
            }}
        >
            {user.name.charAt(0).toUpperCase()}
        </Avatar>
    );
}

function RoleChip({ role }: { role: TeamRole }) {
    return (
        <Chip
            label={ROLE_LABELS[role]}
            size="small"
            variant="outlined"
            color={
                role === "owner"
                    ? "primary"
                    : role === "admin"
                      ? "secondary"
                      : "default"
            }
            sx={{ fontWeight: 600 }}
        />
    );
}

function MemberIdentity({
    member,
    isCurrentUser,
}: {
    member: UserWithTeamPivot;
    isCurrentUser: boolean;
}) {
    return (
        <Box
            sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.5,
                minWidth: 0,
                flex: "1 1 220px",
            }}
        >
            <MemberAvatar user={member} />
            <Box sx={{ minWidth: 0 }}>
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 0.75,
                        flexWrap: "wrap",
                    }}
                >
                    <Typography variant="body2" fontWeight={600} noWrap>
                        {member.name}
                    </Typography>
                    {isCurrentUser && (
                        <Typography variant="caption" color="text.secondary">
                            (you)
                        </Typography>
                    )}
                    {member.is_bot && (
                        <Chip label="Bot" size="small" color="info" />
                    )}
                </Box>
                {!member.is_bot && (
                    <Typography
                        variant="caption"
                        color="text.secondary"
                        noWrap
                        component="div"
                    >
                        {member.email}
                    </Typography>
                )}
            </Box>
        </Box>
    );
}

export default function MembersSection({
    team,
    members,
    deactivatedMembers,
    currentUserId,
    canManageMembers,
    canManageAdmins,
}: Props) {
    const [addOpen, setAddOpen] = useState(false);
    const [removeMember, setRemoveMember] = useState<UserWithTeamPivot | null>(
        null,
    );
    const [pendingRole, setPendingRole] = useState<PendingRoleChange | null>(
        null,
    );
    const [updatingId, setUpdatingId] = useState<string | null>(null);

    const ownerCount = members.filter((m) => m.pivot.role === "owner").length;

    const applyRoleChange = (member: UserWithTeamPivot, toRole: TeamRole) => {
        router.put(
            route("teams.members.update", [team.slug, member.id]),
            { role: toRole },
            {
                preserveScroll: true,
                onStart: () => setUpdatingId(member.id),
                onFinish: () => setUpdatingId(null),
            },
        );
    };

    const requestRoleChange = (member: UserWithTeamPivot, toRole: TeamRole) => {
        const confirmation = roleChangeConfirmation({
            memberName: member.name,
            fromRole: member.pivot.role,
            toRole,
            isSelf: member.id === currentUserId,
        });

        if (confirmation) {
            setPendingRole({ member, toRole, confirmation });
        } else {
            applyRoleChange(member, toRole);
        }
    };

    const confirmRemoveMember = () => {
        if (!removeMember) return;
        router.delete(
            route("teams.members.destroy", [team.slug, removeMember.id]),
            {
                preserveScroll: true,
                onSuccess: () => setRemoveMember(null),
            },
        );
    };

    return (
        <Stack spacing={3}>
            <SectionCard
                title={`Members (${members.length})`}
                description="Owners manage everything, including other owners and deleting the team. Admins manage boards, members, labels and integrations. Members create boards and work on tasks."
                action={
                    canManageMembers ? (
                        <Button
                            startIcon={<PersonAddIcon />}
                            size="small"
                            variant="outlined"
                            onClick={() => setAddOpen(true)}
                        >
                            Add member
                        </Button>
                    ) : undefined
                }
            >
                <Box
                    component="ul"
                    sx={{
                        listStyle: "none",
                        m: 0,
                        p: 0,
                        display: "flex",
                        flexDirection: "column",
                    }}
                >
                    {members.map((member) => {
                        const role = member.pivot.role;
                        const isCurrentUser = member.id === currentUserId;
                        const isOnlyOwner = role === "owner" && ownerCount <= 1;
                        const canEditRole =
                            canManageMembers &&
                            (canManageAdmins || !isElevated(role));
                        const canRemove =
                            canEditRole && !isCurrentUser && !isOnlyOwner;

                        return (
                            <Box
                                component="li"
                                key={member.id}
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    flexWrap: "wrap",
                                    columnGap: 2,
                                    rowGap: 1,
                                    py: 1.25,
                                    borderTop: 1,
                                    borderColor: "divider",
                                    "&:first-of-type": { borderTop: 0 },
                                }}
                            >
                                <MemberIdentity
                                    member={member}
                                    isCurrentUser={isCurrentUser}
                                />
                                <Box
                                    sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 1,
                                        ml: { xs: 6, sm: "auto" },
                                    }}
                                >
                                    {canEditRole && !isOnlyOwner ? (
                                        <FormControl size="small">
                                            <Select
                                                value={role}
                                                onChange={(e) =>
                                                    requestRoleChange(
                                                        member,
                                                        e.target
                                                            .value as TeamRole,
                                                    )
                                                }
                                                disabled={
                                                    updatingId === member.id
                                                }
                                                inputProps={{
                                                    "aria-label": `Role for ${member.name}`,
                                                }}
                                                sx={{
                                                    fontSize: "0.85rem",
                                                    minWidth: 112,
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
                                    ) : isOnlyOwner && canManageAdmins ? (
                                        <Tooltip title="Every team needs an owner. Make someone else an owner before changing this role.">
                                            <Box
                                                component="span"
                                                tabIndex={0}
                                                aria-label="Owner. Every team needs an owner; make someone else an owner before changing this role."
                                            >
                                                <RoleChip role={role} />
                                            </Box>
                                        </Tooltip>
                                    ) : (
                                        <RoleChip role={role} />
                                    )}
                                    {canRemove ? (
                                        <Tooltip title="Remove from team">
                                            <IconButton
                                                size="small"
                                                color="error"
                                                aria-label={`Remove ${member.name} from the team`}
                                                onClick={() =>
                                                    setRemoveMember(member)
                                                }
                                            >
                                                <PersonRemoveIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                    ) : (
                                        canManageMembers && (
                                            // Keeps role controls aligned across rows.
                                            <Box
                                                aria-hidden
                                                sx={{
                                                    width: 34,
                                                    flexShrink: 0,
                                                }}
                                            />
                                        )
                                    )}
                                </Box>
                            </Box>
                        );
                    })}
                </Box>
            </SectionCard>

            {deactivatedMembers.length > 0 && (
                <SectionCard
                    title={`Deactivated accounts (${deactivatedMembers.length})`}
                    description="An app administrator deactivated these accounts, so they can't sign in. They stay listed here so their past work keeps its attribution."
                >
                    <Box component="ul" sx={{ listStyle: "none", m: 0, p: 0 }}>
                        {deactivatedMembers.map((member) => (
                            <Box
                                component="li"
                                key={member.id}
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    flexWrap: "wrap",
                                    columnGap: 2,
                                    rowGap: 1,
                                    py: 1.25,
                                    borderTop: 1,
                                    borderColor: "divider",
                                    "&:first-of-type": { borderTop: 0 },
                                }}
                            >
                                <MemberIdentity
                                    member={member}
                                    isCurrentUser={false}
                                />
                                <Box
                                    sx={{
                                        display: "flex",
                                        gap: 1,
                                        ml: { xs: 6, sm: "auto" },
                                    }}
                                >
                                    <RoleChip role={member.pivot.role} />
                                    <Chip
                                        label="Deactivated"
                                        size="small"
                                        sx={{
                                            bgcolor: harborHex.countBg,
                                            color: harborHex.ink,
                                        }}
                                    />
                                </Box>
                            </Box>
                        ))}
                    </Box>
                </SectionCard>
            )}

            {canManageMembers && (
                <AddMemberDialog
                    team={team}
                    open={addOpen}
                    onClose={() => setAddOpen(false)}
                    canManageAdmins={canManageAdmins}
                />
            )}

            <ConfirmDialog
                open={!!removeMember}
                onClose={() => setRemoveMember(null)}
                onConfirm={confirmRemoveMember}
                title={`Remove ${removeMember?.name ?? "member"}?`}
                message={`${removeMember?.name ?? "This person"} will lose access to all of this team's boards. Their tasks and comments stay.`}
                confirmLabel="Remove"
                confirmColor="error"
            />

            <ConfirmDialog
                open={!!pendingRole}
                onClose={() => setPendingRole(null)}
                onConfirm={() => {
                    if (pendingRole) {
                        applyRoleChange(pendingRole.member, pendingRole.toRole);
                    }
                    setPendingRole(null);
                }}
                title={pendingRole?.confirmation.title ?? ""}
                message={pendingRole?.confirmation.message ?? ""}
                confirmLabel={pendingRole?.confirmation.confirmLabel}
                confirmColor={pendingRole?.confirmation.confirmColor}
            />
        </Stack>
    );
}

function AddMemberDialog({
    team,
    open,
    onClose,
    canManageAdmins,
}: {
    team: Team;
    open: boolean;
    onClose: () => void;
    canManageAdmins: boolean;
}) {
    const [results, setResults] = useState<SearchUser[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedUser, setSelectedUser] = useState<SearchUser | null>(null);
    const searchControllerRef = useRef<AbortController | null>(null);

    const form = useForm({ user_id: "", role: "member" as TeamRole });

    const search = useCallback(
        (query: string) => {
            searchControllerRef.current?.abort();
            if (query.length < 2) {
                setResults([]);
                setLoading(false);
                return;
            }
            const controller = new AbortController();
            searchControllerRef.current = controller;
            setLoading(true);
            axios
                .get<SearchUser[]>(route("teams.members.search", team.slug), {
                    params: { q: query },
                    signal: controller.signal,
                })
                .then(({ data }) => setResults(data))
                .catch(() => {})
                .finally(() => {
                    if (!controller.signal.aborted) setLoading(false);
                });
        },
        [team.slug],
    );

    const resetState = () => {
        form.reset();
        form.clearErrors();
        setSelectedUser(null);
        setResults([]);
    };

    const submit = (e: FormEvent) => {
        e.preventDefault();
        form.post(route("teams.members.store", team.slug), {
            preserveScroll: true,
            onSuccess: () => onClose(),
        });
    };

    return (
        <Dialog
            open={open}
            onClose={form.processing ? undefined : onClose}
            maxWidth="xs"
            fullWidth
            aria-labelledby="add-member-dialog-title"
            slotProps={{ transition: { onExited: resetState } }}
        >
            <form onSubmit={submit}>
                <DialogTitle id="add-member-dialog-title">
                    Add member
                </DialogTitle>
                <DialogContent>
                    <Autocomplete
                        options={results}
                        getOptionLabel={(option) => option.name}
                        filterOptions={(x) => x}
                        value={selectedUser}
                        loading={loading}
                        onInputChange={(_e, value, reason) => {
                            if (reason === "input") search(value);
                        }}
                        onChange={(_e, value) => {
                            setSelectedUser(value);
                            form.setData("user_id", value?.id ?? "");
                        }}
                        isOptionEqualToValue={(option, value) =>
                            option.id === value.id
                        }
                        renderOption={(props, option) => {
                            // Key by id (names can repeat); never spread `key`.
                            const { key: _key, ...rest } = props;
                            return (
                                <li {...rest} key={option.id}>
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
                            );
                        }}
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                autoFocus
                                label="Search people"
                                placeholder="Type a name or email…"
                                error={!!form.errors.user_id}
                                helperText={
                                    form.errors.user_id ??
                                    "Type at least 2 characters."
                                }
                                slotProps={{
                                    input: {
                                        ...params.InputProps,
                                        endAdornment: (
                                            <>
                                                {loading ? (
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
                        noOptionsText="No matching people"
                        sx={{ mt: 1, mb: 2 }}
                    />
                    <FormControl fullWidth>
                        <InputLabel id="add-member-role-label">Role</InputLabel>
                        <Select
                            labelId="add-member-role-label"
                            label="Role"
                            value={form.data.role}
                            onChange={(e) =>
                                form.setData("role", e.target.value as TeamRole)
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
                    <Button onClick={onClose} disabled={form.processing}>
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        variant="contained"
                        disabled={form.processing || !selectedUser}
                    >
                        {form.processing ? "Adding…" : "Add member"}
                    </Button>
                </DialogActions>
            </form>
        </Dialog>
    );
}
