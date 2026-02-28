import { useForm, usePage } from '@inertiajs/react';
import type { NotificationPreferences, PageProps } from '@/types';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Switch from '@mui/material/Switch';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';

const NOTIFICATION_TYPES = [
    { key: 'task_assigned', label: 'Task Assigned' },
    { key: 'task_commented', label: 'Comment on Task' },
    { key: 'task_mentioned', label: 'Mentioned in Comment' },
    { key: 'task_due_soon', label: 'Task Due Soon' },
    { key: 'task_overdue', label: 'Task Overdue' },
] as const;

type NotificationType = (typeof NOTIFICATION_TYPES)[number]['key'];

const DEFAULT_PREFS: NotificationPreferences = {
    task_assigned: { in_app: true, email: true },
    task_commented: { in_app: true, email: false },
    task_mentioned: { in_app: true, email: true },
    task_due_soon: { in_app: true, email: true },
    task_overdue: { in_app: true, email: true },
};

export default function NotificationPreferencesForm() {
    const { auth } = usePage<PageProps>().props;
    const currentPrefs = auth.user.email_notification_prefs ?? DEFAULT_PREFS;

    const { data, setData, patch, processing } = useForm<{ prefs: NotificationPreferences }>({
        prefs: { ...DEFAULT_PREFS, ...currentPrefs },
    });

    const handleToggle = (type: NotificationType, channel: 'in_app' | 'email') => {
        setData('prefs', {
            ...data.prefs,
            [type]: {
                ...data.prefs[type],
                [channel]: !data.prefs[type]?.[channel],
            },
        });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        patch(route('profile.notifications.update'));
    };

    return (
        <Box>
            <Typography variant="h6" fontWeight={600} gutterBottom>
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
                                            checked={data.prefs[key]?.in_app ?? true}
                                            onChange={() => handleToggle(key, 'in_app')}
                                            size="small"
                                        />
                                    </TableCell>
                                    <TableCell align="center">
                                        <Switch
                                            checked={data.prefs[key]?.email ?? false}
                                            onChange={() => handleToggle(key, 'email')}
                                            size="small"
                                        />
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>

                <Box sx={{ mt: 2 }}>
                    <Button
                        type="submit"
                        variant="contained"
                        disabled={processing}
                        size="small"
                    >
                        Save Preferences
                    </Button>
                </Box>
            </form>
        </Box>
    );
}
