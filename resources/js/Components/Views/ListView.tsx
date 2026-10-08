import RouterLink from "@/Components/Common/RouterLink";
import { memo, useMemo, useState } from "react";
import PriorityIndicator from "@/Components/Tasks/PriorityIndicator";
import MergeRequestChip from "@/Components/Gitlab/MergeRequestChip";
import type { Column, Task } from "@/types";
import { listFooterText } from "@/utils/boardFilters";
import { getContrastText } from "@/utils/colorContrast";
import { formatDueDate, isOverdue } from "@/utils/formatTimestamp";
import { getGitlabPrefix } from "@/utils/gitlabPrefix";
import { describeTaskCard } from "@/utils/taskCardLabel";
import { PRIORITY_RANK } from "@/utils/workload";
import { harbor, harborAvatarColor } from "@/theme/harbor";
import Avatar from "@mui/material/Avatar";
import AvatarGroup from "@mui/material/AvatarGroup";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Link from "@mui/material/Link";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TableSortLabel from "@mui/material/TableSortLabel";
import Typography from "@mui/material/Typography";

type SortKey =
    | "task_number"
    | "title"
    | "priority"
    | "due_date"
    | "column"
    | "assignees";
type SortDir = "asc" | "desc";

const VISUALLY_HIDDEN = {
    position: "absolute",
    width: "1px",
    height: "1px",
    p: 0,
    m: -1,
    overflow: "hidden",
    clip: "rect(0 0 0 0)",
    whiteSpace: "nowrap",
    border: 0,
} as const;

/** Missing values (no due date, nobody assigned) sort last either way. */
function compareMaybe<T>(
    a: T | null | undefined,
    b: T | null | undefined,
    compare: (x: T, y: T) => number,
    dir: SortDir,
): number {
    if (a == null && b == null) return 0;
    if (a == null) return 1;
    if (b == null) return -1;
    const cmp = compare(a, b);
    return dir === "asc" ? cmp : -cmp;
}

interface TaskRowProps {
    task: Task;
    column?: Column;
    href: string;
    showGitlab: boolean;
}

const TaskRow = memo(function TaskRow({
    task,
    column,
    href,
    showGitlab,
}: TaskRowProps) {
    const prefix = getGitlabPrefix(task);
    const assignees = task.assignees ?? [];
    const mergeRequests = (task.gitlab_refs ?? []).filter(
        (r) => r.ref_type === "merge_request",
    );

    return (
        <TableRow
            hover
            sx={{
                // The title link stretches over the whole row (see ::after)
                position: "relative",
                cursor: "pointer",
                "& .MuiTableCell-root": { py: 1.25 },
            }}
        >
            <TableCell>
                <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ fontVariantNumeric: "tabular-nums" }}
                >
                    #{task.task_number}
                </Typography>
            </TableCell>
            <TableCell>
                <Link
                    component={RouterLink}
                    href={href}
                    underline="hover"
                    aria-label={describeTaskCard(task)}
                    sx={{
                        color: harbor.ink,
                        fontWeight: 600,
                        fontSize: "0.875rem",
                        overflowWrap: "anywhere",
                        // The focus ring is drawn around the whole row
                        "&:focus-visible": { outline: "none" },
                        "&::after": {
                            content: '""',
                            position: "absolute",
                            inset: 0,
                        },
                        "&:focus-visible::after": {
                            outline: `2px solid ${harbor.accent}`,
                            outlineOffset: "-2px",
                        },
                    }}
                >
                    {prefix && (
                        <Box
                            component="span"
                            sx={{ color: harbor.sub, fontWeight: 500, mr: 0.5 }}
                        >
                            {prefix}
                        </Box>
                    )}
                    {task.title}
                </Link>
            </TableCell>
            <TableCell>
                {column && (
                    <Chip
                        label={column.name}
                        size="small"
                        sx={{
                            bgcolor: column.color || harbor.countBg,
                            color: column.color
                                ? getContrastText(column.color)
                                : harbor.ink,
                            height: 24,
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            maxWidth: 140,
                        }}
                    />
                )}
            </TableCell>
            <TableCell>
                {task.priority === "none" ? (
                    <Typography variant="body2" sx={{ color: harbor.sub }}>
                        None
                    </Typography>
                ) : (
                    <PriorityIndicator priority={task.priority} fontSize={13} />
                )}
            </TableCell>
            <TableCell>
                {task.due_date && (
                    <Typography
                        variant="body2"
                        color={
                            isOverdue(task.due_date) && !task.completed_at
                                ? "error"
                                : "text.secondary"
                        }
                        sx={{ whiteSpace: "nowrap" }}
                    >
                        {formatDueDate(task.due_date, { includeYear: true })}
                    </Typography>
                )}
            </TableCell>
            <TableCell>
                {assignees.length > 0 && (
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                            minWidth: 0,
                        }}
                    >
                        <AvatarGroup
                            max={3}
                            aria-hidden
                            sx={{
                                "& .MuiAvatar-root": {
                                    width: 24,
                                    height: 24,
                                    fontSize: "0.65rem",
                                },
                            }}
                        >
                            {assignees.map((u) => (
                                <Avatar
                                    key={u.id}
                                    alt=""
                                    src={u.avatar_url}
                                    sx={{
                                        bgcolor: harborAvatarColor(u.name),
                                        color: "#ffffff",
                                    }}
                                >
                                    {u.name.charAt(0).toUpperCase()}
                                </Avatar>
                            ))}
                        </AvatarGroup>
                        <Typography
                            variant="body2"
                            noWrap
                            sx={{ color: harbor.sub, minWidth: 0 }}
                            title={assignees.map((u) => u.name).join(", ")}
                        >
                            {assignees[0].name}
                            {assignees.length > 1
                                ? ` +${assignees.length - 1}`
                                : ""}
                        </Typography>
                    </Box>
                )}
            </TableCell>
            <TableCell>
                <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                    {(task.labels ?? []).map((label) => (
                        <Chip
                            key={label.id}
                            label={label.name}
                            size="small"
                            sx={{
                                height: 22,
                                fontSize: "0.7rem",
                                fontWeight: 600,
                                bgcolor: label.color,
                                color: getContrastText(label.color),
                            }}
                        />
                    ))}
                </Box>
            </TableCell>
            {showGitlab && (
                <TableCell>
                    {/* Above the stretched row link so the chips stay clickable */}
                    <Box
                        sx={{
                            display: "flex",
                            gap: 0.5,
                            flexWrap: "wrap",
                            position: "relative",
                            zIndex: 1,
                        }}
                    >
                        {mergeRequests.map((ref) => (
                            <MergeRequestChip key={ref.id} gitlabRef={ref} />
                        ))}
                    </Box>
                </TableCell>
            )}
        </TableRow>
    );
});

interface Props {
    columns: Column[];
    team: { slug: string };
    board: { slug: string; name: string };
    /** Every task on the board once loaded; the first pages until then. */
    tasks: Task[];
    /** `tasks` holds every task on the board. */
    complete: boolean;
    loading: boolean;
    truncated?: boolean;
    filterFn: (task: Task) => boolean;
    filtersActive: boolean;
    onClearFilters: () => void;
    showGitlab?: boolean;
}

export default function ListView({
    columns,
    team,
    board,
    tasks,
    complete,
    loading,
    truncated = false,
    filterFn,
    filtersActive,
    onClearFilters,
    showGitlab = false,
}: Props) {
    const [sortKey, setSortKey] = useState<SortKey>("task_number");
    const [sortDir, setSortDir] = useState<SortDir>("asc");

    const columnMap = useMemo(() => {
        const m: Record<string, Column> = {};
        for (const col of columns) m[col.id] = col;
        return m;
    }, [columns]);

    const columnPosition = useMemo(() => {
        const m: Record<string, number> = {};
        columns.forEach((col, index) => (m[col.id] = index));
        return m;
    }, [columns]);

    // Server-side totals, correct before every task has loaded
    const totalTaskCount = useMemo(
        () =>
            columns.reduce(
                (sum, col) => sum + (col.tasks_count ?? col.tasks?.length ?? 0),
                0,
            ),
        [columns],
    );

    const visibleTasks = useMemo(
        () => (filtersActive ? tasks.filter(filterFn) : tasks),
        [tasks, filterFn, filtersActive],
    );

    const sortedTasks = useMemo(() => {
        const byNumber = (a: Task, b: Task) =>
            (a.task_number ?? 0) - (b.task_number ?? 0);
        return [...visibleTasks].sort((a, b) => {
            let cmp = 0;
            switch (sortKey) {
                case "task_number":
                    cmp = byNumber(a, b);
                    return sortDir === "asc" ? cmp : -cmp;
                case "title":
                    cmp = a.title.localeCompare(b.title);
                    break;
                case "priority":
                    cmp =
                        (PRIORITY_RANK[a.priority] ?? 4) -
                        (PRIORITY_RANK[b.priority] ?? 4);
                    break;
                case "due_date":
                    cmp = compareMaybe(
                        a.due_date?.slice(0, 10),
                        b.due_date?.slice(0, 10),
                        (x, y) => x.localeCompare(y),
                        sortDir,
                    );
                    return cmp || byNumber(a, b);
                case "column":
                    cmp =
                        (columnPosition[a.column_id] ?? 0) -
                        (columnPosition[b.column_id] ?? 0);
                    break;
                case "assignees":
                    // By the first assignee's name; unassigned last
                    cmp = compareMaybe(
                        a.assignees?.[0]?.name,
                        b.assignees?.[0]?.name,
                        (x, y) => x.localeCompare(y),
                        sortDir,
                    );
                    return cmp || byNumber(a, b);
            }
            return (sortDir === "asc" ? cmp : -cmp) || byNumber(a, b);
        });
    }, [visibleTasks, sortKey, sortDir, columnPosition]);

    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        } else {
            setSortKey(key);
            setSortDir("asc");
        }
    };

    const renderSortLabel = (key: SortKey, label: string) => (
        <TableSortLabel
            active={sortKey === key}
            direction={sortKey === key ? sortDir : "asc"}
            onClick={() => handleSort(key)}
        >
            {label}
        </TableSortLabel>
    );

    const colSpan = showGitlab ? 8 : 7;
    const ariaSort = (key: SortKey) =>
        sortKey === key
            ? sortDir === "asc"
                ? "ascending"
                : "descending"
            : undefined;

    return (
        <Box>
            <TableContainer
                component={Paper}
                variant="outlined"
                scroll-region=""
                sx={{ borderRadius: 2, overflowX: "auto" }}
            >
                <Table sx={{ minWidth: 760 }}>
                    <Box component="caption" sx={VISUALLY_HIDDEN}>
                        Tasks on {board.name}
                    </Box>
                    <TableHead>
                        <TableRow
                            sx={{
                                "& .MuiTableCell-head": {
                                    fontWeight: 600,
                                    bgcolor: harbor.countBg,
                                    color: harbor.sub,
                                    py: 1.25,
                                },
                            }}
                        >
                            <TableCell
                                sx={{ width: 70 }}
                                aria-sort={ariaSort("task_number")}
                            >
                                {renderSortLabel("task_number", "#")}
                            </TableCell>
                            <TableCell aria-sort={ariaSort("title")}>
                                {renderSortLabel("title", "Title")}
                            </TableCell>
                            <TableCell
                                sx={{ width: 140 }}
                                aria-sort={ariaSort("column")}
                            >
                                {renderSortLabel("column", "Status")}
                            </TableCell>
                            <TableCell
                                sx={{ width: 110 }}
                                aria-sort={ariaSort("priority")}
                            >
                                {renderSortLabel("priority", "Priority")}
                            </TableCell>
                            <TableCell
                                sx={{ width: 130 }}
                                aria-sort={ariaSort("due_date")}
                            >
                                {renderSortLabel("due_date", "Due date")}
                            </TableCell>
                            <TableCell
                                sx={{ width: 170 }}
                                aria-sort={ariaSort("assignees")}
                            >
                                {renderSortLabel("assignees", "Assignees")}
                            </TableCell>
                            <TableCell sx={{ width: 160 }}>Labels</TableCell>
                            {showGitlab && (
                                <TableCell sx={{ width: 110 }}>
                                    GitLab
                                </TableCell>
                            )}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {sortedTasks.length === 0 ? (
                            <TableRow>
                                <TableCell
                                    colSpan={colSpan}
                                    align="center"
                                    sx={{ py: 6 }}
                                >
                                    {loading && !complete ? (
                                        <CircularProgress
                                            size={24}
                                            aria-label="Loading tasks"
                                        />
                                    ) : filtersActive ? (
                                        <>
                                            <Typography
                                                color="text.secondary"
                                                sx={{ mb: 1.5 }}
                                            >
                                                No tasks match the current
                                                filters.
                                            </Typography>
                                            <Button
                                                variant="outlined"
                                                size="small"
                                                onClick={onClearFilters}
                                            >
                                                Clear filters
                                            </Button>
                                        </>
                                    ) : (
                                        <Typography color="text.secondary">
                                            No tasks on this board yet.
                                        </Typography>
                                    )}
                                </TableCell>
                            </TableRow>
                        ) : (
                            sortedTasks.map((task) => (
                                <TaskRow
                                    key={task.id}
                                    task={task}
                                    column={columnMap[task.column_id]}
                                    href={route("tasks.show", [
                                        team.slug,
                                        board.slug,
                                        task.slug ?? task.id,
                                    ])}
                                    showGitlab={showGitlab}
                                />
                            ))
                        )}
                    </TableBody>
                </Table>
            </TableContainer>

            {/* Count summary */}
            <Box
                role="status"
                sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 1,
                    py: 1.5,
                    color: harbor.sub,
                }}
            >
                {!complete && loading ? (
                    <>
                        <CircularProgress size={14} aria-hidden />
                        <Typography
                            variant="caption"
                            sx={{ color: harbor.sub }}
                        >
                            Loading all {totalTaskCount} tasks…
                        </Typography>
                    </>
                ) : (
                    <Typography variant="caption" sx={{ color: harbor.sub }}>
                        {listFooterText(sortedTasks.length, totalTaskCount)}
                        {!complete
                            ? " (not every task could be loaded)"
                            : truncated
                              ? ` (only the first ${tasks.length} could be loaded)`
                              : ""}
                    </Typography>
                )}
            </Box>
        </Box>
    );
}
