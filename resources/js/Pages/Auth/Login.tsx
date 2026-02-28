import GuestLayout from '@/Layouts/GuestLayout';
import { Head, Link, useForm } from '@inertiajs/react';
import { type FormEvent } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import MuiLink from '@mui/material/Link';
import TextField from '@mui/material/TextField';

interface LoginProps {
    status?: string;
    canResetPassword: boolean;
}

export default function Login({ status, canResetPassword }: LoginProps) {
    const { data, setData, post, processing, errors, reset } = useForm({
        email: '',
        password: '',
        remember: false,
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        post(route('login'), {
            onFinish: () => reset('password'),
        });
    };

    return (
        <GuestLayout>
            <Head title="Log In" />

            {status && (
                <Alert severity="success" sx={{ mb: 2 }}>
                    {status}
                </Alert>
            )}

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
                    autoFocus
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
                    autoComplete="current-password"
                    fullWidth
                    margin="normal"
                />

                <FormControlLabel
                    control={
                        <Checkbox
                            name="remember"
                            checked={data.remember}
                            onChange={(e) => setData('remember', e.target.checked)}
                            color="primary"
                        />
                    }
                    label="Remember me"
                    sx={{ mt: 1 }}
                />

                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        mt: 2,
                        gap: 2,
                    }}
                >
                    {canResetPassword && (
                        <MuiLink
                            component={Link}
                            href={route('password.request')}
                            variant="body2"
                            underline="hover"
                        >
                            Forgot your password?
                        </MuiLink>
                    )}

                    <Button
                        type="submit"
                        variant="contained"
                        disabled={processing}
                    >
                        Log in
                    </Button>
                </Box>
            </Box>
        </GuestLayout>
    );
}
