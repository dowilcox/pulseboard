import type { Task } from "@/types";

/**
 * Returns the GitLab project slug prefix for display, e.g. "[my-group/my-project]"
 * Returns empty string if no project is associated.
 */
export function getGitlabPrefix(task: Task): string {
    if (!task.gitlab_project) return "";
    return `[${task.gitlab_project.path_with_namespace}]`;
}

/**
 * Returns the full display label: #1 [group/project] Title
 */
export function getTaskLabel(task: Task): string {
    const parts: string[] = [];
    if (task.task_number) parts.push(`#${task.task_number}`);
    const prefix = getGitlabPrefix(task);
    if (prefix) parts.push(prefix);
    parts.push(task.title);
    return parts.join(" ");
}

/**
 * Returns the task title prefixed with the GitLab project slug if one is associated.
 */
export function getPrefixedTitle(task: Task): string {
    const prefix = getGitlabPrefix(task);
    return prefix ? `${prefix} ${task.title}` : task.title;
}
