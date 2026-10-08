import LayoutHeader from "@/Components/Layout/LayoutHeader";
import PageHeader from "@/Components/Layout/PageHeader";
import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import type {
    FigmaConnection,
    Label,
    PageProps,
    Team,
    UserWithTeamPivot,
} from "@/types";
import { Head, router, usePage } from "@inertiajs/react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import { type ReactElement, useMemo, useState } from "react";
import ApiTokens, { type BotWithTokens } from "./Settings/ApiTokens";
import DangerZoneSection from "./Settings/DangerZoneSection";
import FigmaIntegration from "./Settings/FigmaIntegration";
import GeneralSection, {
    type ImageUploadRules,
} from "./Settings/GeneralSection";
import GitlabProjects, { type GitlabSettings } from "./Settings/GitlabProjects";
import LabelsSection from "./Settings/LabelsSection";
import MembersSection from "./Settings/MembersSection";
import {
    availableSettingsTabs,
    resolveSettingsTab,
    TEAM_SETTINGS_TAB_LABELS,
    type TeamSettingsCan,
    type TeamSettingsTab,
} from "./Settings/settingsTabs";

interface Props {
    team: Team;
    sidebarBoards?: Team["boards"];
    labels: Label[];
    members: UserWithTeamPivot[];
    deactivatedMembers: UserWithTeamPivot[];
    tab?: string | null;
    can: TeamSettingsCan;
    imageUpload: ImageUploadRules;
    /** Only sent to users who can manage integrations. */
    gitlab?: GitlabSettings | null;
    figmaConnections?: FigmaConnection[] | null;
    bots?: BotWithTokens[] | null;
}

export default function TeamSettings({
    team,
    labels,
    members,
    deactivatedMembers,
    tab: requestedTab,
    can,
    imageUpload,
    gitlab,
    figmaConnections,
    bots,
}: Props) {
    const { auth } = usePage<PageProps>().props;

    const tabs = useMemo(() => availableSettingsTabs(can), [can]);
    const [tab, setTab] = useState<TeamSettingsTab>(() =>
        resolveSettingsTab(requestedTab, tabs),
    );
    // If permissions change (e.g. you demoted yourself), fall back to a tab
    // that still exists.
    const activeTab = tabs.includes(tab) ? tab : tabs[0];

    const readOnly = !can.updateTeam && !can.manageMembers;

    const changeTab = (next: TeamSettingsTab) => {
        setTab(next);
        // Keep ?tab= in sync (shareable, survives reloads and redirect-backs)
        // without a server round trip.
        router.replace({
            url: route("teams.settings", { team: team.slug, tab: next }, false),
            preserveState: true,
            preserveScroll: true,
        });
    };

    return (
        <>
            <Head title={`Team settings — ${team.name}`} />
            <LayoutHeader>
                <PageHeader
                    title="Team settings"
                    breadcrumbs={[
                        {
                            label: team.name,
                            href: route("teams.show", team.slug),
                            teamSwitcher: true,
                        },
                    ]}
                />
            </LayoutHeader>

            <Box sx={{ maxWidth: 960, minWidth: 0 }}>
                {readOnly && (
                    <Alert severity="info" sx={{ mb: 2 }}>
                        You're viewing this team's settings as a member. Team
                        owners and admins can make changes.
                    </Alert>
                )}

                <Tabs
                    value={activeTab}
                    onChange={(_, value: TeamSettingsTab) => changeTab(value)}
                    variant="scrollable"
                    scrollButtons="auto"
                    allowScrollButtonsMobile
                    aria-label="Team settings sections"
                    sx={{ borderBottom: 1, borderColor: "divider", mb: 3 }}
                >
                    {tabs.map((t) => (
                        <Tab
                            key={t}
                            value={t}
                            label={TEAM_SETTINGS_TAB_LABELS[t]}
                            id={`team-settings-tab-${t}`}
                            aria-controls={`team-settings-panel-${t}`}
                            sx={
                                t === "danger"
                                    ? { color: "error.main" }
                                    : undefined
                            }
                        />
                    ))}
                </Tabs>

                <Box
                    role="tabpanel"
                    id={`team-settings-panel-${activeTab}`}
                    aria-labelledby={`team-settings-tab-${activeTab}`}
                >
                    {activeTab === "general" && (
                        <GeneralSection
                            team={team}
                            canUpdate={can.updateTeam}
                            imageUpload={imageUpload}
                        />
                    )}

                    {activeTab === "members" && (
                        <MembersSection
                            team={team}
                            members={members}
                            deactivatedMembers={deactivatedMembers}
                            currentUserId={auth.user.id}
                            canManageMembers={can.manageMembers}
                            canManageAdmins={can.manageAdmins}
                        />
                    )}

                    {activeTab === "labels" && (
                        <LabelsSection
                            team={team}
                            labels={labels}
                            canManage={can.manageLabels}
                        />
                    )}

                    {activeTab === "integrations" && (
                        <Stack spacing={3}>
                            {gitlab && (
                                <GitlabProjects
                                    team={team}
                                    projects={gitlab.projects}
                                    connections={gitlab.connections}
                                    activeConnections={gitlab.activeConnections}
                                />
                            )}
                            {figmaConnections && (
                                <FigmaIntegration
                                    team={team}
                                    connections={figmaConnections}
                                />
                            )}
                        </Stack>
                    )}

                    {activeTab === "api" && bots && (
                        <ApiTokens team={team} bots={bots} />
                    )}

                    {activeTab === "danger" && (
                        <DangerZoneSection team={team} />
                    )}
                </Box>
            </Box>
        </>
    );
}

TeamSettings.layout = (props: Props) => [
    AuthenticatedLayout,
    { currentTeam: props.team, sidebarBoards: props.sidebarBoards ?? [] },
];
