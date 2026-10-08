import { useMemo, useState } from "react";
import PriorityIndicator from "@/Components/Tasks/PriorityIndicator";
import { harbor, harborAvatarColor } from "@/theme/harbor";
import type { Column, Task, User } from "@/types";
import { pluralize } from "@/utils/boardFilters";
import { getTaskLabel } from "@/utils/gitlabPrefix";
import { describeTaskCard } from "@/utils/taskCardLabel";
import {
    computeWorkload,
    PRIORITY_RANK,
    type WorkloadGroup,
} from "@/utils/workload";
import { Link } from "@inertiajs/react";
import Alert from "@mui/material/Alert";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import LinearProgress from "@mui/material/LinearProgress";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import PersonOffOutlinedIcon from "@mui/icons-material/PersonOffOutlined";

/** Tasks shown per person before "+N more". */
const PREVIEW_COUNT = 8;

function initials(name: string): string {
    return name
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part.charAt(0))
        .join("")
        .toUpperCase();
}

function TaskChip({ task, href }: { task: Task; href: string }) {
    return (
        <Chip
            component={Link}
            href={href}
            clickable
            size="small"
            aria-label={describeTaskCard(task)}
            icon={
                task.priority !== "none" ? (
                    <Box
                        component="span"
                        sx={{ display: "inline-flex", ml: "6px !important" }}
                    >
                        <PriorityIndicator
                            priority={task.priority}
                            showLabel={false}
                        />
                    </Box>
                ) : undefined
            }
            label={getTaskLabel(task)}
            sx={{
                maxWidth: { xs: "100%", sm: 280 },
                height: 28,
                fontSize: "12.5px",
                fontWeight: 600,
                bgcolor: harbor.card,
                color: harbor.ink,
                border: `1px solid ${harbor.cardBorder}`,
                boxShadow: harbor.chipShadow,
                "&:hover": { bgcolor: harbor.countBg },
            }}
        />
    );
}

function GroupCard({
    group,
    maxTasks,
    expanded,
    onToggle,
    taskHref,
}: {
    group: WorkloadGroup;
    maxTasks: number;
    expanded: boolean;
    onToggle: () => void;
    taskHref: (task: Task) => string;
}) {
    const name = group.user?.name ?? "Unassigned";
    const visible = expanded
        ? group.tasks
        : group.tasks.slice(0, PREVIEW_COUNT);
    const hidden = group.tasks.length - PREVIEW_COUNT;
    const listId = `workload-${group.key}`;
    const priorities = (
        Object.entries(group.byPriority) as [Task["priority"], number][]
    ).sort(([a], [b]) => PRIORITY_RANK[a] - PRIORITY_RANK[b]);

    return (
        <Paper
            component="section"
            aria-labelledby={`${listId}-name`}
            elevation={1}
            sx={{ p: { xs: 1.75, sm: 2 } }}
        >
            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1.5,
                    mb: 1.25,
                    flexWrap: "wrap",
                }}
            >
                {group.user ? (
                    <Avatar
                        alt=""
                        src={group.user.avatar_url}
                        sx={{
                            width: 36,
                            height: 36,
                            fontSize: "0.8rem",
                            bgcolor: harborAvatarColor(group.user.name),
                            color: "#ffffff",
                        }}
                    >
                        {initials(group.user.name)}
                    </Avatar>
                ) : (
                    <Avatar
                        alt=""
                        sx={{
                            width: 36,
                            height: 36,
                            bgcolor: harbor.countBg,
                            color: harbor.sub,
                        }}
                    >
                        <PersonOffOutlinedIcon fontSize="small" />
                    </Avatar>
                )}
                <Box sx={{ flex: "1 1 160px", minWidth: 0 }}>
                    <Typography
                        id={`${listId}-name`}
                        variant="subtitle2"
                        component="h2"
                        sx={{ fontWeight: 700, color: harbor.ink }}
                        noWrap
                    >
                        {name}
                    </Typography>
                    <Typography
                        variant="body2"
                        sx={{ color: harbor.sub, fontSize: "12.5px" }}
                    >
                        {pluralize(group.tasks.length, "task")} ·{" "}
                        {pluralize(group.points, "point")}
                        {group.unestimated > 0 &&
                            ` · ${group.unestimated} unestimated`}
                    </Typography>
                </Box>
                <Box
                    sx={{
                        display: "flex",
                        gap: 1.25,
                        flexWrap: "wrap",
                        alignItems: "center",
                    }}
                >
                    {priorities.map(([priority, count]) =>
                        priority === "none" ? (
                            <Typography
                                key={priority}
                                variant="body2"
                                sx={{
                                    color: harbor.sub,
                                    fontSize: "12px",
                                    fontWeight: 700,
                                }}
                            >
                                {count} no priority
                            </Typography>
                        ) : (
                            <Box
                                key={priority}
                                sx={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 0.5,
                                    fontSize: "12px",
                                    fontWeight: 700,
                                    color: harbor.sub,
                                }}
                            >
                                {count}
                                <PriorityIndicator
                                    priority={priority}
                                    fontSize={12}
                                />
                            </Box>
                        ),
                    )}
                </Box>
            </Box>
            <LinearProgress
                variant="determinate"
                aria-hidden
                value={(group.tasks.length / maxTasks) * 100}
                sx={{ height: 6, borderRadius: 3, mb: 1.5 }}
            />
            <Box
                id={listId}
                component="ul"
                sx={{
                    display: "flex",
                    gap: 1,
                    flexWrap: "wrap",
                    listStyle: "none",
                    m: 0,
                    p: 0,
                    "& > li": { maxWidth: "100%" },
                }}
            >
                {visible.map((task) => (
                    <li key={task.id}>
                        <TaskChip task={task} href={taskHref(task)} />
                    </li>
                ))}
            </Box>
            {hidden > 0 && (
                <Button
                    size="small"
                    onClick={onToggle}
                    aria-expanded={expanded}
                    aria-controls={listId}
                    sx={{ mt: 1, color: harbor.accent }}
                >
                    {expanded ? "Show fewer" : `Show ${hidden} more`}
                </Button>
            )}
        </Paper>
    );
}

interface Props {
    columns: Column[];
    members: User[];
    /** Every task on the board once loaded; the first pages until then. */
    tasks: Task[];
    complete: boolean;
    loading: boolean;
    filterFn: (task: Task) => boolean;
    filtersActive: boolean;
    /** Active assignee filter (member ids). */
    assigneeIds: string[];
    /** Filters other than assignees are active. */
    otherFiltersActive: boolean;
    onShowEveryone: () => void;
    taskHref: (task: Task) => string;
}

export default function WorkloadView({
    columns,
    members,
    tasks,
    complete,
    loading,
    filterFn,
    filtersActive,
    assigneeIds,
    otherFiltersActive,
    onShowEveryone,
    taskHref,
}: Props) {
    const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

    const doneColumnIds = useMemo(
        () => new Set(columns.filter((c) => c.is_done_column).map((c) => c.id)),
        [columns],
    );

    const workload = useMemo(
        () =>
            computeWorkload({
                tasks: filtersActive ? tasks.filter(filterFn) : tasks,
                members,
                doneColumnIds,
                onlyAssigneeIds: assigneeIds,
            }),
        [tasks, filterFn, filtersActive, members, doneColumnIds, assigneeIds],
    );

    const filteredNames = useMemo(() => {
        const byId = new Map(members.map((m) => [m.id, m.name]));
        return assigneeIds
            .map((id) => byId.get(id))
            .filter((n): n is string => Boolean(n));
    }, [assigneeIds, members]);

    const allGroups = [
        ...workload.groups,
        ...(workload.unassigned && workload.unassigned.tasks.length > 0
            ? [workload.unassigned]
            : []),
    ];
    const maxTasks = Math.max(...allGroups.map((g) => g.tasks.length), 1);

    const toggle = (key: string) =>
        setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {assigneeIds.length > 0 && (
                <Alert
                    severity="info"
                    action={
                        <Button
                            color="inherit"
                            size="small"
                            onClick={onShowEveryone}
                        >
                            Show everyone
                        </Button>
                    }
                >
                    Showing only{" "}
                    {filteredNames.length > 0
                        ? filteredNames.join(", ")
                        : "the selected people"}
                    .
                </Alert>
            )}
            {otherFiltersActive && (
                <Typography variant="body2" sx={{ color: harbor.sub }}>
                    Totals count only tasks that match the current filters.
                </Typography>
            )}

            {!complete && (
                <Box
                    role="status"
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                        color: harbor.sub,
                    }}
                >
                    {loading && <CircularProgress size={14} aria-hidden />}
                    <Typography variant="body2" sx={{ color: harbor.sub }}>
                        {loading
                            ? "Loading every task on the board…"
                            : "Showing loaded tasks only."}
                    </Typography>
                </Box>
            )}

            {allGroups.length === 0 ? (
                <Box sx={{ py: 6, textAlign: "center" }}>
                    <Typography color="text.secondary">
                        {filtersActive
                            ? "No active tasks match the current filters."
                            : "No active tasks."}
                    </Typography>
                </Box>
            ) : (
                allGroups.map((group) => (
                    <GroupCard
                        key={group.key}
                        group={group}
                        maxTasks={maxTasks}
                        expanded={expanded.has(group.key)}
                        onToggle={() => toggle(group.key)}
                        taskHref={taskHref}
                    />
                ))
            )}

            {workload.idleMembers.length > 0 && (
                <Typography variant="body2" sx={{ color: harbor.sub }}>
                    <Box component="span" sx={{ fontWeight: 700 }}>
                        {filtersActive
                            ? "No matching active tasks:"
                            : "No active tasks:"}
                    </Box>{" "}
                    {workload.idleMembers.map((m) => m.name).join(", ")}
                </Typography>
            )}
        </Box>
    );
}
