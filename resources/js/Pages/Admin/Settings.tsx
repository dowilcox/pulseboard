import { Head, useForm } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import AdminNav from '@/Components/Admin/AdminNav';
import type { Organization, PageProps } from '@/types';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

interface Props extends PageProps {
    organization: Organization | null;
}

export default function Settings({ organization }: Props) {
    const form = useForm({
        name: organization?.name ?? '',
        slug: organization?.slug ?? '',
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        form.put(route('admin.settings.update'));
    };

    return (
        <AuthenticatedLayout
            header={
                <Typography variant="h6" component="h2" fontWeight={600}>
                    Organization Settings
                </Typography>
            }
        >
            <Head title="Organization Settings" />

            <Box sx={{ display: 'flex' }}>
                <AdminNav />

                <Box sx={{ flex: 1, maxWidth: 600 }}>
                    <Paper elevation={1} sx={{ p: 3 }}>
                        <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                            Organization Details
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                            Configure your organization name and slug.
                        </Typography>

                        <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <TextField
                                label="Organization Name"
                                value={form.data.name}
                                onChange={(e) => form.setData('name', e.target.value)}
                                error={!!form.errors.name}
                                helperText={form.errors.name}
                                fullWidth
                                required
                            />
                            <TextField
                                label="Slug"
                                value={form.data.slug}
                                onChange={(e) => form.setData('slug', e.target.value)}
                                error={!!form.errors.slug}
                                helperText={form.errors.slug || 'URL-friendly identifier (letters, numbers, dashes)'}
                                fullWidth
                                required
                            />
                            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                                <Button
                                    type="submit"
                                    variant="contained"
                                    disabled={form.processing}
                                >
                                    Save Settings
                                </Button>
                            </Box>
                        </Box>
                    </Paper>
                </Box>
            </Box>
        </AuthenticatedLayout>
    );
}
