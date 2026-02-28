import { Link, useForm, usePage } from '@inertiajs/react';
import type { PageProps } from '@/types';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { FormEventHandler } from 'react';

export default function UpdateProfileInformationForm({
    mustVerifyEmail,
    status,
    className,
}: {
    mustVerifyEmail: boolean;
    status?: string;
    className?: string;
}) {
    const { auth } = usePage<PageProps>().props;
    const user = auth.user;

    const { data, setData, patch, errors, processing, recentlySuccessful } =
        useForm({
            name: user.name,
            email: user.email,
        });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        patch(route('profile.update'));
    };

    return (
        <Box component="section" sx={{ maxWidth: 480 }}>
            <Typography variant="h6" component="h2" gutterBottom>
                Profile Information
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Update your account's profile information and email address.
            </Typography>

            <Box component="form" onSubmit={submit} sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <TextField
                    id="name"
                    label="Name"
                    value={data.name}
                    onChange={(e) => setData('name', e.target.value)}
                    error={!!errors.name}
                    helperText={errors.name}
                    required
                    autoFocus
                    autoComplete="name"
                    fullWidth
                    size="small"
                />

                <TextField
                    id="email"
                    label="Email"
                    type="email"
                    value={data.email}
                    onChange={(e) => setData('email', e.target.value)}
                    error={!!errors.email}
                    helperText={errors.email}
                    required
                    autoComplete="username"
                    fullWidth
                    size="small"
                />

                {mustVerifyEmail && user.email_verified_at === null && (
                    <Box>
                        <Typography variant="body2" color="text.primary">
                            Your email address is unverified.{' '}
                            <Link
                                href={route('verification.send')}
                                method="post"
                                as="button"
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    padding: 0,
                                    cursor: 'pointer',
                                    textDecoration: 'underline',
                                    font: 'inherit',
                                    color: 'inherit',
                                }}
                            >
                                Click here to re-send the verification email.
                            </Link>
                        </Typography>

                        {status === 'verification-link-sent' && (
                            <Alert severity="success" sx={{ mt: 2 }}>
                                A new verification link has been sent to your email address.
                            </Alert>
                        )}
                    </Box>
                )}

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Button
                        type="submit"
                        variant="contained"
                        disabled={processing}
                    >
                        Save
                    </Button>

                    {recentlySuccessful && (
                        <Typography variant="body2" color="text.secondary">
                            Saved.
                        </Typography>
                    )}
                </Box>
            </Box>
        </Box>
    );
}
