import type { Task } from "@/types";

/** Server-computed counts for tasks assigned to the user on active boards. */
export interface DashboardStats {
    open: number;
    overdue: number;
    due_next_7_days: number;
    completed_last_7_days: number;
    completed_previous_7_days: number;
}

interface TeamRef {
    id: string;
    name: string;
    slug: string;
}

export interface DashboardBoard {
    id: string;
    name: string;
    slug: string;
    image_url: string | null;
    team: TeamRef;
    total_tasks: number;
    /** Completed or sitting in a done column. */
    done_tasks: number;
    open_tasks: number;
    my_open_tasks: number;
    last_activity_at: string | null;
}

export interface DashboardTask extends Task {
    board?: {
        id: string;
        name: string;
        slug: string;
        team?: TeamRef;
    };
    column?: {
        id: string;
        name: string;
        color: string;
        is_done_column: boolean;
    };
}

export interface DashboardActivity {
    id: string;
    action: string;
    changes: Record<string, unknown>;
    created_at: string;
    user: { id: string; name: string; avatar_url?: string } | null;
    task: {
        id: string;
        title: string;
        task_number: number | null;
        slug: string | null;
    };
    board: { id: string; name: string; slug: string };
    team: TeamRef;
}
