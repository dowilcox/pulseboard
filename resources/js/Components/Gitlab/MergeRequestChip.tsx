import Chip from "@mui/material/Chip";
import MergeIcon from "@mui/icons-material/MergeType";
import type { TaskGitlabRef } from "@/types";

interface Props {
    gitlabRef: TaskGitlabRef;
}

const stateColors: Record<string, "success" | "error" | "info" | "default"> = {
    opened: "info",
    merged: "success",
    closed: "error",
};

export default function MergeRequestChip({ gitlabRef }: Props) {
    const color = stateColors[gitlabRef.state ?? ""] ?? "default";

    return (
        <Chip
            icon={<MergeIcon />}
            label={`!${gitlabRef.gitlab_iid}`}
            color={color}
            size="small"
            variant="outlined"
            component="a"
            href={gitlabRef.url}
            target="_blank"
            rel="noopener noreferrer"
            clickable
            sx={{ height: 24, fontSize: "0.75rem" }}
        />
    );
}
