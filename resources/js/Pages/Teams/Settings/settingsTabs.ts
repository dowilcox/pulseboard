/**
 * Tabs on the team settings page, synced to the `?tab=` query parameter.
 * Which tabs exist depends on the server-provided `can` flags, so a member
 * never sees a section whose every control would 403.
 */

export type TeamSettingsTab =
    | "general"
    | "members"
    | "labels"
    | "integrations"
    | "api"
    | "danger";

export interface TeamSettingsCan {
    updateTeam: boolean;
    manageMembers: boolean;
    manageAdmins: boolean;
    manageLabels: boolean;
    manageIntegrations: boolean;
    manageBots: boolean;
    deleteTeam: boolean;
}

export const TEAM_SETTINGS_TAB_LABELS: Record<TeamSettingsTab, string> = {
    general: "General",
    members: "Members",
    labels: "Labels",
    integrations: "Integrations",
    api: "API & bots",
    danger: "Danger zone",
};

/** Older URLs and natural aliases that should land on a current tab. */
const TAB_ALIASES: Record<string, TeamSettingsTab> = {
    gitlab: "integrations",
    figma: "integrations",
    bots: "api",
    tokens: "api",
    "api-tokens": "api",
    delete: "danger",
};

/** Tabs the current user may open, in display order. */
export function availableSettingsTabs(can: TeamSettingsCan): TeamSettingsTab[] {
    const tabs: TeamSettingsTab[] = ["general", "members", "labels"];
    if (can.manageIntegrations) tabs.push("integrations");
    if (can.manageBots) tabs.push("api");
    if (can.deleteTeam) tabs.push("danger");
    return tabs;
}

/**
 * Resolve a requested `?tab=` value to a tab the user can open, falling back
 * to the first available tab for unknown or unavailable values.
 */
export function resolveSettingsTab(
    requested: string | null | undefined,
    available: TeamSettingsTab[],
): TeamSettingsTab {
    const fallback = available[0] ?? "general";
    if (!requested) return fallback;
    const normalized = requested.trim().toLowerCase();
    const tab = (TAB_ALIASES[normalized] ?? normalized) as TeamSettingsTab;
    return available.includes(tab) ? tab : fallback;
}
