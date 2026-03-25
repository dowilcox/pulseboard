import { useRef, useState } from "react";
import axios from "axios";
import { router } from "@inertiajs/react";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import DeleteIcon from "@mui/icons-material/Delete";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";

interface Props {
    title: string;
    description: string;
    imageUrl?: string | null;
    altText: string;
    uploadRoute: string;
    deleteRoute: string;
}

export default function ImageUpload({
    title,
    description,
    imageUrl,
    altText,
    uploadRoute,
    deleteRoute,
}: Props) {
    const [uploading, setUploading] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        setError(null);

        const formData = new FormData();
        formData.append("image", file);

        try {
            await axios.post(uploadRoute, formData);
            router.reload();
        } catch (e) {
            if (axios.isAxiosError(e) && e.response) {
                const data = e.response.data;
                setError(
                    data?.message ??
                        data?.errors?.image?.[0] ??
                        "Failed to upload image",
                );
            } else {
                setError("Network error");
            }
        } finally {
            setUploading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        }
    };

    const handleDelete = async () => {
        setDeleting(true);
        setError(null);

        try {
            await axios.delete(deleteRoute);
            router.reload();
        } catch {
            setError("Failed to remove image");
        } finally {
            setDeleting(false);
        }
    };

    return (
        <Card variant="outlined">
            <CardContent>
                <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                    {title}
                </Typography>
                <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: 2 }}
                >
                    {description}
                </Typography>

                {error && (
                    <Alert
                        severity="error"
                        sx={{ mb: 2 }}
                        onClose={() => setError(null)}
                    >
                        {error}
                    </Alert>
                )}

                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 2,
                    }}
                >
                    {imageUrl && (
                        <Box
                            component="img"
                            src={imageUrl}
                            alt={altText}
                            sx={{
                                width: 64,
                                height: 64,
                                borderRadius: "8px",
                                objectFit: "cover",
                                border: 1,
                                borderColor: "divider",
                            }}
                        />
                    )}

                    <Box
                        sx={{
                            display: "flex",
                            gap: 1,
                        }}
                    >
                        <Button
                            variant="outlined"
                            size="small"
                            component="label"
                            startIcon={
                                uploading ? (
                                    <CircularProgress size={14} />
                                ) : (
                                    <CloudUploadIcon />
                                )
                            }
                            disabled={uploading || deleting}
                            sx={{ textTransform: "none" }}
                        >
                            {imageUrl ? "Change Image" : "Upload Image"}
                            <input
                                ref={fileInputRef}
                                type="file"
                                hidden
                                accept="image/*"
                                onChange={handleUpload}
                            />
                        </Button>

                        {imageUrl && (
                            <Button
                                variant="outlined"
                                size="small"
                                color="error"
                                startIcon={
                                    deleting ? (
                                        <CircularProgress size={14} />
                                    ) : (
                                        <DeleteIcon />
                                    )
                                }
                                onClick={handleDelete}
                                disabled={uploading || deleting}
                                sx={{ textTransform: "none" }}
                            >
                                Remove
                            </Button>
                        )}
                    </Box>
                </Box>
            </CardContent>
        </Card>
    );
}
