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
 * Returns the task title prefixed with the GitLab project slug if one is associated.
 */
export function getPrefixedTitle(task: Task): string {
    const prefix = getGitlabPrefix(task);
    return prefix ? `${prefix} ${task.title}` : task.title;
}
