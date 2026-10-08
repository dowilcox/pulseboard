import ConfirmDeleteDialog from "@/Components/Common/ConfirmDeleteDialog";
import type { Team } from "@/types";
import { router } from "@inertiajs/react";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import Button from "@mui/material/Button";
import { useState } from "react";
import SectionCard from "./SectionCard";

/** Owner-only destructive actions (Danger zone tab of team settings). */
export default function DangerZoneSection({ team }: { team: Team }) {
    const [open, setOpen] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const handleDelete = () => {
        router.delete(route("teams.destroy", team.slug), {
            data: { confirmation: "DELETE" },
            onStart: () => setDeleting(true),
            onFinish: () => setDeleting(false),
        });
    };

    return (
        <>
            <SectionCard
                tone="danger"
                title="Delete team"
                description="Permanently delete this team with all of its boards (including archived ones), tasks, comments, attachments and integrations. This can't be undone."
                action={
                    <Button
                        variant="outlined"
                        color="error"
                        startIcon={<DeleteOutlineIcon />}
                        onClick={() => setOpen(true)}
                    >
                        Delete team
                    </Button>
                }
            />
            <ConfirmDeleteDialog
                open={open}
                onClose={() => setOpen(false)}
                onConfirm={handleDelete}
                title="Delete team"
                description="This will permanently delete this team and all its boards, tasks, comments, attachments, and integrations."
                itemName={team.name}
                processing={deleting}
            />
        </>
    );
}
