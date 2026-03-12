import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PRIORITY_COLORS } from "@/constants/priorities";
import type { Board, Column, PaginatedResponse, Task, Team } from "@/types";
import { getContrastText } from "@/utils/colorContrast";
import { getGitlabPrefix } from "@/utils/gitlabPrefix";
import MergeRequestChip from "@/Components/Gitlab/MergeRequestChip";
import Avatar from "@mui/material/Avatar";
import AvatarGroup from "@mui/material/AvatarGroup";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TableSortLabel from "@mui/material/TableSortLabel";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";

type SortKey =
    | "task_number"
    | "title"
    | "priority"
    | "due_date"
    | "column"
    | "assignees";
type SortDir = "asc" | "desc";

const PRIORITY_ORDER: Record<string, number> = {
    urgent: 1,
    high: 2,
    medium: 3,
    low: 4,
    none: 5,
};

/** Map client sort keys to API sort fields */
const SORT_KEY_TO_API: Record<SortKey, string> = {
    task_number: "task_number",
    title: "title",
    priority: "priority",
    due_date: "due_date",
    column: "sort_order",
    assignees: "sort_order",
};

interface Props {
    columns: Column[];
    board: Board;
    team: Team;
    filterFn: (task: Task) => boolean;
    onTaskClick: (task: Task) => void;
    showGitlab?: boolean;
}

export default function ListView({
    columns,
    board,
    team,
    filterFn,
    onTaskClick,
    showGitlab = false,
}: Props) {
    const [sortKey, setSortKey] = useState<SortKey>("task_number");
    const [sortDir, setSortDir] = useState<SortDir>("asc");
    const [extraTasks, setExtraTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const sentinelRef = useRef<HTMLTableRowElement | null>(null);
    const abortRef = useRef<AbortController | null>(null);

    const columnMap = useMemo(() => {
        const m: Record<string, Column> = {};
        for (const col of columns) {
            m[col.id] = col;
        }
        return m;
    }, [columns]);

    // Compute total tasks from column counts (server-provided) vs initial loaded tasks
    const totalTaskCount = useMemo(() => {
        return columns.reduce(
            (sum, col) => sum + (col.tasks_count ?? col.tasks?.length ?? 0),
            0,
        );
    }, [columns]);

    const initialTasks = useMemo(() => {
        const tasks: Task[] = [];
        for (const col of columns) {
            for (const task of col.tasks ?? []) {
                tasks.push(task);
            }
        }
        return tasks;
    }, [columns]);

    // Merge initial tasks with lazily loaded extra tasks, deduplicating by id
    const allTasks = useMemo(() => {
        const seen = new Set<string>();
        const merged: Task[] = [];
        for (const task of initialTasks) {
            if (!seen.has(task.id)) {
                seen.add(task.id);
                merged.push(task);
            }
        }
        for (const task of extraTasks) {
            if (!seen.has(task.id)) {
                seen.add(task.id);
                merged.push(task);
            }
        }
        return merged.filter(filterFn);
    }, [initialTasks, extraTasks, filterFn]);

    const sortedTasks = useMemo(() => {
        return [...allTasks].sort((a, b) => {
            let cmp = 0;
            switch (sortKey) {
                case "task_number":
                    cmp = (a.task_number ?? 0) - (b.task_number ?? 0);
                    break;
                case "title":
                    cmp = a.title.localeCompare(b.title);
                    break;
                case "priority":
                    cmp =
                        (PRIORITY_ORDER[a.priority] ?? 5) -
                        (PRIORITY_ORDER[b.priority] ?? 5);
                    break;
                case "due_date":
                    cmp = (a.due_date ?? "9999").localeCompare(
                        b.due_date ?? "9999",
                    );
                    break;
                case "column": {
                    const colA = columnMap[a.column_id]?.name ?? "";
                    const colB = columnMap[b.column_id]?.name ?? "";
                    cmp = colA.localeCompare(colB);
                    break;
                }
                case "assignees":
                    cmp =
                        (a.assignees?.length ?? 0) - (b.assignees?.length ?? 0);
                    break;
            }
            return sortDir === "asc" ? cmp : -cmp;
        });
    }, [allTasks, sortKey, sortDir, columnMap]);

    // Determine if there are more tasks to load
    useEffect(() => {
        const loadedUniqueCount = new Set([
            ...initialTasks.map((t) => t.id),
            ...extraTasks.map((t) => t.id),
        ]).size;
        setHasMore(loadedUniqueCount < totalTaskCount);
    }, [initialTasks, extraTasks, totalTaskCount]);

    // Reset extra tasks and pagination when columns change (e.g., Inertia reload)
    useEffect(() => {
        setExtraTasks([]);
        setCurrentPage(1);
    }, [columns]);

    const fetchMoreTasks = useCallback(async () => {
        if (loading || !hasMore) return;

        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        setLoading(true);

        try {
            const nextPage = currentPage + 1;
            const apiSort = SORT_KEY_TO_API[sortKey];
            const params = new URLSearchParams({
                page: String(nextPage),
                per_page: "50",
                sort: apiSort,
                direction: sortDir,
            });

            const response = await fetch(
                `${route("boards.tasks.index", [team.id, board.id])}?${params}`,
                {
                    headers: { Accept: "application/json" },
                    signal: controller.signal,
                },
            );

            if (!response.ok) throw new Error("Failed to load tasks");

            const data: PaginatedResponse<Task> = await response.json();

            setExtraTasks((prev) => [...prev, ...data.data]);
            setCurrentPage(nextPage);
            setHasMore(data.current_page < data.last_page);
        } catch (error) {
            if ((error as Error).name === "AbortError") {
                // Ignore aborted requests
            }
        } finally {
            setLoading(false);
        }
    }, [loading, hasMore, currentPage, sortKey, sortDir, team.id, board.id]);

    // IntersectionObserver for infinite scroll
    useEffect(() => {
        const sentinel = sentinelRef.current;
        if (!sentinel) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0]?.isIntersecting) {
                    fetchMoreTasks();
                }
            },
            { rootMargin: "200px" },
        );

        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [fetchMoreTasks]);

    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        } else {
            setSortKey(key);
            setSortDir("asc");
        }
        // Reset lazy-loaded tasks when sort changes since server ordering differs
        setExtraTasks([]);
        setCurrentPage(1);
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

    return (
        <TableContainer component={Paper} variant="outlined">
            <Table>
                <TableHead>
                    <TableRow
                        sx={{
                            "& .MuiTableCell-head": {
                                fontWeight: 600,
                                bgcolor: "action.hover",
                                py: 1.5,
                            },
                        }}
                    >
                        <TableCell sx={{ width: 70 }}>
                            {renderSortLabel("task_number", "#")}
                        </TableCell>
                        <TableCell>
                            {renderSortLabel("title", "Title")}
                        </TableCell>
                        <TableCell sx={{ width: 130 }}>
                            {renderSortLabel("column", "Status")}
                        </TableCell>
                        <TableCell sx={{ width: 120 }}>
                            {renderSortLabel("priority", "Priority")}
                        </TableCell>
                        <TableCell sx={{ width: 130 }}>
                            {renderSortLabel("due_date", "Due Date")}
                        </TableCell>
                        <TableCell sx={{ width: 150 }}>
                            {renderSortLabel("assignees", "Assignees")}
                        </TableCell>
                        <TableCell sx={{ width: 160 }}>Labels</TableCell>
                        {showGitlab && (
                            <TableCell sx={{ width: 110 }}>GitLab</TableCell>
                        )}
                    </TableRow>
                </TableHead>
                <TableBody>
                    {sortedTasks.length === 0 && !loading ? (
                        <TableRow>
                            <TableCell
                                colSpan={showGitlab ? 8 : 7}
                                align="center"
                                sx={{ py: 6 }}
                            >
                                <Typography color="text.secondary">
                                    No tasks found
                                </Typography>
                            </TableCell>
                        </TableRow>
                    ) : (
                        sortedTasks.map((task) => {
                            const col = columnMap[task.column_id];
                            return (
                                <TableRow
                                    key={task.id}
                                    hover
                                    tabIndex={0}
                                    aria-label={`Task ${task.task_number ? "#" + task.task_number + " " : ""}${task.title}`}
                                    sx={{
                                        cursor: "pointer",
                                        "& .MuiTableCell-root": { py: 1.5 },
                                    }}
                                    onClick={() => onTaskClick(task)}
                                    onKeyDown={(e) => {
                                        if (
                                            e.key === "Enter" ||
                                            e.key === " "
                                        ) {
                                            e.preventDefault();
                                            onTaskClick(task);
                                        }
                                    }}
                                >
                                    <TableCell>
                                        <Typography
                                            variant="body2"
                                            color="text.secondary"
                                            sx={{ fontFamily: "monospace" }}
                                        >
                                            #{task.task_number}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Typography
                                            variant="body2"
                                            fontWeight={500}
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
                                        {col && (
                                            <Chip
                                                label={col.name}
                                                size="small"
                                                sx={{
                                                    bgcolor: col.color,
                                                    color: getContrastText(
                                                        col.color,
                                                    ),
                                                    height: 26,
                                                    fontSize: "0.75rem",
                                                    fontWeight: 500,
                                                }}
                                            />
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <Box
                                            sx={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 1,
                                            }}
                                        >
                                            <Box
                                                sx={{
                                                    width: 10,
                                                    height: 10,
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
                                                    flexShrink: 0,
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
                                                        year: "numeric",
                                                    },
                                                )}
                                            </Typography>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {task.assignees &&
                                            task.assignees.length > 0 && (
                                                <AvatarGroup
                                                    max={3}
                                                    sx={{
                                                        justifyContent:
                                                            "flex-end",
                                                        "& .MuiAvatar-root": {
                                                            width: 28,
                                                            height: 28,
                                                            fontSize: "0.75rem",
                                                        },
                                                    }}
                                                >
                                                    {task.assignees.map((u) => (
                                                        <Avatar
                                                            key={u.id}
                                                            alt={u.name}
                                                            src={u.avatar_url}
                                                        >
                                                            {u.name.charAt(0)}
                                                        </Avatar>
                                                    ))}
                                                </AvatarGroup>
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
                                            {(task.labels ?? []).map(
                                                (label) => (
                                                    <Chip
                                                        key={label.id}
                                                        label={label.name}
                                                        size="small"
                                                        sx={{
                                                            height: 22,
                                                            fontSize: "0.7rem",
                                                            fontWeight: 600,
                                                            bgcolor:
                                                                label.color,
                                                            color: getContrastText(
                                                                label.color,
                                                            ),
                                                        }}
                                                    />
                                                ),
                                            )}
                                        </Box>
                                    </TableCell>
                                    {showGitlab && (
                                        <TableCell
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <Box
                                                sx={{
                                                    display: "flex",
                                                    gap: 0.5,
                                                    flexWrap: "wrap",
                                                }}
                                            >
                                                {(task.gitlab_refs ?? [])
                                                    .filter(
                                                        (r) =>
                                                            r.ref_type ===
                                                            "merge_request",
                                                    )
                                                    .map((ref) => (
                                                        <MergeRequestChip
                                                            key={ref.id}
                                                            gitlabRef={ref}
                                                        />
                                                    ))}
                                            </Box>
                                        </TableCell>
                                    )}
                                </TableRow>
                            );
                        })
                    )}

                    {/* Sentinel row for IntersectionObserver */}
                    {hasMore && (
                        <TableRow ref={sentinelRef}>
                            <TableCell
                                colSpan={showGitlab ? 8 : 7}
                                align="center"
                                sx={{ py: 3, border: 0 }}
                            >
                                {loading && (
                                    <Box
                                        sx={{
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            gap: 1,
                                        }}
                                    >
                                        <CircularProgress size={20} />
                                        <Typography
                                            variant="body2"
                                            color="text.secondary"
                                        >
                                            Loading more tasks...
                                        </Typography>
                                    </Box>
                                )}
                            </TableCell>
                        </TableRow>
                    )}

                    {/* Task count summary */}
                    {!hasMore && sortedTasks.length > 0 && (
                        <TableRow>
                            <TableCell
                                colSpan={showGitlab ? 8 : 7}
                                align="center"
                                sx={{ py: 2, border: 0 }}
                            >
                                <Typography
                                    variant="caption"
                                    color="text.secondary"
                                >
                                    Showing all {sortedTasks.length} tasks
                                </Typography>
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </TableContainer>
    );
}
