import { PRIORITY_COLORS } from '@/constants/priorities';
import type { Task } from '@/types';
import MergeRequestChip from '@/Components/Gitlab/MergeRequestChip';
import PipelineBadge from '@/Components/Gitlab/PipelineBadge';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import Avatar from '@mui/material/Avatar';
import AvatarGroup from '@mui/material/AvatarGroup';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';

interface Props {
    task: Task;
    onClick?: (task: Task) => void;
}

export default function TaskCard({ task, onClick }: Props) {
    const priorityColor = PRIORITY_COLORS[task.priority] ?? 'transparent';

    return (
        <Paper
            variant="outlined"
            role="button"
            tabIndex={0}
            aria-label={`${task.title}${task.priority !== 'none' ? `, ${task.priority} priority` : ''}`}
            onClick={() => onClick?.(task)}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onClick?.(task);
                }
            }}
            sx={{
                p: 1.5,
                cursor: 'pointer',
                borderLeft: `3px solid ${priorityColor}`,
                transition: 'border-color 150ms ease, background-color 150ms ease',
                '&:hover': {
                    bgcolor: 'action.hover',
                    borderColor: 'action.selected',
                },
                '&:focus-visible': {
                    outline: '2px solid',
                    outlineColor: 'primary.main',
                    outlineOffset: 1,
                },
            }}
        >
            {/* Labels */}
            {task.labels && task.labels.length > 0 && (
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 0.75 }}>
                    {task.labels.map((label) => (
                        <Chip
                            key={label.id}
                            label={label.name}
                            size="small"
                            sx={{
                                height: 18,
                                fontSize: '0.65rem',
                                bgcolor: label.color,
                                color: '#fff',
                            }}
                        />
                    ))}
                </Box>
            )}

            {/* Title */}
            <Typography variant="body2" fontWeight={500} sx={{ mb: 0.75 }}>
                {task.task_number ? `PB-${task.task_number} ` : ''}{task.title}
            </Typography>

            {/* GitLab MR badges */}
            {task.gitlab_links && task.gitlab_links.filter(l => l.link_type === 'merge_request').length > 0 && (
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 0.75 }} onClick={(e) => e.stopPropagation()}>
                    {task.gitlab_links
                        .filter(l => l.link_type === 'merge_request')
                        .map((link) => (
                            <MergeRequestChip key={link.id} link={link} />
                        ))}
                </Box>
            )}

            {/* Footer row: metadata + assignees */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {/* Due date */}
                    {task.due_date && (
                        <Typography variant="caption" color="text.secondary">
                            {new Date(task.due_date).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                            })}
                        </Typography>
                    )}

                    {/* Comment count */}
                    {(task.comments_count ?? 0) > 0 && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                            <ChatBubbleOutlineIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                            <Typography variant="caption" color="text.secondary">
                                {task.comments_count}
                            </Typography>
                        </Box>
                    )}

                    {/* Subtask progress */}
                    {(task.subtasks_count ?? 0) > 0 && (
                        <Typography variant="caption" color="text.secondary">
                            {task.completed_subtasks_count ?? 0}/{task.subtasks_count}
                        </Typography>
                    )}
                </Box>

                {/* Assignee avatars */}
                {task.assignees && task.assignees.length > 0 && (
                    <AvatarGroup
                        max={3}
                        sx={{
                            '& .MuiAvatar-root': { width: 22, height: 22, fontSize: '0.65rem' },
                        }}
                    >
                        {task.assignees.map((user) => (
                            <Avatar key={user.id} alt={user.name} src={user.avatar_url}>
                                {user.name.charAt(0).toUpperCase()}
                            </Avatar>
                        ))}
                    </AvatarGroup>
                )}
            </Box>
        </Paper>
    );
}
