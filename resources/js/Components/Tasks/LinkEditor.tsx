import type { TaskLink } from "@/types";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import LinkIcon from "@mui/icons-material/Link";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import MuiLink from "@mui/material/Link";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useRef, useState } from "react";

interface Props {
    links: TaskLink[];
    onChange: (links: TaskLink[]) => void;
}

function normalizeUrl(url: string): string {
    const trimmed = url.trim();
    if (!/^https?:\/\//i.test(trimmed)) {
        return `https://${trimmed}`;
    }
    return trimmed;
}

function isValidUrl(url: string): boolean {
    try {
        const parsed = new URL(url);
        return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
        return false;
    }
}

export default function LinkEditor({ links, onChange }: Props) {
    const [adding, setAdding] = useState(false);
    const [newUrl, setNewUrl] = useState("");
    const [newLabel, setNewLabel] = useState("");
    const [urlError, setUrlError] = useState("");
    const urlRef = useRef<HTMLInputElement>(null);

    const handleAdd = () => {
        const url = normalizeUrl(newUrl);
        if (!isValidUrl(url)) {
            setUrlError("Please enter a valid URL");
            return;
        }

        const link: TaskLink = {
            id: crypto.randomUUID(),
            url,
            label: newLabel.trim() || url,
        };
        onChange([...links, link]);
        setNewUrl("");
        setNewLabel("");
        setUrlError("");
        setAdding(false);
    };

    const handleRemove = (id: string) => {
        onChange(links.filter((l) => l.id !== id));
    };

    return (
        <Box>
            {links.map((link) => (
                <Box
                    key={link.id}
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                        py: 0.5,
                        "&:hover .link-actions": { opacity: 1 },
                    }}
                >
                    <LinkIcon
                        sx={{
                            fontSize: 16,
                            color: "text.secondary",
                            flexShrink: 0,
                        }}
                    />
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                        <MuiLink
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            underline="hover"
                            variant="body2"
                            noWrap
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 0.5,
                            }}
                        >
                            {link.label}
                            <OpenInNewIcon sx={{ fontSize: 12 }} />
                        </MuiLink>
                    </Box>
                    <Tooltip title="Remove link">
                        <IconButton
                            className="link-actions"
                            size="small"
                            onClick={() => handleRemove(link.id)}
                            aria-label={`Remove link ${link.label}`}
                            sx={{ opacity: 0.5, "&:hover": { opacity: 1 } }}
                        >
                            <DeleteIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                    </Tooltip>
                </Box>
            ))}

            {adding ? (
                <Box
                    sx={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 1,
                        mt: 1,
                    }}
                >
                    <TextField
                        inputRef={urlRef}
                        size="small"
                        fullWidth
                        autoFocus
                        label="URL"
                        placeholder="https://example.com"
                        value={newUrl}
                        error={!!urlError}
                        helperText={urlError}
                        onChange={(e) => {
                            setNewUrl(e.target.value);
                            if (urlError) setUrlError("");
                        }}
                        onKeyDown={(e) => {
                            if (e.key === "Escape") {
                                setAdding(false);
                                setNewUrl("");
                                setNewLabel("");
                                setUrlError("");
                            }
                        }}
                        slotProps={{ inputLabel: { shrink: true } }}
                    />
                    <TextField
                        size="small"
                        fullWidth
                        label="Label (optional)"
                        placeholder="Display text"
                        value={newLabel}
                        onChange={(e) => setNewLabel(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                e.preventDefault();
                                handleAdd();
                            }
                            if (e.key === "Escape") {
                                setAdding(false);
                                setNewUrl("");
                                setNewLabel("");
                                setUrlError("");
                            }
                        }}
                        slotProps={{ inputLabel: { shrink: true } }}
                    />
                    <Box
                        sx={{
                            display: "flex",
                            justifyContent: "flex-end",
                            gap: 1,
                        }}
                    >
                        <Button
                            size="small"
                            onClick={() => {
                                setAdding(false);
                                setNewUrl("");
                                setNewLabel("");
                                setUrlError("");
                            }}
                        >
                            Cancel
                        </Button>
                        <Button
                            size="small"
                            variant="contained"
                            onClick={handleAdd}
                            disabled={!newUrl.trim()}
                        >
                            Add
                        </Button>
                    </Box>
                </Box>
            ) : (
                <Button
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={() => {
                        setAdding(true);
                        setTimeout(() => urlRef.current?.focus(), 0);
                    }}
                    sx={{ mt: 0.5, textTransform: "none" }}
                >
                    Add link
                </Button>
            )}

            {links.length === 0 && !adding && (
                <Typography variant="body2" color="text.secondary">
                    No links yet.
                </Typography>
            )}
        </Box>
    );
}
