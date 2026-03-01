import { PRIORITY_COLORS } from '@/constants/priorities';
import type { Task } from '@/types';
import MergeRequestChip from '@/Components/Gitlab/MergeRequestChip';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import LockIcon from '@mui/icons-material/Lock';
import SpeedIcon from '@mui/icons-material/Speed';
import Avatar from '@mui/material/Avatar';
import AvatarGroup from '@mui/material/AvatarGroup';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

interface Props {
    task: Task;
    onClick?: (task: Task) => void;
}

export default function TaskCard({ task, onClick }: Props) {
    const priorityColor = PRIORITY_COLORS[task.priority] ?? 'transparent';
    const isCompleted = task.completed_at !== null && task.completed_at !== undefined;
    const isBlocked = (task.blocked_by ?? []).length > 0;
    const checklistProgress = task.checklist_progress;

    return (
        <Paper
            variant="outlined"
            role="button"
            tabIndex={0}
            aria-label={`${task.title}${task.priority !== 'none' ? `, ${task.priority} priority` : ''}${isCompleted ? ', completed' : ''}${isBlocked ? ', blocked' : ''}`}
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
                borderRadius: '8px',
                opacity: isCompleted ? 0.7 : 1,
                transition: 'border-color 150ms ease, background-color 150ms ease',
                display: 'flex',
                flexDirection: 'column',
                gap: 1,
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
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
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

            {/* Task number */}
            {task.task_number && (
                <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1 }}>
                    PB-{task.task_number}
                </Typography>
            )}

            {/* Title + indicators */}
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5 }}>
                {isBlocked && (
                    <Tooltip title="Blocked by dependencies">
                        <LockIcon sx={{ fontSize: 16, color: 'warning.main', mt: 0.25, flexShrink: 0 }} />
                    </Tooltip>
                )}
                {isCompleted && (
                    <Tooltip title="Completed">
                        <CheckCircleOutlineIcon sx={{ fontSize: 16, color: 'success.main', mt: 0.25, flexShrink: 0 }} />
                    </Tooltip>
                )}
                <Typography
                    variant="body2"
                    fontWeight={500}
                    sx={{
                        textDecoration: isCompleted ? 'line-through' : 'none',
                        color: isCompleted ? 'text.disabled' : 'text.primary',
                    }}
                >
                    {task.title}
                </Typography>
            </Box>

            {/* GitLab MR badges */}
            {task.gitlab_links && task.gitlab_links.filter(l => l.link_type === 'merge_request').length > 0 && (
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }} onClick={(e) => e.stopPropagation()}>
                    {task.gitlab_links
                        .filter(l => l.link_type === 'merge_request')
                        .map((link) => (
                            <MergeRequestChip key={link.id} link={link} />
                        ))}
                </Box>
            )}

            {/* Checklist progress bar */}
            {checklistProgress && checklistProgress.total > 0 && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <LinearProgress
                        variant="determinate"
                        value={(checklistProgress.completed / checklistProgress.total) * 100}
                        sx={{ flex: 1, height: 4, borderRadius: 2 }}
                    />
                    <Typography variant="caption" color="text.secondary">
                        {checklistProgress.completed}/{checklistProgress.total}
                    </Typography>
                </Box>
            )}

            {/* Footer row: metadata + assignees (only if there's content) */}
            {(task.due_date || (task.comments_count ?? 0) > 0 || (task.subtasks_count ?? 0) > 0 || (task.effort_estimate != null && task.effort_estimate > 0) || (task.assignees && task.assignees.length > 0)) && (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {task.due_date && (
                            <Typography variant="caption" color="text.secondary">
                                {new Date(task.due_date).toLocaleDateString(undefined, {
                                    month: 'short',
                                    day: 'numeric',
                                })}
                            </Typography>
                        )}
                        {(task.comments_count ?? 0) > 0 && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                                <ChatBubbleOutlineIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                                <Typography variant="caption" color="text.secondary">
                                    {task.comments_count}
                                </Typography>
                            </Box>
                        )}
                        {(task.subtasks_count ?? 0) > 0 && (
                            <Typography variant="caption" color="text.secondary">
                                {task.completed_subtasks_count ?? 0}/{task.subtasks_count}
                            </Typography>
                        )}
                        {task.effort_estimate != null && task.effort_estimate > 0 && (
                            <Tooltip title="Effort estimate">
                                <Chip
                                    icon={<SpeedIcon sx={{ fontSize: '14px !important' }} />}
                                    label={task.effort_estimate}
                                    size="small"
                                    variant="outlined"
                                    sx={{ height: 20, fontSize: '0.65rem', '& .MuiChip-icon': { ml: 0.5 } }}
                                />
                            </Tooltip>
                        )}
                    </Box>
                    {task.assignees && task.assignees.length > 0 && (
                        <AvatarGroup
                            max={3}
                            sx={{
                                '& .MuiAvatar-root': { width: 24, height: 24, fontSize: '0.65rem' },
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
            )}
        </Paper>
    );
}
