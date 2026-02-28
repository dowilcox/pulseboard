import GuestLayout from '@/Layouts/GuestLayout';
import { Head, Link, useForm } from '@inertiajs/react';
import { type FormEvent } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import MuiLink from '@mui/material/Link';
import Typography from '@mui/material/Typography';

interface VerifyEmailProps {
    status?: string;
}

export default function VerifyEmail({ status }: VerifyEmailProps) {
    const { post, processing } = useForm({});

    const submit = (e: FormEvent) => {
        e.preventDefault();
        post(route('verification.send'));
    };

    return (
        <GuestLayout>
            <Head title="Email Verification" />

            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Thanks for signing up! Before getting started, could you verify
                your email address by clicking on the link we just emailed to
                you? If you didn't receive the email, we will gladly send you
                another.
            </Typography>

            {status === 'verification-link-sent' && (
                <Alert severity="success" sx={{ mb: 2 }}>
                    A new verification link has been sent to the email address
                    you provided during registration.
                </Alert>
            )}

            <Box component="form" onSubmit={submit}>
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        mt: 2,
                    }}
                >
                    <Button
                        type="submit"
                        variant="contained"
                        disabled={processing}
                    >
                        Resend Verification Email
                    </Button>

                    <MuiLink
                        component={Link}
                        href={route('logout')}
                        method="post"
                        as="button"
                        variant="body2"
                        underline="hover"
                        sx={{
                            border: 'none',
                            background: 'none',
                            cursor: 'pointer',
                            p: 0,
                        }}
                    >
                        Log Out
                    </MuiLink>
                </Box>
            </Box>
        </GuestLayout>
    );
}
