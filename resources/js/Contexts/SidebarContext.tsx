import { router, usePage } from "@inertiajs/react";
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from "react";
import type { Board, PageProps, Team } from "@/types";
import { getRecentBoardIds } from "@/utils/recentBoards";
import {
    applySavedOrder,
    isTeamExpanded as resolveTeamExpanded,
    parseExpandedTeams,
    toggleStarredBoard,
} from "@/utils/sidebarNav";

interface SidebarContextValue {
    collapsed: boolean;
    setCollapsed: (collapsed: boolean) => void;
    /** Team of the current page (from the page's `currentTeam` prop), if any. */
    currentTeam: Team | undefined;
    /** Ordered active boards of the current page's team. */
    boards: Board[];
    /** The user's teams, each with its active boards in the user's saved order. */
    teams: Team[];
    reorderBoards: (teamId: string, orderedBoardIds: string[]) => void;
    starredBoardIds: string[];
    toggleStarredBoard: (boardId: string) => void;
    recentBoardIds: string[];
    /** Re-read recently visited boards from storage. */
    refreshRecentBoards: () => void;
    isTeamExpanded: (teamId: string) => boolean;
    setTeamExpanded: (teamId: string, expanded: boolean) => void;
}

const SidebarContext = createContext<SidebarContextValue>({
    collapsed: false,
    setCollapsed: () => {},
    currentTeam: undefined,
    boards: [],
    teams: [],
    reorderBoards: () => {},
    starredBoardIds: [],
    toggleStarredBoard: () => {},
    recentBoardIds: [],
    refreshRecentBoards: () => {},
    isTeamExpanded: () => false,
    setTeamExpanded: () => {},
});

export function useSidebar() {
    return useContext(SidebarContext);
}

const COLLAPSED_KEY = "pulseboard-sidebar-collapsed";
const EXPANDED_TEAMS_KEY = "pulseboard-sidebar-expanded-teams";
const EMPTY_IDS: string[] = [];
const EMPTY_BOARDS: Board[] = [];

function readStorage(key: string): string | null {
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
}

function writeStorage(key: string, value: string) {
    try {
        localStorage.setItem(key, value);
    } catch {
        // Storage unavailable — the preference just won't persist.
    }
}

/**
 * Save a UI preference with an optimistic local value. `rollback` runs when
 * the request fails (validation error or server/network exception), but not
 * when Inertia cancels it because the user navigated or saved again.
 */
function patchUiPreferences(
    data: Parameters<typeof router.patch>[1],
    rollback: () => void,
) {
    let settled = false;
    router.patch(route("profile.ui-preferences.update"), data, {
        preserveScroll: true,
        preserveState: true,
        // The redirect back only needs the refreshed user preferences.
        only: ["auth"],
        onSuccess: () => {
            settled = true;
        },
        onCancel: () => {
            settled = true;
        },
        onFinish: () => {
            if (!settled) rollback();
        },
    });
}

interface SidebarProviderProps {
    children: ReactNode;
    currentTeamOverride?: Team;
    sidebarBoardsOverride?: Board[];
}

export function SidebarProvider({
    children,
    currentTeamOverride,
    sidebarBoardsOverride,
}: SidebarProviderProps) {
    const { teams: sharedTeams, auth } = usePage<PageProps>().props;
    const uiPreferences = auth.user?.ui_preferences;
    const serverBoardOrder = uiPreferences?.board_order;
    const serverStarred = uiPreferences?.starred_boards ?? EMPTY_IDS;

    const [collapsed, setCollapsedRaw] = useState<boolean>(
        () => readStorage(COLLAPSED_KEY) === "true",
    );

    const setCollapsed = useCallback((value: boolean) => {
        setCollapsedRaw(value);
        writeStorage(COLLAPSED_KEY, String(value));
    }, []);

    // --- Board order (optimistic, keyed by team ID) -------------------------

    const [localBoardOrder, setLocalBoardOrder] = useState<
        Record<string, string[]>
    >({});

    // Server props win again once they update (e.g. after the save lands).
    useEffect(() => {
        setLocalBoardOrder({});
    }, [serverBoardOrder]);

    const localBoardOrderRef = useRef(localBoardOrder);
    localBoardOrderRef.current = localBoardOrder;

    const reorderBoards = useCallback(
        (teamId: string, orderedBoardIds: string[]) => {
            const previous = localBoardOrderRef.current[teamId];

            setLocalBoardOrder((prev) => ({
                ...prev,
                [teamId]: orderedBoardIds,
            }));

            patchUiPreferences(
                { board_order: { [teamId]: orderedBoardIds } },
                () =>
                    setLocalBoardOrder((cur) => {
                        if (previous) {
                            return { ...cur, [teamId]: previous };
                        }
                        const { [teamId]: _removed, ...rest } = cur;
                        return rest;
                    }),
            );
        },
        [],
    );

    // --- Teams with ordered boards -----------------------------------------

    const teams = useMemo<Team[]>(
        () =>
            (sharedTeams ?? []).map((team) => {
                // Board pages pass a fresher list of the current team's
                // boards; prefer it when present.
                const rawBoards =
                    currentTeamOverride?.id === team.id &&
                    sidebarBoardsOverride &&
                    sidebarBoardsOverride.length > 0
                        ? sidebarBoardsOverride
                        : (team.boards ?? []);
                const order =
                    localBoardOrder[team.id] ?? serverBoardOrder?.[team.id];
                return { ...team, boards: applySavedOrder(rawBoards, order) };
            }),
        [
            sharedTeams,
            currentTeamOverride?.id,
            sidebarBoardsOverride,
            localBoardOrder,
            serverBoardOrder,
        ],
    );

    const currentTeam = useMemo<Team | undefined>(() => {
        if (!currentTeamOverride) return undefined;
        const shared = teams.find((team) => team.id === currentTeamOverride.id);
        if (!shared) {
            return {
                ...currentTeamOverride,
                boards: applySavedOrder(
                    sidebarBoardsOverride ?? currentTeamOverride.boards ?? [],
                    localBoardOrder[currentTeamOverride.id] ??
                        serverBoardOrder?.[currentTeamOverride.id],
                ),
            };
        }
        return {
            ...shared,
            ...currentTeamOverride,
            pivot: currentTeamOverride.pivot ?? shared.pivot,
            boards: shared.boards,
        };
    }, [
        currentTeamOverride,
        teams,
        sidebarBoardsOverride,
        localBoardOrder,
        serverBoardOrder,
    ]);

    const boards = currentTeam?.boards ?? EMPTY_BOARDS;

    // --- Starred boards (optimistic) ----------------------------------------

    const [localStarred, setLocalStarred] = useState<string[] | null>(null);
    const serverStarredKey = serverStarred.join(",");

    useEffect(() => {
        setLocalStarred(null);
    }, [serverStarredKey]);

    const starredBoardIds = localStarred ?? serverStarred;
    const starredRef = useRef(starredBoardIds);
    starredRef.current = starredBoardIds;

    const toggleStar = useCallback((boardId: string) => {
        const previous = starredRef.current;
        const next = toggleStarredBoard(previous, boardId);
        setLocalStarred(next);
        patchUiPreferences({ starred_boards: next }, () =>
            setLocalStarred(previous),
        );
    }, []);

    // --- Recent boards ------------------------------------------------------

    const [recentBoardIds, setRecentBoardIds] = useState<string[]>(() =>
        getRecentBoardIds(),
    );

    const refreshRecentBoards = useCallback(() => {
        setRecentBoardIds(getRecentBoardIds());
    }, []);

    // The layout persists across visits, so re-read after each navigation.
    useEffect(
        () => router.on("navigate", () => refreshRecentBoards()),
        [refreshRecentBoards],
    );

    // --- Team expansion -----------------------------------------------------

    const [expandedTeams, setExpandedTeams] = useState<Record<string, boolean>>(
        () => parseExpandedTeams(readStorage(EXPANDED_TEAMS_KEY)),
    );

    const persistExpanded = useCallback((next: Record<string, boolean>) => {
        writeStorage(EXPANDED_TEAMS_KEY, JSON.stringify(next));
        return next;
    }, []);

    // Entering a team's pages re-opens its section if the user had closed it.
    const currentTeamId = currentTeam?.id;
    useEffect(() => {
        if (!currentTeamId) return;
        setExpandedTeams((prev) => {
            if (prev[currentTeamId] !== false) return prev;
            const { [currentTeamId]: _removed, ...rest } = prev;
            return persistExpanded(rest);
        });
    }, [currentTeamId, persistExpanded]);

    const teamCount = teams.length;
    const isTeamExpanded = useCallback(
        (teamId: string) =>
            resolveTeamExpanded(
                teamId,
                expandedTeams,
                currentTeamId,
                teamCount,
            ),
        [expandedTeams, currentTeamId, teamCount],
    );

    const setTeamExpanded = useCallback(
        (teamId: string, expanded: boolean) => {
            setExpandedTeams((prev) =>
                persistExpanded({ ...prev, [teamId]: expanded }),
            );
        },
        [persistExpanded],
    );

    const value = useMemo<SidebarContextValue>(
        () => ({
            collapsed,
            setCollapsed,
            currentTeam,
            boards,
            teams,
            reorderBoards,
            starredBoardIds,
            toggleStarredBoard: toggleStar,
            recentBoardIds,
            refreshRecentBoards,
            isTeamExpanded,
            setTeamExpanded,
        }),
        [
            collapsed,
            setCollapsed,
            currentTeam,
            boards,
            teams,
            reorderBoards,
            starredBoardIds,
            toggleStar,
            recentBoardIds,
            refreshRecentBoards,
            isTeamExpanded,
            setTeamExpanded,
        ],
    );

    return (
        <SidebarContext.Provider value={value}>
            {children}
        </SidebarContext.Provider>
    );
}
