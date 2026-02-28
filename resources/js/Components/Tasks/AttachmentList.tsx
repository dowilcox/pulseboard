import type { Attachment } from '@/types';
import { router } from '@inertiajs/react';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DeleteIcon from '@mui/icons-material/Delete';
import DownloadIcon from '@mui/icons-material/Download';
import ImageIcon from '@mui/icons-material/Image';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import axios from 'axios';
import { useCallback, useRef, useState } from 'react';

interface Props {
    attachments: Attachment[];
    teamId: string;
    boardId: string;
    taskId: string;
}

function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImage(mimeType: string): boolean {
    return mimeType.startsWith('image/');
}

export default function AttachmentList({ attachments, teamId, boardId, taskId }: Props) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [dragOver, setDragOver] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<Attachment | null>(null);

    const uploadFiles = useCallback(
        async (files: FileList | File[]) => {
            setUploading(true);
            setUploadProgress(0);
            const fileArray = Array.from(files);
            const totalFiles = fileArray.length;
            let completedFiles = 0;

            for (const file of fileArray) {
                const formData = new FormData();
                formData.append('file', file);

                try {
                    await axios.post(
                        route('attachments.store', [teamId, boardId, taskId]),
                        formData,
                        {
                            headers: { 'Content-Type': 'multipart/form-data' },
                            onUploadProgress: (progressEvent) => {
                                const fileProgress = progressEvent.loaded / (progressEvent.total ?? progressEvent.loaded);
                                const overall = ((completedFiles + fileProgress) / totalFiles) * 100;
                                setUploadProgress(Math.round(overall));
                            },
                        },
                    );
                    completedFiles++;
                } catch {
                    // Continue with remaining files on error
                    completedFiles++;
                }
            }

            setUploading(false);
            setUploadProgress(0);
            router.reload();
        },
        [teamId, boardId, taskId],
    );

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files && files.length > 0) uploadFiles(files);
        e.target.value = '';
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        const files = e.dataTransfer.files;
        if (files.length > 0) uploadFiles(files);
    };

    const handleDownload = (attachment: Attachment) => {
        window.open(
            route('attachments.download', [teamId, boardId, taskId, attachment.id]),
            '_blank',
        );
    };

    const handleDeleteConfirm = () => {
        if (!deleteTarget) return;
        router.delete(
            route('attachments.destroy', [teamId, boardId, taskId, deleteTarget.id]),
            { preserveScroll: true },
        );
        setDeleteTarget(null);
    };

    return (
        <Box>
            {/* Drop zone */}
            <Box
                onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                sx={{
                    border: '2px dashed',
                    borderColor: dragOver ? 'primary.main' : 'divider',
                    borderRadius: 1,
                    p: 2,
                    textAlign: 'center',
                    cursor: 'pointer',
                    bgcolor: dragOver ? 'action.hover' : 'transparent',
                    transition: 'all 0.2s',
                    mb: 1,
                    '&:hover': {
                        borderColor: 'primary.light',
                        bgcolor: 'action.hover',
                    },
                }}
            >
                <CloudUploadIcon sx={{ fontSize: 28, color: 'text.secondary', mb: 0.5 }} />
                <Typography variant="body2" color="text.secondary">
                    Drop files here or click to upload
                </Typography>
                <Typography variant="caption" color="text.disabled">
                    Max 10MB per file
                </Typography>
                <input
                    ref={fileInputRef}
                    type="file"
                    hidden
                    multiple
                    onChange={handleFileSelect}
                />
            </Box>

            {uploading && (
                <LinearProgress
                    variant="determinate"
                    value={uploadProgress}
                    sx={{ mb: 1 }}
                />
            )}

            {/* Attachment list */}
            {attachments.length > 0 && (
                <List dense disablePadding>
                    {attachments.map((attachment) => (
                        <ListItem
                            key={attachment.id}
                            secondaryAction={
                                <Box sx={{ display: 'flex', gap: 0.25 }}>
                                    <Tooltip title="Download">
                                        <IconButton
                                            edge="end"
                                            size="small"
                                            onClick={() => handleDownload(attachment)}
                                            aria-label={`Download ${attachment.filename}`}
                                        >
                                            <DownloadIcon fontSize="small" />
                                        </IconButton>
                                    </Tooltip>
                                    <Tooltip title="Delete">
                                        <IconButton
                                            edge="end"
                                            size="small"
                                            onClick={() => setDeleteTarget(attachment)}
                                            color="error"
                                            aria-label={`Delete ${attachment.filename}`}
                                        >
                                            <DeleteIcon fontSize="small" />
                                        </IconButton>
                                    </Tooltip>
                                </Box>
                            }
                            sx={{ px: 0 }}
                        >
                            <ListItemIcon sx={{ minWidth: 36 }}>
                                {isImage(attachment.mime_type) ? (
                                    <Box
                                        component="img"
                                        src={route('attachments.download', [teamId, boardId, taskId, attachment.id])}
                                        alt={attachment.filename}
                                        sx={{
                                            width: 32,
                                            height: 32,
                                            borderRadius: 0.5,
                                            objectFit: 'cover',
                                        }}
                                        onError={(e) => {
                                            // Fall back to icon on load failure
                                            const target = e.target as HTMLImageElement;
                                            target.style.display = 'none';
                                            target.parentElement?.insertAdjacentHTML(
                                                'beforeend',
                                                '<span style="display:flex"><svg class="MuiSvgIcon-root" viewBox="0 0 24 24" style="width:24px;height:24px;fill:currentColor"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg></span>',
                                            );
                                        }}
                                    />
                                ) : (
                                    <InsertDriveFileIcon sx={{ color: 'text.secondary' }} />
                                )}
                            </ListItemIcon>
                            <ListItemText
                                primary={attachment.filename}
                                secondary={`${formatFileSize(attachment.file_size)} ${attachment.user ? `by ${attachment.user.name}` : ''}`}
                                primaryTypographyProps={{ variant: 'body2', noWrap: true }}
                                secondaryTypographyProps={{ variant: 'caption' }}
                            />
                        </ListItem>
                    ))}
                </List>
            )}

            {attachments.length === 0 && !uploading && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    No attachments yet.
                </Typography>
            )}

            {/* Delete confirmation dialog */}
            <Dialog open={deleteTarget !== null} onClose={() => setDeleteTarget(null)}>
                <DialogTitle>Delete Attachment</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Are you sure you want to delete "{deleteTarget?.filename}"? This action cannot be undone.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
                    <Button onClick={handleDeleteConfirm} color="error" variant="contained">
                        Delete
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
