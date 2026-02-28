export interface NotificationPreferenceChannels {
    in_app: boolean;
    email: boolean;
}

export interface NotificationPreferences {
    task_assigned?: NotificationPreferenceChannels;
    task_commented?: NotificationPreferenceChannels;
    task_mentioned?: NotificationPreferenceChannels;
    task_due_soon?: NotificationPreferenceChannels;
    task_overdue?: NotificationPreferenceChannels;
}

export interface User {
    id: string;
    name: string;
    email: string;
    avatar_url?: string;
    auth_provider: 'local' | 'saml2' | 'okta';
    is_admin: boolean;
    theme_preference: 'light' | 'dark' | 'system';
    email_notification_prefs?: NotificationPreferences;
    email_verified_at?: string;
    created_at: string;
    updated_at: string;
}

export interface Organization {
    id: string;
    name: string;
    slug: string;
    settings: Record<string, unknown>;
}

export interface Team {
    id: string;
    name: string;
    slug: string;
    description?: string;
    settings: Record<string, unknown>;
    created_at: string;
    updated_at: string;
    members?: TeamMember[];
    boards?: Board[];
}

export interface TeamMember {
    id: string;
    team_id: string;
    user_id: string;
    role: 'owner' | 'admin' | 'member';
    created_at: string;
    user?: User;
}

export interface Board {
    id: string;
    team_id: string;
    name: string;
    description?: string;
    is_archived: boolean;
    sort_order: number;
    created_at: string;
    updated_at: string;
    columns?: Column[];
    team?: Team;
}

export interface Column {
    id: string;
    board_id: string;
    name: string;
    color: string;
    wip_limit?: number;
    sort_order: number;
    is_done_column: boolean;
    created_at: string;
    updated_at: string;
    tasks?: Task[];
}

export interface Task {
    id: string;
    board_id: string;
    column_id: string;
    task_number?: number;
    parent_task_id?: string;
    title: string;
    description?: string;
    priority: 'urgent' | 'high' | 'medium' | 'low' | 'none';
    sort_order: number;
    due_date?: string;
    effort_estimate?: number;
    custom_fields: Record<string, unknown>;
    created_by: string;
    created_at: string;
    updated_at: string;
    assignees?: User[];
    labels?: Label[];
    subtasks?: Task[];
    creator?: User;
    gitlab_links?: TaskGitlabLink[];
    comments_count?: number;
    attachments_count?: number;
    subtasks_count?: number;
    completed_subtasks_count?: number;
}

export interface Label {
    id: string;
    team_id: string;
    name: string;
    color: string;
    created_at: string;
}

export interface Comment {
    id: string;
    task_id: string;
    user_id: string;
    body: string;
    created_at: string;
    updated_at: string;
    user?: User;
}

export interface Activity {
    id: string;
    task_id: string;
    user_id?: string;
    action: string;
    changes: Record<string, unknown>;
    created_at: string;
    user?: User;
}

export interface Attachment {
    id: string;
    task_id: string;
    user_id: string;
    filename: string;
    file_path: string;
    file_size: number;
    mime_type: string;
    created_at: string;
    user?: User;
}

export interface AppNotification {
    id: string;
    type: string;
    data: {
        type: string;
        task_id: string;
        task_title: string;
        board_id: string;
        team_id: string;
        message: string;
        [key: string]: unknown;
    };
    read_at: string | null;
    created_at: string;
}

export interface GitlabConnection {
    id: string;
    name: string;
    base_url: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface GitlabProject {
    id: string;
    gitlab_connection_id: string;
    team_id: string;
    gitlab_project_id: number;
    name: string;
    path_with_namespace: string;
    default_branch: string;
    web_url: string;
    webhook_id?: number;
    last_synced_at?: string;
    created_at: string;
    updated_at: string;
    connection?: GitlabConnection;
}

export interface TaskGitlabLink {
    id: string;
    task_id: string;
    gitlab_project_id: string;
    link_type: 'issue' | 'merge_request' | 'branch';
    gitlab_iid?: number;
    gitlab_ref?: string;
    title?: string;
    state?: string;
    url: string;
    pipeline_status?: string;
    author?: string;
    meta: Record<string, unknown>;
    last_synced_at: string;
    created_at: string;
    updated_at: string;
    gitlab_project?: GitlabProject;
}

export interface SavedFilter {
    id: string;
    board_id: string;
    user_id: string;
    name: string;
    filter_config: Record<string, unknown>;
    is_default: boolean;
    created_at: string;
    updated_at: string;
}

export interface AutomationRule {
    id: string;
    board_id: string;
    name: string;
    is_active: boolean;
    trigger_type: string;
    trigger_config: Record<string, unknown>;
    action_type: string;
    action_config: Record<string, unknown>;
    created_at: string;
    updated_at: string;
}

export interface BoardTemplate {
    id: string;
    name: string;
    description?: string;
    created_by: string;
    template_data: Record<string, unknown>;
    created_at: string;
    updated_at: string;
    creator?: User;
}

export type BoardViewMode = 'kanban' | 'list' | 'calendar' | 'timeline' | 'workload';

export type PageProps<
    T extends Record<string, unknown> = Record<string, unknown>,
> = T & {
    auth: {
        user: User;
    };
    currentTeam?: Team;
    teams?: Team[];
    unreadNotificationsCount?: number;
};
