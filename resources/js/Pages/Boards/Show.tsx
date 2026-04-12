import FilterBar from "@/Components/Tasks/FilterBar";
import PresenceAvatars from "@/Components/Layout/PresenceAvatars";
import KanbanView from "@/Components/Views/KanbanView";
import ListView from "@/Components/Views/ListView";
import ViewSwitcher from "@/Components/Views/ViewSwitcher";
import WorkloadView from "@/Components/Views/WorkloadView";
import { useBoardChannel, type BoardEvent } from "@/hooks/useBoardChannel";
import { usePresence } from "@/hooks/usePresence";
import PageHeader from "@/Components/Layout/PageHeader";
import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import type {
    Board,
    BoardViewMode,
    Column,
    FigmaConnection,
    GitlabProject,
    Label,
    PageProps,
    Task,
    TaskTemplate,
    Team,
    User,
} from "@/types";
import { Head, router, usePage } from "@inertiajs/react";
import SettingsIcon from "@mui/icons-material/Settings";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import { useCallback, useState } from "react";

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
}

export default function BoardsShow({
    board,
    team,
    sidebarBoards = [],
    members,
    labels: teamLabels = [],
    gitlabProjects = [],
    taskTemplates = [],
    initialTasksPerColumn = 20,
}: Props) {
    const { auth, teams: sharedTeams } = usePage<PageProps>().props;
    const userRole = sharedTeams?.find((t) => t.id === team.id)?.pivot?.role;
    const canManage = userRole === "owner" || userRole === "admin";
    const columns = board.columns ?? [];
    const [taskFilter, setTaskFilter] = useState<(task: Task) => boolean>(
        () => () => true,
    );
    const [viewMode, setViewMode] = useState<BoardViewMode>("kanban");

    // Real-time: presence
    const presenceUsers = usePresence(board.id);

    // Real-time: board channel listener
    const handleBoardEvent = useCallback(
        (event: BoardEvent) => {
            switch (event.action) {
                // Board deleted — redirect to team page
                case "board.deleted":
                    router.visit(route("teams.show", [team.slug]));
                    break;

                // These don't affect the board view
                case "commented":
                case "comment.created":
                case "comment.replied":
                case "comment.updated":
                case "comment.deleted":
                case "attachment_added":
                case "attachment_removed":
                    break;

                // Everything else: partial reload of board data only
                default:
                    router.reload({ only: ["board"] });
                    break;
            }
        },
        [team.slug],
    );

    useBoardChannel(board.id, handleBoardEvent);

    const handleTaskClick = (task: Task) => {
        router.visit(route("tasks.show", [team.slug, board.slug, task.slug]));
    };

    const renderView = () => {
        switch (viewMode) {
            case "kanban":
                return (
                    <KanbanView
                        columns={columns}
                        board={board}
                        team={team}
                        filterFn={taskFilter}
                        onTaskClick={handleTaskClick}
                        taskTemplates={taskTemplates}
                        initialTasksPerColumn={initialTasksPerColumn}
                    />
                );
            case "list":
                return (
                    <ListView
                        columns={columns}
                        board={board}
                        team={team}
                        filterFn={taskFilter}
                        onTaskClick={handleTaskClick}
                        showGitlab={gitlabProjects.length > 0}
                    />
                );
            case "workload":
                return (
                    <WorkloadView
                        columns={columns}
                        members={members}
                        filterFn={taskFilter}
                        onTaskClick={handleTaskClick}
                    />
                );
        }
    };

    return (
        <AuthenticatedLayout
            currentTeam={team}
            sidebarBoards={sidebarBoards}
            activeBoardId={board.id}
            header={
                <PageHeader
                    title={board.name}
                    breadcrumbs={[
                        { label: "Teams", href: route("teams.index") },
                        {
                            label: team.name,
                            href: route("teams.show", team.slug),
                        },
                    ]}
                    actions={
                        <>
                            <ViewSwitcher
                                value={viewMode}
                                onChange={setViewMode}
                            />
                            <PresenceAvatars
                                users={presenceUsers}
                                currentUserId={auth.user.id}
                            />
                            {canManage && (
                                <Tooltip title="Board Settings">
                                    <IconButton
                                        onClick={() =>
                                            router.get(
                                                route("teams.boards.settings", [
                                                    team.slug,
                                                    board.slug,
                                                ]),
                                            )
                                        }
                                    >
                                        <SettingsIcon />
                                    </IconButton>
                                </Tooltip>
                            )}
                        </>
                    }
                />
            }
        >
            <Head title={`${board.name} - ${team.name}`} />

            {/* Filter bar */}
            {columns.length > 0 && (
                <FilterBar
                    members={members}
                    labels={teamLabels}
                    teamId={team.slug}
                    boardId={board.slug}
                    onFilterChange={(fn) => setTaskFilter(() => fn)}
                />
            )}

            {renderView()}
        </AuthenticatedLayout>
    );
}
