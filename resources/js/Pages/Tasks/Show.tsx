import RichTextDisplay from "@/Components/Common/RichTextDisplay";
import RichTextEditor from "@/Components/Common/RichTextEditor";
import CopyMarkdownButton from "@/Components/Common/CopyMarkdownButton";
import FigmaSection from "@/Components/Figma/FigmaSection";
import GitlabRefsList from "@/Components/Gitlab/GitlabRefsList";
import ActivityFeed from "@/Components/Tasks/ActivityFeed";
import AttachmentList from "@/Components/Tasks/AttachmentList";
import ChecklistEditor from "@/Components/Tasks/ChecklistEditor";
import LinkEditor from "@/Components/Tasks/LinkEditor";
import SubtaskList from "@/Components/Tasks/SubtaskList";
import TaskSidebar from "@/Components/Tasks/TaskSidebar";
import { useWebSocket } from "@/Contexts/WebSocketContext";
import { useBoardChannel, type BoardEvent } from "@/hooks/useBoardChannel";
import PageHeader from "@/Components/Layout/PageHeader";
import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import type {
    Board,
    Checklist,
    FigmaConnection,
    GitlabProject,
    Label,
    PageProps,
    Task,
    TaskLink,
    TaskSummary,
    Team,
    User,
} from "@/types";
import { getGitlabPrefix } from "@/utils/gitlabPrefix";
import { Head, Link as InertiaLink, router, usePage } from "@inertiajs/react";
import EditIcon from "@mui/icons-material/Edit";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Link from "@mui/material/Link";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useCallback, useEffect, useRef, useState } from "react";

interface Props {
    task: Task;
    team: Pick<Team, "id" | "name" | "slug"> & { members?: User[] };
    board: Board;
    members: User[];
    labels: Label[];
    gitlabProjects: GitlabProject[];
    figmaConnections: FigmaConnection[];
    boardTasks: TaskSummary[];
    teamBoards: Board[];
    isWatching: boolean;
}

export default function TasksShow({
    task,
    team,
    board,
    members,
    labels,
    gitlabProjects,
    figmaConnections,
    boardTasks,
    teamBoards,
    isWatching,
}: Props) {
    const { auth } = usePage<PageProps>().props;
    const { reconnectVersion } = useWebSocket();

    // Local state for debounced fields
    const [title, setTitle] = useState(task.title);
    const [description, setDescription] = useState(task.description ?? "");
    const [checklists, setChecklists] = useState<Checklist[]>(
        task.checklists ?? [],
    );
    const [links, setLinks] = useState<TaskLink[]>(task.links ?? []);
    const [editingDescription, setEditingDescription] = useState(false);

    const isDescriptionEmpty = (val: string) =>
        !val.replace(/<br\s*\/?>/g, "").trim();

    const titleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const checklistTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
        null,
    );
    const linksTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Clean up pending timeouts on unmount
    useEffect(() => {
        return () => {
            if (titleTimeoutRef.current) clearTimeout(titleTimeoutRef.current);
            if (checklistTimeoutRef.current)
                clearTimeout(checklistTimeoutRef.current);
            if (linksTimeoutRef.current) clearTimeout(linksTimeoutRef.current);
        };
    }, []);

    useEffect(() => {
        if (!titleTimeoutRef.current) {
            setTitle(task.title);
        }
    }, [task.title]);

    useEffect(() => {
        if (!editingDescription) {
            setDescription(task.description ?? "");
        }
    }, [task.description, editingDescription]);

    useEffect(() => {
        if (!checklistTimeoutRef.current) {
            setChecklists(task.checklists ?? []);
        }
    }, [task.checklists]);

    useEffect(() => {
        if (!linksTimeoutRef.current) {
            setLinks(task.links ?? []);
        }
    }, [task.links]);

    // Real-time: board channel listener
    const handleBoardEvent = useCallback(
        (event: BoardEvent) => {
            // Board deleted — redirect to team page
            if (event.action === "board.deleted") {
                router.visit(route("teams.show", [team.slug]));
                return;
            }
            // Current task deleted — redirect to board
            if (
                event.action === "task.deleted" &&
                event.data.task_id === task.id
            ) {
                if (event.data.to_board_slug && event.data.task_slug) {
                    router.visit(
                        route("tasks.show", [
                            team.slug,
                            event.data.to_board_slug,
                            event.data.task_slug,
                        ]),
                    );
                    return;
                }
                router.visit(
                    route("teams.boards.show", [team.slug, board.slug]),
                );
                return;
            }
            const eventTaskId = event.data.task_id;
            if (eventTaskId && eventTaskId !== task.id) return;
            router.reload();
        },
        [task.id, team.slug, board.slug],
    );
    useBoardChannel(board.id, handleBoardEvent);

    useEffect(() => {
        if (reconnectVersion === 0) return;

        router.reload();
    }, [reconnectVersion]);

    // Debounced save helpers
    const saveField = useCallback(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Inertia's RequestPayload doesn't accept interfaces without index signatures
        (data: Record<string, any>) => {
            router.put(
                route("tasks.update", [team.slug, board.slug, task.slug]),
                data,
                {
                    preserveScroll: true,
                    preserveState: true,
                },
            );
        },
        [team.slug, board.slug, task.slug],
    );

    const handleTitleChange = (newTitle: string) => {
        setTitle(newTitle);
        if (!newTitle.trim()) return;
        if (titleTimeoutRef.current) clearTimeout(titleTimeoutRef.current);
        titleTimeoutRef.current = setTimeout(() => {
            titleTimeoutRef.current = null;
            saveField({ title: newTitle });
        }, 600);
    };

    const handleDescriptionChange = (val: string) => {
        setDescription(val);
    };

    const saveDescription = () => {
        const normalized = isDescriptionEmpty(description) ? null : description;
        saveField({ description: normalized });
    };

    const handleChecklistsChange = (newChecklists: Checklist[]) => {
        setChecklists(newChecklists);
        if (checklistTimeoutRef.current)
            clearTimeout(checklistTimeoutRef.current);
        checklistTimeoutRef.current = setTimeout(() => {
            checklistTimeoutRef.current = null;
            saveField({ checklists: newChecklists });
        }, 800);
    };

    const handleLinksChange = (newLinks: TaskLink[]) => {
        setLinks(newLinks);
        if (linksTimeoutRef.current) clearTimeout(linksTimeoutRef.current);
        linksTimeoutRef.current = setTimeout(() => {
            linksTimeoutRef.current = null;
            saveField({ links: newLinks });
        }, 800);
    };

    const handleSubtaskClick = (subtask: Task) => {
        router.visit(
            route("tasks.show", [team.slug, board.slug, subtask.slug]),
        );
    };

    const isCompleted = task.completed_at != null;
    const taskNumber = task.task_number ? `#${task.task_number}` : "";
    const gitlabPrefix = getGitlabPrefix(task);

    return (
        <AuthenticatedLayout
            currentTeam={team as Team}
            sidebarBoards={teamBoards}
            activeBoardId={board.id}
            header={
                <PageHeader
                    title={[taskNumber, gitlabPrefix, task.title]
                        .filter(Boolean)
                        .join(" ")}
                    titleContent={
                        <TextField
                            fullWidth
                            variant="standard"
                            value={title}
                            onChange={(e) => handleTitleChange(e.target.value)}
                            sx={{
                                "& .MuiInputBase-root": {
                                    alignItems: "baseline",
                                    lineHeight: 1.12,
                                },
                                "& .MuiInputBase-input": {
                                    py: 0,
                                },
                            }}
                            slotProps={{
                                input: {
                                    sx: {
                                        fontSize: {
                                            xs: "1.6rem",
                                            md: "1.85rem",
                                        },
                                        fontWeight: 800,
                                        letterSpacing: "-0.04em",
                                        lineHeight: 1.12,
                                        color: "text.primary",
                                        textDecoration: isCompleted
                                            ? "line-through"
                                            : "none",
                                    },
                                    disableUnderline: true,
                                },
                            }}
                            aria-label="Task title"
                        />
                    }
                    breadcrumbs={[
                        { label: "Teams", href: route("teams.index") },
                        {
                            label: team.name,
                            href: route("teams.show", team.slug),
                        },
                        {
                            label: board.name,
                            href: route("teams.boards.show", [
                                team.slug,
                                board.slug,
                            ]),
                        },
                    ]}
                />
            }
        >
            <Head
                title={`${[taskNumber, gitlabPrefix, task.title].filter(Boolean).join(" ")} - ${board.name}`}
            />

            <Box
                sx={{
                    display: "flex",
                    gap: 3,
                    flexDirection: { xs: "column", md: "row" },
                    alignItems: "flex-start",
                }}
            >
                {/* Left — main content */}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    {(task.gitlab_project || task.parent_task) && (
                        <Box sx={{ mb: 2 }}>
                            {task.gitlab_project && (
                                <Link
                                    href={task.gitlab_project.web_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    variant="caption"
                                    underline="hover"
                                    color="text.secondary"
                                    sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 0.5,
                                        mt: 0.25,
                                    }}
                                >
                                    {task.gitlab_project.path_with_namespace}
                                    <OpenInNewIcon sx={{ fontSize: 12 }} />
                                </Link>
                            )}

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
                                            team.slug,
                                            board.slug,
                                            task.parent_task.slug,
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
                    )}

                    {/* Description */}
                    <Box sx={{ mb: 4 }}>
                        <Box
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                            }}
                        >
                            <Typography
                                variant="subtitle1"
                                fontWeight={700}
                                sx={{ letterSpacing: "0.01em" }}
                            >
                                Description
                            </Typography>
                            {!editingDescription &&
                                !isDescriptionEmpty(description) && (
                                    <Box
                                        sx={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 0.5,
                                        }}
                                    >
                                        <CopyMarkdownButton
                                            content={description}
                                            aria-label="Copy description as Markdown"
                                        />
                                        <Button
                                            size="small"
                                            startIcon={
                                                <EditIcon fontSize="small" />
                                            }
                                            onClick={() =>
                                                setEditingDescription(true)
                                            }
                                        >
                                            Edit
                                        </Button>
                                    </Box>
                                )}
                        </Box>
                        <Divider sx={{ mt: 0.5, mb: 2 }} />
                        {editingDescription ? (
                            <>
                                <RichTextEditor
                                    content={description}
                                    onChange={handleDescriptionChange}
                                    placeholder="Add a description..."
                                    uploadImageUrl={route(
                                        "tasks.images.store",
                                        [team.slug, board.slug, task.slug],
                                    )}
                                    minHeight={150}
                                    autoFocus
                                    mentionableUsers={members}
                                />
                                <Box
                                    sx={{
                                        display: "flex",
                                        justifyContent: "flex-end",
                                        gap: 1,
                                        mt: 1,
                                    }}
                                >
                                    <Button
                                        size="small"
                                        onClick={() => {
                                            setDescription(
                                                task.description ?? "",
                                            );
                                            setEditingDescription(false);
                                        }}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        size="small"
                                        variant="contained"
                                        disableElevation
                                        onClick={() => {
                                            saveDescription();
                                            setEditingDescription(false);
                                        }}
                                    >
                                        Save
                                    </Button>
                                </Box>
                            </>
                        ) : !isDescriptionEmpty(description) ? (
                            <Box sx={{ px: 1 }}>
                                <RichTextDisplay content={description} />
                            </Box>
                        ) : (
                            <Typography
                                color="text.secondary"
                                sx={{
                                    cursor: "pointer",
                                    py: 1,
                                    "&:hover": {
                                        textDecoration: "underline",
                                    },
                                }}
                                onClick={() => setEditingDescription(true)}
                            >
                                Add a description...
                            </Typography>
                        )}
                    </Box>

                    {/* Checklists */}
                    <Box sx={{ mb: 4 }}>
                        <Typography
                            variant="subtitle1"
                            fontWeight={700}
                            sx={{ letterSpacing: "0.01em" }}
                        >
                            Checklists
                        </Typography>
                        <Divider sx={{ mt: 0.5, mb: 2 }} />
                        <ChecklistEditor
                            checklists={checklists}
                            onChange={handleChecklistsChange}
                        />
                    </Box>

                    {/* Related Links */}
                    <Box sx={{ mb: 4 }}>
                        <Typography
                            variant="subtitle1"
                            fontWeight={700}
                            sx={{ letterSpacing: "0.01em" }}
                        >
                            Related Links
                        </Typography>
                        <Divider sx={{ mt: 0.5, mb: 2 }} />
                        <LinkEditor
                            links={links}
                            onChange={handleLinksChange}
                        />
                    </Box>

                    {/* Subtasks */}
                    <Box sx={{ mb: 4 }}>
                        <Typography
                            variant="subtitle1"
                            fontWeight={700}
                            sx={{ letterSpacing: "0.01em" }}
                        >
                            Subtasks
                        </Typography>
                        <Divider sx={{ mt: 0.5, mb: 2 }} />
                        <SubtaskList
                            task={task}
                            teamId={team.slug}
                            boardId={board.slug}
                            columnId={task.column_id}
                            onSubtaskClick={handleSubtaskClick}
                        />
                    </Box>

                    {/* GitLab Refs */}
                    {(task.gitlab_refs ?? []).length > 0 && (
                        <Box sx={{ mb: 4 }}>
                            <GitlabRefsList
                                task={task}
                                teamId={team.slug}
                                boardId={board.slug}
                            />
                        </Box>
                    )}

                    {/* Figma */}
                    {figmaConnections.length > 0 && (
                        <Box sx={{ mb: 4 }}>
                            <FigmaSection
                                task={task}
                                teamId={team.slug}
                                boardId={board.slug}
                                figmaConnections={figmaConnections}
                            />
                        </Box>
                    )}

                    {/* Attachments */}
                    <Box sx={{ mb: 4 }}>
                        <Typography
                            variant="subtitle1"
                            fontWeight={700}
                            sx={{ letterSpacing: "0.01em" }}
                        >
                            Attachments
                        </Typography>
                        <Divider sx={{ mt: 0.5, mb: 2 }} />
                        <AttachmentList
                            attachments={task.attachments ?? []}
                            teamId={team.slug}
                            boardId={board.slug}
                            taskId={task.id}
                        />
                    </Box>

                    {/* Activity + Comments */}
                    <Box>
                        <Typography
                            variant="subtitle1"
                            fontWeight={700}
                            sx={{ letterSpacing: "0.01em" }}
                        >
                            Activity
                        </Typography>
                        <Divider sx={{ mt: 0.5, mb: 2 }} />
                        <ActivityFeed
                            comments={task.comments ?? []}
                            activities={task.activities ?? []}
                            teamId={team.slug}
                            boardId={board.slug}
                            taskId={task.id}
                            currentUserId={auth.user.id}
                            uploadImageUrl={route("tasks.images.store", [
                                team.slug,
                                board.slug,
                                task.slug,
                            ])}
                            mentionableUsers={members}
                        />
                    </Box>
                </Box>

                {/* Right — sidebar */}
                <Box
                    sx={{
                        width: { xs: "100%", md: 280 },
                        flexShrink: 0,
                        position: { md: "sticky" },
                        top: { md: 16 },
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
                        gitlabProjects={gitlabProjects}
                        isWatching={isWatching}
                    />
                </Box>
            </Box>
        </AuthenticatedLayout>
    );
}
