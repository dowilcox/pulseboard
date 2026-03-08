import RichTextDisplay from '@/Components/Common/RichTextDisplay';
import RichTextEditor from '@/Components/Common/RichTextEditor';
import type { Activity, Comment, PageProps } from '@/types';
import { router, usePage } from '@inertiajs/react';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import SwapVertIcon from '@mui/icons-material/SwapVert';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useState } from 'react';

type FeedItem =
    | { type: 'comment'; item: Comment; timestamp: string }
    | { type: 'activity'; item: Activity; timestamp: string };

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

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
}

function activityDescription(action: string, changes: Record<string, unknown>): string {
    switch (action) {
        case 'created':
            return 'created this task';
        case 'moved':
            if (changes.auto_moved) {
                return `auto-moved from ${changes.from_column ?? '?'} to ${changes.to_column ?? '?'}`;
            }
            return `moved from ${changes.from_column ?? '?'} to ${changes.to_column ?? '?'}`;
        case 'assigned':
            return `assigned ${(changes.users as string[])?.join(', ') ?? 'users'}`;
        case 'unassigned':
            return `unassigned ${(changes.users as string[])?.join(', ') ?? 'users'}`;
        case 'labels_changed':
            return 'updated labels';
        case 'commented':
            return 'added a comment';
        case 'completed':
            return 'marked this task as complete';
        case 'uncompleted':
            return 'marked this task as incomplete';
        case 'dependency_added':
            return `added a dependency on ${(changes.depends_on_title as string) ?? 'a task'}`;
        case 'dependency_removed':
            return `removed a dependency on ${(changes.depends_on_title as string) ?? 'a task'}`;
        case 'field_changed': {
            const fields = Object.keys(changes);
            return `updated ${fields.join(', ')}`;
        }
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
    const savedSort = auth.user.ui_preferences?.activity_sort_order ?? 'desc';

    const [editingId, setEditingId] = useState<string | null>(null);
    const [editBody, setEditBody] = useState('');
    const [newCommentBody, setNewCommentBody] = useState('');
    const [commentEditorKey, setCommentEditorKey] = useState(0);
    const [submitting, setSubmitting] = useState(false);
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(savedSort);
    const [deleteCommentTarget, setDeleteCommentTarget] = useState<string | null>(null);

    // Merge and sort by timestamp
    const feed: FeedItem[] = [
        ...comments.map((c): FeedItem => ({ type: 'comment', item: c, timestamp: c.created_at })),
        ...activities
            .filter((a) => a.action !== 'commented')
            .map((a): FeedItem => ({ type: 'activity', item: a, timestamp: a.created_at })),
    ].sort((a, b) => {
        const diff = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
        return sortOrder === 'asc' ? diff : -diff;
    });

    const handleToggleSort = () => {
        const newOrder = sortOrder === 'asc' ? 'desc' : 'asc';
        setSortOrder(newOrder);
        router.patch(
            route('profile.ui-preferences.update'),
            { activity_sort_order: newOrder },
            { preserveState: true, preserveScroll: true },
        );
    };

    const handleAddComment = () => {
        if (!newCommentBody.trim() || submitting) return;
        setSubmitting(true);

        router.post(
            route('comments.store', [teamId, boardId, taskId]),
            { body: newCommentBody },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setNewCommentBody('');
                    setCommentEditorKey((k) => k + 1);
                    setSubmitting(false);
                },
                onError: () => setSubmitting(false),
            },
        );
    };

    const handleEditComment = (commentId: string) => {
        router.put(
            route('comments.update', [teamId, boardId, taskId, commentId]),
            { body: editBody },
            {
                preserveScroll: true,
                onSuccess: () => setEditingId(null),
            },
        );
    };

    const handleDeleteComment = () => {
        if (!deleteCommentTarget) return;
        router.delete(route('comments.destroy', [teamId, boardId, taskId, deleteCommentTarget]), {
            preserveScroll: true,
        });
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
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', mb: 1 }}>
                <Tooltip title={sortOrder === 'desc' ? 'Showing newest first' : 'Showing oldest first'}>
                    <IconButton size="small" onClick={handleToggleSort} aria-label={sortOrder === 'desc' ? 'Sort oldest first' : 'Sort newest first'}>
                        <SwapVertIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
                <Typography variant="caption" color="text.secondary">
                    {sortOrder === 'desc' ? 'Newest first' : 'Oldest first'}
                </Typography>
            </Box>

            {/* Empty state */}
            {feed.length === 0 && (
                <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ textAlign: 'center', py: 3 }}
                >
                    No activity yet
                </Typography>
            )}

            {/* Feed items */}
            {feed.map((entry) => {
                if (entry.type === 'comment') {
                    const comment = entry.item;
                    const isOwn = comment.user_id === currentUserId;
                    const isEditing = editingId === comment.id;

                    return (
                        <Box key={`comment-${comment.id}`} sx={{ mb: 2 }}>
                            <Box sx={{ display: 'flex', gap: 1 }}>
                                <Avatar
                                    sx={{ width: 28, height: 28, fontSize: '0.7rem' }}
                                    src={comment.user?.avatar_url}
                                >
                                    {comment.user?.name?.charAt(0).toUpperCase()}
                                </Avatar>
                                <Box sx={{ flex: 1 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Typography variant="body2" fontWeight={600}>
                                            {comment.user?.name}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            {formatTimestamp(comment.created_at)}
                                        </Typography>
                                        {isOwn && !isEditing && (
                                            <>
                                                <Tooltip title="Edit">
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => {
                                                            setEditingId(comment.id);
                                                            setEditBody(comment.body);
                                                        }}
                                                    >
                                                        <EditIcon sx={{ fontSize: 14 }} />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title="Delete">
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => setDeleteCommentTarget(comment.id)}
                                                    >
                                                        <DeleteIcon sx={{ fontSize: 14 }} />
                                                    </IconButton>
                                                </Tooltip>
                                            </>
                                        )}
                                    </Box>
                                    {isEditing ? (
                                        <Box sx={{ mt: 0.5 }}>
                                            <RichTextEditor
                                                content={editBody}
                                                onChange={setEditBody}
                                                placeholder="Edit comment..."
                                                uploadImageUrl={uploadImageUrl}
                                                minHeight={100}
                                            />
                                            <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                                                <Button
                                                    size="small"
                                                    variant="contained"
                                                    onClick={() => handleEditComment(comment.id)}
                                                >
                                                    Save
                                                </Button>
                                                <Button
                                                    size="small"
                                                    onClick={() => setEditingId(null)}
                                                >
                                                    Cancel
                                                </Button>
                                            </Box>
                                        </Box>
                                    ) : (
                                        <Box
                                            sx={{
                                                mt: 0.5,
                                                p: 1.5,
                                                bgcolor: 'action.hover',
                                                borderRadius: 1,
                                            }}
                                        >
                                            {isHtml(comment.body) ? (
                                                <RichTextDisplay content={comment.body} />
                                            ) : (
                                                <Typography
                                                    variant="body2"
                                                    sx={{ whiteSpace: 'pre-wrap' }}
                                                >
                                                    {comment.body}
                                                </Typography>
                                            )}
                                        </Box>
                                    )}
                                </Box>
                            </Box>
                        </Box>
                    );
                }

                // Activity entry
                const activity = entry.item;
                return (
                    <Box
                        key={`activity-${activity.id}`}
                        sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, pl: 4.5 }}
                    >
                        <Typography variant="caption" color="text.secondary">
                            <strong>{activity.user?.name ?? 'System'}</strong>{' '}
                            {activityDescription(activity.action, activity.changes ?? {})}
                            {' \u00b7 '}
                            {formatTimestamp(activity.created_at)}
                        </Typography>
                    </Box>
                );
            })}

            {/* Delete comment confirmation dialog */}
            <Dialog open={deleteCommentTarget !== null} onClose={() => setDeleteCommentTarget(null)} aria-labelledby="delete-comment-dialog-title">
                <DialogTitle id="delete-comment-dialog-title">Delete Comment</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Are you sure you want to delete this comment? This action cannot be undone.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteCommentTarget(null)}>Cancel</Button>
                    <Button onClick={handleDeleteComment} color="error" variant="contained">
                        Delete
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
