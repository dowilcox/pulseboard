import GuestLayout from '@/Layouts/GuestLayout';
import { Head, useForm } from '@inertiajs/react';
import { type FormEvent } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';

interface ResetPasswordProps {
    token: string;
    email: string;
}

export default function ResetPassword({ token, email }: ResetPasswordProps) {
    const { data, setData, post, processing, errors, reset } = useForm({
        token,
        email,
        password: '',
        password_confirmation: '',
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        post(route('password.store'), {
            onFinish: () => reset('password', 'password_confirmation'),
        });
    };

    return (
        <GuestLayout>
            <Head title="Reset Password" />

            <Box component="form" onSubmit={submit} noValidate>
                <TextField
                    id="email"
                    label="Email"
                    type="email"
                    name="email"
                    value={data.email}
                    onChange={(e) => setData('email', e.target.value)}
                    error={!!errors.email}
                    helperText={errors.email}
                    autoComplete="username"
                    fullWidth
                    margin="normal"
                />

                <TextField
                    id="password"
                    label="Password"
                    type="password"
                    name="password"
                    value={data.password}
                    onChange={(e) => setData('password', e.target.value)}
                    error={!!errors.password}
                    helperText={errors.password}
                    autoComplete="new-password"
                    autoFocus
                    fullWidth
                    margin="normal"
                />

                <TextField
                    id="password_confirmation"
                    label="Confirm Password"
                    type="password"
                    name="password_confirmation"
                    value={data.password_confirmation}
                    onChange={(e) => setData('password_confirmation', e.target.value)}
                    error={!!errors.password_confirmation}
                    helperText={errors.password_confirmation}
                    autoComplete="new-password"
                    fullWidth
                    margin="normal"
                />

                <Box
                    sx={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        mt: 2,
                    }}
                >
                    <Button
                        type="submit"
                        variant="contained"
                        disabled={processing}
                    >
                        Reset Password
                    </Button>
                </Box>
            </Box>
        </GuestLayout>
    );
}
