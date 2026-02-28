import type { Activity, Comment, User } from '@/types';
import { router, useForm } from '@inertiajs/react';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { type FormEvent, useState } from 'react';

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
            return `moved from ${changes.from_column ?? '?'} to ${changes.to_column ?? '?'}`;
        case 'assigned':
            return `assigned ${(changes.users as string[])?.join(', ') ?? 'users'}`;
        case 'unassigned':
            return `unassigned ${(changes.users as string[])?.join(', ') ?? 'users'}`;
        case 'labels_changed':
            return 'updated labels';
        case 'commented':
            return 'added a comment';
        case 'field_changed': {
            const fields = Object.keys(changes);
            return `updated ${fields.join(', ')}`;
        }
        default:
            return action;
    }
}

export default function ActivityFeed({
    comments,
    activities,
    teamId,
    boardId,
    taskId,
    currentUserId,
}: Props) {
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editBody, setEditBody] = useState('');

    const { data, setData, post, processing, reset } = useForm({ body: '' });

    // Merge and sort by timestamp
    const feed: FeedItem[] = [
        ...comments.map((c): FeedItem => ({ type: 'comment', item: c, timestamp: c.created_at })),
        ...activities
            .filter((a) => a.action !== 'commented')
            .map((a): FeedItem => ({ type: 'activity', item: a, timestamp: a.created_at })),
    ].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    const handleAddComment = (e: FormEvent) => {
        e.preventDefault();
        if (!data.body.trim()) return;

        post(route('comments.store', [teamId, boardId, taskId]), {
            preserveScroll: true,
            onSuccess: () => reset('body'),
        });
    };

    const handleEditComment = (commentId: string) => {
        router.put(
            route('comments.update', [teamId, boardId, taskId, commentId]),
            { body: editBody },
            {
                preserveScroll: true,
                onSuccess: () => setEditingId(null),
            }
        );
    };

    const handleDeleteComment = (commentId: string) => {
        router.delete(route('comments.destroy', [teamId, boardId, taskId, commentId]), {
            preserveScroll: true,
        });
    };

    return (
        <Box>
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
                                                        onClick={() => handleDeleteComment(comment.id)}
                                                    >
                                                        <DeleteIcon sx={{ fontSize: 14 }} />
                                                    </IconButton>
                                                </Tooltip>
                                            </>
                                        )}
                                    </Box>
                                    {isEditing ? (
                                        <Box sx={{ mt: 0.5 }}>
                                            <TextField
                                                size="small"
                                                fullWidth
                                                multiline
                                                minRows={2}
                                                value={editBody}
                                                onChange={(e) => setEditBody(e.target.value)}
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
                                        <Typography
                                            variant="body2"
                                            sx={{
                                                mt: 0.5,
                                                p: 1.5,
                                                bgcolor: 'action.hover',
                                                borderRadius: 1,
                                                whiteSpace: 'pre-wrap',
                                            }}
                                        >
                                            {comment.body}
                                        </Typography>
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

            <Divider sx={{ my: 2 }} />

            {/* Add comment form */}
            <Box component="form" onSubmit={handleAddComment}>
                <TextField
                    size="small"
                    fullWidth
                    multiline
                    minRows={2}
                    placeholder="Write a comment..."
                    value={data.body}
                    onChange={(e) => setData('body', e.target.value)}
                    disabled={processing}
                />
                <Button
                    type="submit"
                    size="small"
                    variant="contained"
                    disabled={processing || !data.body.trim()}
                    sx={{ mt: 1 }}
                >
                    Comment
                </Button>
            </Box>
        </Box>
    );
}
