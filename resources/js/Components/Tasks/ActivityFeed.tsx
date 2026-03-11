import RichTextDisplay from "@/Components/Common/RichTextDisplay";
import RichTextEditor from "@/Components/Common/RichTextEditor";
import type { Activity, Comment, PageProps } from "@/types";
import { router, usePage } from "@inertiajs/react";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import SwapVertIcon from "@mui/icons-material/SwapVert";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import type { ReactNode } from "react";
import { useState } from "react";

const TIMELINE_WIDTH = 40;

type FeedItem =
    | { type: "comment"; item: Comment; timestamp: string }
    | { type: "activity"; item: Activity; timestamp: string };

interface Props {
    comments: Comment[];
    activities: Activity[];
    teamId: string;
    boardId: string;
    taskId: string;
    currentUserId: string;
    uploadImageUrl?: string;
}

function formatTimestamp(ts: string): string {
    const date = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
}

function LabelChip({ name }: { name: string }) {
    return (
        <Chip
            label={name}
            size="small"
            sx={{
                height: 20,
                fontSize: "0.7rem",
                fontWeight: 600,
                mx: 0.25,
                verticalAlign: "middle",
            }}
        />
    );
}

function activityDescription(
    action: string,
    changes: Record<string, unknown>,
): ReactNode {
    switch (action) {
        case "created":
            return "created this task";
        case "moved":
            if (changes.auto_moved) {
                return (
                    <>
                        auto-moved from{" "}
                        <strong>{String(changes.from_column ?? "?")}</strong> to{" "}
                        <strong>{String(changes.to_column ?? "?")}</strong>
                    </>
                );
            }
            return (
                <>
                    moved from{" "}
                    <strong>{String(changes.from_column ?? "?")}</strong> to{" "}
                    <strong>{String(changes.to_column ?? "?")}</strong>
                </>
            );
        case "assigned":
            return (
                <>
                    assigned{" "}
                    {(changes.users as string[])?.join(", ") ?? "users"}
                </>
            );
        case "unassigned":
            return (
                <>
                    unassigned{" "}
                    {(changes.users as string[])?.join(", ") ?? "users"}
                </>
            );
        case "labels_changed": {
            const added = changes.added as string[] | undefined;
            const removed = changes.removed as string[] | undefined;
            const parts: ReactNode[] = [];
            if (added?.length) {
                parts.push(
                    <span key="added">
                        added{" "}
                        {added.map((name) => (
                            <LabelChip key={name} name={name} />
                        ))}{" "}
                        {added.length === 1 ? "label" : "labels"}
                    </span>,
                );
            }
            if (removed?.length) {
                if (parts.length) parts.push(" and ");
                parts.push(
                    <span key="removed">
                        removed{" "}
                        {removed.map((name) => (
                            <LabelChip key={name} name={name} />
                        ))}{" "}
                        {removed.length === 1 ? "label" : "labels"}
                    </span>,
                );
            }
            return parts.length ? <>{parts}</> : "updated labels";
        }
        case "commented":
            return "added a comment";
        case "completed":
            return "marked this task as complete";
        case "uncompleted":
            return "marked this task as incomplete";
        case "dependency_added":
            return (
                <>
                    added a dependency on{" "}
                    <strong>
                        {String(changes.depends_on_title ?? "a task")}
                    </strong>
                </>
            );
        case "dependency_removed":
            return (
                <>
                    removed a dependency on{" "}
                    <strong>
                        {String(changes.depends_on_title ?? "a task")}
                    </strong>
                </>
            );
        case "field_changed": {
            const fields = Object.keys(changes);
            return `updated ${fields.join(", ")}`;
        }
        case "attachment_added":
            return (
                <>
                    added attachment{" "}
                    <strong>{String(changes.filename ?? "")}</strong>
                </>
            );
        case "attachment_removed":
            return (
                <>
                    removed attachment{" "}
                    <strong>{String(changes.filename ?? "")}</strong>
                </>
            );
        case "gitlab_branch_created":
            return (
                <>
                    created branch{" "}
                    <strong>{String(changes.branch ?? "")}</strong>
                </>
            );
        case "gitlab_mr_created":
            return (
                <>
                    created merge request{" "}
                    <strong>{String(changes.title ?? "")}</strong>
                </>
            );
        case "gitlab_mr_merged":
            return (
                <>
                    merged merge request{" "}
                    <strong>{String(changes.title ?? "")}</strong>
                </>
            );
        case "gitlab_mr_closed":
            return (
                <>
                    closed merge request{" "}
                    <strong>{String(changes.title ?? "")}</strong>
                </>
            );
        default:
            return action;
    }
}

function isHtml(text: string): boolean {
    return /<[a-z][\s\S]*>/i.test(text);
}

export default function ActivityFeed({
    comments,
    activities,
    teamId,
    boardId,
    taskId,
    currentUserId,
    uploadImageUrl,
}: Props) {
    const { auth } = usePage<PageProps>().props;
    const savedSort = auth.user.ui_preferences?.activity_sort_order ?? "desc";

    const [editingId, setEditingId] = useState<string | null>(null);
    const [editBody, setEditBody] = useState("");
    const [newCommentBody, setNewCommentBody] = useState("");
    const [commentEditorKey, setCommentEditorKey] = useState(0);
    const [submitting, setSubmitting] = useState(false);
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">(savedSort);
    const [deleteCommentTarget, setDeleteCommentTarget] = useState<
        string | null
    >(null);

    // Merge and sort by timestamp
    const feed: FeedItem[] = [
        ...comments.map(
            (c): FeedItem => ({
                type: "comment",
                item: c,
                timestamp: c.created_at,
            }),
        ),
        ...activities
            .filter((a) => a.action !== "commented")
            .map(
                (a): FeedItem => ({
                    type: "activity",
                    item: a,
                    timestamp: a.created_at,
                }),
            ),
    ].sort((a, b) => {
        const diff =
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
        return sortOrder === "asc" ? diff : -diff;
    });

    const handleToggleSort = () => {
        const newOrder = sortOrder === "asc" ? "desc" : "asc";
        setSortOrder(newOrder);
        router.patch(
            route("profile.ui-preferences.update"),
            { activity_sort_order: newOrder },
            { preserveState: true, preserveScroll: true },
        );
    };

    const handleAddComment = () => {
        if (!newCommentBody.trim() || submitting) return;
        setSubmitting(true);

        router.post(
            route("comments.store", [teamId, boardId, taskId]),
            { body: newCommentBody },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setNewCommentBody("");
                    setCommentEditorKey((k) => k + 1);
                    setSubmitting(false);
                },
                onError: () => setSubmitting(false),
            },
        );
    };

    const handleEditComment = (commentId: string) => {
        router.put(
            route("comments.update", [teamId, boardId, taskId, commentId]),
            { body: editBody },
            {
                preserveScroll: true,
                onSuccess: () => setEditingId(null),
            },
        );
    };

    const handleDeleteComment = () => {
        if (!deleteCommentTarget) return;
        router.delete(
            route("comments.destroy", [
                teamId,
                boardId,
                taskId,
                deleteCommentTarget,
            ]),
            {
                preserveScroll: true,
            },
        );
        setDeleteCommentTarget(null);
    };

    return (
        <Box>
            {/* Add comment form */}
            <Box sx={{ mb: 2 }}>
                <RichTextEditor
                    key={commentEditorKey}
                    content={newCommentBody}
                    onChange={setNewCommentBody}
                    placeholder="Write a comment..."
                    uploadImageUrl={uploadImageUrl}
                    minHeight={100}
                />
                <Button
                    size="small"
                    variant="contained"
                    disabled={submitting || !newCommentBody.trim()}
                    onClick={handleAddComment}
                    sx={{ mt: 1 }}
                >
                    Comment
                </Button>
            </Box>

            <Divider sx={{ mb: 2 }} />

            {/* Sort toggle header */}
            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    mb: 1,
                }}
            >
                <Tooltip
                    title={
                        sortOrder === "desc"
                            ? "Showing newest first"
                            : "Showing oldest first"
                    }
                >
                    <IconButton
                        size="small"
                        onClick={handleToggleSort}
                        aria-label={
                            sortOrder === "desc"
                                ? "Sort oldest first"
                                : "Sort newest first"
                        }
                    >
                        <SwapVertIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
                <Typography variant="caption" color="text.secondary">
                    {sortOrder === "desc" ? "Newest first" : "Oldest first"}
                </Typography>
            </Box>

            {/* Empty state */}
            {feed.length === 0 && (
                <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ textAlign: "center", py: 3 }}
                >
                    No activity yet
                </Typography>
            )}

            {/* Timeline container */}
            {feed.length > 0 && (
                <Box sx={{ position: "relative" }}>
                    {/* Vertical timeline line */}
                    <Box
                        sx={{
                            position: "absolute",
                            left: TIMELINE_WIDTH / 2 - 1,
                            top: 0,
                            bottom: 0,
                            width: 2,
                            bgcolor: "divider",
                        }}
                    />

                    {/* Feed items */}
                    {feed.map((entry) => {
                        if (entry.type === "comment") {
                            const comment = entry.item;
                            const isOwn = comment.user_id === currentUserId;
                            const isEditing = editingId === comment.id;
                            const wasEdited =
                                comment.updated_at !== comment.created_at;

                            return (
                                <Box
                                    key={`comment-${comment.id}`}
                                    sx={{
                                        display: "flex",
                                        gap: 1.5,
                                        mb: 2.5,
                                        alignItems: "flex-start",
                                    }}
                                >
                                    {/* Avatar on timeline */}
                                    <Box
                                        sx={{
                                            width: TIMELINE_WIDTH,
                                            flexShrink: 0,
                                            display: "flex",
                                            justifyContent: "center",
                                        }}
                                    >
                                        <Avatar
                                            sx={{
                                                width: 32,
                                                height: 32,
                                                fontSize: "0.8rem",
                                                zIndex: 1,
                                            }}
                                            src={comment.user?.avatar_url}
                                        >
                                            {comment.user?.name
                                                ?.charAt(0)
                                                .toUpperCase()}
                                        </Avatar>
                                    </Box>

                                    {/* Comment card */}
                                    <Box
                                        sx={{
                                            flex: 1,
                                            border: 1,
                                            borderColor: "divider",
                                            borderRadius: 1,
                                            overflow: "hidden",
                                        }}
                                    >
                                        {/* Card header */}
                                        <Box
                                            sx={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 1,
                                                px: 2,
                                                py: 1,
                                                bgcolor: "action.hover",
                                                borderBottom: 1,
                                                borderColor: "divider",
                                            }}
                                        >
                                            <Typography
                                                variant="body2"
                                                fontWeight={600}
                                            >
                                                {comment.user?.name}
                                            </Typography>
                                            <Typography
                                                variant="caption"
                                                color="text.secondary"
                                            >
                                                {formatTimestamp(
                                                    comment.created_at,
                                                )}
                                            </Typography>
                                            {wasEdited && (
                                                <Typography
                                                    variant="caption"
                                                    color="text.secondary"
                                                    sx={{
                                                        fontStyle: "italic",
                                                    }}
                                                >
                                                    (edited)
                                                </Typography>
                                            )}
                                            <Box sx={{ flex: 1 }} />
                                            {isOwn && !isEditing && (
                                                <>
                                                    <Tooltip title="Edit">
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => {
                                                                setEditingId(
                                                                    comment.id,
                                                                );
                                                                setEditBody(
                                                                    comment.body,
                                                                );
                                                            }}
                                                        >
                                                            <EditIcon
                                                                sx={{
                                                                    fontSize: 16,
                                                                }}
                                                            />
                                                        </IconButton>
                                                    </Tooltip>
                                                    <Tooltip title="Delete">
                                                        <IconButton
                                                            size="small"
                                                            onClick={() =>
                                                                setDeleteCommentTarget(
                                                                    comment.id,
                                                                )
                                                            }
                                                        >
                                                            <DeleteIcon
                                                                sx={{
                                                                    fontSize: 16,
                                                                }}
                                                            />
                                                        </IconButton>
                                                    </Tooltip>
                                                </>
                                            )}
                                        </Box>

                                        {/* Card body */}
                                        {isEditing ? (
                                            <Box sx={{ p: 2 }}>
                                                <RichTextEditor
                                                    content={editBody}
                                                    onChange={setEditBody}
                                                    placeholder="Edit comment..."
                                                    uploadImageUrl={
                                                        uploadImageUrl
                                                    }
                                                    minHeight={100}
                                                />
                                                <Box
                                                    sx={{
                                                        display: "flex",
                                                        gap: 1,
                                                        mt: 1,
                                                    }}
                                                >
                                                    <Button
                                                        size="small"
                                                        variant="contained"
                                                        onClick={() =>
                                                            handleEditComment(
                                                                comment.id,
                                                            )
                                                        }
                                                    >
                                                        Save
                                                    </Button>
                                                    <Button
                                                        size="small"
                                                        onClick={() =>
                                                            setEditingId(null)
                                                        }
                                                    >
                                                        Cancel
                                                    </Button>
                                                </Box>
                                            </Box>
                                        ) : (
                                            <Box sx={{ p: 2 }}>
                                                {isHtml(comment.body) ? (
                                                    <RichTextDisplay
                                                        content={comment.body}
                                                    />
                                                ) : (
                                                    <Typography
                                                        variant="body2"
                                                        sx={{
                                                            whiteSpace:
                                                                "pre-wrap",
                                                        }}
                                                    >
                                                        {comment.body}
                                                    </Typography>
                                                )}
                                            </Box>
                                        )}
                                    </Box>
                                </Box>
                            );
                        }

                        // Activity entry
                        const activity = entry.item;
                        return (
                            <Box
                                key={`activity-${activity.id}`}
                                sx={{
                                    display: "flex",
                                    gap: 1.5,
                                    mb: 1.5,
                                    alignItems: "center",
                                    minHeight: 28,
                                }}
                            >
                                {/* Timeline dot */}
                                <Box
                                    sx={{
                                        width: TIMELINE_WIDTH,
                                        flexShrink: 0,
                                        display: "flex",
                                        justifyContent: "center",
                                    }}
                                >
                                    <Box
                                        sx={{
                                            width: 10,
                                            height: 10,
                                            borderRadius: "50%",
                                            bgcolor: "text.disabled",
                                            zIndex: 1,
                                        }}
                                    />
                                </Box>

                                {/* Activity text */}
                                <Typography
                                    variant="body2"
                                    color="text.secondary"
                                    component="div"
                                    sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        flexWrap: "wrap",
                                        gap: 0.25,
                                        lineHeight: 1.6,
                                    }}
                                >
                                    <strong>
                                        {activity.user?.name ?? "System"}
                                    </strong>
                                    {activityDescription(
                                        activity.action,
                                        activity.changes ?? {},
                                    )}
                                    <span style={{ marginLeft: 4 }}>
                                        {formatTimestamp(activity.created_at)}
                                    </span>
                                </Typography>
                            </Box>
                        );
                    })}
                </Box>
            )}

            {/* Delete comment confirmation dialog */}
            <Dialog
                open={deleteCommentTarget !== null}
                onClose={() => setDeleteCommentTarget(null)}
                aria-labelledby="delete-comment-dialog-title"
            >
                <DialogTitle id="delete-comment-dialog-title">
                    Delete Comment
                </DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Are you sure you want to delete this comment? This
                        action cannot be undone.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteCommentTarget(null)}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleDeleteComment}
                        color="error"
                        variant="contained"
                    >
                        Delete
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
