import type { Attachment } from '@/types';
import { router } from '@inertiajs/react';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DeleteIcon from '@mui/icons-material/Delete';
import DownloadIcon from '@mui/icons-material/Download';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import ImageIcon from '@mui/icons-material/Image';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
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
    const [dragOver, setDragOver] = useState(false);

    const uploadFile = useCallback(
        (file: File) => {
            setUploading(true);
            router.post(
                route('attachments.store', [teamId, boardId, taskId]),
                { file },
                {
                    forceFormData: true,
                    preserveScroll: true,
                    onFinish: () => setUploading(false),
                }
            );
        },
        [teamId, boardId, taskId]
    );

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) uploadFile(file);
        // Reset so same file can be selected again
        e.target.value = '';
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files[0];
        if (file) uploadFile(file);
    };

    const handleDownload = (attachment: Attachment) => {
        window.open(
            route('attachments.download', [teamId, boardId, taskId, attachment.id]),
            '_blank'
        );
    };

    const handleDelete = (attachment: Attachment) => {
        router.delete(
            route('attachments.destroy', [teamId, boardId, taskId, attachment.id]),
            { preserveScroll: true }
        );
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
                    Drop a file here or click to upload
                </Typography>
                <Typography variant="caption" color="text.disabled">
                    Max 10MB
                </Typography>
                <input
                    ref={fileInputRef}
                    type="file"
                    hidden
                    onChange={handleFileSelect}
                />
            </Box>

            {uploading && <LinearProgress sx={{ mb: 1 }} />}

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
                                        >
                                            <DownloadIcon fontSize="small" />
                                        </IconButton>
                                    </Tooltip>
                                    <Tooltip title="Delete">
                                        <IconButton
                                            edge="end"
                                            size="small"
                                            onClick={() => handleDelete(attachment)}
                                            color="error"
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
                                    <ImageIcon sx={{ color: 'primary.main' }} />
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
        </Box>
    );
}
