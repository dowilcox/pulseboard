import { usePage } from '@inertiajs/react';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Board, PageProps, Team } from '@/types';

interface SidebarContextValue {
    selectedTeamId: string | null;
    setSelectedTeamId: (id: string | null) => void;
    collapsed: boolean;
    setCollapsed: (collapsed: boolean) => void;
    currentTeam: Team | undefined;
    boards: Board[];
}

const SidebarContext = createContext<SidebarContextValue>({
    selectedTeamId: null,
    setSelectedTeamId: () => {},
    collapsed: false,
    setCollapsed: () => {},
    currentTeam: undefined,
    boards: [],
});

export function useSidebar() {
    return useContext(SidebarContext);
}

const TEAM_KEY = 'pulseboard-selected-team';
const COLLAPSED_KEY = 'pulseboard-sidebar-collapsed';

interface SidebarProviderProps {
    children: ReactNode;
    currentTeamOverride?: Team;
    activeBoardId?: string;
}

export function SidebarProvider({ children, currentTeamOverride, activeBoardId }: SidebarProviderProps) {
    const { teams: sharedTeams } = usePage<PageProps>().props;
    const teams = sharedTeams ?? [];

    const [selectedTeamId, setSelectedTeamIdRaw] = useState<string | null>(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem(TEAM_KEY);
        }
        return null;
    });

    const [collapsed, setCollapsedRaw] = useState<boolean>(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem(COLLAPSED_KEY) === 'true';
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
        if (selectedTeamId && teams.length > 0 && !teams.some((t) => t.id === selectedTeamId)) {
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

    const boards = useMemo(() => currentTeam?.boards ?? [], [currentTeam]);

    const value = useMemo<SidebarContextValue>(
        () => ({
            selectedTeamId,
            setSelectedTeamId,
            collapsed,
            setCollapsed,
            currentTeam,
            boards,
        }),
        [selectedTeamId, collapsed, currentTeam, boards],
    );

    return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}
