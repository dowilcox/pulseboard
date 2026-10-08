import PriorityIndicator from "@/Components/Tasks/PriorityIndicator";
import type { Task, TaskGitlabRef } from "@/types";
import { getContrastText } from "@/utils/colorContrast";
import { daysUntil, formatDueDate } from "@/utils/formatTimestamp";
import { getGitlabPrefix } from "@/utils/gitlabPrefix";
import { describeTaskCard } from "@/utils/taskCardLabel";
import { harbor, harborAvatarColor } from "@/theme/harbor";
import { Link } from "@inertiajs/react";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import LockIcon from "@mui/icons-material/Lock";
import MergeIcon from "@mui/icons-material/MergeType";
import SpeedIcon from "@mui/icons-material/Speed";
import Avatar from "@mui/material/Avatar";
import AvatarGroup from "@mui/material/AvatarGroup";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { forwardRef, memo, type HTMLAttributes, type ReactNode } from "react";

/** Event + ARIA props the sortable wrapper forwards to the card root. */
type ForwardedProps = Pick<
    HTMLAttributes<HTMLElement>,
    "onPointerDown" | "onKeyDown" | "onClickCapture" | "aria-describedby"
>;

interface Props extends ForwardedProps {
    task: Task;
    /**
     * Task URL. When set the card root is a real link (Cmd/middle-click open
     * a new tab, copy link works); otherwise it is a static preview (e.g. the
     * drag overlay).
     */
    href?: string;
}

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

const MR_STATE_COLORS: Record<string, string> = {
    opened: harbor.accent,
    merged: harbor.successText,
    closed: harbor.dangerText,
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

/** Due within the next two days (or overdue) — gets the warm dueSoon tint. */
function isDueSoon(dueDate: string): boolean {
    const days = daysUntil(dueDate);
    return !Number.isNaN(days) && days <= 2;
}

/**
 * Static merge-request badge. The card itself is a link, so the badge can't
 * be one too (nested links are invalid); the task page links out to GitLab.
 */
function MergeRequestBadge({ gitlabRef }: { gitlabRef: TaskGitlabRef }) {
    const color = MR_STATE_COLORS[gitlabRef.state ?? ""] ?? harbor.sub;
    return (
        <Box
            component="span"
            sx={{
                ...TRACK_PILL,
                color,
                bgcolor: harbor.card,
                border: "1px solid currentColor",
                padding: "2px 8px",
            }}
        >
            <MergeIcon sx={{ fontSize: 13 }} />!{gitlabRef.gitlab_iid}
            {gitlabRef.state ? ` ${gitlabRef.state}` : ""}
        </Box>
    );
}

function initials(name: string): string {
    return name
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part.charAt(0))
        .join("")
        .toUpperCase();
}

const CARD_SX = {
    display: "block",
    p: "14px 15px",
    borderRadius: "14px",
    bgcolor: harbor.card,
    color: harbor.ink,
    boxShadow: harbor.cardShadow,
    transition: "box-shadow 150ms ease-out",
    textDecoration: "none",
    // Links and avatar images are natively draggable; that would cancel the
    // dnd-kit pointer drag.
    WebkitUserDrag: "none",
    "& img": { WebkitUserDrag: "none", pointerEvents: "none" },
} as const;

const CONTENT_SX = {
    display: "flex",
    flexDirection: "column",
    gap: 1,
} as const;

const TaskCard = memo(
    forwardRef<HTMLElement, Props>(function TaskCard(
        { task, href, ...rest },
        ref,
    ) {
        const isCompleted = task.completed_at != null;
        const isBlocked = (task.blocked_by ?? []).length > 0;
        const checklistProgress = task.checklist_progress;
        const dueSoon =
            task.due_date != null && !isCompleted && isDueSoon(task.due_date);
        const gitlabPrefixLabel = getGitlabPrefix(task);
        const mergeRequests = (task.gitlab_refs ?? []).filter(
            (r) => r.ref_type === "merge_request",
        );
        const assignees = task.assignees ?? [];

        // Everything inside is summarised by the link's aria-label, so the
        // visual content is hidden from assistive tech to avoid repeats.
        const content: ReactNode = (
            <>
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

                {/* Meta row: priority + task number + GitLab prefix + blocked */}
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
                            minWidth: 0,
                        }}
                    >
                        <PriorityIndicator priority={task.priority} />
                        {task.task_number && (
                            <Box component="span" sx={{ fontWeight: 700 }}>
                                #{task.task_number}
                            </Box>
                        )}
                        {gitlabPrefixLabel && (
                            <Box
                                component="span"
                                sx={{
                                    whiteSpace: "nowrap",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    minWidth: 0,
                                }}
                            >
                                {gitlabPrefixLabel}
                            </Box>
                        )}
                        {isBlocked && (
                            <Tooltip title="Blocked by dependencies">
                                <Box
                                    component="span"
                                    sx={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "3px",
                                        color: harbor.dangerText,
                                        fontWeight: 700,
                                        flexShrink: 0,
                                    }}
                                >
                                    <LockIcon sx={{ fontSize: 13 }} />
                                    Blocked
                                </Box>
                            </Tooltip>
                        )}
                    </Box>
                )}

                {/* Title + completion indicator */}
                <Box
                    sx={{ display: "flex", alignItems: "flex-start", gap: 0.5 }}
                >
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
                        component="span"
                        sx={{
                            fontSize: "14.5px",
                            fontWeight: 600,
                            textDecoration: isCompleted
                                ? "line-through"
                                : "none",
                            color: isCompleted ? harbor.sub : harbor.ink,
                            lineHeight: 1.4,
                            overflowWrap: "anywhere",
                        }}
                    >
                        {task.title}
                    </Typography>
                </Box>

                {/* GitLab MR badges */}
                {mergeRequests.length > 0 && (
                    <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                        {mergeRequests.map((mr) => (
                            <MergeRequestBadge key={mr.id} gitlabRef={mr} />
                        ))}
                    </Box>
                )}

                {/* Checklist progress — segmented bar */}
                {checklistProgress && checklistProgress.total > 0 && (
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <Box sx={{ flex: 1, display: "flex", gap: "3px" }}>
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
                            component="span"
                            sx={{
                                color: harbor.faint,
                                fontSize: "11.5px",
                                fontWeight: 600,
                                fontVariantNumeric: "tabular-nums",
                                lineHeight: 1,
                            }}
                        >
                            {checklistProgress.completed}/
                            {checklistProgress.total}
                        </Typography>
                    </Box>
                )}

                {/* Footer row: metadata pills + assignees */}
                {(task.due_date ||
                    (task.comments_count ?? 0) > 0 ||
                    (task.subtasks_count ?? 0) > 0 ||
                    (task.effort_estimate != null &&
                        task.effort_estimate > 0) ||
                    assignees.length > 0) && (
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                            mt: "3px",
                            minHeight: 24,
                            flexWrap: "wrap",
                        }}
                    >
                        {(task.comments_count ?? 0) > 0 && (
                            <Box component="span" sx={TRACK_PILL}>
                                <ChatBubbleOutlineIcon sx={{ fontSize: 12 }} />
                                {task.comments_count}
                            </Box>
                        )}
                        {task.due_date && (
                            <Box
                                component="span"
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
                            <Box component="span" sx={TRACK_PILL}>
                                {task.completed_subtasks_count ?? 0}/
                                {task.subtasks_count}
                            </Box>
                        )}
                        {task.effort_estimate != null &&
                            task.effort_estimate > 0 && (
                                <Tooltip title="Story points">
                                    <Box component="span" sx={TRACK_PILL}>
                                        <SpeedIcon sx={{ fontSize: 12 }} />
                                        {task.effort_estimate} pt
                                    </Box>
                                </Tooltip>
                            )}
                        <Box sx={{ flex: 1 }} />
                        {assignees.length > 0 && (
                            <AvatarGroup
                                max={3}
                                sx={{
                                    "& .MuiAvatar-root": {
                                        width: 24,
                                        height: 24,
                                        fontSize: "0.6rem",
                                        border: `2px solid ${harbor.card}`,
                                    },
                                }}
                            >
                                {assignees.map((user) => (
                                    <Avatar
                                        key={user.id}
                                        alt=""
                                        src={user.avatar_url}
                                        sx={{
                                            bgcolor: harborAvatarColor(
                                                user.name,
                                            ),
                                            color: "#ffffff",
                                        }}
                                    >
                                        {initials(user.name)}
                                    </Avatar>
                                ))}
                            </AvatarGroup>
                        )}
                    </Box>
                )}
            </>
        );

        if (href) {
            return (
                <Paper
                    ref={ref as React.Ref<HTMLAnchorElement>}
                    elevation={0}
                    component={Link}
                    href={href}
                    draggable={false}
                    aria-label={describeTaskCard(task)}
                    {...rest}
                    sx={{
                        ...CARD_SX,
                        cursor: "pointer",
                        "&:hover": { boxShadow: harbor.cardShadowHover },
                        "&:focus-visible": {
                            outline: "2px solid",
                            outlineColor: "primary.main",
                            outlineOffset: 2,
                        },
                    }}
                >
                    <Box aria-hidden sx={CONTENT_SX}>
                        {content}
                    </Box>
                </Paper>
            );
        }

        return (
            <Paper
                ref={ref as React.Ref<HTMLDivElement>}
                elevation={0}
                {...rest}
                sx={CARD_SX}
            >
                <Box sx={CONTENT_SX}>{content}</Box>
            </Paper>
        );
    }),
);

export default TaskCard;
