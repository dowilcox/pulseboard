import { Head, router } from "@inertiajs/react";
import { useState } from "react";
import ConfirmDeleteDialog from "@/Components/Common/ConfirmDeleteDialog";
import PageHeader from "@/Components/Layout/PageHeader";
import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import AdminNav from "@/Components/Admin/AdminNav";
import type { Board, PageProps } from "@/types";
import DeleteIcon from "@mui/icons-material/Delete";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";

interface BoardWithRelations extends Board {
    tasks_count: number;
}

interface Props extends PageProps {
    adminBoards: BoardWithRelations[];
}

export default function Boards({ adminBoards: boards }: Props) {
    const [deleteBoard, setDeleteBoard] = useState<BoardWithRelations | null>(
        null,
    );
    const [deleting, setDeleting] = useState(false);

    const handleDelete = () => {
        if (!deleteBoard) return;
        setDeleting(true);
        router.delete(route("admin.boards.destroy", deleteBoard.id), {
            data: { confirmation: "DELETE" },
            onSuccess: () => setDeleteBoard(null),
            onFinish: () => setDeleting(false),
        });
    };

    return (
        <AuthenticatedLayout
            header={
                <PageHeader
                    title="Board Oversight"
                    breadcrumbs={[
                        { label: "Admin", href: route("admin.dashboard") },
                    ]}
                />
            }
        >
            <Head title="Board Oversight" />

            <Box sx={{ display: "flex" }}>
                <AdminNav />

                <Box sx={{ flex: 1 }}>
                    {boards.length === 0 ? (
                        <Paper
                            variant="outlined"
                            sx={{ p: 4, textAlign: "center" }}
                        >
                            <Typography color="text.secondary">
                                No boards have been created yet.
                            </Typography>
                        </Paper>
                    ) : (
                        <TableContainer component={Paper} variant="outlined">
                            <Table>
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Name</TableCell>
                                        <TableCell>Team</TableCell>
                                        <TableCell>Tasks</TableCell>
                                        <TableCell>Status</TableCell>
                                        <TableCell>Created</TableCell>
                                        <TableCell align="right">
                                            Actions
                                        </TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {boards.map((board) => (
                                        <TableRow key={board.id} hover>
                                            <TableCell>
                                                <Box
                                                    sx={{
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: 1.5,
                                                    }}
                                                >
                                                    <Avatar
                                                        src={
                                                            board.image_url ??
                                                            undefined
                                                        }
                                                        variant="rounded"
                                                        sx={{
                                                            width: 28,
                                                            height: 28,
                                                            fontSize: "0.75rem",
                                                            fontWeight: 600,
                                                            bgcolor:
                                                                "primary.main",
                                                        }}
                                                    >
                                                        {board.name
                                                            .charAt(0)
                                                            .toUpperCase()}
                                                    </Avatar>
                                                    <Typography
                                                        fontWeight={500}
                                                    >
                                                        {board.name}
                                                    </Typography>
                                                </Box>
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="body2">
                                                    {board.team?.name ?? "—"}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Chip
                                                    label={board.tasks_count}
                                                    size="small"
                                                    variant="outlined"
                                                />
                                            </TableCell>
                                            <TableCell>
                                                {board.is_archived ? (
                                                    <Chip
                                                        label="Archived"
                                                        size="small"
                                                        color="default"
                                                    />
                                                ) : (
                                                    <Chip
                                                        label="Active"
                                                        size="small"
                                                        color="success"
                                                        variant="outlined"
                                                    />
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <Typography
                                                    variant="body2"
                                                    color="text.secondary"
                                                >
                                                    {new Date(
                                                        board.created_at,
                                                    ).toLocaleDateString()}
                                                </Typography>
                                            </TableCell>
                                            <TableCell align="right">
                                                <Tooltip title="Delete board">
                                                    <IconButton
                                                        size="small"
                                                        color="error"
                                                        onClick={() =>
                                                            setDeleteBoard(
                                                                board,
                                                            )
                                                        }
                                                    >
                                                        <DeleteIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    )}
                </Box>
            </Box>

            {/* Delete Board Confirmation Dialog */}
            <ConfirmDeleteDialog
                open={!!deleteBoard}
                onClose={() => setDeleteBoard(null)}
                onConfirm={handleDelete}
                title="Delete Board"
                description="This will permanently delete this board and all its columns, tasks, comments, and attachments."
                itemName={deleteBoard?.name ?? ""}
                processing={deleting}
            />
        </AuthenticatedLayout>
    );
}
