import type { Task } from "@/types";
import axios from "axios";
import { router } from "@inertiajs/react";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import DeleteIcon from "@mui/icons-material/Delete";
import MergeTypeIcon from "@mui/icons-material/MergeType";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Link from "@mui/material/Link";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import PipelineBadge from "./PipelineBadge";

interface Props {
    task: Task;
    teamId: string;
    boardId: string;
}

export default function GitlabRefsList({ task, teamId, boardId }: Props) {
    const refs = task.gitlab_refs ?? [];
    const branches = refs.filter((r) => r.ref_type === "branch");
    const mergeRequests = refs.filter((r) => r.ref_type === "merge_request");

    const handleRemoveRef = async (refId: string) => {
        try {
            await axios.delete(
                route("tasks.gitlab.destroy", [
                    teamId,
                    boardId,
                    task.id,
                    refId,
                ]),
            );
            router.reload();
        } catch {
            // Silently fail
        }
    };

    if (refs.length === 0) return null;

    return (
        <Box>
            <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
                GitLab
            </Typography>

            <List dense disablePadding>
                {mergeRequests.map((ref) => (
                    <ListItem
                        key={ref.id}
                        disableGutters
                        secondaryAction={
                            <Tooltip title="Remove">
                                <IconButton
                                    edge="end"
                                    size="small"
                                    onClick={() => handleRemoveRef(ref.id)}
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
                                <Box
                                    sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 1,
                                    }}
                                >
                                    <Link
                                        href={ref.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        variant="body2"
                                        underline="hover"
                                        sx={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 0.5,
                                        }}
                                    >
                                        !{ref.gitlab_iid} {ref.title}
                                        <OpenInNewIcon sx={{ fontSize: 14 }} />
                                    </Link>
                                    <PipelineBadge
                                        status={ref.pipeline_status}
                                    />
                                </Box>
                            }
                            secondary={
                                <Typography
                                    variant="caption"
                                    color="text.secondary"
                                >
                                    {ref.state} · {ref.author}
                                </Typography>
                            }
                        />
                    </ListItem>
                ))}

                {branches.length > 0 && mergeRequests.length > 0 && (
                    <Divider sx={{ my: 0.5 }} />
                )}

                {branches.map((ref) => (
                    <ListItem
                        key={ref.id}
                        disableGutters
                        secondaryAction={
                            <Tooltip title="Remove">
                                <IconButton
                                    edge="end"
                                    size="small"
                                    onClick={() => handleRemoveRef(ref.id)}
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
                                    href={ref.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    variant="body2"
                                    underline="hover"
                                    sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 0.5,
                                    }}
                                >
                                    {ref.gitlab_ref}
                                    <OpenInNewIcon sx={{ fontSize: 14 }} />
                                </Link>
                            }
                        />
                    </ListItem>
                ))}
            </List>
        </Box>
    );
}
