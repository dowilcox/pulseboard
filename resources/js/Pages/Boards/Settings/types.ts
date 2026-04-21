import type { TaskTemplate } from "@/types";

export interface ColumnFormData {
    id?: string;
    name: string;
    color: string;
    wip_limit: number | "";
    is_done_column: boolean;
    _destroy?: boolean;
}

export interface TaskTemplateFormData {
    name: string;
    description_template: string;
    priority: TaskTemplate["priority"];
    effort_estimate: number | "";
}
