import PageHeader from "@/Components/Layout/PageHeader";
import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import { PageProps } from "@/types";
import { Head } from "@inertiajs/react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";

import AuthProviderInfo from "./Partials/AuthProviderInfo";
import DeleteUserForm from "./Partials/DeleteUserForm";
import NotificationPreferencesForm from "./Partials/NotificationPreferencesForm";
import ThemePreferenceForm from "./Partials/ThemePreferenceForm";
import UpdatePasswordForm from "./Partials/UpdatePasswordForm";
import UpdateProfileInformationForm from "./Partials/UpdateProfileInformationForm";

export default function Edit({
    mustVerifyEmail,
    status,
}: PageProps<{ mustVerifyEmail: boolean; status?: string }>) {
    return (
        <AuthenticatedLayout header={<PageHeader title="Profile" />}>
            <Head title="Profile" />

            <Box
                sx={{
                    maxWidth: "lg",
                    mx: "auto",
                    display: "flex",
                    flexDirection: "column",
                    gap: 3,
                }}
            >
                <Paper variant="outlined" sx={{ p: { xs: 3, sm: 4 } }}>
                    <AuthProviderInfo />
                </Paper>

                <Paper variant="outlined" sx={{ p: { xs: 3, sm: 4 } }}>
                    <UpdateProfileInformationForm
                        mustVerifyEmail={mustVerifyEmail}
                        status={status}
                    />
                </Paper>

                <Paper variant="outlined" sx={{ p: { xs: 3, sm: 4 } }}>
                    <UpdatePasswordForm />
                </Paper>

                <Paper variant="outlined" sx={{ p: { xs: 3, sm: 4 } }}>
                    <ThemePreferenceForm />
                </Paper>

                <Paper variant="outlined" sx={{ p: { xs: 3, sm: 4 } }}>
                    <NotificationPreferencesForm />
                </Paper>

                <Paper variant="outlined" sx={{ p: { xs: 3, sm: 4 } }}>
                    <DeleteUserForm />
                </Paper>
            </Box>
        </AuthenticatedLayout>
    );
}
