import RichTextDisplay from "@/Components/Common/RichTextDisplay";
import RichTextEditor from "@/Components/Common/RichTextEditor";
import CopyMarkdownButton from "@/Components/Common/CopyMarkdownButton";
import FigmaSection from "@/Components/Figma/FigmaSection";
import GitlabRefsList from "@/Components/Gitlab/GitlabRefsList";
import ActivityFeed from "@/Components/Tasks/ActivityFeed";
import AttachmentList from "@/Components/Tasks/AttachmentList";
import AutosaveStatus from "@/Components/Tasks/AutosaveStatus";
import ChecklistEditor from "@/Components/Tasks/ChecklistEditor";
import LinkEditor from "@/Components/Tasks/LinkEditor";
import SubtaskList from "@/Components/Tasks/SubtaskList";
import TaskSidebar from "@/Components/Tasks/TaskSidebar";
import { useSnackbar } from "@/Contexts/SnackbarContext";
import { useWebSocket } from "@/Contexts/WebSocketContext";
import { useBoardChannel, type BoardEvent } from "@/hooks/useBoardChannel";
import { isLeavingVisit, reissueVisit, useAutosave } from "@/hooks/useAutosave";
import LayoutHeader from "@/Components/Layout/LayoutHeader";
import PageHeader from "@/Components/Layout/PageHeader";
import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import { harbor, harborHex } from "@/theme/harbor";
import type {
    Board,
    Checklist,
    FigmaConnection,
    GitlabProject,
    Label,
    PageProps,
    Task,
    TaskLink,
    TaskMoveTarget,
    TaskPermissions,
    TaskSummary,
    Team,
    User,
} from "@/types";
import { getGitlabPrefix } from "@/utils/gitlabPrefix";
import { singleLineTitle } from "@/utils/taskFields";
import type { PendingVisit } from "@inertiajs/core";
import { Head, router, usePage } from "@inertiajs/react";
import RouterLink from "@/Components/Common/RouterLink";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import Link from "@mui/material/Link";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import {
    type KeyboardEvent,
    type ReactElement,
    type ReactNode,
    useCallback,
    useEffect,
    useRef,
    useState,
} from "react";

/** Harbor section card — cream surface, soft shadow, no border. */
const cardSx = {
    bgcolor: harbor.card,
    borderRadius: "16px",
    boxShadow: harbor.cardShadow,
    p: "16px 20px",
} as const;

/** Harbor section title — 15px/700 heading font in ink. */
const sectionTitleSx = {
    fontSize: 15,
    fontWeight: 700,
    fontFamily: harbor.headingFont,
    color: harbor.ink,
} as const;

/** Compact "+ Add …" pill for collapsed optional sections. */
const addPillSx = {
    height: 32,
    px: 1.5,
    borderRadius: 999,
    bgcolor: harbor.card,
    boxShadow: harbor.chipShadow,
    color: harborHex.accent,
    fontSize: 12.5,
    fontWeight: 700,
    "&:hover": { bgcolor: harbor.track },
} as const;

const TITLE_SAVE_DELAY = 600;
const LIST_SAVE_DELAY = 800;
const CHECKBOX_SAVE_DELAY = 500;
/** Fallback app bar height before it has been measured. */
const APP_BAR_FALLBACK = 96;

type OptionalSection =
    | "checklists"
    | "subtasks"
    | "links"
    | "attachments"
    | "figma";

interface Props {
    task: Task;
    team: Pick<Team, "id" | "name" | "slug"> & { members?: User[] };
    board: Board;
    members: User[];
    labels: Label[];
    gitlabProjects: GitlabProject[];
    figmaConnections: FigmaConnection[];
    /** Deferred prop — undefined until Inertia fetches it after first paint. */
    boardTasks?: TaskSummary[];
    /** Deferred prop — undefined until Inertia fetches it after first paint. */
    teamBoards?: Board[];
    isWatching: boolean;
    moveTargets: TaskMoveTarget[];
    can: TaskPermissions;
}

const isDescriptionEmpty = (val: string) =>
    !val
        .replace(/<br\s*\/?>/g, "")
        .replace(/<p>\s*<\/p>/g, "")
        .trim();

const normalizeDescription = (val: string) =>
    isDescriptionEmpty(val) ? "" : val;

/**
 * Height of the sticky app bar (its height grows with the header content),
 * so the sticky sidebar can sit just below it.
 */
function useAppBarHeight(): number {
    const [height, setHeight] = useState(APP_BAR_FALLBACK);

    useEffect(() => {
        const header = document.querySelector<HTMLElement>(
            "header.MuiAppBar-root",
        );
        if (!header) return;
        const update = () =>
            setHeight(Math.round(header.getBoundingClientRect().height));
        update();
        if (typeof ResizeObserver === "undefined") return;
        const observer = new ResizeObserver(update);
        observer.observe(header);
        return () => observer.disconnect();
    }, []);

    return height;
}

function SectionCard({
    title,
    children,
}: {
    title: string;
    children: ReactNode;
}) {
    return (
        <Box component="section" sx={cardSx}>
            <Typography component="h2" sx={{ ...sectionTitleSx, mb: 1 }}>
                {title}
            </Typography>
            {children}
        </Box>
    );
}

export default function TasksShow({
    task,
    team,
    board,
    members,
    labels,
    gitlabProjects,
    figmaConnections,
    boardTasks = [],
    isWatching,
    moveTargets = [],
    can,
}: Props) {
    const { auth } = usePage<PageProps>().props;
    const { reconnectVersion } = useWebSocket();
    const { showSnackbar } = useSnackbar();
    const appBarHeight = useAppBarHeight();

    // Registered first so its `before` listener runs before the
    // description guard below.
    const autosave = useAutosave({
        url: route("tasks.update", [
            team.slug,
            board.slug,
            task.slug ?? task.id,
        ]),
        // Refresh the task (activity, updated_at, …) once saves settle.
        onSaved: () => router.reload({ only: ["task"] }),
        onError: (message) => showSnackbar(message, "error"),
    });

    // Local state for autosaved fields
    const [title, setTitle] = useState(task.title);
    const [description, setDescription] = useState(task.description ?? "");
    const [checklists, setChecklists] = useState<Checklist[]>(
        task.checklists ?? [],
    );
    const [links, setLinks] = useState<TaskLink[]>(task.links ?? []);
    const [editingDescription, setEditingDescription] = useState(false);
    // Optional sections that are open: those with content (they stay open
    // if emptied, until reload) plus any opened from the "+ Add" row.
    const [expanded, setExpanded] = useState<Set<OptionalSection>>(
        () => new Set(),
    );

    const titleFocusedRef = useRef(false);
    const titleAtFocusRef = useRef(task.title);
    const skipTitleCommitRef = useRef(false);
    const descriptionAtEditRef = useRef(task.description ?? "");

    // Take server values unless the field has a local edit in progress.
    useEffect(() => {
        if (!titleFocusedRef.current && !autosave.isBusy("title")) {
            setTitle(task.title);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- sync on prop change only
    }, [task.title]);

    useEffect(() => {
        // Skip while a checkbox toggle is pending so a slower reload that
        // was already in flight cannot revert it.
        if (!editingDescription && !autosave.isBusy("description")) {
            setDescription(task.description ?? "");
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- sync on prop change only
    }, [task.description, editingDescription]);

    useEffect(() => {
        if (!autosave.isBusy("checklists")) {
            setChecklists(task.checklists ?? []);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- sync on prop change only
    }, [task.checklists]);

    useEffect(() => {
        if (!autosave.isBusy("links")) {
            setLinks(task.links ?? []);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- sync on prop change only
    }, [task.links]);

    // ── Unsaved description guard ─────────────────────────────────────────
    const descriptionDirty =
        editingDescription &&
        normalizeDescription(description) !==
            normalizeDescription(descriptionAtEditRef.current);
    const descriptionDirtyRef = useRef(false);
    useEffect(() => {
        descriptionDirtyRef.current = descriptionDirty;
    }, [descriptionDirty]);

    const [blockedVisit, setBlockedVisit] = useState<PendingVisit | null>(null);

    useEffect(
        () =>
            router.on("before", (event) => {
                if (event.defaultPrevented) return;
                const visit = event.detail.visit;
                if (!descriptionDirtyRef.current || !isLeavingVisit(visit)) {
                    return;
                }
                setBlockedVisit(visit);
                return false;
            }),
        [],
    );

    useEffect(() => {
        if (!descriptionDirty) return;
        const onBeforeUnload = (event: BeforeUnloadEvent) => {
            event.preventDefault();
            event.returnValue = "";
        };
        window.addEventListener("beforeunload", onBeforeUnload);
        return () => window.removeEventListener("beforeunload", onBeforeUnload);
    }, [descriptionDirty]);

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

    // ── Title ─────────────────────────────────────────────────────────────
    const handleTitleChange = (raw: string) => {
        const next = singleLineTitle(raw);
        setTitle(next);
        if (next.trim()) {
            autosave.schedule("title", next.trim(), TITLE_SAVE_DELAY);
        } else {
            // Never save an empty title; it's restored on blur.
            autosave.cancel("title");
        }
    };

    const saveTitle = (value: string) => {
        autosave.saveNow({ title: value }).catch(() => {});
    };

    const commitTitle = () => {
        const trimmed = title.trim();
        if (!trimmed) {
            const original = titleAtFocusRef.current;
            setTitle(original);
            if (task.title !== original) saveTitle(original);
            return;
        }
        setTitle(trimmed);
        if (autosave.isBusy("title") || trimmed !== task.title) {
            saveTitle(trimmed);
        }
    };

    const handleTitleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.nativeEvent.isComposing) return;
        if (event.key === "Enter") {
            // Titles are single-line: Enter saves instead of adding a newline.
            event.preventDefault();
            (event.target as HTMLElement).blur();
        } else if (event.key === "Escape") {
            event.preventDefault();
            const original = titleAtFocusRef.current;
            autosave.cancel("title");
            setTitle(original);
            if (task.title !== original) saveTitle(original);
            skipTitleCommitRef.current = true;
            (event.target as HTMLElement).blur();
        }
    };

    // ── Description ───────────────────────────────────────────────────────
    const startEditingDescription = () => {
        descriptionAtEditRef.current = description;
        setEditingDescription(true);
    };

    const stopEditingDescription = () => {
        descriptionDirtyRef.current = false;
        setEditingDescription(false);
    };

    const saveDescription = () => {
        const normalized = isDescriptionEmpty(description) ? null : description;
        stopEditingDescription();
        return autosave.saveNow({ description: normalized });
    };

    const discardDescription = () => {
        setDescription(descriptionAtEditRef.current);
        stopEditingDescription();
    };

    // Checkbox toggled directly in the read-only description view. Debounced
    // like the other inline fields so rapid clicks collapse into one save.
    const handleDescriptionCheckboxToggle = (val: string) => {
        setDescription(val);
        autosave.schedule(
            "description",
            isDescriptionEmpty(val) ? null : val,
            CHECKBOX_SAVE_DELAY,
        );
    };

    const leaveAfterDescriptionPrompt = (save: boolean) => {
        const visit = blockedVisit;
        setBlockedVisit(null);
        if (!visit) return;
        if (save) {
            saveDescription().then(
                () => reissueVisit(visit),
                () => {
                    // Stay put; the status shows "Couldn't save · Retry".
                },
            );
        } else {
            discardDescription();
            reissueVisit(visit);
        }
    };

    // ── Checklists / links ────────────────────────────────────────────────
    const handleChecklistsChange = (newChecklists: Checklist[]) => {
        setChecklists(newChecklists);
        autosave.schedule("checklists", newChecklists, LIST_SAVE_DELAY);
    };

    const handleLinksChange = (newLinks: TaskLink[]) => {
        setLinks(newLinks);
        autosave.schedule("links", newLinks, LIST_SAVE_DELAY);
    };

    // ── Optional sections ─────────────────────────────────────────────────
    const expand = (section: OptionalSection) =>
        setExpanded((prev) => new Set(prev).add(section));
    const collapse = (section: OptionalSection) =>
        setExpanded((prev) => {
            const next = new Set(prev);
            next.delete(section);
            return next;
        });

    const hasContent: Record<OptionalSection, boolean> = {
        checklists: checklists.length > 0,
        subtasks: (task.subtasks ?? []).length > 0,
        links: links.length > 0,
        attachments: (task.attachments ?? []).length > 0,
        figma: (task.figma_links ?? []).length > 0,
    };
    const isShown = (section: OptionalSection) =>
        hasContent[section] || expanded.has(section);

    // Keep a section open once it has had content, so removing its last
    // item doesn't yank it (and focus) away mid-edit.
    const filledSections = (
        Object.keys(hasContent) as OptionalSection[]
    ).filter((section) => hasContent[section]);
    const filledKey = filledSections.join(",");
    useEffect(() => {
        setExpanded((prev) => {
            if (filledSections.every((section) => prev.has(section))) {
                return prev;
            }
            return new Set([...prev, ...filledSections]);
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by filledKey
    }, [filledKey]);
    // Opened from the "+ Add" row (not because it already had content).
    const openedEmpty = (section: OptionalSection) =>
        expanded.has(section) && !hasContent[section];

    const addOptions: { section: OptionalSection; label: string }[] = [
        { section: "checklists", label: "Add checklist" },
        { section: "subtasks", label: "Add subtask" },
        { section: "links", label: "Add link" },
        { section: "attachments", label: "Attach file" },
    ];
    if (figmaConnections.length > 0) {
        addOptions.push({ section: "figma", label: "Link Figma design" });
    }
    const addButtons = addOptions.filter(
        ({ section }) => can.update && !isShown(section),
    );

    const isCompleted = task.completed_at != null;
    const taskNumber = task.task_number ? `#${task.task_number}` : "";
    const gitlabPrefix = getGitlabPrefix(task);
    const fullTitle = [taskNumber, gitlabPrefix, task.title]
        .filter(Boolean)
        .join(" ");

    return (
        <>
            <Head title={`${fullTitle} - ${board.name}`} />
            <LayoutHeader>
                <PageHeader
                    title={fullTitle}
                    titleContent={
                        <Box
                            sx={{
                                display: "flex",
                                alignItems: "flex-start",
                                gap: 1,
                                minWidth: 0,
                                width: "100%",
                            }}
                        >
                            {taskNumber && (
                                <Typography
                                    component="span"
                                    aria-hidden
                                    sx={{
                                        flexShrink: 0,
                                        pt: "3px",
                                        fontSize: {
                                            xs: "1.6rem",
                                            md: "1.85rem",
                                        },
                                        fontWeight: 800,
                                        letterSpacing: "-0.04em",
                                        lineHeight: 1.12,
                                        color: harbor.faint,
                                        fontVariantNumeric: "tabular-nums",
                                    }}
                                >
                                    {taskNumber}
                                </Typography>
                            )}
                            <TextField
                                fullWidth
                                multiline
                                minRows={1}
                                maxRows={4}
                                variant="standard"
                                value={title}
                                disabled={!can.update}
                                onChange={(e) =>
                                    handleTitleChange(e.target.value)
                                }
                                onFocus={() => {
                                    titleFocusedRef.current = true;
                                    titleAtFocusRef.current = title;
                                }}
                                onBlur={() => {
                                    titleFocusedRef.current = false;
                                    if (skipTitleCommitRef.current) {
                                        skipTitleCommitRef.current = false;
                                        return;
                                    }
                                    commitTitle();
                                }}
                                onKeyDown={handleTitleKeyDown}
                                sx={{
                                    minWidth: 0,
                                    "& .MuiInputBase-root": {
                                        alignItems: "flex-start",
                                        lineHeight: 1.12,
                                        borderRadius: "10px",
                                        ml: -0.75,
                                        px: 0.75,
                                        py: "3px",
                                        transition:
                                            "background-color 150ms ease-out, box-shadow 150ms ease-out",
                                        // Edit affordance: tint + pencil on
                                        // hover, accent ring while editing.
                                        "&:hover": {
                                            bgcolor: harbor.countBg,
                                        },
                                        "&:hover .title-edit-icon, &.Mui-focused .title-edit-icon":
                                            { opacity: 1 },
                                        "&.Mui-focused": {
                                            bgcolor: harbor.card,
                                            boxShadow: `0 0 0 2px ${harborHex.accent}`,
                                        },
                                        "&.Mui-disabled:hover": {
                                            bgcolor: "transparent",
                                        },
                                    },
                                    "& .MuiInputBase-input": {
                                        py: 0,
                                        overflow: "hidden",
                                        overflowWrap: "anywhere",
                                        resize: "none",
                                    },
                                }}
                                slotProps={{
                                    htmlInput: {
                                        "aria-label": "Task title",
                                        maxLength: 255,
                                        enterKeyHint: "done",
                                    },
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
                                        endAdornment: can.update ? (
                                            <EditIcon
                                                className="title-edit-icon"
                                                aria-hidden
                                                sx={{
                                                    flexShrink: 0,
                                                    alignSelf: "center",
                                                    ml: 1,
                                                    fontSize: 18,
                                                    color: harbor.faint,
                                                    opacity: 0,
                                                    transition:
                                                        "opacity 150ms ease-out",
                                                    "@media (hover: none)": {
                                                        opacity: 0.7,
                                                    },
                                                }}
                                            />
                                        ) : undefined,
                                    },
                                }}
                            />
                        </Box>
                    }
                    breadcrumbs={[
                        {
                            label: team.name,
                            href: route("teams.show", team.slug),
                            teamSwitcher: true,
                        },
                        {
                            label: board.name,
                            href: route("teams.boards.show", [
                                team.slug,
                                board.slug,
                            ]),
                        },
                    ]}
                    actions={
                        <AutosaveStatus
                            status={autosave.status}
                            errorMessage={autosave.errorMessage}
                            onRetry={autosave.retry}
                        />
                    }
                />
            </LayoutHeader>

            <Box
                sx={{
                    display: "flex",
                    gap: 2,
                    flexDirection: { xs: "column", md: "row" },
                    alignItems: "flex-start",
                }}
            >
                {/* Left — main content */}
                <Box
                    sx={{
                        flex: 1,
                        minWidth: 0,
                        width: "100%",
                        display: "flex",
                        flexDirection: "column",
                        gap: 2,
                    }}
                >
                    {(task.gitlab_project || task.parent_task) && (
                        <Box>
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
                                        component={RouterLink}
                                        href={route("tasks.show", [
                                            team.slug,
                                            board.slug,
                                            task.parent_task.slug ??
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
                    )}

                    {/* Description */}
                    <Box component="section" sx={cardSx}>
                        <Box
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                            }}
                        >
                            <Typography component="h2" sx={sectionTitleSx}>
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
                                        {can.update && (
                                            <Button
                                                size="small"
                                                startIcon={
                                                    <EditIcon fontSize="small" />
                                                }
                                                onClick={
                                                    startEditingDescription
                                                }
                                                aria-label="Edit description"
                                                sx={{
                                                    fontSize: 12.5,
                                                    fontWeight: 700,
                                                }}
                                            >
                                                Edit
                                            </Button>
                                        )}
                                    </Box>
                                )}
                        </Box>
                        {editingDescription ? (
                            <>
                                <Box sx={{ mt: 1 }}>
                                    <RichTextEditor
                                        content={description}
                                        onChange={setDescription}
                                        placeholder="Add a description..."
                                        uploadImageUrl={route(
                                            "tasks.images.store",
                                            [
                                                team.slug,
                                                board.slug,
                                                task.slug ?? task.id,
                                            ],
                                        )}
                                        minHeight={150}
                                        autoFocus
                                        mentionableUsers={members}
                                    />
                                </Box>
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
                                        onClick={discardDescription}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        size="small"
                                        variant="contained"
                                        disableElevation
                                        onClick={() => {
                                            saveDescription().catch(() => {});
                                        }}
                                    >
                                        Save
                                    </Button>
                                </Box>
                            </>
                        ) : !isDescriptionEmpty(description) ? (
                            <Box sx={{ mt: 1 }}>
                                <RichTextDisplay
                                    content={description}
                                    ariaLabel="Task description"
                                    onChange={
                                        can.update
                                            ? handleDescriptionCheckboxToggle
                                            : undefined
                                    }
                                />
                            </Box>
                        ) : can.update ? (
                            <Box
                                component="button"
                                type="button"
                                onClick={startEditingDescription}
                                sx={{
                                    display: "block",
                                    width: "100%",
                                    textAlign: "left",
                                    mt: 1,
                                    p: "12px 14px",
                                    border: "none",
                                    borderRadius: "10px",
                                    bgcolor: harbor.countBg,
                                    fontFamily: harbor.bodyFont,
                                    fontSize: 13,
                                    color: harbor.sub,
                                    cursor: "pointer",
                                    transition:
                                        "background-color 150ms ease-out",
                                    "&:hover": { bgcolor: harbor.track },
                                }}
                            >
                                Add a description...
                            </Box>
                        ) : (
                            <Typography
                                sx={{ mt: 1, fontSize: 13, color: harbor.sub }}
                            >
                                No description.
                            </Typography>
                        )}
                    </Box>

                    {/* Optional sections — shown when they have content or
                        were opened from the "+ Add" row below. */}
                    {isShown("checklists") && (
                        <SectionCard title="Checklists">
                            <ChecklistEditor
                                checklists={checklists}
                                onChange={handleChecklistsChange}
                                autoStartAdding={openedEmpty("checklists")}
                                onDismiss={() => collapse("checklists")}
                            />
                        </SectionCard>
                    )}

                    {isShown("subtasks") && (
                        <SectionCard title="Subtasks">
                            <SubtaskList
                                task={task}
                                teamSlug={team.slug}
                                boardSlug={board.slug}
                                columnId={task.column_id}
                                autoStartAdding={openedEmpty("subtasks")}
                                onDismiss={() => collapse("subtasks")}
                            />
                        </SectionCard>
                    )}

                    {isShown("links") && (
                        <SectionCard title="Related links">
                            <LinkEditor
                                links={links}
                                onChange={handleLinksChange}
                                autoStartAdding={openedEmpty("links")}
                                onDismiss={() => collapse("links")}
                            />
                        </SectionCard>
                    )}

                    {isShown("attachments") && (
                        <SectionCard title="Attachments">
                            <AttachmentList
                                attachments={task.attachments ?? []}
                                teamSlug={team.slug}
                                boardSlug={board.slug}
                                taskId={task.id}
                                openPickerOnMount={openedEmpty("attachments")}
                            />
                        </SectionCard>
                    )}

                    {/* GitLab refs are created from the sidebar controls. */}
                    {(task.gitlab_refs ?? []).length > 0 && (
                        <Box component="section" sx={cardSx}>
                            <GitlabRefsList
                                task={task}
                                teamSlug={team.slug}
                                boardSlug={board.slug}
                            />
                        </Box>
                    )}

                    {figmaConnections.length > 0 && isShown("figma") && (
                        <Box component="section" sx={cardSx}>
                            <FigmaSection
                                task={task}
                                teamSlug={team.slug}
                                boardSlug={board.slug}
                                figmaConnections={figmaConnections}
                                autoOpenDialog={openedEmpty("figma")}
                                onDismiss={() => collapse("figma")}
                            />
                        </Box>
                    )}

                    {addButtons.length > 0 && (
                        <Box
                            role="group"
                            aria-label="Add to task"
                            sx={{
                                display: "flex",
                                flexWrap: "wrap",
                                gap: 1,
                            }}
                        >
                            {addButtons.map(({ section, label }) => (
                                <Button
                                    key={section}
                                    startIcon={
                                        <AddIcon
                                            sx={{ fontSize: "15px !important" }}
                                        />
                                    }
                                    onClick={() => expand(section)}
                                    sx={addPillSx}
                                >
                                    {label}
                                </Button>
                            ))}
                        </Box>
                    )}

                    {/* Comments (+ optional system activity) stay at the bottom,
                        after the task's own content. */}
                    <Box sx={{ ...cardSx, p: "20px 24px" }}>
                        <ActivityFeed
                            comments={task.comments ?? []}
                            activities={task.activities ?? []}
                            teamSlug={team.slug}
                            boardSlug={board.slug}
                            taskId={task.id}
                            currentUserId={auth.user.id}
                            uploadImageUrl={route("tasks.images.store", [
                                team.slug,
                                board.slug,
                                task.slug ?? task.id,
                            ])}
                            mentionableUsers={members}
                        />
                    </Box>
                </Box>

                {/* Right — sidebar; sticks below the app bar on desktop and
                    scrolls on its own when taller than the viewport. */}
                <Box
                    component="aside"
                    aria-label="Task details"
                    sx={{
                        width: { xs: "100%", md: 320 },
                        flexShrink: 0,
                        alignSelf: "flex-start",
                        position: { md: "sticky" },
                        top: { md: appBarHeight + 16 },
                        maxHeight: {
                            md: `calc(100vh - ${appBarHeight + 32}px)`,
                        },
                        overflowY: { md: "auto" },
                        // Room for the cards' shadows inside the scroller.
                        px: { md: 0.5 },
                        mx: { md: -0.5 },
                        pb: { md: 0.5 },
                    }}
                >
                    <TaskSidebar
                        task={task}
                        team={team}
                        board={board}
                        members={members}
                        labels={labels}
                        boardTasks={boardTasks}
                        moveTargets={moveTargets}
                        can={can}
                        gitlabProjects={gitlabProjects}
                        isWatching={isWatching}
                        autosave={autosave}
                    />
                </Box>
            </Box>

            {/* Leaving with an unsaved description */}
            <Dialog
                open={blockedVisit !== null}
                onClose={() => setBlockedVisit(null)}
                maxWidth="xs"
                aria-labelledby="unsaved-description-title"
                aria-describedby="unsaved-description-text"
            >
                <DialogTitle id="unsaved-description-title">
                    Unsaved description changes
                </DialogTitle>
                <DialogContent>
                    <DialogContentText id="unsaved-description-text">
                        You've edited the description but haven't saved it.
                        Discard your changes and leave this page?
                    </DialogContentText>
                </DialogContent>
                <DialogActions sx={{ flexWrap: "wrap", gap: 0.5 }}>
                    <Button onClick={() => setBlockedVisit(null)} autoFocus>
                        Keep editing
                    </Button>
                    <Button
                        color="error"
                        onClick={() => leaveAfterDescriptionPrompt(false)}
                    >
                        Discard
                    </Button>
                    <Button
                        variant="contained"
                        disableElevation
                        onClick={() => leaveAfterDescriptionPrompt(true)}
                    >
                        Save and leave
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
}

TasksShow.layout = (props: Props) => [
    AuthenticatedLayout,
    {
        currentTeam: props.team as Team,
        sidebarBoards: props.teamBoards,
        activeBoardId: props.board.id,
    },
];
