import { useState } from 'react';
import type { GitlabProject, Task, TaskGitlabLink } from '@/types';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import MergeTypeIcon from '@mui/icons-material/MergeType';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import FormControl from '@mui/material/FormControl';
import IconButton from '@mui/material/IconButton';
import InputLabel from '@mui/material/InputLabel';
import Link from '@mui/material/Link';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import PipelineBadge from './PipelineBadge';

interface Props {
    task: Task;
    teamId: string;
    boardId: string;
    gitlabProjects: GitlabProject[];
    onLinkCreated?: (link: TaskGitlabLink) => void;
    onLinkRemoved?: (linkId: string) => void;
}

export default function GitlabSection({
    task,
    teamId,
    boardId,
    gitlabProjects,
    onLinkCreated,
    onLinkRemoved,
}: Props) {
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [createType, setCreateType] = useState<'branch' | 'merge_request'>('branch');
    const [selectedProjectId, setSelectedProjectId] = useState<string>(
        gitlabProjects[0]?.id ?? '',
    );
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const links = task.gitlab_links ?? [];
    const branches = links.filter((l) => l.link_type === 'branch');
    const mergeRequests = links.filter((l) => l.link_type === 'merge_request');

    const handleCreate = async () => {
        setCreating(true);
        setError(null);

        const routeName =
            createType === 'branch' ? 'tasks.gitlab.branch' : 'tasks.gitlab.merge-request';

        try {
            const response = await fetch(route(routeName, [teamId, boardId, task.id]), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN':
                        document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')
                            ?.content ?? '',
                    Accept: 'application/json',
                },
                body: JSON.stringify({ gitlab_project_id: selectedProjectId }),
            });

            if (response.ok) {
                const link = await response.json();
                onLinkCreated?.(link);
                setCreateDialogOpen(false);
            } else {
                const data = await response.json();
                setError(data.error ?? 'Failed to create');
            }
        } catch {
            setError('Network error');
        } finally {
            setCreating(false);
        }
    };

    const handleRemoveLink = async (linkId: string) => {
        try {
            const response = await fetch(
                route('tasks.gitlab.destroy', [teamId, boardId, task.id, linkId]),
                {
                    method: 'DELETE',
                    headers: {
                        'X-CSRF-TOKEN':
                            document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')
                                ?.content ?? '',
                        Accept: 'application/json',
                    },
                },
            );
            if (response.ok) {
                onLinkRemoved?.(linkId);
            }
        } catch {
            // Silently fail
        }
    };

    if (gitlabProjects.length === 0) return null;

    return (
        <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="subtitle2" fontWeight={600}>
                    GitLab
                </Typography>
                <Button
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={() => setCreateDialogOpen(true)}
                >
                    Link
                </Button>
            </Box>

            {links.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                    No GitLab links yet
                </Typography>
            ) : (
                <List dense disablePadding>
                    {mergeRequests.map((link) => (
                        <ListItem
                            key={link.id}
                            disableGutters
                            secondaryAction={
                                <Tooltip title="Remove link">
                                    <IconButton
                                        edge="end"
                                        size="small"
                                        onClick={() => handleRemoveLink(link.id)}
                                    >
                                        <DeleteIcon fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                            }
                        >
                            <ListItemIcon sx={{ minWidth: 32 }}>
                                <MergeTypeIcon fontSize="small" color="info" />
                            </ListItemIcon>
                            <ListItemText
                                primary={
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Link
                                            href={link.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            variant="body2"
                                            underline="hover"
                                            sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                                        >
                                            !{link.gitlab_iid} {link.title}
                                            <OpenInNewIcon sx={{ fontSize: 14 }} />
                                        </Link>
                                        <PipelineBadge status={link.pipeline_status} />
                                    </Box>
                                }
                                secondary={
                                    <Typography variant="caption" color="text.secondary">
                                        {link.state} · {link.author}
                                    </Typography>
                                }
                            />
                        </ListItem>
                    ))}

                    {branches.length > 0 && mergeRequests.length > 0 && (
                        <Divider sx={{ my: 0.5 }} />
                    )}

                    {branches.map((link) => (
                        <ListItem
                            key={link.id}
                            disableGutters
                            secondaryAction={
                                <Tooltip title="Remove link">
                                    <IconButton
                                        edge="end"
                                        size="small"
                                        onClick={() => handleRemoveLink(link.id)}
                                    >
                                        <DeleteIcon fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                            }
                        >
                            <ListItemIcon sx={{ minWidth: 32 }}>
                                <AccountTreeIcon fontSize="small" color="action" />
                            </ListItemIcon>
                            <ListItemText
                                primary={
                                    <Link
                                        href={link.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        variant="body2"
                                        underline="hover"
                                        sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                                    >
                                        {link.gitlab_ref}
                                        <OpenInNewIcon sx={{ fontSize: 14 }} />
                                    </Link>
                                }
                            />
                        </ListItem>
                    ))}
                </List>
            )}

            {/* Create Dialog */}
            <Dialog
                open={createDialogOpen}
                onClose={() => setCreateDialogOpen(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>
                    Create GitLab {createType === 'branch' ? 'Branch' : 'Merge Request'}
                </DialogTitle>
                <DialogContent>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                        {error && <Alert severity="error">{error}</Alert>}

                        <FormControl fullWidth>
                            <InputLabel>Type</InputLabel>
                            <Select
                                value={createType}
                                label="Type"
                                onChange={(e) =>
                                    setCreateType(e.target.value as 'branch' | 'merge_request')
                                }
                            >
                                <MenuItem value="branch">Branch</MenuItem>
                                <MenuItem value="merge_request">Merge Request</MenuItem>
                            </Select>
                        </FormControl>

                        {gitlabProjects.length > 1 && (
                            <FormControl fullWidth>
                                <InputLabel>Project</InputLabel>
                                <Select
                                    value={selectedProjectId}
                                    label="Project"
                                    onChange={(e) => setSelectedProjectId(e.target.value)}
                                >
                                    {gitlabProjects.map((project) => (
                                        <MenuItem key={project.id} value={project.id}>
                                            {project.path_with_namespace}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        )}

                        {createType === 'branch' && (
                            <Typography variant="body2" color="text.secondary">
                                Branch name: pb-{task.task_number}-...
                            </Typography>
                        )}

                        {createType === 'merge_request' && (
                            <Typography variant="body2" color="text.secondary">
                                {branches.length > 0
                                    ? `Will use existing branch: ${branches[0].gitlab_ref}`
                                    : 'A new branch will be created automatically'}
                            </Typography>
                        )}
                    </Box>
                </DialogContent>
                <DialogActions sx={{ px: 3, py: 2 }}>
                    <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
                    <Button
                        variant="contained"
                        onClick={handleCreate}
                        disabled={creating || !selectedProjectId}
                        startIcon={creating ? <CircularProgress size={16} /> : undefined}
                    >
                        Create
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
