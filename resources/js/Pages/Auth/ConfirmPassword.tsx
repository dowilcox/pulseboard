import GuestLayout from '@/Layouts/GuestLayout';
import { Head, useForm } from '@inertiajs/react';
import { type FormEvent } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

export default function ConfirmPassword() {
    const { data, setData, post, processing, errors, reset } = useForm({
        password: '',
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        post(route('password.confirm'), {
            onFinish: () => reset('password'),
        });
    };

    return (
        <GuestLayout>
            <Head title="Confirm Password" />

            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                This is a secure area of the application. Please confirm your
                password before continuing.
            </Typography>

            <Box component="form" onSubmit={submit} noValidate>
                <TextField
                    id="password"
                    label="Password"
                    type="password"
                    name="password"
                    value={data.password}
                    onChange={(e) => setData('password', e.target.value)}
                    error={!!errors.password}
                    helperText={errors.password}
                    autoFocus
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
                        Confirm
                    </Button>
                </Box>
            </Box>
        </GuestLayout>
    );
}
