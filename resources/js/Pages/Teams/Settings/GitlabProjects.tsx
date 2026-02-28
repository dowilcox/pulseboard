import { Head, router } from '@inertiajs/react';
import { useState } from 'react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import GitlabProjectSearch from '@/Components/Gitlab/GitlabProjectSearch';
import type { GitlabConnection, GitlabProject, PageProps, Team } from '@/types';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import LinkIcon from '@mui/icons-material/Link';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControl from '@mui/material/FormControl';
import IconButton from '@mui/material/IconButton';
import InputLabel from '@mui/material/InputLabel';
import Link from '@mui/material/Link';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

interface Props extends PageProps {
    team: Team;
    gitlabProjects: (GitlabProject & { connection: GitlabConnection })[];
    connections: Pick<GitlabConnection, 'id' | 'name' | 'base_url'>[];
}

export default function GitlabProjects({ team, gitlabProjects, connections }: Props) {
    const [linkDialogOpen, setLinkDialogOpen] = useState(false);
    const [selectedConnectionId, setSelectedConnectionId] = useState<string>(
        connections[0]?.id ?? '',
    );
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

    const handleLinkProject = (project: { id: number }) => {
        router.post(
            route('teams.gitlab-projects.store', team.id),
            {
                connection_id: selectedConnectionId,
                gitlab_project_id: project.id,
            },
            {
                onSuccess: () => setLinkDialogOpen(false),
            },
        );
    };

    const handleUnlink = (id: string) => {
        router.delete(route('teams.gitlab-projects.destroy', [team.id, id]), {
            onSuccess: () => setDeleteConfirmId(null),
        });
    };

    return (
        <AuthenticatedLayout
            header={
                <Typography variant="h6" component="h2" fontWeight={600}>
                    {team.name} — GitLab Projects
                </Typography>
            }
        >
            <Head title={`${team.name} — GitLab Projects`} />

            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => setLinkDialogOpen(true)}
                    disabled={connections.length === 0}
                >
                    Link Project
                </Button>
            </Box>

            {connections.length === 0 && (
                <Alert severity="info" sx={{ mb: 2 }}>
                    No active GitLab connections available. Ask an administrator to add one.
                </Alert>
            )}

            {gitlabProjects.length === 0 ? (
                <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
                    <Typography color="text.secondary">
                        No GitLab projects linked to this team yet.
                    </Typography>
                </Paper>
            ) : (
                <Paper variant="outlined">
                    <List>
                        {gitlabProjects.map((project, index) => (
                            <ListItem
                                key={project.id}
                                divider={index < gitlabProjects.length - 1}
                                secondaryAction={
                                    <Tooltip title="Unlink project">
                                        <IconButton
                                            edge="end"
                                            color="error"
                                            onClick={() => setDeleteConfirmId(project.id)}
                                        >
                                            <DeleteIcon />
                                        </IconButton>
                                    </Tooltip>
                                }
                            >
                                <ListItemText
                                    primary={
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <LinkIcon fontSize="small" color="action" />
                                            <Link
                                                href={project.web_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                underline="hover"
                                                fontWeight={500}
                                            >
                                                {project.path_with_namespace}
                                            </Link>
                                            <Chip
                                                label={project.connection.name}
                                                size="small"
                                                variant="outlined"
                                            />
                                        </Box>
                                    }
                                    secondary={
                                        <Typography variant="caption" color="text.secondary">
                                            Default branch: {project.default_branch}
                                            {project.last_synced_at && (
                                                <> · Last synced: {new Date(project.last_synced_at).toLocaleString()}</>
                                            )}
                                        </Typography>
                                    }
                                />
                            </ListItem>
                        ))}
                    </List>
                </Paper>
            )}

            {/* Link Project Dialog */}
            <Dialog
                open={linkDialogOpen}
                onClose={() => setLinkDialogOpen(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>Link GitLab Project</DialogTitle>
                <DialogContent>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                        {connections.length > 1 && (
                            <FormControl fullWidth>
                                <InputLabel>Connection</InputLabel>
                                <Select
                                    value={selectedConnectionId}
                                    label="Connection"
                                    onChange={(e) => setSelectedConnectionId(e.target.value)}
                                >
                                    {connections.map((conn) => (
                                        <MenuItem key={conn.id} value={conn.id}>
                                            {conn.name} ({conn.base_url})
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        )}
                        {selectedConnectionId && (
                            <GitlabProjectSearch
                                connectionId={selectedConnectionId}
                                teamId={team.id}
                                onSelect={handleLinkProject}
                            />
                        )}
                    </Box>
                </DialogContent>
                <DialogActions sx={{ px: 3, py: 2 }}>
                    <Button onClick={() => setLinkDialogOpen(false)}>Cancel</Button>
                </DialogActions>
            </Dialog>

            {/* Unlink Confirmation Dialog */}
            <Dialog open={!!deleteConfirmId} onClose={() => setDeleteConfirmId(null)}>
                <DialogTitle>Unlink Project</DialogTitle>
                <DialogContent>
                    <Alert severity="warning" sx={{ mt: 1 }}>
                        This will remove the project link and all associated task GitLab links. The
                        webhook will be removed from GitLab.
                    </Alert>
                </DialogContent>
                <DialogActions sx={{ px: 3, py: 2 }}>
                    <Button onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
                    <Button
                        variant="contained"
                        color="error"
                        onClick={() => deleteConfirmId && handleUnlink(deleteConfirmId)}
                    >
                        Unlink
                    </Button>
                </DialogActions>
            </Dialog>
        </AuthenticatedLayout>
    );
}
