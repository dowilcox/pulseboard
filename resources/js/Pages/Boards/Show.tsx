import FilterBar from '@/Components/Tasks/FilterBar';
import PresenceAvatars from '@/Components/Layout/PresenceAvatars';
import TaskDetailPanel from '@/Components/Tasks/TaskDetailPanel';
import CalendarView from '@/Components/Views/CalendarView';
import KanbanView from '@/Components/Views/KanbanView';
import ListView from '@/Components/Views/ListView';
import TimelineView from '@/Components/Views/TimelineView';
import ViewSwitcher from '@/Components/Views/ViewSwitcher';
import WorkloadView from '@/Components/Views/WorkloadView';
import { useBoardChannel, type BoardEvent } from '@/hooks/useBoardChannel';
import { usePresence } from '@/hooks/usePresence';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import type { Board, BoardViewMode, Column, GitlabProject, Label, PageProps, Task, Team, User } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import { Link as InertiaLink } from '@inertiajs/react';
import SettingsIcon from '@mui/icons-material/Settings';
import Box from '@mui/material/Box';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import IconButton from '@mui/material/IconButton';
import Link from '@mui/material/Link';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useCallback, useEffect, useRef, useState } from 'react';

interface Props {
    board: Board;
    team: Team;
    teams: Team[];
    boards: Board[];
    members: User[];
    gitlabProjects?: GitlabProject[];
}

export default function BoardsShow({ board, team, teams, boards, members, gitlabProjects = [] }: Props) {
    const { auth } = usePage<PageProps>().props;
    const columns = board.columns ?? [];
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);
    const [panelOpen, setPanelOpen] = useState(false);
    const [teamLabels, setTeamLabels] = useState<Label[]>([]);
    const [taskFilter, setTaskFilter] = useState<(task: Task) => boolean>(() => () => true);
    const [lastBoardEvent, setLastBoardEvent] = useState<BoardEvent | null>(null);
    const [viewMode, setViewMode] = useState<BoardViewMode>('kanban');

    // Real-time: presence
    const presenceUsers = usePresence(board.id);

    // Real-time: board channel listener
    const selectedTaskRef = useRef(selectedTask);
    selectedTaskRef.current = selectedTask;
    const panelOpenRef = useRef(panelOpen);
    panelOpenRef.current = panelOpen;

    const handleBoardEvent = useCallback((event: BoardEvent) => {
        setLastBoardEvent(event);

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
        setSelectedTask(task);
        setPanelOpen(true);
    };

    const handlePanelClose = () => {
        setPanelOpen(false);
        setSelectedTask(null);
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
                    />
                );
            case 'list':
                return (
                    <ListView
                        columns={columns}
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
            teams={teams}
            currentTeam={team}
            boards={boards}
            activeBoardId={board.id}
            header={
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <Box>
                        <Breadcrumbs sx={{ mb: 0.5 }}>
                            <Link
                                component={InertiaLink}
                                href={route('teams.index')}
                                underline="hover"
                                color="text.secondary"
                                variant="body2"
                            >
                                Teams
                            </Link>
                            <Link
                                component={InertiaLink}
                                href={route('teams.show', team.id)}
                                underline="hover"
                                color="text.secondary"
                                variant="body2"
                            >
                                {team.name}
                            </Link>
                            <Typography variant="body2" color="text.primary">
                                {board.name}
                            </Typography>
                        </Breadcrumbs>
                        <Typography variant="h6" component="h2" fontWeight={600}>
                            {board.name}
                        </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
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
                    </Box>
                </Box>
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

            {/* Task detail panel */}
            <TaskDetailPanel
                task={selectedTask}
                open={panelOpen}
                onClose={handlePanelClose}
                teamId={team.id}
                boardId={board.id}
                members={members}
                labels={teamLabels}
                gitlabProjects={gitlabProjects}
                lastBoardEvent={lastBoardEvent}
            />
        </AuthenticatedLayout>
    );
}
