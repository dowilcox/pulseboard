import ConfirmDialog from "@/Components/Common/ConfirmDialog";
import CopyMarkdownButton from "@/Components/Common/CopyMarkdownButton";
import RichTextDisplay from "@/Components/Common/RichTextDisplay";
import RichTextEditor from "@/Components/Common/RichTextEditor";
import { harbor, harborAvatarColor, harborHex } from "@/theme/harbor";
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
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";

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

/** Comment / Reply submit button as a Harbor pill. */
const commentPillSx = {
    height: 40,
    px: "18px",
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 700,
    flexShrink: 0,
    bgcolor: harborHex.accent,
    color: "#fff",
    transition: "background-color 150ms ease-out",
    "&:hover": { bgcolor: harborHex.accentDark },
    "&.Mui-disabled": { bgcolor: harbor.track, color: harbor.faint },
} as const;

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
    const actionIconSize = isReply ? 13 : 14;

    const meta = (
        <>
            <Typography
                sx={{
                    fontSize: isReply ? 12.5 : 13.5,
                    fontWeight: 700,
                    color: harbor.ink,
                }}
            >
                {comment.user?.name}
            </Typography>
            <Typography sx={{ fontSize: 11.5, color: harbor.faint }}>
                {formatTimestamp(comment.created_at)}
            </Typography>
            {wasEdited && (
                <Typography
                    sx={{
                        fontSize: 11.5,
                        color: harbor.faint,
                        fontStyle: "italic",
                    }}
                >
                    (edited)
                </Typography>
            )}
            <Box sx={{ flex: 1 }} />
            {/* Action tiles — revealed on hover/focus via opacity so they stay
                in the tab order; always visible on touch devices. */}
            <Box
                className="comment-actions"
                sx={{
                    display: "flex",
                    gap: "5px",
                    opacity: 0,
                    transition: "opacity 150ms ease-out",
                    "&:focus-within": { opacity: 1 },
                    "@media (hover: none)": { opacity: 1 },
                    "& .MuiIconButton-root": {
                        width: 26,
                        height: 26,
                        borderRadius: "8px",
                        bgcolor: harbor.card,
                        color: harbor.faint,
                        "&:hover": { color: harbor.ink },
                    },
                }}
            >
                {!isEditing && (
                    <CopyMarkdownButton
                        content={comment.body}
                        aria-label={`Copy ${variant} as Markdown`}
                    />
                )}
                {!isReply && !isEditing && (
                    <Tooltip title="Reply">
                        <IconButton size="small" onClick={onReply}>
                            <ReplyIcon sx={{ fontSize: 14 }} />
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
            </Box>
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
        <Box
            sx={{
                fontSize: 13.5,
                color: harbor.ink,
                "& .tiptap p": { fontSize: 13.5, lineHeight: 1.55 },
            }}
        >
            <RichTextDisplay content={comment.body} />
        </Box>
    );

    if (isReply) {
        return (
            <Box
                sx={{
                    display: "flex",
                    gap: 1.5,
                    py: 1.5,
                    "&:not(:last-of-type)": {
                        borderBottom: `1px solid ${harbor.cardBorder}`,
                    },
                }}
            >
                <Avatar
                    alt=""
                    sx={{
                        width: 24,
                        height: 24,
                        fontSize: "0.7rem",
                        flexShrink: 0,
                        mt: 0.25,
                        bgcolor: harborAvatarColor(
                            comment.user?.id ?? comment.user?.name ?? "?",
                        ),
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
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                {meta}
            </Box>
            <Box sx={{ mt: 1 }}>{body}</Box>
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
    const [composerOpen, setComposerOpen] = useState(false);
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
                        setComposerOpen(false);
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
                    borderTop: `1px solid ${harbor.cardBorder}`,
                    mt: 1.5,
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
                            color: harborHex.accent,
                            px: 0.5,
                            py: 0.75,
                            fontSize: 12.5,
                            fontWeight: 700,
                            "&:hover": { bgcolor: "transparent" },
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
                        <Box>
                            {replies.map((reply) =>
                                renderCommentItem(reply, "reply"),
                            )}
                        </Box>
                    )}

                    {/* Reply input — compact placeholder or full editor */}
                    <Box sx={{ py: 1 }}>
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
                                component="button"
                                type="button"
                                onClick={() => {
                                    setReplyingTo(comment.id);
                                    setReplyBody("");
                                }}
                                sx={{
                                    display: "block",
                                    width: "100%",
                                    textAlign: "left",
                                    border: "none",
                                    borderRadius: 999,
                                    bgcolor: harbor.card,
                                    px: 1.75,
                                    py: 1,
                                    cursor: "text",
                                    fontFamily: harbor.bodyFont,
                                    fontSize: 12.5,
                                    color: harbor.faint,
                                }}
                            >
                                Reply...
                            </Box>
                        )}
                    </Box>
                </Collapse>
            </Box>
        );
    };

    return (
        <Box>
            {/* Header — title + sort pill */}
            <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
                <Typography
                    component="h2"
                    sx={{
                        fontSize: 17,
                        fontWeight: 700,
                        fontFamily: harbor.headingFont,
                        color: harbor.ink,
                    }}
                >
                    Activity
                </Typography>
                <Box sx={{ flex: 1 }} />
                <Tooltip
                    title={
                        sortOrder === "desc"
                            ? "Showing newest first"
                            : "Showing oldest first"
                    }
                >
                    <Button
                        onClick={handleToggleSort}
                        aria-label={
                            sortOrder === "desc"
                                ? "Sort oldest first"
                                : "Sort newest first"
                        }
                        startIcon={<SwapVertIcon sx={{ fontSize: 14 }} />}
                        sx={{
                            borderRadius: 999,
                            bgcolor: harbor.countBg,
                            color: harbor.sub,
                            fontSize: 12.5,
                            fontWeight: 700,
                            px: "13px",
                            py: "6px",
                            minWidth: 0,
                            transition: "background-color 150ms ease-out",
                            "&:hover": { bgcolor: harbor.track },
                        }}
                    >
                        {sortOrder === "desc" ? "Newest first" : "Oldest first"}
                    </Button>
                </Tooltip>
            </Box>

            {/* Composer — pill that expands into the rich text editor */}
            <Box
                sx={{
                    display: "flex",
                    gap: 1.25,
                    mb: 2.75,
                    alignItems: composerOpen ? "flex-start" : "center",
                }}
            >
                <Avatar
                    alt=""
                    src={auth.user.avatar_url}
                    sx={{
                        width: 30,
                        height: 30,
                        fontSize: "0.8rem",
                        flexShrink: 0,
                        bgcolor: harborAvatarColor(auth.user.id),
                    }}
                >
                    {auth.user.name?.charAt(0).toUpperCase()}
                </Avatar>
                {composerOpen ? (
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <RichTextEditor
                            key={commentEditorKey}
                            content={newCommentBody}
                            onChange={setNewCommentBody}
                            placeholder="Write a comment..."
                            uploadImageUrl={uploadImageUrl}
                            minHeight={100}
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
                                    setComposerOpen(false);
                                    setNewCommentBody("");
                                    setCommentEditorKey((k) => k + 1);
                                }}
                            >
                                Cancel
                            </Button>
                            <Button
                                disabled={submitting || !newCommentBody.trim()}
                                onClick={() => submitComment()}
                                sx={commentPillSx}
                            >
                                Comment
                            </Button>
                        </Box>
                    </Box>
                ) : (
                    <>
                        <Box
                            component="button"
                            type="button"
                            onClick={() => setComposerOpen(true)}
                            aria-label="Write a comment"
                            sx={{
                                flex: 1,
                                minWidth: 0,
                                height: 40,
                                borderRadius: 999,
                                border: "none",
                                bgcolor: harbor.countBg,
                                textAlign: "left",
                                px: 2,
                                fontFamily: harbor.bodyFont,
                                fontSize: 13,
                                color: harbor.faint,
                                cursor: "text",
                                transition: "background-color 150ms ease-out",
                                "&:hover": { bgcolor: harbor.track },
                            }}
                        >
                            Write a comment…
                        </Box>
                        <Button disabled sx={commentPillSx}>
                            Comment
                        </Button>
                    </>
                )}
            </Box>

            {/* Empty state */}
            {feed.length === 0 && (
                <Typography
                    sx={{
                        fontSize: 13,
                        color: harbor.faint,
                        textAlign: "center",
                        py: 3,
                    }}
                >
                    No activity yet
                </Typography>
            )}

            {/* Timeline container */}
            {feed.length > 0 && (
                <Box
                    sx={{
                        position: "relative",
                        display: "flex",
                        flexDirection: "column",
                        gap: 2,
                    }}
                >
                    {/* Vertical timeline line */}
                    <Box
                        sx={{
                            position: "absolute",
                            left: 12,
                            top: 6,
                            bottom: 6,
                            width: "1.5px",
                            bgcolor: harbor.cardBorder,
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
                                        alignItems: "flex-start",
                                        position: "relative",
                                    }}
                                >
                                    {/* Avatar centered on the timeline */}
                                    <Avatar
                                        alt=""
                                        sx={{
                                            width: 26,
                                            height: 26,
                                            fontSize: "0.7rem",
                                            flexShrink: 0,
                                            zIndex: 1,
                                            bgcolor: harborAvatarColor(
                                                comment.user?.id ??
                                                    comment.user?.name ??
                                                    "?",
                                            ),
                                            boxShadow: `0 0 0 2px ${harbor.card}`,
                                        }}
                                        src={comment.user?.avatar_url}
                                    >
                                        {comment.user?.name
                                            ?.charAt(0)
                                            .toUpperCase()}
                                    </Avatar>

                                    {/* Comment bubble */}
                                    <Box
                                        sx={{
                                            flex: 1,
                                            minWidth: 0,
                                            bgcolor: harbor.countBg,
                                            borderRadius: "12px",
                                            p: "12px 14px",
                                            "&:hover .comment-actions, &:focus-within .comment-actions":
                                                {
                                                    opacity: 1,
                                                },
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
                                    gap: 1.75,
                                    alignItems: "flex-start",
                                    position: "relative",
                                }}
                            >
                                {/* Timeline dot */}
                                <Box
                                    sx={{
                                        width: 9,
                                        height: 9,
                                        borderRadius: "50%",
                                        bgcolor: harbor.cardBorder,
                                        boxShadow: `0 0 0 2px ${harbor.card}`,
                                        mt: "5px",
                                        ml: "8px",
                                        flexShrink: 0,
                                        zIndex: 1,
                                    }}
                                />

                                {/* Activity text */}
                                <Typography
                                    component="div"
                                    sx={{
                                        fontSize: 13,
                                        color: harbor.sub,
                                        lineHeight: 1.5,
                                        "& strong": {
                                            color: harbor.ink,
                                            fontWeight: 700,
                                        },
                                    }}
                                >
                                    <strong>
                                        {activity.user?.name ?? "System"}
                                    </strong>{" "}
                                    {activityDescription(
                                        activity.action,
                                        activity.changes ?? {},
                                    )}
                                    <Box
                                        component="span"
                                        sx={{ color: harbor.faint }}
                                    >
                                        {" "}
                                        · {formatTimestamp(activity.created_at)}
                                    </Box>
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
