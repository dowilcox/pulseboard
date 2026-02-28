import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageProps } from '@/types';
import { Head } from '@inertiajs/react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import AuthProviderInfo from './Partials/AuthProviderInfo';
import DeleteUserForm from './Partials/DeleteUserForm';
import NotificationPreferencesForm from './Partials/NotificationPreferencesForm';
import ThemePreferenceForm from './Partials/ThemePreferenceForm';
import UpdatePasswordForm from './Partials/UpdatePasswordForm';
import UpdateProfileInformationForm from './Partials/UpdateProfileInformationForm';

export default function Edit({
    mustVerifyEmail,
    status,
}: PageProps<{ mustVerifyEmail: boolean; status?: string }>) {
    return (
        <AuthenticatedLayout
            header={
                <Typography variant="h6" component="h2" fontWeight={600}>
                    Profile
                </Typography>
            }
        >
            <Head title="Profile" />

            <Box sx={{ maxWidth: 'lg', mx: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
                <Paper elevation={1} sx={{ p: { xs: 3, sm: 4 } }}>
                    <AuthProviderInfo />
                </Paper>

                <Paper elevation={1} sx={{ p: { xs: 3, sm: 4 } }}>
                    <UpdateProfileInformationForm
                        mustVerifyEmail={mustVerifyEmail}
                        status={status}
                    />
                </Paper>

                <Paper elevation={1} sx={{ p: { xs: 3, sm: 4 } }}>
                    <UpdatePasswordForm />
                </Paper>

                <Paper elevation={1} sx={{ p: { xs: 3, sm: 4 } }}>
                    <ThemePreferenceForm />
                </Paper>

                <Paper elevation={1} sx={{ p: { xs: 3, sm: 4 } }}>
                    <NotificationPreferencesForm />
                </Paper>

                <Paper elevation={1} sx={{ p: { xs: 3, sm: 4 } }}>
                    <DeleteUserForm />
                </Paper>
            </Box>
        </AuthenticatedLayout>
    );
}
