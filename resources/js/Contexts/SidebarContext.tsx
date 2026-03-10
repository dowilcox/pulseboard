import { router, usePage } from "@inertiajs/react";
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from "react";
import type { Board, PageProps, Team } from "@/types";

interface SidebarContextValue {
    selectedTeamId: string | null;
    setSelectedTeamId: (id: string | null) => void;
    collapsed: boolean;
    setCollapsed: (collapsed: boolean) => void;
    currentTeam: Team | undefined;
    boards: Board[];
    reorderBoards: (teamId: string, orderedBoardIds: string[]) => void;
}

const SidebarContext = createContext<SidebarContextValue>({
    selectedTeamId: null,
    setSelectedTeamId: () => {},
    collapsed: false,
    setCollapsed: () => {},
    currentTeam: undefined,
    boards: [],
    reorderBoards: () => {},
});

export function useSidebar() {
    return useContext(SidebarContext);
}

const TEAM_KEY = "pulseboard-selected-team";
const COLLAPSED_KEY = "pulseboard-sidebar-collapsed";

interface SidebarProviderProps {
    children: ReactNode;
    currentTeamOverride?: Team;
    activeBoardId?: string;
}

export function SidebarProvider({
    children,
    currentTeamOverride,
    activeBoardId,
}: SidebarProviderProps) {
    const { teams: sharedTeams } = usePage<PageProps>().props;
    const teams = sharedTeams ?? [];

    const [selectedTeamId, setSelectedTeamIdRaw] = useState<string | null>(
        () => {
            if (typeof window !== "undefined") {
                return localStorage.getItem(TEAM_KEY);
            }
            return null;
        },
    );

    const [collapsed, setCollapsedRaw] = useState<boolean>(() => {
        if (typeof window !== "undefined") {
            return localStorage.getItem(COLLAPSED_KEY) === "true";
        }
        return false;
    });

    // Sync when a page explicitly provides a team — persist so it survives navigation
    useEffect(() => {
        if (currentTeamOverride) {
            setSelectedTeamIdRaw(currentTeamOverride.id);
            localStorage.setItem(TEAM_KEY, currentTeamOverride.id);
        }
    }, [currentTeamOverride?.id]);

    // Clear stored team if it no longer exists in the teams array
    useEffect(() => {
        if (
            selectedTeamId &&
            teams.length > 0 &&
            !teams.some((t) => t.id === selectedTeamId)
        ) {
            setSelectedTeamIdRaw(null);
            localStorage.removeItem(TEAM_KEY);
        }
    }, [selectedTeamId, teams]);

    // Persist to localStorage
    const setSelectedTeamId = (id: string | null) => {
        setSelectedTeamIdRaw(id);
        if (id) {
            localStorage.setItem(TEAM_KEY, id);
        } else {
            localStorage.removeItem(TEAM_KEY);
        }
    };

    const setCollapsed = (value: boolean) => {
        setCollapsedRaw(value);
        localStorage.setItem(COLLAPSED_KEY, String(value));
    };

    const currentTeam = useMemo(
        () => teams.find((t) => t.id === selectedTeamId),
        [teams, selectedTeamId],
    );

    const { auth } = usePage<PageProps>().props;
    const serverBoardOrder = auth.user?.ui_preferences?.board_order;

    // Optimistic local board order — keyed by team ID
    const [localBoardOrder, setLocalBoardOrder] = useState<
        Record<string, string[]>
    >({});

    // Sync local state when server props update (e.g. on full page navigation)
    useEffect(() => {
        setLocalBoardOrder({});
    }, [serverBoardOrder]);

    const boards = useMemo(() => {
        const rawBoards = currentTeam?.boards ?? [];
        if (!currentTeam) return rawBoards;
        const order =
            localBoardOrder[currentTeam.id] ??
            serverBoardOrder?.[currentTeam.id];
        if (!order) return rawBoards;
        const boardMap = new Map(rawBoards.map((b) => [b.id, b]));
        const ordered: Board[] = [];
        // Add boards in the saved order
        for (const id of order) {
            const board = boardMap.get(id);
            if (board) {
                ordered.push(board);
                boardMap.delete(id);
            }
        }
        // Append any boards not in the saved order (newly created)
        for (const board of boardMap.values()) {
            ordered.push(board);
        }
        return ordered;
    }, [currentTeam, serverBoardOrder, localBoardOrder]);

    const reorderBoards = useCallback(
        (teamId: string, orderedBoardIds: string[]) => {
            // Optimistically update local state so UI doesn't snap back
            setLocalBoardOrder((prev) => ({
                ...prev,
                [teamId]: orderedBoardIds,
            }));
            router.patch(
                route("profile.ui-preferences.update"),
                { board_order: { [teamId]: orderedBoardIds } },
                { preserveScroll: true, preserveState: true },
            );
        },
        [],
    );

    const value = useMemo<SidebarContextValue>(
        () => ({
            selectedTeamId,
            setSelectedTeamId,
            collapsed,
            setCollapsed,
            currentTeam,
            boards,
            reorderBoards,
        }),
        [selectedTeamId, collapsed, currentTeam, boards, reorderBoards],
    );

    return (
        <SidebarContext.Provider value={value}>
            {children}
        </SidebarContext.Provider>
    );
}
