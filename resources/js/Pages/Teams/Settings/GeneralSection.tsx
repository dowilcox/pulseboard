import { useSnackbar } from "@/Contexts/SnackbarContext";
import { harborAvatarColor } from "@/theme/harbor";
import type { Team } from "@/types";
import { router, useForm } from "@inertiajs/react";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import Alert from "@mui/material/Alert";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import axios from "axios";
import { type FormEvent, useRef, useState } from "react";
import SectionCard from "./SectionCard";

export interface ImageUploadRules {
    /** Human-readable size limit, e.g. "2MB". */
    maxSize: string;
    /** Allowed file extensions, e.g. ["jpg", "png"]. */
    types: string[];
}

interface Props {
    team: Team;
    canUpdate: boolean;
    imageUpload: ImageUploadRules;
}

const NAME_MAX = 255;
const DESCRIPTION_MAX = 1000;

export default function GeneralSection({
    team,
    canUpdate,
    imageUpload,
}: Props) {
    return (
        <Stack spacing={3}>
            {canUpdate ? (
                <TeamDetailsForm team={team} />
            ) : (
                <SectionCard title="Team details">
                    <Box
                        component="dl"
                        sx={{
                            m: 0,
                            display: "grid",
                            gridTemplateColumns: { xs: "1fr", sm: "140px 1fr" },
                            rowGap: { xs: 0.5, sm: 1.5 },
                            columnGap: 2,
                            "& dt": {
                                color: "text.secondary",
                                fontWeight: 600,
                                fontSize: "0.875rem",
                            },
                            "& dd": { m: 0, mb: { xs: 1.5, sm: 0 } },
                        }}
                    >
                        <dt>Name</dt>
                        <dd>{team.name}</dd>
                        <dt>Description</dt>
                        <dd>
                            {team.description || (
                                <Box
                                    component="span"
                                    sx={{ color: "text.secondary" }}
                                >
                                    No description
                                </Box>
                            )}
                        </dd>
                    </Box>
                </SectionCard>
            )}

            <TeamImage
                team={team}
                canUpdate={canUpdate}
                imageUpload={imageUpload}
            />
        </Stack>
    );
}

function TeamDetailsForm({ team }: { team: Team }) {
    const form = useForm({
        name: team.name,
        description: team.description ?? "",
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        form.put(route("teams.update", team.slug), {
            preserveScroll: true,
            onSuccess: () => form.setDefaults(),
        });
    };

    return (
        <SectionCard
            title="Team details"
            description="The name and description appear on the team page and in team lists."
        >
            <Box component="form" onSubmit={submit} noValidate>
                <Stack spacing={2.5}>
                    <TextField
                        label="Team name"
                        required
                        fullWidth
                        value={form.data.name}
                        onChange={(e) => form.setData("name", e.target.value)}
                        error={!!form.errors.name}
                        helperText={
                            form.errors.name ??
                            "Renaming the team also changes its web address."
                        }
                        slotProps={{ htmlInput: { maxLength: NAME_MAX } }}
                    />
                    <TextField
                        label="Description"
                        fullWidth
                        multiline
                        minRows={3}
                        value={form.data.description}
                        onChange={(e) =>
                            form.setData("description", e.target.value)
                        }
                        error={!!form.errors.description}
                        helperText={
                            form.errors.description ??
                            `${form.data.description.length}/${DESCRIPTION_MAX}`
                        }
                        slotProps={{
                            htmlInput: { maxLength: DESCRIPTION_MAX },
                        }}
                    />
                    <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                        <Button
                            type="submit"
                            variant="contained"
                            disabled={!form.isDirty || form.processing}
                        >
                            {form.processing ? "Saving…" : "Save changes"}
                        </Button>
                        {form.isDirty && (
                            <Button
                                onClick={() => {
                                    form.reset();
                                    form.clearErrors();
                                }}
                                disabled={form.processing}
                            >
                                Discard changes
                            </Button>
                        )}
                    </Box>
                </Stack>
            </Box>
        </SectionCard>
    );
}

function TeamImage({
    team,
    canUpdate,
    imageUpload,
}: {
    team: Team;
    canUpdate: boolean;
    imageUpload: ImageUploadRules;
}) {
    const { showSnackbar } = useSnackbar();
    const [uploading, setUploading] = useState(false);
    const [removing, setRemoving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const busy = uploading || removing;

    const typeList = imageUpload.types.map((t) => t.toUpperCase()).join(", ");

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        setError(null);
        const formData = new FormData();
        formData.append("image", file);

        try {
            await axios.post(route("teams.upload-image", team.slug), formData);
            router.reload();
            showSnackbar("Team image updated.", "success");
        } catch (err) {
            if (axios.isAxiosError(err) && err.response) {
                const data = err.response.data;
                setError(
                    data?.errors?.image?.[0] ??
                        data?.message ??
                        "The image could not be uploaded.",
                );
            } else {
                setError("Network error. Please try again.");
            }
        } finally {
            setUploading(false);
            if (inputRef.current) inputRef.current.value = "";
        }
    };

    const handleRemove = async () => {
        setRemoving(true);
        setError(null);
        try {
            await axios.delete(route("teams.delete-image", team.slug));
            router.reload();
            showSnackbar("Team image removed.", "success");
        } catch {
            setError("The image could not be removed. Please try again.");
        } finally {
            setRemoving(false);
        }
    };

    return (
        <SectionCard
            title="Team image"
            description="Shown next to the team name in the sidebar and in team lists. Without an image, the team's initial is used."
        >
            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 2,
                    flexWrap: "wrap",
                }}
            >
                <Avatar
                    src={team.image_url ?? undefined}
                    alt=""
                    variant="rounded"
                    sx={{
                        width: 64,
                        height: 64,
                        fontSize: "1.5rem",
                        fontWeight: 700,
                        bgcolor: harborAvatarColor(team.name),
                        color: "#fff",
                    }}
                >
                    {team.name.charAt(0).toUpperCase()}
                </Avatar>
                <Box sx={{ minWidth: 0, flex: "1 1 220px" }}>
                    <Typography variant="body2" color="text.secondary">
                        Square images work best (at least 128 × 128 px).{" "}
                        {typeList}, up to {imageUpload.maxSize}.
                    </Typography>
                    {canUpdate && (
                        <Box
                            sx={{
                                display: "flex",
                                gap: 1,
                                flexWrap: "wrap",
                                mt: 1.5,
                            }}
                        >
                            <Button
                                variant="outlined"
                                size="small"
                                component="label"
                                disabled={busy}
                                startIcon={
                                    uploading ? (
                                        <CircularProgress size={14} />
                                    ) : (
                                        <CloudUploadIcon />
                                    )
                                }
                            >
                                {team.image_url
                                    ? "Change image"
                                    : "Upload image"}
                                <input
                                    ref={inputRef}
                                    type="file"
                                    hidden
                                    accept={imageUpload.types
                                        .map((t) => `.${t}`)
                                        .join(",")}
                                    onChange={handleUpload}
                                />
                            </Button>
                            {team.image_url && (
                                <Button
                                    size="small"
                                    color="error"
                                    onClick={handleRemove}
                                    disabled={busy}
                                    startIcon={
                                        removing ? (
                                            <CircularProgress size={14} />
                                        ) : (
                                            <DeleteOutlineIcon />
                                        )
                                    }
                                >
                                    Remove image
                                </Button>
                            )}
                        </Box>
                    )}
                </Box>
            </Box>
            {error && (
                <Alert
                    severity="error"
                    sx={{ mt: 2 }}
                    onClose={() => setError(null)}
                >
                    {error}
                </Alert>
            )}
        </SectionCard>
    );
}
