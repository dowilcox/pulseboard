import FilterBar from "@/Components/Tasks/FilterBar";
import NewTaskDialog from "@/Components/Tasks/NewTaskDialog";
import PresenceAvatars from "@/Components/Layout/PresenceAvatars";
import KanbanView from "@/Components/Views/KanbanView";
import ListView from "@/Components/Views/ListView";
import ViewSwitcher from "@/Components/Views/ViewSwitcher";
import WorkloadView from "@/Components/Views/WorkloadView";
import { useAllBoardTasks } from "@/hooks/useAllBoardTasks";
import { useBoardChannel, type BoardEvent } from "@/hooks/useBoardChannel";
import { usePresence } from "@/hooks/usePresence";
import { useWebSocket } from "@/Contexts/WebSocketContext";
import PageHeader from "@/Components/Layout/PageHeader";
import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import type {
    Board,
    BoardViewMode,
    FigmaConnection,
    GitlabProject,
    Label,
    PageProps,
    SavedFilter,
    Task,
    TaskTemplate,
    Team,
    User,
} from "@/types";
import {
    buildBoardSearch,
    createTaskFilter,
    EMPTY_FILTERS,
    getStoredBoardView,
    hasActiveFilters,
    normalizeFilterConfig,
    resolveBoardState,
    storeBoardView,
    withFilters,
    type BoardFilters,
    type BoardState,
} from "@/utils/boardFilters";
import { Head, Link, router, usePage } from "@inertiajs/react";
import AddIcon from "@mui/icons-material/Add";
import UnarchiveOutlinedIcon from "@mui/icons-material/UnarchiveOutlined";
import Alert from "@mui/material/Alert";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import {
    type ReactElement,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import LayoutHeader from "@/Components/Layout/LayoutHeader";
import { harbor } from "@/theme/harbor";

interface Props {
    board: Board;
    team: Team;
    sidebarBoards?: Board[];
    members: User[];
    labels?: Label[];
    gitlabProjects?: GitlabProject[];
    figmaConnections?: FigmaConnection[];
    taskTemplates?: TaskTemplate[];
    initialTasksPerColumn?: number;
    /** The viewer's saved filters for this board. */
    savedFilters?: SavedFilter[];
    can?: { update: boolean };
}

const NO_SAVED_FILTERS: SavedFilter[] = [];

// Back/forward restores the board from Inertia's history cache, which can be
// stale (e.g. the task just edited has since moved column). Remember that the
// last navigation was a history restore so the board can refresh its data;
// view and filters still come from the restored URL.
let restoredFromHistory = false;
if (typeof window !== "undefined") {
    window.addEventListener("popstate", () => {
        restoredFromHistory = true;
    });
    router.on("start", () => {
        restoredFromHistory = false;
    });
}

export default function BoardsShow({
    board,
    team,
    members,
    labels: teamLabels = [],
    gitlabProjects = [],
    taskTemplates = [],
    initialTasksPerColumn = 20,
    savedFilters: initialSavedFilters = NO_SAVED_FILTERS,
    can,
}: Props) {
    const { auth } = usePage<PageProps>().props;
    const canManage = can?.update ?? false;
    const columns = useMemo(() => board.columns ?? [], [board.columns]);
    const [newTaskOpen, setNewTaskOpen] = useState(false);

    // ── View + filters (the URL is the source of truth) ─────────────────
    const [savedFilters, setSavedFilters] =
        useState<SavedFilter[]>(initialSavedFilters);
    useEffect(
        () => setSavedFilters(initialSavedFilters),
        [initialSavedFilters],
    );

    // Read once on mount: Back/forward remounts the page with the URL of
    // that history entry, so this restores the board exactly.
    const [boardState, setBoardState] = useState<BoardState>(
        () =>
            resolveBoardState(
                window.location.search,
                initialSavedFilters,
                getStoredBoardView(board.id),
            ).state,
    );
    const { view, filters } = boardState;

    // Mirror state into the URL without a server round trip. router.replace
    // updates Inertia's page + history entry in place (scroll and component
    // state preserved), so Back from a task lands on this exact URL.
    // Inertia applies replaces asynchronously (in order), so compare with
    // the last URL requested rather than the possibly-lagging location.
    const requestedSearchRef = useRef(window.location.search);
    useEffect(() => {
        const search = buildBoardSearch(requestedSearchRef.current, boardState);
        if (search === requestedSearchRef.current) return;
        requestedSearchRef.current = search;
        router.replace({
            url: `${window.location.pathname}${search}${window.location.hash}`,
            preserveScroll: true,
            preserveState: true,
        });
    }, [boardState]);

    useEffect(() => storeBoardView(board.id, view), [board.id, view]);

    useEffect(() => {
        if (!restoredFromHistory) return;
        restoredFromHistory = false;
        router.reload({ only: ["board"] });
    }, []);

    const setView = useCallback(
        (next: BoardViewMode) => setBoardState((s) => ({ ...s, view: next })),
        [],
    );

    const handleFiltersChange = useCallback(
        (next: BoardFilters) =>
            setBoardState((s) => withFilters(s, next, savedFilters)),
        [savedFilters],
    );

    const clearFilters = useCallback(
        () =>
            setBoardState((s) => ({
                ...s,
                filters: EMPTY_FILTERS,
                savedFilterId: null,
                cleared: true,
            })),
        [],
    );

    const applySavedFilter = useCallback((savedFilter: SavedFilter) => {
        const next = normalizeFilterConfig(savedFilter.filter_config);
        const active = hasActiveFilters(next);
        setBoardState((s) => ({
            ...s,
            filters: next,
            savedFilterId: active ? savedFilter.id : null,
            cleared: !active,
        }));
    }, []);

    const handleSavedFiltersChange = useCallback((next: SavedFilter[]) => {
        setSavedFilters(next);
        setBoardState((s) =>
            s.savedFilterId && !next.some((f) => f.id === s.savedFilterId)
                ? { ...s, savedFilterId: null }
                : s,
        );
    }, []);

    const showEveryone = useCallback(
        () =>
            setBoardState((s) =>
                withFilters(s, { ...s.filters, assignees: [] }, savedFilters),
            ),
        [savedFilters],
    );

    const filtersActive = hasActiveFilters(filters);
    const filterFn = useMemo(() => createTaskFilter(filters), [filters]);

    // ── Every task, for List / Workload / filtered Kanban ───────────────
    const allTasks = useAllBoardTasks({
        teamSlug: team.slug,
        boardSlug: board.slug,
        enabled: view !== "kanban" || filtersActive,
        reloadKey: board,
    });

    const loadedTasks = useMemo(() => {
        const tasks: Task[] = [];
        for (const col of columns) tasks.push(...(col.tasks ?? []));
        return tasks;
    }, [columns]);

    const totalTaskCount = columns.reduce(
        (sum, col) => sum + (col.tasks_count ?? col.tasks?.length ?? 0),
        0,
    );
    // Before the full list arrives, the first page per column may already
    // be everything.
    const everyTaskLoaded =
        allTasks.data !== null || loadedTasks.length >= totalTaskCount;
    const viewTasks = allTasks.data?.tasks ?? loadedTasks;

    const taskHref = useCallback(
        (task: Task) =>
            route("tasks.show", [team.slug, board.slug, task.slug ?? task.id]),
        [team.slug, board.slug],
    );

    // ── Real-time ───────────────────────────────────────────────────────
    const presenceUsers = usePresence(board.id);
    const { reconnectVersion } = useWebSocket();

    const handleBoardEvent = useCallback(
        (event: BoardEvent) => {
            switch (event.action) {
                // Board deleted — redirect to team page
                case "board.deleted":
                    router.visit(route("teams.show", [team.slug]));
                    break;

                // These don't affect the board view
                case "comment.updated":
                case "attachment_added":
                case "attachment_removed":
                    break;

                // Everything else (comment counts included): partial reload
                // of board data only
                default:
                    router.reload({ only: ["board"] });
                    break;
            }
        },
        [team.slug],
    );

    useBoardChannel(board.id, handleBoardEvent);

    useEffect(() => {
        if (reconnectVersion === 0) return;

        router.reload({ only: ["board"] });
    }, [reconnectVersion]);

    const renderView = () => {
        switch (view) {
            case "kanban":
                return (
                    <KanbanView
                        columns={columns}
                        board={board}
                        team={team}
                        filterFn={filterFn}
                        filtersActive={filtersActive}
                        allTasks={allTasks.fresh ? allTasks.data!.tasks : null}
                        taskTemplates={taskTemplates}
                        initialTasksPerColumn={initialTasksPerColumn}
                        canManage={canManage}
                    />
                );
            case "list":
                return (
                    <ListView
                        columns={columns}
                        board={board}
                        team={team}
                        tasks={viewTasks}
                        complete={everyTaskLoaded}
                        loading={allTasks.loading}
                        truncated={allTasks.data?.truncated ?? false}
                        filterFn={filterFn}
                        filtersActive={filtersActive}
                        onClearFilters={clearFilters}
                        showGitlab={gitlabProjects.length > 0}
                    />
                );
            case "workload":
                return (
                    <WorkloadView
                        columns={columns}
                        members={members}
                        tasks={viewTasks}
                        complete={everyTaskLoaded}
                        loading={allTasks.loading}
                        filterFn={filterFn}
                        filtersActive={filtersActive}
                        assigneeIds={filters.assignees}
                        otherFiltersActive={hasActiveFilters({
                            ...filters,
                            assignees: [],
                        })}
                        onShowEveryone={showEveryone}
                        taskHref={taskHref}
                    />
                );
        }
    };

    return (
        <>
            <Head title={`${board.name} - ${team.name}`} />
            <LayoutHeader>
                <PageHeader
                    title={board.name}
                    breadcrumbs={[
                        {
                            label: team.name,
                            href: route("teams.show", team.slug),
                            teamSwitcher: true,
                        },
                    ]}
                    actions={
                        <>
                            <PresenceAvatars
                                users={presenceUsers}
                                currentUserId={auth.user.id}
                            />
                            <ViewSwitcher value={view} onChange={setView} />
                            {columns.length > 0 && (
                                <Tooltip
                                    title="New task"
                                    // The header row is shared with the title
                                    // and quick switcher, so between md and xl
                                    // the button is icon-only; the tooltip
                                    // names it there.
                                    slotProps={{
                                        popper: {
                                            sx: {
                                                display: {
                                                    xs: "none",
                                                    md: "block",
                                                    xl: "none",
                                                },
                                            },
                                        },
                                    }}
                                >
                                    <Button
                                        variant="contained"
                                        onClick={() => setNewTaskOpen(true)}
                                        aria-label="New task"
                                        startIcon={<AddIcon />}
                                        sx={{
                                            height: 34,
                                            whiteSpace: "nowrap",
                                            minWidth: { md: 40, xl: 64 },
                                            px: { md: 1, xl: 2 },
                                            "& .MuiButton-startIcon": {
                                                mr: { md: 0, xl: 1 },
                                                ml: { md: 0, xl: -0.5 },
                                            },
                                        }}
                                    >
                                        <Box
                                            component="span"
                                            sx={{
                                                display: {
                                                    xs: "inline",
                                                    md: "none",
                                                    xl: "inline",
                                                },
                                            }}
                                        >
                                            New task
                                        </Box>
                                    </Button>
                                </Tooltip>
                            )}
                            {canManage && (
                                <Tooltip title="Board settings">
                                    <IconButton
                                        component={Link}
                                        href={route("teams.boards.settings", [
                                            team.slug,
                                            board.slug,
                                        ])}
                                        aria-label="Board settings"
                                        sx={{ color: harbor.sub }}
                                    >
                                        <SettingsOutlinedIcon />
                                    </IconButton>
                                </Tooltip>
                            )}
                        </>
                    }
                />
            </LayoutHeader>

            {board.is_archived && (
                <Alert
                    severity="info"
                    sx={{ mb: 2 }}
                    action={
                        canManage ? (
                            <Button
                                color="inherit"
                                size="small"
                                startIcon={<UnarchiveOutlinedIcon />}
                                onClick={() =>
                                    router.post(
                                        route("teams.boards.unarchive", [
                                            team.slug,
                                            board.slug,
                                        ]),
                                    )
                                }
                            >
                                Restore board
                            </Button>
                        ) : undefined
                    }
                >
                    This board is archived. It&apos;s hidden from the sidebar
                    and the team page
                    {canManage
                        ? ""
                        : " — ask a team owner or admin to restore it"}
                    .
                </Alert>
            )}

            {columns.length > 0 && (
                <FilterBar
                    members={members}
                    labels={teamLabels}
                    columns={columns}
                    filters={filters}
                    onFiltersChange={handleFiltersChange}
                    onClearFilters={clearFilters}
                    savedFilters={savedFilters}
                    activeSavedFilterId={boardState.savedFilterId}
                    onApplySavedFilter={applySavedFilter}
                    onSavedFiltersChange={handleSavedFiltersChange}
                    teamSlug={team.slug}
                    boardSlug={board.slug}
                    currentUserId={auth.user.id}
                />
            )}

            {renderView()}

            <NewTaskDialog
                open={newTaskOpen}
                onClose={() => setNewTaskOpen(false)}
                teamSlug={team.slug}
                boardSlug={board.slug}
                columns={columns}
            />
        </>
    );
}

BoardsShow.layout = (page: ReactElement<Props>) => (
    <AuthenticatedLayout
        currentTeam={page.props.team}
        sidebarBoards={page.props.sidebarBoards ?? []}
        activeBoardId={page.props.board.id}
    >
        {page}
    </AuthenticatedLayout>
);
