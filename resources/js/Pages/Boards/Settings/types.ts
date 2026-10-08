import type { TaskTemplate } from "@/types";

export interface ColumnFormData {
    id?: string;
    /** Stable React key for columns that have no id yet. */
    _key?: string;
    name: string;
    color: string;
    wip_limit: number | "";
    is_done_column: boolean;
    /** Tasks in the column when the page loaded (existing columns only). */
    tasks_count?: number;
    _destroy?: boolean;
    /** For a removed column: the surviving column its tasks move to. */
    move_tasks_to?: string | null;
    /** For a removed column: the user chose to delete its tasks. */
    delete_tasks?: boolean;
}

export interface TaskTemplateFormData {
    name: string;
    description_template: string;
    priority: TaskTemplate["priority"];
    effort_estimate: number | "";
}
