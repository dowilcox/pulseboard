import { Head, router, useForm, usePage } from "@inertiajs/react";
import { useEffect, useState } from "react";
import PageHeader from "@/Components/Layout/PageHeader";
import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import AdminNav from "@/Components/Admin/AdminNav";
import type { PageProps, User } from "@/types";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import LockResetIcon from "@mui/icons-material/LockReset";
import PersonOffIcon from "@mui/icons-material/PersonOff";
import PersonIcon from "@mui/icons-material/Person";
import SearchIcon from "@mui/icons-material/Search";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import Paper from "@mui/material/Paper";
import Snackbar from "@mui/material/Snackbar";
import Switch from "@mui/material/Switch";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TablePagination from "@mui/material/TablePagination";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";

interface PaginatedUsers {
    data: User[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
}

interface Props extends PageProps {
    users: PaginatedUsers;
    filters: { search: string | null };
}

interface UserFormData {
    name: string;
    email: string;
    password: string;
    is_admin: boolean;
}

interface EditFormData {
    name: string;
    email: string;
    is_admin: boolean;
}

export default function Users({ users, filters }: Props) {
    const { flash } = usePage<PageProps>().props;
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [search, setSearch] = useState(filters.search ?? "");
    const [confirmAction, setConfirmAction] = useState<{
        user: User;
        action: "toggle" | "reset";
    } | null>(null);
    const [snackbar, setSnackbar] = useState<{
        open: boolean;
        message: string;
        severity: "success" | "error";
    }>({ open: false, message: "", severity: "success" });

    useEffect(() => {
        if (flash?.success) {
            setSnackbar({
                open: true,
                message: flash.success,
                severity: "success",
            });
        } else if (flash?.error) {
            setSnackbar({
                open: true,
                message: flash.error,
                severity: "error",
            });
        }
    }, [flash?.success, flash?.error]);

    const createForm = useForm<UserFormData>({
        name: "",
        email: "",
        password: "",
        is_admin: false,
    });

    const editForm = useForm<EditFormData>({
        name: "",
        email: "",
        is_admin: false,
    });

    const openCreateDialog = () => {
        setEditingUser(null);
        createForm.reset();
        createForm.clearErrors();
        setDialogOpen(true);
    };

    const openEditDialog = (user: User) => {
        setEditingUser(user);
        editForm.setData({
            name: user.name,
            email: user.email,
            is_admin: user.is_admin,
        });
        editForm.clearErrors();
        setDialogOpen(true);
    };

    const handleSubmit = () => {
        if (editingUser) {
            editForm.put(route("admin.users.update", editingUser.id), {
                onSuccess: () => setDialogOpen(false),
            });
        } else {
            createForm.post(route("admin.users.store"), {
                onSuccess: () => setDialogOpen(false),
            });
        }
    };

    const handleSearch = () => {
        router.get(
            route("admin.users.index"),
            { search: search || undefined },
            { preserveState: true },
        );
    };

    const handleToggleActive = (user: User) => {
        router.post(
            route("admin.users.toggle-active", user.id),
            {},
            {
                onSuccess: () => setConfirmAction(null),
            },
        );
    };

    const handleResetPassword = (user: User) => {
        router.post(
            route("admin.users.reset-password", user.id),
            {},
            {
                onSuccess: () => setConfirmAction(null),
            },
        );
    };

    const handlePageChange = (_: unknown, page: number) => {
        router.get(
            route("admin.users.index"),
            {
                page: page + 1,
                per_page: users.per_page,
                search: filters.search || undefined,
            },
            { preserveState: true },
        );
    };

    const handleRowsPerPageChange = (
        event: React.ChangeEvent<HTMLInputElement>,
    ) => {
        router.get(
            route("admin.users.index"),
            {
                page: 1,
                per_page: parseInt(event.target.value, 10),
                search: filters.search || undefined,
            },
            { preserveState: true },
        );
    };

    return (
        <AuthenticatedLayout
            header={
                <PageHeader
                    title="User Management"
                    breadcrumbs={[
                        { label: "Admin", href: route("admin.dashboard") },
                    ]}
                />
            }
        >
            <Head title="User Management" />

            <Box sx={{ display: "flex" }}>
                <AdminNav />

                <Box sx={{ flex: 1 }}>
                    <Box
                        sx={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            mb: 2,
                            gap: 2,
                        }}
                    >
                        <TextField
                            size="small"
                            placeholder="Search users..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            onKeyDown={(e) =>
                                e.key === "Enter" && handleSearch()
                            }
                            slotProps={{
                                input: {
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <SearchIcon fontSize="small" />
                                        </InputAdornment>
                                    ),
                                },
                            }}
                            sx={{ minWidth: 250 }}
                        />
                        <Button
                            variant="contained"
                            startIcon={<AddIcon />}
                            onClick={openCreateDialog}
                        >
                            Add User
                        </Button>
                    </Box>

                    <TableContainer component={Paper} variant="outlined">
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell>Name</TableCell>
                                    <TableCell>Email</TableCell>
                                    <TableCell>Auth Provider</TableCell>
                                    <TableCell>Role</TableCell>
                                    <TableCell>Status</TableCell>
                                    <TableCell>Created</TableCell>
                                    <TableCell align="right">Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {users.data.map((user) => (
                                    <TableRow key={user.id}>
                                        <TableCell>
                                            <Box
                                                sx={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: 1,
                                                }}
                                            >
                                                <Typography fontWeight={500}>
                                                    {user.name}
                                                </Typography>
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
                                                                user
                                                                    .created_by_team
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
                                        </TableCell>
                                        <TableCell>
                                            {!user.is_bot && (
                                                <Typography
                                                    variant="body2"
                                                    color="text.secondary"
                                                >
                                                    {user.email}
                                                </Typography>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <Chip
                                                label={user.auth_provider}
                                                size="small"
                                                variant="outlined"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Chip
                                                label={
                                                    user.is_bot
                                                        ? "Bot"
                                                        : user.is_admin
                                                          ? "Admin"
                                                          : "User"
                                                }
                                                color={
                                                    user.is_bot
                                                        ? "info"
                                                        : user.is_admin
                                                          ? "primary"
                                                          : "default"
                                                }
                                                size="small"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Chip
                                                label={
                                                    user.deactivated_at
                                                        ? "Deactivated"
                                                        : "Active"
                                                }
                                                color={
                                                    user.deactivated_at
                                                        ? "error"
                                                        : "success"
                                                }
                                                size="small"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Typography
                                                variant="body2"
                                                color="text.secondary"
                                            >
                                                {new Date(
                                                    user.created_at,
                                                ).toLocaleDateString()}
                                            </Typography>
                                        </TableCell>
                                        <TableCell align="right">
                                            {!user.is_bot && (
                                                <Tooltip title="Edit">
                                                    <IconButton
                                                        size="small"
                                                        onClick={() =>
                                                            openEditDialog(user)
                                                        }
                                                    >
                                                        <EditIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            )}
                                            <Tooltip
                                                title={
                                                    user.deactivated_at
                                                        ? "Reactivate"
                                                        : "Deactivate"
                                                }
                                            >
                                                <IconButton
                                                    size="small"
                                                    color={
                                                        user.deactivated_at
                                                            ? "success"
                                                            : "warning"
                                                    }
                                                    onClick={() =>
                                                        setConfirmAction({
                                                            user,
                                                            action: "toggle",
                                                        })
                                                    }
                                                >
                                                    {user.deactivated_at ? (
                                                        <PersonIcon fontSize="small" />
                                                    ) : (
                                                        <PersonOffIcon fontSize="small" />
                                                    )}
                                                </IconButton>
                                            </Tooltip>
                                            {!user.is_bot && (
                                                <Tooltip title="Reset Password">
                                                    <IconButton
                                                        size="small"
                                                        onClick={() =>
                                                            setConfirmAction({
                                                                user,
                                                                action: "reset",
                                                            })
                                                        }
                                                    >
                                                        <LockResetIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                        <TablePagination
                            component="div"
                            count={users.total}
                            page={users.current_page - 1}
                            rowsPerPage={users.per_page}
                            onPageChange={handlePageChange}
                            onRowsPerPageChange={handleRowsPerPageChange}
                            rowsPerPageOptions={[10, 25, 50]}
                        />
                    </TableContainer>
                </Box>
            </Box>

            {/* Create/Edit Dialog */}
            <Dialog
                open={dialogOpen}
                onClose={() => setDialogOpen(false)}
                maxWidth="sm"
                fullWidth
                aria-labelledby="user-form-dialog-title"
            >
                <DialogTitle id="user-form-dialog-title">
                    {editingUser ? "Edit User" : "Create User"}
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
                        <TextField
                            label="Name"
                            value={
                                editingUser
                                    ? editForm.data.name
                                    : createForm.data.name
                            }
                            onChange={(e) =>
                                editingUser
                                    ? editForm.setData("name", e.target.value)
                                    : createForm.setData("name", e.target.value)
                            }
                            error={
                                !!(editingUser
                                    ? editForm.errors.name
                                    : createForm.errors.name)
                            }
                            helperText={
                                editingUser
                                    ? editForm.errors.name
                                    : createForm.errors.name
                            }
                            fullWidth
                            required
                        />
                        <TextField
                            label="Email"
                            type="email"
                            value={
                                editingUser
                                    ? editForm.data.email
                                    : createForm.data.email
                            }
                            onChange={(e) =>
                                editingUser
                                    ? editForm.setData("email", e.target.value)
                                    : createForm.setData(
                                          "email",
                                          e.target.value,
                                      )
                            }
                            error={
                                !!(editingUser
                                    ? editForm.errors.email
                                    : createForm.errors.email)
                            }
                            helperText={
                                editingUser
                                    ? editForm.errors.email
                                    : createForm.errors.email
                            }
                            fullWidth
                            required
                        />
                        {!editingUser && (
                            <TextField
                                label="Password"
                                type="password"
                                value={createForm.data.password}
                                onChange={(e) =>
                                    createForm.setData(
                                        "password",
                                        e.target.value,
                                    )
                                }
                                error={!!createForm.errors.password}
                                helperText={createForm.errors.password}
                                fullWidth
                                required
                            />
                        )}
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={
                                        editingUser
                                            ? editForm.data.is_admin
                                            : createForm.data.is_admin
                                    }
                                    onChange={(e) =>
                                        editingUser
                                            ? editForm.setData(
                                                  "is_admin",
                                                  e.target.checked,
                                              )
                                            : createForm.setData(
                                                  "is_admin",
                                                  e.target.checked,
                                              )
                                    }
                                />
                            }
                            label="Administrator"
                        />
                    </Box>
                </DialogContent>
                <DialogActions sx={{ px: 3, py: 2 }}>
                    <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
                    <Button
                        variant="contained"
                        onClick={handleSubmit}
                        disabled={
                            editingUser
                                ? editForm.processing
                                : createForm.processing
                        }
                    >
                        {editingUser ? "Update" : "Create"}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Confirm Action Dialog */}
            <Dialog
                open={!!confirmAction}
                onClose={() => setConfirmAction(null)}
                aria-labelledby="confirm-action-dialog-title"
            >
                <DialogTitle id="confirm-action-dialog-title">
                    {confirmAction?.action === "toggle"
                        ? confirmAction.user.deactivated_at
                            ? "Reactivate User"
                            : "Deactivate User"
                        : "Reset Password"}
                </DialogTitle>
                <DialogContent>
                    {confirmAction?.action === "toggle" ? (
                        <Alert
                            severity={
                                confirmAction.user.deactivated_at
                                    ? "info"
                                    : "warning"
                            }
                            sx={{ mt: 1 }}
                        >
                            {confirmAction.user.deactivated_at
                                ? `Reactivate ${confirmAction.user.name}? They will be able to log in again.`
                                : `Deactivate ${confirmAction.user.name}? They will be logged out and unable to access the system.`}
                        </Alert>
                    ) : (
                        <Alert severity="info" sx={{ mt: 1 }}>
                            Send a password reset link to{" "}
                            {confirmAction?.user.email}?
                        </Alert>
                    )}
                </DialogContent>
                <DialogActions sx={{ px: 3, py: 2 }}>
                    <Button onClick={() => setConfirmAction(null)}>
                        Cancel
                    </Button>
                    <Button
                        variant="contained"
                        color={
                            confirmAction?.action === "toggle" &&
                            !confirmAction.user.deactivated_at
                                ? "warning"
                                : "primary"
                        }
                        onClick={() => {
                            if (!confirmAction) return;
                            if (confirmAction.action === "toggle") {
                                handleToggleActive(confirmAction.user);
                            } else {
                                handleResetPassword(confirmAction.user);
                            }
                        }}
                    >
                        Confirm
                    </Button>
                </DialogActions>
            </Dialog>

            <Snackbar
                open={snackbar.open}
                autoHideDuration={4000}
                onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
                anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
            >
                <Alert
                    onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
                    severity={snackbar.severity}
                    variant="filled"
                    role="status"
                    sx={{ width: "100%" }}
                >
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </AuthenticatedLayout>
    );
}
