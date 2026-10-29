import { useForm } from "@inertiajs/react";
import type { NotificationPreferences } from "@/types";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Switch from "@mui/material/Switch";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";

const NOTIFICATION_TYPES = [
    { key: "task_assigned", label: "Task Assigned" },
    { key: "task_commented", label: "Comment on Task" },
    { key: "task_comment_replied", label: "Reply to Comment" },
    { key: "task_mentioned", label: "Mentioned in Comment" },
    { key: "task_completed", label: "Task Completed" },
    { key: "task_attachment_added", label: "Attachment Added" },
    { key: "task_due_soon", label: "Task Due Soon" },
    { key: "task_overdue", label: "Task Overdue" },
] as const;

type NotificationType = (typeof NOTIFICATION_TYPES)[number]["key"];

interface Props {
    /** Resolved server-side: saved choices merged over the server defaults. */
    preferences: Required<NotificationPreferences>;
}

export default function NotificationPreferencesForm({ preferences }: Props) {
    const { data, setData, patch, processing, recentlySuccessful } = useForm<{
        prefs: Required<NotificationPreferences>;
    }>({
        prefs: preferences,
    });

    const handleToggle = (
        type: NotificationType,
        channel: "in_app" | "email",
    ) => {
        setData("prefs", {
            ...data.prefs,
            [type]: {
                ...data.prefs[type],
                [channel]: !data.prefs[type][channel],
            },
        });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        patch(route("profile.notifications.update"), {
            preserveScroll: true,
        });
    };

    return (
        <Box>
            <Typography
                variant="h6"
                component="h2"
                fontWeight={600}
                gutterBottom
            >
                Notification Preferences
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Choose which notifications you want to receive and how.
            </Typography>

            <form onSubmit={handleSubmit}>
                <TableContainer>
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell>Notification Type</TableCell>
                                <TableCell align="center">In-App</TableCell>
                                <TableCell align="center">Email</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {NOTIFICATION_TYPES.map(({ key, label }) => (
                                <TableRow key={key}>
                                    <TableCell>{label}</TableCell>
                                    <TableCell align="center">
                                        <Switch
                                            checked={data.prefs[key].in_app}
                                            onChange={() =>
                                                handleToggle(key, "in_app")
                                            }
                                            size="small"
                                            inputProps={{
                                                "aria-label": `${label} in-app notification`,
                                            }}
                                        />
                                    </TableCell>
                                    <TableCell align="center">
                                        <Switch
                                            checked={data.prefs[key].email}
                                            onChange={() =>
                                                handleToggle(key, "email")
                                            }
                                            size="small"
                                            inputProps={{
                                                "aria-label": `${label} email notification`,
                                            }}
                                        />
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>

                <Box
                    sx={{
                        mt: 2,
                        display: "flex",
                        alignItems: "center",
                        gap: 2,
                    }}
                >
                    <Button
                        type="submit"
                        variant="contained"
                        disabled={processing}
                        size="small"
                    >
                        Save Preferences
                    </Button>

                    <Typography
                        variant="body2"
                        color="text.secondary"
                        role="status"
                        aria-live="polite"
                    >
                        {recentlySuccessful ? "Saved." : ""}
                    </Typography>
                </Box>
            </form>
        </Box>
    );
}
