import GuestLayout from '@/Layouts/GuestLayout';
import { Head, Link, useForm } from '@inertiajs/react';
import { type FormEvent } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import MuiLink from '@mui/material/Link';
import TextField from '@mui/material/TextField';

export default function Register() {
    const { data, setData, post, processing, errors, reset } = useForm({
        name: '',
        email: '',
        password: '',
        password_confirmation: '',
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        post(route('register'), {
            onFinish: () => reset('password', 'password_confirmation'),
        });
    };

    return (
        <GuestLayout>
            <Head title="Register" />

            <Box component="form" onSubmit={submit} noValidate>
                <TextField
                    id="name"
                    label="Name"
                    name="name"
                    value={data.name}
                    onChange={(e) => setData('name', e.target.value)}
                    error={!!errors.name}
                    helperText={errors.name}
                    autoComplete="name"
                    autoFocus
                    required
                    fullWidth
                    margin="normal"
                />

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
                    required
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
                    required
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
                    required
                    fullWidth
                    margin="normal"
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
                    <MuiLink
                        component={Link}
                        href={route('login')}
                        variant="body2"
                        underline="hover"
                    >
                        Already registered?
                    </MuiLink>

                    <Button
                        type="submit"
                        variant="contained"
                        disabled={processing}
                    >
                        Register
                    </Button>
                </Box>
            </Box>
        </GuestLayout>
    );
}
