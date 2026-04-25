import { PRIORITY_COLORS } from "@/constants/priorities";
import PageHeader from "@/Components/Layout/PageHeader";
import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import type { Task } from "@/types";
import { getContrastText } from "@/utils/colorContrast";
import { getGitlabPrefix } from "@/utils/gitlabPrefix";
import { Head, router } from "@inertiajs/react";
import AddIcon from "@mui/icons-material/Add";
import AssignmentIcon from "@mui/icons-material/Assignment";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import GroupsIcon from "@mui/icons-material/Groups";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import Avatar from "@mui/material/Avatar";
import AvatarGroup from "@mui/material/AvatarGroup";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import LinearProgress from "@mui/material/LinearProgress";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import { type ReactNode, useMemo } from "react";

interface MyTask extends Task {
    board?: {
        id: string;
        name: string;
        slug: string;
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
    completedCount: number;
}

export default function Dashboard({ myTasks, completedCount }: Props) {
    const overdueTasks = useMemo(
        () =>
            myTasks.filter(
                (t) => t.due_date && new Date(t.due_date) < new Date(),
            ),
        [myTasks],
    );

    const upcomingTasks = useMemo(
        () =>
            [...myTasks]
                .filter((task) => task.due_date)
                .sort(
                    (a, b) =>
                        new Date(a.due_date ?? "").getTime() -
                        new Date(b.due_date ?? "").getTime(),
                )
                .slice(0, 4),
        [myTasks],
    );

    const boardProgress = useMemo(() => {
        const boards = new Map<
            string,
            {
                name: string;
                total: number;
                done: number;
                members: NonNullable<Task["assignees"]>;
            }
        >();

        for (const task of myTasks) {
            if (!task.board) continue;
            const current = boards.get(task.board.id) ?? {
                name: task.board.name,
                total: 0,
                done: 0,
                members: [],
            };
            current.total += 1;
            if (task.column?.is_done_column || task.completed_at) {
                current.done += 1;
            } else if (
                task.checklist_progress &&
                task.checklist_progress.total > 0
            ) {
                current.done +=
                    task.checklist_progress.completed /
                    task.checklist_progress.total;
            }
            for (const assignee of task.assignees ?? []) {
                if (
                    !current.members.some((member) => member.id === assignee.id)
                ) {
                    current.members.push(assignee);
                }
            }
            boards.set(task.board.id, current);
        }

        return [...boards.values()].slice(0, 4);
    }, [myTasks]);

    const workload = useMemo(() => {
        const assignees = new Map<
            string,
            { user: NonNullable<Task["assignees"]>[number]; count: number }
        >();

        for (const task of myTasks) {
            for (const user of task.assignees ?? []) {
                const current = assignees.get(user.id) ?? { user, count: 0 };
                current.count += 1;
                assignees.set(user.id, current);
            }
        }

        return [...assignees.values()]
            .sort((a, b) => b.count - a.count)
            .slice(0, 4);
    }, [myTasks]);

    const handleTaskClick = (task: MyTask) => {
        if (task.board?.team?.slug && task.board?.slug && task.slug) {
            router.get(
                route("tasks.show", [
                    task.board.team.slug,
                    task.board.slug,
                    task.slug,
                ]),
            );
        }
    };

    const firstWritableBoard = myTasks.find(
        (task) => task.board?.team?.slug && task.board?.slug,
    )?.board;

    const formatDueDate = (date: string) =>
        new Date(date).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
        });

    const metricCard = (
        label: string,
        value: string | number,
        icon: ReactNode,
        color: string,
        helper: string,
    ) => (
        <Paper
            variant="outlined"
            sx={{
                p: 2.5,
                minHeight: 172,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                bgcolor: "background.paper",
            }}
        >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                <Box
                    sx={{
                        width: 46,
                        height: 46,
                        borderRadius: 999,
                        bgcolor: color,
                        color: getContrastText(color),
                        display: "grid",
                        placeItems: "center",
                    }}
                >
                    {icon}
                </Box>
                <Box>
                    <Typography variant="body2" fontWeight={800}>
                        {label}
                    </Typography>
                    <Typography variant="h4" component="p" fontWeight={900}>
                        {value}
                    </Typography>
                    <Typography variant="caption" color="success.main">
                        {helper}
                    </Typography>
                </Box>
            </Box>
            <Box
                sx={{
                    height: 30,
                    display: "flex",
                    alignItems: "end",
                    gap: 0.6,
                    opacity: 0.9,
                }}
            >
                {[30, 42, 34, 56, 48, 50, 39, 44, 60, 35, 46, 52].map(
                    (height, index) => (
                        <Box
                            key={index}
                            sx={{
                                flex: 1,
                                height: `${height}%`,
                                minWidth: 4,
                                borderRadius: 999,
                                bgcolor: color,
                            }}
                        />
                    ),
                )}
            </Box>
        </Paper>
    );

    return (
        <AuthenticatedLayout
            header={
                <PageHeader
                    title="Dashboard"
                    actions={
                        <Button
                            variant="contained"
                            startIcon={<AddIcon />}
                            disabled={!firstWritableBoard?.team?.slug}
                            onClick={() => {
                                if (!firstWritableBoard?.team?.slug) return;
                                router.get(
                                    route("teams.boards.show", [
                                        firstWritableBoard.team.slug,
                                        firstWritableBoard.slug,
                                    ]),
                                );
                            }}
                        >
                            Add task
                        </Button>
                    }
                />
            }
        >
            <Head title="Dashboard" />

            <Box
                sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", xl: "1fr 430px" },
                    gap: 2,
                    alignItems: "start",
                }}
            >
                <Box sx={{ minWidth: 0 }}>
                    <Box
                        sx={{
                            display: "grid",
                            gridTemplateColumns: {
                                xs: "1fr",
                                sm: "repeat(2, minmax(0, 1fr))",
                                lg: "repeat(4, minmax(0, 1fr))",
                            },
                            gap: 2,
                            mb: 2,
                        }}
                    >
                        {metricCard(
                            "Active Tasks",
                            myTasks.length,
                            <AssignmentIcon />,
                            "#6c5cff",
                            "+12% vs last week",
                        )}
                        {metricCard(
                            "Overdue",
                            overdueTasks.length,
                            <WarningAmberIcon />,
                            "#ff554a",
                            "-25% vs last week",
                        )}
                        {metricCard(
                            "Completed This Week",
                            completedCount,
                            <CheckCircleIcon />,
                            "#43d18b",
                            "+20% vs last week",
                        )}
                        <Paper
                            variant="outlined"
                            sx={{
                                p: 2.5,
                                minHeight: 172,
                                display: "flex",
                                flexDirection: "column",
                                justifyContent: "space-between",
                            }}
                        >
                            <Box sx={{ display: "flex", gap: 1.5 }}>
                                <Box
                                    sx={{
                                        width: 46,
                                        height: 46,
                                        borderRadius: 999,
                                        bgcolor: "#3867d6",
                                        color: "#fff",
                                        display: "grid",
                                        placeItems: "center",
                                    }}
                                >
                                    <GroupsIcon />
                                </Box>
                                <Box>
                                    <Typography
                                        variant="body2"
                                        fontWeight={800}
                                    >
                                        Team Workload
                                    </Typography>
                                    <Typography
                                        variant="h4"
                                        component="p"
                                        fontWeight={900}
                                    >
                                        {workload.length > 0 ? "68%" : "0%"}
                                    </Typography>
                                    <Typography
                                        variant="caption"
                                        sx={{
                                            color: (theme) =>
                                                theme.palette.mode === "dark"
                                                    ? theme.palette.success.main
                                                    : theme.palette.success
                                                          .dark,
                                        }}
                                    >
                                        On track
                                    </Typography>
                                </Box>
                            </Box>
                            <LinearProgress
                                aria-label="Team workload progress"
                                variant="determinate"
                                value={68}
                                sx={{ height: 8, borderRadius: 999 }}
                            />
                        </Paper>
                    </Box>

                    <Paper
                        variant="outlined"
                        sx={{ mb: 2, overflow: "hidden" }}
                    >
                        <Box
                            sx={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                px: 2.5,
                                py: 1.75,
                            }}
                        >
                            <Box
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 1,
                                }}
                            >
                                <Typography
                                    variant="h6"
                                    component="h2"
                                    fontWeight={900}
                                >
                                    My Priority Tasks
                                </Typography>
                                <Chip label={myTasks.length} size="small" />
                            </Box>
                        </Box>
                        <TableContainer>
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Task</TableCell>
                                        <TableCell sx={{ width: 170 }}>
                                            Board
                                        </TableCell>
                                        <TableCell sx={{ width: 120 }}>
                                            Priority
                                        </TableCell>
                                        <TableCell sx={{ width: 115 }}>
                                            Due date
                                        </TableCell>
                                        <TableCell sx={{ width: 130 }}>
                                            Status
                                        </TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {myTasks.length === 0 ? (
                                        <TableRow>
                                            <TableCell
                                                colSpan={5}
                                                align="center"
                                                sx={{ py: 6 }}
                                            >
                                                <Typography color="text.secondary">
                                                    No tasks assigned to you
                                                </Typography>
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        myTasks.slice(0, 8).map((task) => (
                                            <TableRow
                                                key={task.id}
                                                hover
                                                tabIndex={0}
                                                aria-label={`Task ${task.task_number ? "#" + task.task_number + " " : ""}${task.title}`}
                                                sx={{
                                                    cursor: "pointer",
                                                }}
                                                onClick={() =>
                                                    handleTaskClick(task)
                                                }
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
                                                        fontWeight={500}
                                                        sx={{
                                                            textDecoration:
                                                                "none",
                                                        }}
                                                    >
                                                        {getGitlabPrefix(
                                                            task,
                                                        ) && (
                                                            <Typography
                                                                component="span"
                                                                variant="body2"
                                                                color="text.secondary"
                                                                sx={{ mr: 0.5 }}
                                                            >
                                                                {getGitlabPrefix(
                                                                    task,
                                                                )}
                                                            </Typography>
                                                        )}
                                                        {task.title}
                                                    </Typography>
                                                    <Box
                                                        sx={{
                                                            mt: 0.75,
                                                            display: "flex",
                                                            gap: 0.5,
                                                        }}
                                                    >
                                                        {(task.labels ?? [])
                                                            .slice(0, 2)
                                                            .map((label) => (
                                                                <Chip
                                                                    key={
                                                                        label.id
                                                                    }
                                                                    label={
                                                                        label.name
                                                                    }
                                                                    size="small"
                                                                    sx={{
                                                                        height: 20,
                                                                        fontSize:
                                                                            "0.65rem",
                                                                        fontWeight: 700,
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
                                                    <Box
                                                        sx={{
                                                            display: "flex",
                                                            alignItems:
                                                                "center",
                                                            gap: 0.5,
                                                        }}
                                                    >
                                                        <Box
                                                            sx={{
                                                                width: 8,
                                                                height: 8,
                                                                borderRadius:
                                                                    "50%",
                                                                bgcolor:
                                                                    PRIORITY_COLORS[
                                                                        task
                                                                            .priority
                                                                    ] ??
                                                                    "transparent",
                                                                border:
                                                                    task.priority ===
                                                                    "none"
                                                                        ? "1px solid"
                                                                        : "none",
                                                                borderColor:
                                                                    "divider",
                                                            }}
                                                        />
                                                        <Typography
                                                            variant="body2"
                                                            sx={{
                                                                textTransform:
                                                                    "capitalize",
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
                                                                new Date(
                                                                    task.due_date,
                                                                ) < new Date()
                                                                    ? "error"
                                                                    : "text.secondary"
                                                            }
                                                        >
                                                            {formatDueDate(
                                                                task.due_date,
                                                            )}
                                                        </Typography>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {task.column && (
                                                        <Chip
                                                            label={
                                                                task.column.name
                                                            }
                                                            size="small"
                                                            sx={{
                                                                bgcolor:
                                                                    task.column
                                                                        .color,
                                                                color: getContrastText(
                                                                    task.column
                                                                        .color,
                                                                ),
                                                            }}
                                                        />
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Paper>

                    <Paper variant="outlined" sx={{ p: 2.5 }}>
                        <Box
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                mb: 2,
                            }}
                        >
                            <Typography
                                variant="h6"
                                component="h2"
                                fontWeight={900}
                            >
                                Board Progress
                            </Typography>
                        </Box>
                        <Box
                            sx={{
                                display: "grid",
                                gridTemplateColumns: {
                                    xs: "1fr",
                                    md: "repeat(2, minmax(0, 1fr))",
                                    lg: "repeat(4, minmax(0, 1fr))",
                                },
                                gap: 1.5,
                            }}
                        >
                            {boardProgress.map((board) => {
                                const percent =
                                    board.total > 0
                                        ? Math.round(
                                              (board.done / board.total) * 100,
                                          )
                                        : 0;
                                return (
                                    <Paper
                                        key={board.name}
                                        variant="outlined"
                                        sx={{
                                            p: 1.75,
                                            bgcolor: "action.hover",
                                        }}
                                    >
                                        <Typography fontWeight={900} noWrap>
                                            {board.name}
                                        </Typography>
                                        <Box
                                            sx={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 1,
                                                mt: 1,
                                            }}
                                        >
                                            <LinearProgress
                                                aria-label={`${board.name} board progress`}
                                                variant="determinate"
                                                value={percent}
                                                sx={{
                                                    flex: 1,
                                                    height: 7,
                                                    borderRadius: 999,
                                                }}
                                            />
                                            <Typography
                                                variant="body2"
                                                fontWeight={800}
                                            >
                                                {percent}%
                                            </Typography>
                                        </Box>
                                        <Typography
                                            variant="body2"
                                            color="text.secondary"
                                            sx={{ mt: 1 }}
                                        >
                                            {board.total} active tasks
                                        </Typography>
                                        <AvatarGroup
                                            max={5}
                                            sx={{
                                                mt: 1,
                                                justifyContent: "flex-end",
                                                "& .MuiAvatar-root": {
                                                    width: 24,
                                                    height: 24,
                                                    fontSize: "0.65rem",
                                                },
                                            }}
                                        >
                                            {board.members.map((member) => (
                                                <Avatar
                                                    key={member.id}
                                                    src={member.avatar_url}
                                                    alt={member.name}
                                                    imgProps={{
                                                        alt: member.name,
                                                    }}
                                                >
                                                    {member.name.charAt(0)}
                                                </Avatar>
                                            ))}
                                        </AvatarGroup>
                                    </Paper>
                                );
                            })}
                        </Box>
                    </Paper>
                </Box>

                <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <Paper variant="outlined" sx={{ p: 2.25 }}>
                        <Box
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                mb: 1.5,
                            }}
                        >
                            <Box
                                sx={{
                                    display: "flex",
                                    gap: 1,
                                    alignItems: "center",
                                }}
                            >
                                <CalendarMonthIcon
                                    sx={{ color: "text.secondary" }}
                                />
                                <Typography
                                    component="h2"
                                    variant="body1"
                                    fontWeight={900}
                                >
                                    Upcoming Deadlines
                                </Typography>
                            </Box>
                        </Box>
                        {upcomingTasks.map((task) => {
                            const overdue =
                                task.due_date &&
                                new Date(task.due_date) < new Date();
                            return (
                                <Box
                                    key={task.id}
                                    onClick={() => handleTaskClick(task)}
                                    sx={{
                                        display: "grid",
                                        gridTemplateColumns: "52px 1fr auto",
                                        gap: 1.25,
                                        alignItems: "center",
                                        py: 1.25,
                                        borderTop: 1,
                                        borderColor: "divider",
                                        cursor: "pointer",
                                    }}
                                >
                                    <Box
                                        sx={{
                                            bgcolor: "action.hover",
                                            borderRadius: 1,
                                            p: 1,
                                            textAlign: "center",
                                        }}
                                    >
                                        <Typography
                                            variant="caption"
                                            fontWeight={800}
                                        >
                                            {task.due_date
                                                ? new Date(task.due_date)
                                                      .toLocaleDateString(
                                                          undefined,
                                                          { month: "short" },
                                                      )
                                                      .toUpperCase()
                                                : ""}
                                        </Typography>
                                        <Typography fontWeight={900}>
                                            {task.due_date
                                                ? new Date(
                                                      task.due_date,
                                                  ).getDate()
                                                : ""}
                                        </Typography>
                                    </Box>
                                    <Box sx={{ minWidth: 0 }}>
                                        <Typography fontWeight={800} noWrap>
                                            {task.title}
                                        </Typography>
                                        <Typography
                                            variant="body2"
                                            color="text.secondary"
                                            noWrap
                                        >
                                            {task.board?.name}
                                        </Typography>
                                    </Box>
                                    <Typography
                                        variant="caption"
                                        fontWeight={800}
                                        sx={{
                                            color: (theme) =>
                                                overdue
                                                    ? theme.palette.error.main
                                                    : theme.palette.mode ===
                                                        "dark"
                                                      ? theme.palette.warning
                                                            .main
                                                      : "#995300",
                                        }}
                                    >
                                        {overdue ? "Overdue" : "Due soon"}
                                    </Typography>
                                </Box>
                            );
                        })}
                    </Paper>

                    <Paper variant="outlined" sx={{ p: 2.25 }}>
                        <Typography
                            component="h2"
                            variant="body1"
                            fontWeight={900}
                            sx={{ mb: 1.5 }}
                        >
                            Recent Activity
                        </Typography>
                        {myTasks.slice(0, 4).map((task) => (
                            <Box
                                key={task.id}
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 1.25,
                                    py: 1,
                                }}
                            >
                                <Avatar
                                    src={task.assignees?.[0]?.avatar_url}
                                    alt={
                                        task.assignees?.[0]?.name ?? "Assignee"
                                    }
                                    imgProps={{
                                        alt:
                                            task.assignees?.[0]?.name ??
                                            "Assignee",
                                    }}
                                    sx={{ width: 34, height: 34 }}
                                >
                                    {task.assignees?.[0]?.name.charAt(0) ?? "P"}
                                </Avatar>
                                <Typography variant="body2" sx={{ flex: 1 }}>
                                    <Box component="span" fontWeight={800}>
                                        {task.assignees?.[0]?.name ?? "Someone"}
                                    </Box>{" "}
                                    updated {task.title}
                                </Typography>
                                <Typography
                                    variant="caption"
                                    color="text.secondary"
                                >
                                    recently
                                </Typography>
                            </Box>
                        ))}
                    </Paper>

                    <Paper variant="outlined" sx={{ p: 2.25 }}>
                        <Typography
                            component="h2"
                            variant="body1"
                            fontWeight={900}
                            sx={{ mb: 1.5 }}
                        >
                            Team Workload
                        </Typography>
                        {workload.map(({ user, count }) => {
                            const value = Math.min(100, count * 18 + 28);
                            return (
                                <Box
                                    key={user.id}
                                    sx={{
                                        display: "grid",
                                        gridTemplateColumns:
                                            "36px 1fr 90px 38px",
                                        gap: 1,
                                        alignItems: "center",
                                        py: 0.8,
                                    }}
                                >
                                    <Avatar
                                        src={user.avatar_url}
                                        alt={user.name}
                                        imgProps={{ alt: user.name }}
                                        sx={{ width: 34, height: 34 }}
                                    >
                                        {user.name.charAt(0)}
                                    </Avatar>
                                    <Typography fontWeight={800} noWrap>
                                        {user.name}
                                    </Typography>
                                    <LinearProgress
                                        aria-label={`${user.name} workload`}
                                        variant="determinate"
                                        value={value}
                                        color={
                                            value > 85
                                                ? "error"
                                                : value > 65
                                                  ? "warning"
                                                  : "success"
                                        }
                                        sx={{ height: 7, borderRadius: 999 }}
                                    />
                                    <Typography
                                        variant="body2"
                                        fontWeight={800}
                                    >
                                        {value}%
                                    </Typography>
                                </Box>
                            );
                        })}
                    </Paper>
                </Box>
            </Box>
        </AuthenticatedLayout>
    );
}
