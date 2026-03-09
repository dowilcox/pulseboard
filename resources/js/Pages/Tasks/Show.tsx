import RichTextEditor from "@/Components/Common/RichTextEditor";
import GitlabSection from "@/Components/Gitlab/GitlabSection";
import ActivityFeed from "@/Components/Tasks/ActivityFeed";
import AttachmentList from "@/Components/Tasks/AttachmentList";
import ChecklistEditor from "@/Components/Tasks/ChecklistEditor";
import LinkEditor from "@/Components/Tasks/LinkEditor";
import SubtaskList from "@/Components/Tasks/SubtaskList";
import TaskSidebar from "@/Components/Tasks/TaskSidebar";
import { useBoardChannel, type BoardEvent } from "@/hooks/useBoardChannel";
import PageHeader from "@/Components/Layout/PageHeader";
import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import type {
    Board,
    Checklist,
    GitlabProject,
    Label,
    PageProps,
    Task,
    TaskLink,
    TaskSummary,
    Team,
    User,
} from "@/types";
import { Head, Link as InertiaLink, router, usePage } from "@inertiajs/react";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Link from "@mui/material/Link";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useCallback, useEffect, useRef, useState } from "react";

interface Props {
    task: Task;
    team: {
        id: string;
        name: string;
        slug: string;
        members?: User[];
    };
    board: Board;
    members: User[];
    labels: Label[];
    gitlabProjects: GitlabProject[];
    boardTasks: TaskSummary[];
    teamBoards: Board[];
}

export default function TasksShow({
    task,
    team,
    board,
    members,
    labels,
    gitlabProjects,
    boardTasks,
    teamBoards,
}: Props) {
    const { auth } = usePage<PageProps>().props;

    // Local state for debounced fields
    const [title, setTitle] = useState(task.title);
    const [description, setDescription] = useState(task.description ?? "");
    const [checklists, setChecklists] = useState<Checklist[]>(
        task.checklists ?? [],
    );
    const [links, setLinks] = useState<TaskLink[]>(task.links ?? []);

    const titleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const descTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const checklistTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
        null,
    );
    const linksTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Clean up pending timeouts on unmount
    useEffect(() => {
        return () => {
            if (titleTimeoutRef.current) clearTimeout(titleTimeoutRef.current);
            if (descTimeoutRef.current) clearTimeout(descTimeoutRef.current);
            if (checklistTimeoutRef.current)
                clearTimeout(checklistTimeoutRef.current);
            if (linksTimeoutRef.current) clearTimeout(linksTimeoutRef.current);
        };
    }, []);

    // Real-time: board channel listener
    const handleBoardEvent = useCallback(
        (event: BoardEvent) => {
            const eventTaskId = event.data.task_id;
            if (eventTaskId && eventTaskId !== task.id) return;
            router.reload();
        },
        [task.id],
    );
    useBoardChannel(board.id, handleBoardEvent);

    // Debounced save helpers
    const saveField = useCallback(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Inertia's RequestPayload doesn't accept interfaces without index signatures
        (data: Record<string, any>) => {
            router.put(
                route("tasks.update", [team.id, board.id, task.id]),
                data,
                {
                    preserveScroll: true,
                    preserveState: true,
                },
            );
        },
        [team.id, board.id, task.id],
    );

    const handleTitleChange = (newTitle: string) => {
        setTitle(newTitle);
        if (!newTitle.trim()) return;
        if (titleTimeoutRef.current) clearTimeout(titleTimeoutRef.current);
        titleTimeoutRef.current = setTimeout(
            () => saveField({ title: newTitle }),
            600,
        );
    };

    const handleDescriptionChange = (html: string) => {
        setDescription(html);
        if (descTimeoutRef.current) clearTimeout(descTimeoutRef.current);
        descTimeoutRef.current = setTimeout(
            () => saveField({ description: html || null }),
            800,
        );
    };

    const handleChecklistsChange = (newChecklists: Checklist[]) => {
        setChecklists(newChecklists);
        if (checklistTimeoutRef.current)
            clearTimeout(checklistTimeoutRef.current);
        checklistTimeoutRef.current = setTimeout(
            () => saveField({ checklists: newChecklists }),
            800,
        );
    };

    const handleLinksChange = (newLinks: TaskLink[]) => {
        setLinks(newLinks);
        if (linksTimeoutRef.current) clearTimeout(linksTimeoutRef.current);
        linksTimeoutRef.current = setTimeout(
            () => saveField({ links: newLinks }),
            800,
        );
    };

    const handleSubtaskClick = (subtask: Task) => {
        router.visit(route("tasks.show", [team.id, board.id, subtask.id]));
    };

    const isCompleted =
        task.completed_at !== null && task.completed_at !== undefined;
    const taskNumber = task.task_number ? `#${task.task_number}` : "";

    return (
        <AuthenticatedLayout
            currentTeam={team as Team}
            activeBoardId={board.id}
            header={
                <PageHeader
                    title={
                        taskNumber ? `${taskNumber} ${task.title}` : task.title
                    }
                    breadcrumbs={[
                        { label: "Teams", href: route("teams.index") },
                        {
                            label: team.name,
                            href: route("teams.show", team.id),
                        },
                        {
                            label: board.name,
                            href: route("teams.boards.show", [
                                team.id,
                                board.id,
                            ]),
                        },
                    ]}
                />
            }
        >
            <Head title={`${taskNumber} ${task.title} - ${board.name}`} />

            <Box
                sx={{
                    display: "flex",
                    gap: 3,
                    flexDirection: { xs: "column", md: "row" },
                }}
            >
                {/* Left — main content */}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    {/* Task number + title */}
                    <Box sx={{ mb: 2 }}>
                        {taskNumber && (
                            <Typography
                                variant="caption"
                                color="text.secondary"
                                fontWeight={600}
                            >
                                {taskNumber}
                            </Typography>
                        )}
                        <TextField
                            fullWidth
                            variant="standard"
                            value={title}
                            onChange={(e) => handleTitleChange(e.target.value)}
                            slotProps={{
                                input: {
                                    sx: {
                                        fontSize: "1.5rem",
                                        fontWeight: 600,
                                        textDecoration: isCompleted
                                            ? "line-through"
                                            : "none",
                                    },
                                    disableUnderline: true,
                                },
                            }}
                            aria-label="Task title"
                        />

                        {/* Parent task breadcrumb */}
                        {task.parent_task && (
                            <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{ mt: 0.5 }}
                            >
                                Subtask of{" "}
                                <Link
                                    component={InertiaLink}
                                    href={route("tasks.show", [
                                        team.id,
                                        board.id,
                                        task.parent_task.id,
                                    ])}
                                    underline="hover"
                                >
                                    {task.parent_task.task_number
                                        ? `#${task.parent_task.task_number}`
                                        : ""}{" "}
                                    {task.parent_task.title}
                                </Link>
                            </Typography>
                        )}
                    </Box>

                    <Divider sx={{ mb: 3 }} />

                    {/* Description */}
                    <Box sx={{ mb: 3 }}>
                        <Typography
                            variant="subtitle2"
                            fontWeight={600}
                            sx={{ mb: 1 }}
                        >
                            Description
                        </Typography>
                        <RichTextEditor
                            content={description}
                            onChange={handleDescriptionChange}
                            placeholder="Add a description..."
                            uploadImageUrl={route("tasks.images.store", [
                                team.id,
                                board.id,
                                task.id,
                            ])}
                            minHeight={150}
                        />
                    </Box>

                    {/* Checklists */}
                    <Box sx={{ mb: 3 }}>
                        <Typography
                            variant="subtitle2"
                            fontWeight={600}
                            sx={{ mb: 1 }}
                        >
                            Checklists
                        </Typography>
                        <ChecklistEditor
                            checklists={checklists}
                            onChange={handleChecklistsChange}
                        />
                    </Box>

                    {/* Related Links */}
                    <Box sx={{ mb: 3 }}>
                        <Typography
                            variant="subtitle2"
                            fontWeight={600}
                            sx={{ mb: 1 }}
                        >
                            Related Links
                        </Typography>
                        <LinkEditor
                            links={links}
                            onChange={handleLinksChange}
                        />
                    </Box>

                    {/* Subtasks */}
                    <Box sx={{ mb: 3 }}>
                        <Typography
                            variant="subtitle2"
                            fontWeight={600}
                            sx={{ mb: 1 }}
                        >
                            Subtasks
                        </Typography>
                        <SubtaskList
                            task={task}
                            teamId={team.id}
                            boardId={board.id}
                            columnId={task.column_id}
                            onSubtaskClick={handleSubtaskClick}
                        />
                    </Box>

                    {/* Attachments */}
                    <Box sx={{ mb: 3 }}>
                        <Typography
                            variant="subtitle2"
                            fontWeight={600}
                            sx={{ mb: 1 }}
                        >
                            Attachments
                        </Typography>
                        <AttachmentList
                            attachments={task.attachments ?? []}
                            teamId={team.id}
                            boardId={board.id}
                            taskId={task.id}
                        />
                    </Box>

                    {/* GitLab */}
                    {gitlabProjects.length > 0 && (
                        <Box sx={{ mb: 3 }}>
                            <GitlabSection
                                task={task}
                                teamId={team.id}
                                boardId={board.id}
                                gitlabProjects={gitlabProjects}
                            />
                        </Box>
                    )}

                    <Divider sx={{ mb: 2 }} />

                    {/* Activity + Comments */}
                    <Box>
                        <Typography
                            variant="subtitle2"
                            fontWeight={600}
                            sx={{ mb: 1 }}
                        >
                            Activity
                        </Typography>
                        <ActivityFeed
                            comments={task.comments ?? []}
                            activities={task.activities ?? []}
                            teamId={team.id}
                            boardId={board.id}
                            taskId={task.id}
                            currentUserId={auth.user.id}
                            uploadImageUrl={route("tasks.images.store", [
                                team.id,
                                board.id,
                                task.id,
                            ])}
                        />
                    </Box>
                </Box>

                {/* Right — sidebar */}
                <Box
                    sx={{
                        width: { xs: "100%", md: 280 },
                        flexShrink: 0,
                        position: { md: "sticky" },
                        top: { md: 80 },
                        alignSelf: "flex-start",
                    }}
                >
                    <TaskSidebar
                        task={task}
                        team={team}
                        board={board}
                        members={members}
                        labels={labels}
                        boardTasks={boardTasks}
                        teamBoards={teamBoards}
                    />
                </Box>
            </Box>
        </AuthenticatedLayout>
    );
}
