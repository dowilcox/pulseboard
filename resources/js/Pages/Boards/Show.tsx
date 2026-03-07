import FilterBar from '@/Components/Tasks/FilterBar';
import PresenceAvatars from '@/Components/Layout/PresenceAvatars';
import CalendarView from '@/Components/Views/CalendarView';
import KanbanView from '@/Components/Views/KanbanView';
import ListView from '@/Components/Views/ListView';
import TimelineView from '@/Components/Views/TimelineView';
import ViewSwitcher from '@/Components/Views/ViewSwitcher';
import WorkloadView from '@/Components/Views/WorkloadView';
import { useBoardChannel, type BoardEvent } from '@/hooks/useBoardChannel';
import { usePresence } from '@/hooks/usePresence';
import PageHeader from '@/Components/Layout/PageHeader';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import type { Board, BoardViewMode, Column, GitlabProject, Label, PageProps, Task, Team, User } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import SettingsIcon from '@mui/icons-material/Settings';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import { useCallback, useEffect, useState } from 'react';

interface Props {
    board: Board;
    team: Team;
    members: User[];
    gitlabProjects?: GitlabProject[];
    initialTasksPerColumn?: number;
}

export default function BoardsShow({ board, team, members, gitlabProjects = [], initialTasksPerColumn = 20 }: Props) {
    const { auth } = usePage<PageProps>().props;
    const columns = board.columns ?? [];
    const [teamLabels, setTeamLabels] = useState<Label[]>([]);
    const [taskFilter, setTaskFilter] = useState<(task: Task) => boolean>(() => () => true);
    const [viewMode, setViewMode] = useState<BoardViewMode>('kanban');

    // Real-time: presence
    const presenceUsers = usePresence(board.id);

    // Real-time: board channel listener
    const handleBoardEvent = useCallback((event: BoardEvent) => {
        switch (event.action) {
            case 'created':
            case 'task.deleted':
                router.reload();
                break;

            case 'moved':
            case 'task.reordered':
                router.reload();
                break;

            case 'field_changed':
            case 'assigned':
            case 'unassigned':
            case 'labels_changed':
                if (event.data.task_id) {
                    router.reload();
                }
                break;

            case 'commented':
            case 'comment.updated':
            case 'comment.deleted':
            case 'attachment_added':
            case 'attachment_removed':
                break;

            case 'gitlab_branch_created':
            case 'gitlab_mr_created':
            case 'gitlab_mr_merged':
            case 'gitlab_mr_closed':
                router.reload();
                break;

            default:
                router.reload();
                break;
        }
    }, []);

    useBoardChannel(board.id, handleBoardEvent);

    useEffect(() => {
        fetch(route('labels.index', team.id), {
            headers: { Accept: 'application/json' },
        })
            .then((res) => res.json())
            .then((data: Label[]) => setTeamLabels(data))
            .catch(() => {});
    }, [team.id]);

    const handleTaskClick = (task: Task) => {
        router.visit(route('tasks.show', [team.id, board.id, task.id]));
    };

    const renderView = () => {
        switch (viewMode) {
            case 'kanban':
                return (
                    <KanbanView
                        columns={columns}
                        board={board}
                        team={team}
                        filterFn={taskFilter}
                        onTaskClick={handleTaskClick}
                        initialTasksPerColumn={initialTasksPerColumn}
                    />
                );
            case 'list':
                return (
                    <ListView
                        columns={columns}
                        board={board}
                        team={team}
                        filterFn={taskFilter}
                        onTaskClick={handleTaskClick}
                    />
                );
            case 'calendar':
                return (
                    <CalendarView
                        columns={columns}
                        filterFn={taskFilter}
                        onTaskClick={handleTaskClick}
                    />
                );
            case 'timeline':
                return (
                    <TimelineView
                        columns={columns}
                        filterFn={taskFilter}
                        onTaskClick={handleTaskClick}
                    />
                );
            case 'workload':
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
            activeBoardId={board.id}
            header={
                <PageHeader
                    title={board.name}
                    breadcrumbs={[
                        { label: 'Teams', href: route('teams.index') },
                        { label: team.name, href: route('teams.show', team.id) },
                    ]}
                    actions={
                        <>
                            <ViewSwitcher value={viewMode} onChange={setViewMode} />
                            <PresenceAvatars users={presenceUsers} currentUserId={auth.user.id} />
                            <Tooltip title="Board Settings">
                                <IconButton
                                    onClick={() =>
                                        router.get(route('teams.boards.settings', [team.id, board.id]))
                                    }
                                >
                                    <SettingsIcon />
                                </IconButton>
                            </Tooltip>
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
                    onFilterChange={(fn) => setTaskFilter(() => fn)}
                />
            )}

            {renderView()}
        </AuthenticatedLayout>
    );
}
