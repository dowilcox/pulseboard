import { PRIORITY_COLORS } from "@/constants/priorities";
import type { Task } from "@/types";
import { getContrastText } from "@/utils/colorContrast";
import { formatDueDate } from "@/utils/formatTimestamp";
import { getGitlabPrefix } from "@/utils/gitlabPrefix";
import { harbor } from "@/theme/harbor";
import MergeRequestChip from "@/Components/Gitlab/MergeRequestChip";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import LockIcon from "@mui/icons-material/Lock";
import SpeedIcon from "@mui/icons-material/Speed";
import Avatar from "@mui/material/Avatar";
import AvatarGroup from "@mui/material/AvatarGroup";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { memo } from "react";

interface Props {
    task: Task;
    onClick?: (task: Task) => void;
    interactive?: boolean;
}

const SR_ONLY = {
    position: "absolute",
    width: "1px",
    height: "1px",
    p: 0,
    m: -1,
    overflow: "hidden",
    clip: "rect(0 0 0 0)",
    whiteSpace: "nowrap",
    border: 0,
};

// Neutral track pill used for comment/due/subtask/effort chips in the footer
const TRACK_PILL = {
    display: "inline-flex",
    alignItems: "center",
    gap: "5px",
    color: harbor.sub,
    bgcolor: harbor.track,
    fontSize: "11.5px",
    fontWeight: 600,
    borderRadius: "999px",
    padding: "3px 9px",
    whiteSpace: "nowrap",
    flex: "none",
    fontVariantNumeric: "tabular-nums",
};

/**
 * Tinted pill colors for a user-defined label hex: dark fg on a pale bg of
 * the same hue. Falls back to the raw color + contrast text on bad input.
 */
function labelTint(hexColor: string): { fg: string; bg: string } {
    const hex = (hexColor ?? "").replace("#", "");
    const fullHex =
        hex.length === 3
            ? hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2]
            : hex;
    const r = parseInt(fullHex.substring(0, 2), 16);
    const g = parseInt(fullHex.substring(2, 4), 16);
    const b = parseInt(fullHex.substring(4, 6), 16);
    if (isNaN(r) || isNaN(g) || isNaN(b) || fullHex.length !== 6) {
        return {
            fg: getContrastText(hexColor || "#000"),
            bg: hexColor || harbor.track,
        };
    }
    // Pale tint of the hue for the bg, darkened hue for the fg
    const mix = (c: number, target: number, amount: number) =>
        Math.round(c + (target - c) * amount);
    const bg = `rgb(${mix(r, 235, 0.82)}, ${mix(g, 238, 0.82)}, ${mix(b, 242, 0.82)})`;
    const fg = `rgb(${mix(r, 20, 0.55)}, ${mix(g, 25, 0.55)}, ${mix(b, 35, 0.55)})`;
    return { fg, bg };
}

/** Due within the next 48 hours (or overdue) — gets the warm dueSoon tint. */
function isDueSoon(dueDate: string): boolean {
    const due = new Date(dueDate).getTime();
    if (isNaN(due)) return false;
    return due - Date.now() < 48 * 60 * 60 * 1000;
}

const TaskCard = memo(function TaskCard({
    task,
    onClick,
    interactive = true,
}: Props) {
    const isCompleted = task.completed_at != null;
    const isBlocked = (task.blocked_by ?? []).length > 0;
    const checklistProgress = task.checklist_progress;
    const dueSoon =
        task.due_date != null && !isCompleted && isDueSoon(task.due_date);

    const gitlabPrefixLabel = getGitlabPrefix(task);
    const visibleTaskLabel = [
        task.task_number ? `#${task.task_number}` : null,
        gitlabPrefixLabel,
        task.title,
    ]
        .filter(Boolean)
        .join(" ");

    return (
        <Paper
            elevation={0}
            role={interactive ? "button" : undefined}
            tabIndex={interactive ? 0 : undefined}
            onClick={interactive ? () => onClick?.(task) : undefined}
            onKeyDown={
                interactive
                    ? (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              onClick?.(task);
                          }
                      }
                    : undefined
            }
            sx={{
                p: "14px 15px",
                cursor: "pointer",
                borderRadius: "14px",
                bgcolor: harbor.card,
                color: harbor.ink,
                boxShadow: harbor.cardShadow,
                transition: "box-shadow 150ms ease-out",
                display: "flex",
                flexDirection: "column",
                gap: 1,
                "&:hover": {
                    boxShadow: harbor.cardShadowHover,
                },
                "&:focus-visible": {
                    outline: "2px solid",
                    outlineColor: "primary.main",
                    outlineOffset: 1,
                },
            }}
        >
            {(task.priority !== "none" || isCompleted || isBlocked) && (
                <Box component="span" sx={SR_ONLY}>
                    {task.priority !== "none"
                        ? `${task.priority} priority`
                        : ""}
                    {isCompleted ? " completed" : ""}
                    {isBlocked ? " blocked" : ""}
                </Box>
            )}

            {/* Labels — tinted pills */}
            {task.labels && task.labels.length > 0 && (
                <Box sx={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                    {task.labels.map((label) => {
                        const tint = labelTint(label.color);
                        return (
                            <Box
                                key={label.id}
                                component="span"
                                sx={{
                                    fontSize: "11px",
                                    fontWeight: 700,
                                    color: tint.fg,
                                    bgcolor: tint.bg,
                                    padding: "3px 9px",
                                    borderRadius: "999px",
                                    whiteSpace: "nowrap",
                                    lineHeight: 1.3,
                                }}
                            >
                                {label.name}
                            </Box>
                        );
                    })}
                </Box>
            )}

            {/* Meta row: priority dot + task number + GitLab prefix + blocked */}
            {(gitlabPrefixLabel ||
                task.task_number ||
                isBlocked ||
                task.priority !== "none") && (
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                        color: harbor.faint,
                        fontSize: "11.5px",
                        fontVariantNumeric: "tabular-nums",
                        lineHeight: 1,
                    }}
                >
                    {task.priority !== "none" && (
                        <Tooltip title={`${task.priority} priority`}>
                            <Box
                                component="span"
                                sx={{
                                    width: 9,
                                    height: 9,
                                    borderRadius: "50%",
                                    bgcolor:
                                        PRIORITY_COLORS[task.priority] ??
                                        harbor.faint,
                                    flexShrink: 0,
                                }}
                            />
                        </Tooltip>
                    )}
                    {task.task_number && (
                        <Box component="span" sx={{ fontWeight: 700 }}>
                            #{task.task_number}
                        </Box>
                    )}
                    {gitlabPrefixLabel && (
                        <Box component="span" sx={{ whiteSpace: "nowrap" }}>
                            {gitlabPrefixLabel}
                        </Box>
                    )}
                    {isBlocked && (
                        <Tooltip title="Blocked by dependencies">
                            <LockIcon
                                sx={{
                                    fontSize: 13,
                                    color: harbor.accent,
                                    flexShrink: 0,
                                }}
                            />
                        </Tooltip>
                    )}
                </Box>
            )}

            {/* Title + completion indicator */}
            <Box sx={{ display: "flex", alignItems: "flex-start", gap: 0.5 }}>
                {isCompleted && (
                    <Tooltip title="Completed">
                        <CheckCircleOutlineIcon
                            sx={{
                                fontSize: 16,
                                color: "success.main",
                                mt: 0.25,
                                flexShrink: 0,
                            }}
                        />
                    </Tooltip>
                )}
                <Typography
                    variant="body2"
                    sx={{
                        fontSize: "14.5px",
                        fontWeight: 600,
                        textDecoration: isCompleted ? "line-through" : "none",
                        color: isCompleted ? harbor.sub : harbor.ink,
                        lineHeight: 1.4,
                    }}
                >
                    {task.title}
                </Typography>
            </Box>

            {/* GitLab MR badges */}
            {task.gitlab_refs &&
                task.gitlab_refs.filter((r) => r.ref_type === "merge_request")
                    .length > 0 && (
                    <Box
                        sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {task.gitlab_refs
                            .filter((r) => r.ref_type === "merge_request")
                            .map((ref) => (
                                <MergeRequestChip
                                    key={ref.id}
                                    gitlabRef={ref}
                                />
                            ))}
                    </Box>
                )}

            {/* Checklist progress — segmented bar */}
            {checklistProgress && checklistProgress.total > 0 && (
                <Box
                    sx={{ display: "flex", alignItems: "center", gap: 1 }}
                    role="progressbar"
                    aria-label={`${visibleTaskLabel} checklist progress`}
                    aria-valuenow={checklistProgress.completed}
                    aria-valuemin={0}
                    aria-valuemax={checklistProgress.total}
                >
                    <Box
                        aria-hidden
                        sx={{ flex: 1, display: "flex", gap: "3px" }}
                    >
                        {Array.from(
                            { length: checklistProgress.total },
                            (_, i) => (
                                <Box
                                    key={i}
                                    component="span"
                                    sx={{
                                        flex: 1,
                                        height: 5,
                                        borderRadius: "3px",
                                        bgcolor:
                                            i < checklistProgress.completed
                                                ? harbor.accent
                                                : harbor.track,
                                    }}
                                />
                            ),
                        )}
                    </Box>
                    <Typography
                        variant="caption"
                        sx={{
                            color: harbor.faint,
                            fontSize: "11.5px",
                            fontWeight: 600,
                            fontVariantNumeric: "tabular-nums",
                            lineHeight: 1,
                        }}
                    >
                        {checklistProgress.completed}/{checklistProgress.total}
                    </Typography>
                </Box>
            )}

            {/* Footer row: metadata pills + assignees (only if there's content) */}
            {(task.due_date ||
                (task.comments_count ?? 0) > 0 ||
                (task.subtasks_count ?? 0) > 0 ||
                (task.effort_estimate != null && task.effort_estimate > 0) ||
                (task.assignees && task.assignees.length > 0)) && (
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                        mt: "3px",
                        minHeight: 24,
                    }}
                >
                    {(task.comments_count ?? 0) > 0 && (
                        <Box
                            aria-label={`${task.comments_count} ${task.comments_count === 1 ? "comment" : "comments"}`}
                            sx={TRACK_PILL}
                        >
                            <ChatBubbleOutlineIcon sx={{ fontSize: 12 }} />
                            {task.comments_count}
                        </Box>
                    )}
                    {task.due_date && (
                        <Box
                            sx={{
                                ...TRACK_PILL,
                                fontWeight: 700,
                                ...(dueSoon && {
                                    color: harbor.dueSoon.fg,
                                    bgcolor: harbor.dueSoon.bg,
                                }),
                            }}
                        >
                            <CalendarTodayIcon sx={{ fontSize: 11 }} />
                            {formatDueDate(task.due_date)}
                        </Box>
                    )}
                    {(task.subtasks_count ?? 0) > 0 && (
                        <Box
                            aria-label={`${task.completed_subtasks_count ?? 0} of ${task.subtasks_count} subtasks completed`}
                            sx={TRACK_PILL}
                        >
                            {task.completed_subtasks_count ?? 0}/
                            {task.subtasks_count}
                        </Box>
                    )}
                    {task.effort_estimate != null &&
                        task.effort_estimate > 0 && (
                            <Tooltip title="Effort estimate">
                                <Box sx={TRACK_PILL}>
                                    <SpeedIcon sx={{ fontSize: 12 }} />
                                    {task.effort_estimate}
                                </Box>
                            </Tooltip>
                        )}
                    <Box sx={{ flex: 1 }} />
                    {task.assignees && task.assignees.length > 0 && (
                        <AvatarGroup
                            max={3}
                            sx={{
                                "& .MuiAvatar-root": {
                                    width: 24,
                                    height: 24,
                                    fontSize: "0.65rem",
                                    border: `2px solid ${harbor.card}`,
                                },
                            }}
                        >
                            {task.assignees.map((user) => (
                                <Avatar
                                    key={user.id}
                                    alt={user.name}
                                    src={user.avatar_url}
                                >
                                    {user.name.charAt(0).toUpperCase()}
                                </Avatar>
                            ))}
                        </AvatarGroup>
                    )}
                </Box>
            )}
        </Paper>
    );
});

export default TaskCard;
