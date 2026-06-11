import ConfirmDialog from "@/Components/Common/ConfirmDialog";
import CopyMarkdownButton from "@/Components/Common/CopyMarkdownButton";
import RichTextDisplay from "@/Components/Common/RichTextDisplay";
import RichTextEditor from "@/Components/Common/RichTextEditor";
import type { Activity, Comment, PageProps, User } from "@/types";
import { formatTimestamp } from "@/utils/formatTimestamp";
import { router, usePage } from "@inertiajs/react";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ReplyIcon from "@mui/icons-material/Reply";
import SwapVertIcon from "@mui/icons-material/SwapVert";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Collapse from "@mui/material/Collapse";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";

const TIMELINE_WIDTH = 40;

type FeedItem =
    | { type: "comment"; item: Comment; timestamp: string }
    | { type: "activity"; item: Activity; timestamp: string };

interface Props {
    comments: Comment[];
    activities: Activity[];
    teamSlug: string;
    boardSlug: string;
    taskId: string;
    currentUserId: string;
    uploadImageUrl?: string;
    mentionableUsers?: User[];
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

interface CommentItemProps {
    comment: Comment;
    variant: "comment" | "reply";
    isOwn: boolean;
    isEditing: boolean;
    editBody: string;
    onEditBodyChange: (body: string) => void;
    onStartEdit: () => void;
    onCancelEdit: () => void;
    onSaveEdit: () => void;
    onDelete: () => void;
    onReply?: () => void;
    uploadImageUrl?: string;
    mentionableUsers: User[];
}

function CommentItem({
    comment,
    variant,
    isOwn,
    isEditing,
    editBody,
    onEditBodyChange,
    onStartEdit,
    onCancelEdit,
    onSaveEdit,
    onDelete,
    onReply,
    uploadImageUrl,
    mentionableUsers,
}: CommentItemProps) {
    const isReply = variant === "reply";
    const wasEdited = comment.updated_at !== comment.created_at;
    const actionIconSize = isReply ? 14 : 16;

    const meta = (
        <>
            <Typography
                variant="body2"
                fontWeight={600}
                fontSize={isReply ? "0.85rem" : undefined}
            >
                {comment.user?.name}
            </Typography>
            <Typography variant="caption" color="text.secondary">
                {formatTimestamp(comment.created_at)}
            </Typography>
            {wasEdited && (
                <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ fontStyle: "italic" }}
                >
                    (edited)
                </Typography>
            )}
            <Box sx={{ flex: 1 }} />
            {!isEditing && (
                <CopyMarkdownButton
                    content={comment.body}
                    aria-label={`Copy ${variant} as Markdown`}
                />
            )}
            {!isReply && !isEditing && (
                <Tooltip title="Reply">
                    <IconButton size="small" onClick={onReply}>
                        <ReplyIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                </Tooltip>
            )}
            {isOwn && !isEditing && (
                <>
                    <Tooltip title="Edit">
                        <IconButton size="small" onClick={onStartEdit}>
                            <EditIcon sx={{ fontSize: actionIconSize }} />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                        <IconButton size="small" onClick={onDelete}>
                            <DeleteIcon sx={{ fontSize: actionIconSize }} />
                        </IconButton>
                    </Tooltip>
                </>
            )}
        </>
    );

    const body = isEditing ? (
        <>
            <RichTextEditor
                content={editBody}
                onChange={onEditBodyChange}
                placeholder={isReply ? "Edit reply..." : "Edit comment..."}
                uploadImageUrl={uploadImageUrl}
                minHeight={isReply ? 60 : 80}
                mentionableUsers={mentionableUsers}
            />
            <Box
                sx={{
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: 1,
                    mt: 1,
                }}
            >
                <Button size="small" onClick={onCancelEdit}>
                    Cancel
                </Button>
                <Button size="small" variant="contained" onClick={onSaveEdit}>
                    Save
                </Button>
            </Box>
        </>
    ) : (
        <RichTextDisplay content={comment.body} />
    );

    if (isReply) {
        return (
            <Box
                sx={{
                    display: "flex",
                    gap: 1.5,
                    py: 1.5,
                    "&:not(:last-of-type)": {
                        borderBottom: 1,
                        borderColor: "divider",
                    },
                }}
            >
                <Avatar
                    alt=""
                    sx={{
                        width: 28,
                        height: 28,
                        fontSize: "0.75rem",
                        flexShrink: 0,
                        mt: 0.25,
                    }}
                    src={comment.user?.avatar_url}
                >
                    {comment.user?.name?.charAt(0).toUpperCase()}
                </Avatar>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                            mb: 0.5,
                        }}
                    >
                        {meta}
                    </Box>
                    {body}
                </Box>
            </Box>
        );
    }

    return (
        <>
            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    px: 2,
                    py: 0.75,
                    bgcolor: "action.hover",
                    borderBottom: 1,
                    borderColor: "divider",
                }}
            >
                {meta}
            </Box>
            <Box sx={{ p: 2 }}>{body}</Box>
        </>
    );
}

export default function ActivityFeed({
    comments,
    activities,
    teamSlug,
    boardSlug,
    taskId,
    currentUserId,
    uploadImageUrl,
    mentionableUsers = [],
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

    // Reply state
    const [replyingTo, setReplyingTo] = useState<string | null>(null);
    const [replyBody, setReplyBody] = useState("");
    const [replyEditorKey, setReplyEditorKey] = useState(0);
    const [collapsedThreads, setCollapsedThreads] = useState<Set<string>>(
        new Set(),
    );

    // Merge and sort by timestamp
    const feed = useMemo<FeedItem[]>(() => {
        const items: FeedItem[] = [
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
        ];
        return items.sort((a, b) => {
            const diff =
                new Date(a.timestamp).getTime() -
                new Date(b.timestamp).getTime();
            return sortOrder === "asc" ? diff : -diff;
        });
    }, [comments, activities, sortOrder]);

    const handleToggleSort = () => {
        const newOrder = sortOrder === "asc" ? "desc" : "asc";
        setSortOrder(newOrder);
        router.patch(
            route("profile.ui-preferences.update"),
            { activity_sort_order: newOrder },
            { preserveState: true, preserveScroll: true },
        );
    };

    const submitComment = (parentId?: string) => {
        const body = parentId ? replyBody : newCommentBody;
        if (!body.trim() || submitting) return;
        setSubmitting(true);

        router.post(
            route("comments.store", [teamSlug, boardSlug, taskId]),
            parentId ? { body, parent_id: parentId } : { body },
            {
                preserveScroll: true,
                onSuccess: () => {
                    if (parentId) {
                        setReplyBody("");
                        setReplyEditorKey((k) => k + 1);
                        setReplyingTo(null);
                    } else {
                        setNewCommentBody("");
                        setCommentEditorKey((k) => k + 1);
                    }
                    setSubmitting(false);
                },
                onError: () => setSubmitting(false),
            },
        );
    };

    const handleEditComment = (commentId: string) => {
        router.put(
            route("comments.update", [teamSlug, boardSlug, taskId, commentId]),
            { body: editBody },
            {
                preserveScroll: true,
                onSuccess: () => setEditingId(null),
                onError: () => {},
            },
        );
    };

    const handleDeleteComment = () => {
        if (!deleteCommentTarget) return;
        router.delete(
            route("comments.destroy", [
                teamSlug,
                boardSlug,
                taskId,
                deleteCommentTarget,
            ]),
            {
                preserveScroll: true,
            },
        );
        setDeleteCommentTarget(null);
    };

    const toggleThread = (commentId: string) => {
        setCollapsedThreads((prev) => {
            const next = new Set(prev);
            if (next.has(commentId)) {
                next.delete(commentId);
            } else {
                next.add(commentId);
            }
            return next;
        });
    };

    const renderCommentItem = (
        comment: Comment,
        variant: "comment" | "reply",
    ) => (
        <CommentItem
            key={variant === "reply" ? comment.id : undefined}
            comment={comment}
            variant={variant}
            isOwn={comment.user_id === currentUserId}
            isEditing={editingId === comment.id}
            editBody={editBody}
            onEditBodyChange={setEditBody}
            onStartEdit={() => {
                setEditingId(comment.id);
                setEditBody(comment.body);
            }}
            onCancelEdit={() => setEditingId(null)}
            onSaveEdit={() => handleEditComment(comment.id)}
            onDelete={() => setDeleteCommentTarget(comment.id)}
            onReply={
                variant === "comment"
                    ? () => {
                          setReplyingTo(comment.id);
                          setReplyBody("");
                      }
                    : undefined
            }
            uploadImageUrl={uploadImageUrl}
            mentionableUsers={mentionableUsers}
        />
    );

    const renderReplies = (comment: Comment) => {
        const replies = comment.replies ?? [];
        if (replies.length === 0 && replyingTo !== comment.id) return null;

        const isCollapsed = collapsedThreads.has(comment.id);

        return (
            <Box
                sx={{
                    borderTop: 1,
                    borderColor: "divider",
                }}
            >
                {/* Collapse/expand toggle */}
                {replies.length > 0 && (
                    <Button
                        size="small"
                        onClick={() => toggleThread(comment.id)}
                        aria-expanded={!isCollapsed}
                        startIcon={
                            isCollapsed ? (
                                <ExpandMoreIcon />
                            ) : (
                                <ExpandLessIcon />
                            )
                        }
                        sx={{
                            textTransform: "none",
                            color: "primary.main",
                            px: 2,
                            py: 0.75,
                            fontSize: "0.8rem",
                        }}
                    >
                        {isCollapsed
                            ? `${replies.length} ${replies.length === 1 ? "reply" : "replies"}`
                            : "Collapse replies"}
                    </Button>
                )}

                <Collapse in={!isCollapsed}>
                    {/* Reply list */}
                    {replies.length > 0 && (
                        <Box sx={{ px: 2 }}>
                            {replies.map((reply) =>
                                renderCommentItem(reply, "reply"),
                            )}
                        </Box>
                    )}

                    {/* Reply input — compact placeholder or full editor */}
                    <Box sx={{ px: 2, py: 1.5 }}>
                        {replyingTo === comment.id ? (
                            <>
                                <RichTextEditor
                                    key={replyEditorKey}
                                    content={replyBody}
                                    onChange={setReplyBody}
                                    placeholder="Write a reply..."
                                    uploadImageUrl={uploadImageUrl}
                                    minHeight={80}
                                    autoFocus
                                    mentionableUsers={mentionableUsers}
                                />
                                <Box
                                    sx={{
                                        display: "flex",
                                        justifyContent: "flex-end",
                                        gap: 1,
                                        mt: 1,
                                    }}
                                >
                                    <Button
                                        size="small"
                                        onClick={() => {
                                            setReplyingTo(null);
                                            setReplyBody("");
                                        }}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        size="small"
                                        variant="contained"
                                        disabled={
                                            submitting || !replyBody.trim()
                                        }
                                        onClick={() =>
                                            submitComment(comment.id)
                                        }
                                    >
                                        Reply
                                    </Button>
                                </Box>
                            </>
                        ) : (
                            <Box
                                onClick={() => {
                                    setReplyingTo(comment.id);
                                    setReplyBody("");
                                }}
                                sx={{
                                    border: 1,
                                    borderColor: "divider",
                                    borderRadius: 1,
                                    px: 1.5,
                                    py: 1,
                                    cursor: "text",
                                    "&:hover": {
                                        borderColor: "text.secondary",
                                    },
                                }}
                            >
                                <Typography
                                    variant="body2"
                                    color="text.disabled"
                                    fontSize="0.85rem"
                                >
                                    Reply...
                                </Typography>
                            </Box>
                        )}
                    </Box>
                </Collapse>
            </Box>
        );
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
                    mentionableUsers={mentionableUsers}
                />
                <Box
                    sx={{
                        display: "flex",
                        justifyContent: "flex-end",
                        mt: 1,
                    }}
                >
                    <Button
                        size="small"
                        variant="contained"
                        disabled={submitting || !newCommentBody.trim()}
                        onClick={() => submitComment()}
                    >
                        Comment
                    </Button>
                </Box>
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
                                            alt=""
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
                                        {renderCommentItem(comment, "comment")}
                                        {renderReplies(comment)}
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
            <ConfirmDialog
                open={deleteCommentTarget !== null}
                onClose={() => setDeleteCommentTarget(null)}
                onConfirm={handleDeleteComment}
                title="Delete Comment"
                message="Are you sure you want to delete this comment? This action cannot be undone."
                confirmLabel="Delete"
                confirmColor="error"
            />
        </Box>
    );
}
