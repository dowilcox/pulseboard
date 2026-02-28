import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';

export default function Dashboard() {
    return (
        <AuthenticatedLayout
            header={
                <Typography variant="h6" component="h2" fontWeight={600}>
                    Dashboard
                </Typography>
            }
        >
            <Head title="Dashboard" />

            <Paper elevation={1} sx={{ p: 3 }}>
                <Typography color="text.primary">
                    You're logged in!
                </Typography>
            </Paper>
        </AuthenticatedLayout>
    );
}
