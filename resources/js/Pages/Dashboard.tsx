import { PRIORITY_COLORS } from "@/constants/priorities";
import PageHeader from "@/Components/Layout/PageHeader";
import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import type { Task } from "@/types";
import { getContrastText } from "@/utils/colorContrast";
import { getGitlabPrefix } from "@/utils/gitlabPrefix";
import { Head, router } from "@inertiajs/react";
import AssignmentIcon from "@mui/icons-material/Assignment";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import Avatar from "@mui/material/Avatar";
import AvatarGroup from "@mui/material/AvatarGroup";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import { useMemo } from "react";

interface MyTask extends Task {
    board?: {
        id: string;
        name: string;
        team?: { id: string; name: string; slug: string };
    };
    column?: {
        id: string;
        name: string;
        color: string;
        is_done_column: boolean;
    };
    comments_count?: number;
    subtasks_count?: number;
}

interface Props {
    myTasks: MyTask[];
}

export default function Dashboard({ myTasks }: Props) {
    const overdueTasks = useMemo(
        () =>
            myTasks.filter(
                (t) =>
                    t.due_date &&
                    new Date(t.due_date) < new Date() &&
                    !t.column?.is_done_column,
            ),
        [myTasks],
    );

    const activeTasks = useMemo(
        () => myTasks.filter((t) => !t.column?.is_done_column),
        [myTasks],
    );

    const doneTasks = useMemo(
        () => myTasks.filter((t) => t.column?.is_done_column),
        [myTasks],
    );

    const handleTaskClick = (task: MyTask) => {
        if (task.board?.team?.id && task.board?.id) {
            router.get(
                route("tasks.show", [
                    task.board.team.id,
                    task.board.id,
                    task.id,
                ]),
            );
        }
    };

    return (
        <AuthenticatedLayout header={<PageHeader title="Dashboard" />}>
            <Head title="Dashboard" />

            {/* Summary stats */}
            <Box sx={{ display: "flex", gap: 2, mb: 4, flexWrap: "wrap" }}>
                <Paper
                    variant="outlined"
                    sx={{ p: 2.5, flex: 1, minWidth: 160 }}
                >
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                            mb: 0.5,
                        }}
                    >
                        <AssignmentIcon color="primary" sx={{ fontSize: 18 }} />
                        <Typography
                            variant="caption"
                            color="text.secondary"
                            fontWeight={600}
                        >
                            Active Tasks
                        </Typography>
                    </Box>
                    <Typography variant="h4" component="p" fontWeight={700}>
                        {activeTasks.length}
                    </Typography>
                </Paper>

                <Paper
                    variant="outlined"
                    sx={{ p: 2.5, flex: 1, minWidth: 160 }}
                >
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                            mb: 0.5,
                        }}
                    >
                        <WarningAmberIcon
                            color={
                                overdueTasks.length > 0 ? "error" : "disabled"
                            }
                            sx={{ fontSize: 18 }}
                        />
                        <Typography
                            variant="caption"
                            color="text.secondary"
                            fontWeight={600}
                        >
                            Overdue
                        </Typography>
                    </Box>
                    <Typography
                        variant="h4"
                        component="p"
                        fontWeight={700}
                        color={
                            overdueTasks.length > 0
                                ? "error.main"
                                : "text.primary"
                        }
                    >
                        {overdueTasks.length}
                    </Typography>
                </Paper>

                <Paper
                    variant="outlined"
                    sx={{ p: 2.5, flex: 1, minWidth: 160 }}
                >
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                            mb: 0.5,
                        }}
                    >
                        <AssignmentIcon color="success" sx={{ fontSize: 18 }} />
                        <Typography
                            variant="caption"
                            color="text.secondary"
                            fontWeight={600}
                        >
                            Completed
                        </Typography>
                    </Box>
                    <Typography variant="h4" component="p" fontWeight={700}>
                        {doneTasks.length}
                    </Typography>
                </Paper>
            </Box>

            {/* My Tasks table */}
            <Typography
                variant="caption"
                color="text.secondary"
                fontWeight={600}
                sx={{ display: "block", mb: 1.5, letterSpacing: "0.02em" }}
            >
                My Tasks
            </Typography>

            <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{ width: 60 }}>#</TableCell>
                            <TableCell>Title</TableCell>
                            <TableCell sx={{ width: 140 }}>Board</TableCell>
                            <TableCell sx={{ width: 120 }}>Status</TableCell>
                            <TableCell sx={{ width: 100 }}>Priority</TableCell>
                            <TableCell sx={{ width: 110 }}>Due Date</TableCell>
                            <TableCell sx={{ width: 120 }}>Labels</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {myTasks.length === 0 ? (
                            <TableRow>
                                <TableCell
                                    colSpan={7}
                                    align="center"
                                    sx={{ py: 6 }}
                                >
                                    <Typography color="text.secondary">
                                        No tasks assigned to you
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        ) : (
                            myTasks.map((task) => (
                                <TableRow
                                    key={task.id}
                                    hover
                                    tabIndex={0}
                                    aria-label={`Task ${task.task_number ? "#" + task.task_number + " " : ""}${task.title}`}
                                    sx={{
                                        cursor: "pointer",
                                        opacity: task.column?.is_done_column
                                            ? 0.5
                                            : 1,
                                    }}
                                    onClick={() => handleTaskClick(task)}
                                    onKeyDown={(e) => {
                                        if (
                                            e.key === "Enter" ||
                                            e.key === " "
                                        ) {
                                            e.preventDefault();
                                            handleTaskClick(task);
                                        }
                                    }}
                                >
                                    <TableCell>
                                        <Typography
                                            variant="body2"
                                            color="text.secondary"
                                        >
                                            {task.task_number
                                                ? `#${task.task_number}`
                                                : ""}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Typography
                                            variant="body2"
                                            fontWeight={500}
                                            sx={{
                                                textDecoration: task.column
                                                    ?.is_done_column
                                                    ? "line-through"
                                                    : "none",
                                            }}
                                        >
                                            {getGitlabPrefix(task) && (
                                                <Typography
                                                    component="span"
                                                    variant="body2"
                                                    color="text.secondary"
                                                    sx={{ mr: 0.5 }}
                                                >
                                                    {getGitlabPrefix(task)}
                                                </Typography>
                                            )}
                                            {task.title}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>
                                        {task.board && (
                                            <Typography
                                                variant="body2"
                                                color="text.secondary"
                                                noWrap
                                            >
                                                {task.board.name}
                                            </Typography>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {task.column && (
                                            <Chip
                                                label={task.column.name}
                                                size="small"
                                                sx={{
                                                    bgcolor: task.column.color,
                                                    color: getContrastText(
                                                        task.column.color,
                                                    ),
                                                    height: 22,
                                                    fontSize: "0.7rem",
                                                    fontWeight: 600,
                                                }}
                                            />
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <Box
                                            sx={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 0.5,
                                            }}
                                        >
                                            <Box
                                                sx={{
                                                    width: 8,
                                                    height: 8,
                                                    borderRadius: "50%",
                                                    bgcolor:
                                                        PRIORITY_COLORS[
                                                            task.priority
                                                        ] ?? "transparent",
                                                    border:
                                                        task.priority === "none"
                                                            ? "1px solid"
                                                            : "none",
                                                    borderColor: "divider",
                                                }}
                                            />
                                            <Typography
                                                variant="body2"
                                                sx={{
                                                    textTransform: "capitalize",
                                                }}
                                            >
                                                {task.priority}
                                            </Typography>
                                        </Box>
                                    </TableCell>
                                    <TableCell>
                                        {task.due_date && (
                                            <Typography
                                                variant="body2"
                                                color={
                                                    !task.column
                                                        ?.is_done_column &&
                                                    new Date(task.due_date) <
                                                        new Date()
                                                        ? "error"
                                                        : "text.secondary"
                                                }
                                            >
                                                {new Date(
                                                    task.due_date,
                                                ).toLocaleDateString(
                                                    undefined,
                                                    {
                                                        month: "short",
                                                        day: "numeric",
                                                    },
                                                )}
                                            </Typography>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <Box
                                            sx={{
                                                display: "flex",
                                                gap: 0.5,
                                                flexWrap: "wrap",
                                            }}
                                        >
                                            {(task.labels ?? [])
                                                .slice(0, 2)
                                                .map((label) => (
                                                    <Chip
                                                        key={label.id}
                                                        label={label.name}
                                                        size="small"
                                                        sx={{
                                                            height: 20,
                                                            fontSize: "0.65rem",
                                                            fontWeight: 600,
                                                            bgcolor:
                                                                label.color,
                                                            color: getContrastText(
                                                                label.color,
                                                            ),
                                                        }}
                                                    />
                                                ))}
                                        </Box>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </TableContainer>
        </AuthenticatedLayout>
    );
}
