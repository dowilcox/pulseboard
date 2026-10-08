import { Link, router, usePage } from "@inertiajs/react";
import RouterLink from "@/Components/Common/RouterLink";
import axios from "axios";
import {
    type ComponentType,
    type KeyboardEvent,
    type MouseEvent,
    type ReactNode,
    useCallback,
    useEffect,
    useId,
    useMemo,
    useRef,
    useState,
} from "react";
import AdminPanelSettingsOutlinedIcon from "@mui/icons-material/AdminPanelSettingsOutlined";
import AssignmentOutlinedIcon from "@mui/icons-material/AssignmentOutlined";
import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import SearchIcon from "@mui/icons-material/Search";
import TaskAltIcon from "@mui/icons-material/TaskAlt";
import ViewModuleOutlinedIcon from "@mui/icons-material/ViewModuleOutlined";
import type { SvgIconProps } from "@mui/material/SvgIcon";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import InputBase from "@mui/material/InputBase";
import Typography from "@mui/material/Typography";
import { harbor } from "@/theme/harbor";
import type {
    PageProps,
    Team,
    TaskSearchResponse,
    TaskSearchResult,
} from "@/types";
import { getRecentBoardIds } from "@/utils/recentBoards";
import {
    type BoardEntry,
    type Ranked,
    isApplePlatform,
    rankByName,
    resolveBoardIds,
    searchBoards,
    searchTeams,
    shouldSearchTasks,
    TASK_SEARCH_MAX_LENGTH,
} from "@/utils/quickSwitcher";

const MAX_STARRED = 8;
const MAX_RECENT = 5;
const TASK_SEARCH_DEBOUNCE_MS = 200;
const NO_IDS: string[] = [];

const visuallyHiddenSx = {
    position: "absolute",
    width: 1,
    height: 1,
    p: 0,
    m: "-1px",
    overflow: "hidden",
    clip: "rect(0 0 0 0)",
    whiteSpace: "nowrap",
    border: 0,
} as const;

const kbdSx = {
    display: "inline-flex",
    alignItems: "center",
    px: 0.75,
    minWidth: 22,
    height: 22,
    justifyContent: "center",
    borderRadius: "6px",
    border: 1,
    borderColor: "divider",
    bgcolor: harbor.countBg,
    color: harbor.sub,
    fontFamily: "inherit",
    fontSize: "0.7rem",
    fontWeight: 700,
    lineHeight: 1,
    whiteSpace: "nowrap",
} as const;

// ── Result model ────────────────────────────────────────────────────────────

type Range = [number, number] | null;

interface PageLink {
    key: string;
    label: string;
    href: string;
    icon: ComponentType<SvgIconProps>;
}

type ResultItem =
    | {
          kind: "board";
          key: string;
          href: string;
          entry: BoardEntry;
          range: Range;
      }
    | { kind: "team"; key: string; href: string; team: Team; range: Range }
    | { kind: "page"; key: string; href: string; page: PageLink; range: Range }
    | { kind: "task"; key: string; href: string; task: TaskSearchResult };

interface ResultGroup {
    id: string;
    label: string;
    items: ResultItem[];
}

function boardItem(
    entry: BoardEntry,
    group: string,
    range: Range = null,
): ResultItem {
    return {
        kind: "board",
        key: `${group}-board-${entry.board.id}`,
        href: route("teams.boards.show", [entry.team.slug, entry.board.slug]),
        entry,
        range,
    };
}

function teamItem({ item: team, match }: Ranked<Team>): ResultItem {
    return {
        kind: "team",
        key: `team-${team.id}`,
        href: route("teams.show", team.slug),
        team,
        range: match.range,
    };
}

function pageItem(page: PageLink, range: Range = null): ResultItem {
    return { kind: "page", key: page.key, href: page.href, page, range };
}

function taskItem(task: TaskSearchResult): ResultItem {
    return {
        kind: "task",
        key: `task-${task.id}`,
        href: route("tasks.show", [task.team.slug, task.board.slug, task.slug]),
        task,
    };
}

// ── Server task search ──────────────────────────────────────────────────────

interface TaskSearchState {
    status: "idle" | "loading" | "success" | "error";
    /** The (trimmed) query these results belong to. */
    query: string;
    tasks: TaskSearchResult[];
    rateLimited?: boolean;
}

/** Debounced, abortable task search against route("search"). */
function useTaskSearch(query: string) {
    const enabled = shouldSearchTasks(query);
    const [attempt, setAttempt] = useState(0);
    const [state, setState] = useState<TaskSearchState>({
        status: "idle",
        query: "",
        tasks: [],
    });

    useEffect(() => {
        if (!enabled) {
            setState({ status: "idle", query, tasks: [] });
            return;
        }

        setState({ status: "loading", query, tasks: [] });
        const controller = new AbortController();
        const timer = window.setTimeout(() => {
            axios
                .get<TaskSearchResponse>(route("search", { q: query }), {
                    signal: controller.signal,
                })
                .then(({ data }) =>
                    setState({ status: "success", query, tasks: data.tasks }),
                )
                .catch((error: unknown) => {
                    if (axios.isCancel(error)) return;
                    setState({
                        status: "error",
                        query,
                        tasks: [],
                        rateLimited:
                            axios.isAxiosError(error) &&
                            error.response?.status === 429,
                    });
                });
        }, TASK_SEARCH_DEBOUNCE_MS);

        return () => {
            window.clearTimeout(timer);
            controller.abort();
        };
    }, [query, enabled, attempt]);

    const retry = useCallback(() => setAttempt((n) => n + 1), []);

    // Until the effect catches up with a new query, report it as loading
    // rather than showing the previous query's results.
    const current: TaskSearchState =
        state.query === query
            ? state
            : { status: enabled ? "loading" : "idle", query, tasks: [] };

    return { ...current, retry };
}

// ── Panel ───────────────────────────────────────────────────────────────────

interface QuickSwitcherPanelProps {
    /** Id of the dialog's (visually hidden) title. */
    titleId: string;
    /** Called when a result is opened in this tab; closes the dialog. */
    onNavigate: () => void;
}

/**
 * Contents of the quick switcher dialog: a combobox input that filters
 * boards, teams and pages instantly and searches tasks on the server.
 * Mounted only while the dialog is open, so its state resets on each open.
 */
export default function QuickSwitcherPanel({
    titleId,
    onNavigate,
}: QuickSwitcherPanelProps) {
    const props = usePage<PageProps<{ board?: { id?: string } }>>().props;
    const user = props.auth.user;
    const teams = props.teams ?? [];
    const starredIds = user.ui_preferences?.starred_boards ?? NO_IDS;
    const currentBoardId = props.board?.id;

    const [query, setQuery] = useState("");
    const [activeIndex, setActiveIndex] = useState(0);
    const [recentIds] = useState(getRecentBoardIds);
    const scrollActiveIntoView = useRef(false);

    const trimmed = query.trim();
    const taskSearch = useTaskSearch(trimmed);

    const baseId = useId();
    const listboxId = `${baseId}-listbox`;
    const hintId = `${baseId}-hint`;
    const optionId = (index: number) => `${baseId}-option-${index}`;
    const apple = useMemo(() => isApplePlatform(), []);

    const pages = useMemo<PageLink[]>(
        () => [
            {
                key: "page-dashboard",
                label: "Dashboard",
                href: route("dashboard"),
                icon: DashboardOutlinedIcon,
            },
            {
                key: "page-teams",
                label: "All teams",
                href: route("teams.index"),
                icon: GroupsOutlinedIcon,
            },
            {
                key: "page-profile",
                label: "Profile",
                href: route("profile.edit"),
                icon: PersonOutlineIcon,
            },
            ...(user.is_admin
                ? [
                      {
                          key: "page-admin",
                          label: "Admin",
                          href: route("admin.dashboard"),
                          icon: AdminPanelSettingsOutlinedIcon,
                      },
                  ]
                : []),
        ],
        [user.is_admin],
    );

    const groups = useMemo<ResultGroup[]>(() => {
        const result: ResultGroup[] = [];
        const add = (id: string, label: string, items: ResultItem[]) => {
            if (items.length) result.push({ id, label, items });
        };

        if (!trimmed) {
            const starred = resolveBoardIds(teams, starredIds).slice(
                0,
                MAX_STARRED,
            );
            const recent = resolveBoardIds(
                teams,
                recentIds,
                new Set([
                    ...starred.map((entry) => entry.board.id),
                    ...(currentBoardId ? [currentBoardId] : []),
                ]),
            ).slice(0, MAX_RECENT);

            add(
                "starred",
                "Starred",
                starred.map((entry) => boardItem(entry, "starred")),
            );
            add(
                "recent",
                "Recent",
                recent.map((entry) => boardItem(entry, "recent")),
            );
            add(
                "pages",
                "Pages",
                pages.map((page) => pageItem(page)),
            );
            return result;
        }

        add(
            "boards",
            "Boards",
            searchBoards(teams, trimmed).map(({ item, match }) =>
                boardItem(item, "boards", match.range),
            ),
        );
        add("teams", "Teams", searchTeams(teams, trimmed).map(teamItem));
        add(
            "pages",
            "Pages",
            rankByName(pages, trimmed, (page) => page.label).map(
                ({ item, match }) => pageItem(item, match.range),
            ),
        );
        if (taskSearch.status === "success") {
            add("tasks", "Tasks", taskSearch.tasks.map(taskItem));
        }
        return result;
    }, [
        trimmed,
        teams,
        starredIds,
        recentIds,
        currentBoardId,
        pages,
        taskSearch.status,
        taskSearch.tasks,
    ]);

    const items = useMemo(
        () => groups.flatMap((group) => group.items),
        [groups],
    );
    const active = items.length ? Math.min(activeIndex, items.length - 1) : -1;
    const activeId = active >= 0 ? optionId(active) : undefined;

    useEffect(() => {
        if (!scrollActiveIntoView.current || !activeId) return;
        scrollActiveIntoView.current = false;
        document
            .getElementById(activeId)
            ?.scrollIntoView?.({ block: "nearest" });
    }, [activeId]);

    const moveActive = (delta: number) => {
        if (!items.length) return;
        scrollActiveIntoView.current = true;
        setActiveIndex((active + delta + items.length) % items.length);
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.nativeEvent.isComposing) return;

        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            moveActive(event.key === "ArrowDown" ? 1 : -1);
            return;
        }

        if (event.key === "Enter") {
            const item = items[active];
            if (!item) return;
            event.preventDefault();

            if (event.metaKey || event.ctrlKey) {
                window.open(item.href, "_blank", "noopener");
                return;
            }

            onNavigate();
            router.visit(item.href);
        }
    };

    const handleOptionClick = (event: MouseEvent<Element>) => {
        // Modified and middle clicks fall through to the browser (new tab
        // or window); a plain click is an in-app visit via Inertia's Link.
        if (
            event.button === 0 &&
            !event.metaKey &&
            !event.ctrlKey &&
            !event.shiftKey &&
            !event.altKey
        ) {
            onNavigate();
        }
    };

    // ── Status messages ──
    const taskStatus = taskSearch.status;
    let status: ReactNode = null;
    let announcement = "";

    if (taskStatus === "loading") {
        status = (
            <>
                <CircularProgress size={14} aria-hidden />
                Searching tasks…
            </>
        );
        announcement = "Searching…";
    } else if (taskStatus === "error") {
        status = (
            <>
                {taskSearch.rateLimited
                    ? "Too many searches. Wait a moment, then retry."
                    : "Couldn't search tasks."}
                <Button size="small" onClick={taskSearch.retry}>
                    Retry
                </Button>
            </>
        );
        announcement = "Task search failed.";
    } else if (trimmed && !items.length) {
        status = <>No results for “{trimmed}”</>;
        announcement = "No results.";
    } else if (trimmed && !shouldSearchTasks(trimmed)) {
        status =
            trimmed.length > TASK_SEARCH_MAX_LENGTH
                ? `Task search is limited to ${TASK_SEARCH_MAX_LENGTH} characters.`
                : "Type at least 2 characters to search tasks.";
    }

    if (trimmed && taskStatus !== "loading" && items.length) {
        announcement = `${items.length} ${items.length === 1 ? "result" : "results"}${
            taskStatus === "error" ? ". Task search failed." : "."
        }`;
    }

    let index = -1;

    return (
        <>
            <Typography id={titleId} component="h2" sx={visuallyHiddenSx}>
                Search boards, teams and tasks
            </Typography>

            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1.5,
                    px: 2,
                    py: 1.25,
                    borderBottom: 1,
                    borderColor: "divider",
                }}
            >
                <SearchIcon aria-hidden sx={{ color: harbor.sub }} />
                <InputBase
                    autoFocus
                    fullWidth
                    value={query}
                    onChange={(event) => {
                        setQuery(event.target.value);
                        setActiveIndex(0);
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder="Search boards, teams and tasks…"
                    inputProps={{
                        role: "combobox",
                        "aria-label": "Search boards, teams and tasks",
                        "aria-autocomplete": "list",
                        "aria-expanded": items.length > 0,
                        "aria-controls": listboxId,
                        "aria-activedescendant": activeId,
                        "aria-describedby": hintId,
                        autoComplete: "off",
                        autoCapitalize: "off",
                        spellCheck: false,
                        enterKeyHint: "go",
                    }}
                    sx={{
                        fontSize: "1rem",
                        "& input": { py: 0.75 },
                        "& input::placeholder": {
                            color: harbor.sub,
                            opacity: 1,
                        },
                    }}
                />
                <Box
                    component="kbd"
                    aria-hidden
                    sx={{
                        ...kbdSx,
                        display: { xs: "none", sm: "inline-flex" },
                    }}
                >
                    Esc
                </Box>
            </Box>

            <Box
                sx={{
                    flex: "1 1 auto",
                    minHeight: 0,
                    overflowY: "auto",
                    overscrollBehavior: "contain",
                    py: items.length || status ? 1 : 0,
                }}
            >
                <Box id={listboxId} role="listbox" aria-label="Search results">
                    {groups.map((group) => {
                        const labelId = `${baseId}-group-${group.id}`;
                        return (
                            <Box
                                key={group.id}
                                role="group"
                                aria-labelledby={labelId}
                                sx={{ "& + &": { mt: 1 } }}
                            >
                                <Typography
                                    id={labelId}
                                    role="presentation"
                                    variant="caption"
                                    component="div"
                                    sx={{
                                        px: 2.5,
                                        pt: 0.5,
                                        pb: 0.5,
                                        color: harbor.sub,
                                        fontWeight: 700,
                                        letterSpacing: "0.06em",
                                        textTransform: "uppercase",
                                    }}
                                >
                                    {group.label}
                                </Typography>
                                {group.items.map((item) => {
                                    index += 1;
                                    const itemIndex = index;
                                    return (
                                        <ResultOption
                                            key={item.key}
                                            id={optionId(itemIndex)}
                                            item={item}
                                            selected={itemIndex === active}
                                            onHover={() =>
                                                setActiveIndex(itemIndex)
                                            }
                                            onClick={handleOptionClick}
                                        />
                                    );
                                })}
                            </Box>
                        );
                    })}
                </Box>

                {status && (
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                            px: 2.5,
                            py: 1,
                            color: harbor.sub,
                            fontSize: "0.875rem",
                        }}
                    >
                        {status}
                    </Box>
                )}
            </Box>

            <Box
                aria-hidden
                sx={{
                    display: { xs: "none", sm: "flex" },
                    flexWrap: "wrap",
                    gap: 2,
                    px: 2,
                    py: 1,
                    borderTop: 1,
                    borderColor: "divider",
                    color: harbor.sub,
                    fontSize: "0.75rem",
                    "& > span": {
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 0.5,
                    },
                }}
            >
                <span>
                    <Box component="kbd" sx={kbdSx}>
                        ↑
                    </Box>
                    <Box component="kbd" sx={kbdSx}>
                        ↓
                    </Box>
                    Navigate
                </span>
                <span>
                    <Box component="kbd" sx={kbdSx}>
                        ↵
                    </Box>
                    Open
                </span>
                <span>
                    <Box component="kbd" sx={kbdSx}>
                        {apple ? "⌘ ↵" : "Ctrl ↵"}
                    </Box>
                    New tab
                </span>
            </Box>

            <Box id={hintId} sx={visuallyHiddenSx}>
                Use the up and down arrow keys to choose a result, Enter to open
                it, or {apple ? "Command" : "Control"} Enter to open it in a new
                tab.
            </Box>
            <Box role="status" aria-live="polite" sx={visuallyHiddenSx}>
                {announcement}
            </Box>
        </>
    );
}

// ── Option rendering ────────────────────────────────────────────────────────

interface ResultOptionProps {
    id: string;
    item: ResultItem;
    selected: boolean;
    onHover: () => void;
    onClick: (event: MouseEvent<Element>) => void;
}

function ResultOption({
    id,
    item,
    selected,
    onHover,
    onClick,
}: ResultOptionProps) {
    return (
        <Box
            component={RouterLink}
            href={item.href}
            id={id}
            role="option"
            aria-selected={selected}
            tabIndex={-1}
            onMouseMove={selected ? undefined : onHover}
            onClick={onClick}
            sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.5,
                mx: 1,
                px: 1.5,
                py: 0.875,
                borderRadius: `${harbor.radius.control}px`,
                color: harbor.ink,
                textDecoration: "none",
                cursor: "pointer",
                bgcolor: selected ? "action.selected" : "transparent",
                // Focus stays in the combobox input; the active option is
                // conveyed by aria-activedescendant and this highlight.
                outline: "none",
            }}
        >
            <OptionIcon item={item} />
            <Box sx={{ minWidth: 0, flex: 1 }}>
                <OptionText item={item} />
            </Box>
            {selected && (
                <Box
                    component="kbd"
                    aria-hidden
                    sx={{
                        ...kbdSx,
                        display: { xs: "none", sm: "inline-flex" },
                    }}
                >
                    ↵
                </Box>
            )}
        </Box>
    );
}

function Highlighted({ text, range }: { text: string; range: Range }) {
    if (!range || range[0] >= range[1] || range[1] > text.length) {
        return <>{text}</>;
    }

    return (
        <>
            {text.slice(0, range[0])}
            <Box
                component="span"
                sx={{ color: harbor.accent, fontWeight: 800 }}
            >
                {text.slice(range[0], range[1])}
            </Box>
            {text.slice(range[1])}
        </>
    );
}

function OptionText({ item }: { item: ResultItem }) {
    let primary: ReactNode;
    let secondary: ReactNode = null;

    switch (item.kind) {
        case "board":
            primary = (
                <Highlighted text={item.entry.board.name} range={item.range} />
            );
            secondary = item.entry.team.name;
            break;
        case "team":
            primary = <Highlighted text={item.team.name} range={item.range} />;
            secondary = "Team";
            break;
        case "page":
            primary = <Highlighted text={item.page.label} range={item.range} />;
            break;
        case "task": {
            const { task } = item;
            primary = (
                <>
                    {task.task_number !== null && (
                        <Box
                            component="span"
                            sx={{
                                color: harbor.sub,
                                fontWeight: 700,
                                mr: 0.75,
                            }}
                        >
                            #{task.task_number}
                        </Box>
                    )}
                    {task.title}
                </>
            );
            secondary = [
                `${task.team.name} › ${task.board.name}`,
                task.completed_at ? "Completed" : task.column?.name,
            ]
                .filter(Boolean)
                .join(" · ");
            break;
        }
    }

    return (
        <>
            <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
                {primary}
            </Typography>
            {secondary && (
                <Typography
                    variant="caption"
                    component="div"
                    noWrap
                    sx={{ color: harbor.sub }}
                >
                    {secondary}
                </Typography>
            )}
        </>
    );
}

const iconTileSx = {
    width: 30,
    height: 30,
    flexShrink: 0,
    borderRadius: "8px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    "& svg": { fontSize: 18 },
} as const;

function OptionIcon({ item }: { item: ResultItem }) {
    let imageUrl: string | null | undefined;
    let tint: { fg: string; bg: string } = {
        fg: harbor.sub,
        bg: harbor.countBg,
    };
    let Icon: ComponentType<SvgIconProps>;

    switch (item.kind) {
        case "board":
            imageUrl = item.entry.board.image_url;
            tint = harbor.tints.indigo;
            Icon = ViewModuleOutlinedIcon;
            break;
        case "team":
            imageUrl = item.team.image_url;
            tint = harbor.tints.green;
            Icon = GroupsOutlinedIcon;
            break;
        case "page":
            Icon = item.page.icon;
            break;
        case "task":
            if (item.task.completed_at) {
                tint = harbor.tints.green;
                Icon = TaskAltIcon;
            } else {
                Icon = AssignmentOutlinedIcon;
            }
            break;
    }

    if (imageUrl) {
        return (
            <Avatar
                src={imageUrl}
                alt=""
                variant="rounded"
                sx={{ ...iconTileSx, borderRadius: "8px" }}
            />
        );
    }

    return (
        <Box
            aria-hidden
            sx={{ ...iconTileSx, bgcolor: tint.bg, color: tint.fg }}
        >
            <Icon />
        </Box>
    );
}
