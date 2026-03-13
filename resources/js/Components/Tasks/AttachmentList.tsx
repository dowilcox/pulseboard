import type { Attachment } from "@/types";
import { router } from "@inertiajs/react";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import DeleteIcon from "@mui/icons-material/Delete";
import DownloadIcon from "@mui/icons-material/Download";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import LinearProgress from "@mui/material/LinearProgress";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Link from "@mui/material/Link";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import axios, { AxiosError } from "axios";
import { useCallback, useRef, useState } from "react";
import Lightbox from "yet-another-react-lightbox";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import Thumbnails from "yet-another-react-lightbox/plugins/thumbnails";
import "yet-another-react-lightbox/styles.css";
import "yet-another-react-lightbox/plugins/thumbnails.css";

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
    return mimeType.startsWith("image/");
}

export default function AttachmentList({
    attachments,
    teamId,
    boardId,
    taskId,
}: Props) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [dragOver, setDragOver] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<Attachment | null>(null);
    const [lightboxIndex, setLightboxIndex] = useState(-1);

    const imageAttachments = attachments.filter((a) => isImage(a.mime_type));
    const fileAttachments = attachments.filter((a) => !isImage(a.mime_type));

    const lightboxSlides = imageAttachments.map((a) => ({
        src: route("attachments.download", [teamId, boardId, taskId, a.id]),
        alt: a.filename,
        title: a.filename,
    }));

    const uploadFiles = useCallback(
        async (files: FileList | File[]) => {
            setUploading(true);
            setUploadProgress(0);
            setUploadError(null);
            const fileArray = Array.from(files);
            const totalFiles = fileArray.length;
            let completedFiles = 0;
            const errors: string[] = [];

            for (const file of fileArray) {
                const formData = new FormData();
                formData.append("file", file);

                try {
                    await axios.post(
                        route("attachments.store", [teamId, boardId, taskId]),
                        formData,
                        {
                            headers: { "Content-Type": "multipart/form-data" },
                            onUploadProgress: (progressEvent) => {
                                const fileProgress =
                                    progressEvent.loaded /
                                    (progressEvent.total ??
                                        progressEvent.loaded);
                                const overall =
                                    ((completedFiles + fileProgress) /
                                        totalFiles) *
                                    100;
                                setUploadProgress(Math.round(overall));
                            },
                        },
                    );
                    completedFiles++;
                } catch (err) {
                    completedFiles++;
                    if (err instanceof AxiosError && err.response) {
                        const data = err.response.data;
                        const validationErrors =
                            data?.errors?.file ??
                            Object.values(data?.errors ?? {}).flat();
                        if (validationErrors.length > 0) {
                            errors.push(
                                `${file.name}: ${(validationErrors as string[]).join(", ")}`,
                            );
                        } else if (err.response.status === 413) {
                            errors.push(
                                `${file.name}: File is too large. Maximum upload size is 10MB.`,
                            );
                        } else {
                            errors.push(
                                `${file.name}: Upload failed (${err.response.status}).`,
                            );
                        }
                    } else {
                        errors.push(
                            `${file.name}: Upload failed. Check your connection and try again.`,
                        );
                    }
                }
            }

            if (errors.length > 0) {
                setUploadError(errors.join("\n"));
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
        e.target.value = "";
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        const files = e.dataTransfer.files;
        if (files.length > 0) uploadFiles(files);
    };

    const handleDownload = (attachment: Attachment) => {
        window.open(
            route("attachments.download", [
                teamId,
                boardId,
                taskId,
                attachment.id,
            ]),
            "_blank",
        );
    };

    const handleDeleteConfirm = () => {
        if (!deleteTarget) return;
        router.delete(
            route("attachments.destroy", [
                teamId,
                boardId,
                taskId,
                deleteTarget.id,
            ]),
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
                    border: "2px dashed",
                    borderColor: dragOver ? "primary.main" : "divider",
                    borderRadius: 1,
                    p: 2,
                    textAlign: "center",
                    cursor: "pointer",
                    bgcolor: dragOver ? "action.hover" : "transparent",
                    transition: "all 0.2s",
                    mb: 1,
                    "&:hover": {
                        borderColor: "primary.light",
                        bgcolor: "action.hover",
                    },
                }}
            >
                <CloudUploadIcon
                    sx={{ fontSize: 28, color: "text.secondary", mb: 0.5 }}
                />
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

            {uploadError && (
                <Alert
                    severity="error"
                    onClose={() => setUploadError(null)}
                    sx={{ mb: 1, whiteSpace: "pre-line" }}
                >
                    {uploadError}
                </Alert>
            )}

            {/* Image gallery */}
            {imageAttachments.length > 0 && (
                <Box sx={{ mb: 2 }}>
                    <Typography
                        variant="caption"
                        color="text.secondary"
                        fontWeight={600}
                        sx={{ mb: 1, display: "block" }}
                    >
                        Images ({imageAttachments.length})
                    </Typography>
                    <Box
                        sx={{
                            display: "grid",
                            gridTemplateColumns:
                                "repeat(auto-fill, minmax(120px, 1fr))",
                            gap: 1,
                        }}
                    >
                        {imageAttachments.map((attachment, index) => (
                            <Box
                                key={attachment.id}
                                sx={{
                                    position: "relative",
                                    aspectRatio: "1",
                                    borderRadius: 1,
                                    overflow: "hidden",
                                    cursor: "pointer",
                                    "&:hover .overlay": { opacity: 1 },
                                }}
                                onClick={() => setLightboxIndex(index)}
                            >
                                <Box
                                    component="img"
                                    src={route("attachments.download", [
                                        teamId,
                                        boardId,
                                        taskId,
                                        attachment.id,
                                    ])}
                                    alt={attachment.filename}
                                    sx={{
                                        width: "100%",
                                        height: "100%",
                                        objectFit: "cover",
                                        display: "block",
                                    }}
                                />
                                <Box
                                    className="overlay"
                                    sx={{
                                        position: "absolute",
                                        inset: 0,
                                        bgcolor: "rgba(0,0,0,0.5)",
                                        opacity: 0,
                                        transition: "opacity 0.2s",
                                        display: "flex",
                                        flexDirection: "column",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        gap: 0.5,
                                    }}
                                >
                                    <Link
                                        href={route("attachments.view", [
                                            teamId,
                                            boardId,
                                            taskId,
                                            attachment.id,
                                        ])}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        underline="hover"
                                        variant="caption"
                                        noWrap
                                        sx={{
                                            px: 1,
                                            maxWidth: "100%",
                                            color: "white",
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        {attachment.filename}
                                    </Link>
                                    <Box sx={{ display: "flex", gap: 0.5 }}>
                                        <Tooltip title="Download">
                                            <IconButton
                                                size="small"
                                                sx={{ color: "white" }}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDownload(attachment);
                                                }}
                                            >
                                                <DownloadIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                        <Tooltip title="Delete">
                                            <IconButton
                                                size="small"
                                                sx={{ color: "white" }}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setDeleteTarget(attachment);
                                                }}
                                            >
                                                <DeleteIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                    </Box>
                                </Box>
                            </Box>
                        ))}
                    </Box>
                </Box>
            )}

            {/* Lightbox */}
            <Lightbox
                open={lightboxIndex >= 0}
                close={() => setLightboxIndex(-1)}
                index={lightboxIndex}
                slides={lightboxSlides}
                plugins={[Zoom, Thumbnails]}
            />

            {/* File list (non-images) */}
            {fileAttachments.length > 0 && (
                <Box>
                    <Typography
                        variant="caption"
                        color="text.secondary"
                        fontWeight={600}
                        sx={{ mb: 0.5, display: "block" }}
                    >
                        Files ({fileAttachments.length})
                    </Typography>
                    <List dense disablePadding>
                        {fileAttachments.map((attachment) => (
                            <ListItem
                                key={attachment.id}
                                secondaryAction={
                                    <Box sx={{ display: "flex", gap: 0.25 }}>
                                        <Tooltip title="Download">
                                            <IconButton
                                                edge="end"
                                                size="small"
                                                onClick={() =>
                                                    handleDownload(attachment)
                                                }
                                                aria-label={`Download ${attachment.filename}`}
                                            >
                                                <DownloadIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                        <Tooltip title="Delete">
                                            <IconButton
                                                edge="end"
                                                size="small"
                                                onClick={() =>
                                                    setDeleteTarget(attachment)
                                                }
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
                                    <InsertDriveFileIcon
                                        sx={{ color: "text.secondary" }}
                                    />
                                </ListItemIcon>
                                <ListItemText
                                    primary={
                                        <Link
                                            href={route("attachments.view", [
                                                teamId,
                                                boardId,
                                                taskId,
                                                attachment.id,
                                            ])}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            underline="hover"
                                            variant="body2"
                                            noWrap
                                            sx={{ display: "block" }}
                                        >
                                            {attachment.filename}
                                        </Link>
                                    }
                                    secondary={`${formatFileSize(attachment.file_size)} ${attachment.user ? `by ${attachment.user.name}` : ""}`}
                                    secondaryTypographyProps={{
                                        variant: "caption",
                                    }}
                                />
                            </ListItem>
                        ))}
                    </List>
                </Box>
            )}

            {attachments.length === 0 && !uploading && (
                <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mt: 0.5 }}
                >
                    No attachments yet.
                </Typography>
            )}

            {/* Delete confirmation dialog */}
            <Dialog
                open={deleteTarget !== null}
                onClose={() => setDeleteTarget(null)}
                aria-labelledby="delete-attachment-dialog-title"
            >
                <DialogTitle id="delete-attachment-dialog-title">
                    Delete Attachment
                </DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Are you sure you want to delete "
                        {deleteTarget?.filename}"? This action cannot be undone.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteTarget(null)}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleDeleteConfirm}
                        color="error"
                        variant="contained"
                    >
                        Delete
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
