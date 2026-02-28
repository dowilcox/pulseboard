import { useForm } from '@inertiajs/react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { FormEventHandler, useRef } from 'react';

export default function UpdatePasswordForm({
    className,
}: {
    className?: string;
}) {
    const passwordInput = useRef<HTMLInputElement>(null);
    const currentPasswordInput = useRef<HTMLInputElement>(null);

    const {
        data,
        setData,
        errors,
        put,
        reset,
        processing,
        recentlySuccessful,
    } = useForm({
        current_password: '',
        password: '',
        password_confirmation: '',
    });

    const updatePassword: FormEventHandler = (e) => {
        e.preventDefault();

        put(route('password.update'), {
            preserveScroll: true,
            onSuccess: () => reset(),
            onError: (errors) => {
                if (errors.password) {
                    reset('password', 'password_confirmation');
                    passwordInput.current?.focus();
                }

                if (errors.current_password) {
                    reset('current_password');
                    currentPasswordInput.current?.focus();
                }
            },
        });
    };

    return (
        <Box component="section" sx={{ maxWidth: 480 }}>
            <Typography variant="h6" component="h2" gutterBottom>
                Update Password
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Ensure your account is using a long, random password to stay secure.
            </Typography>

            <Box component="form" onSubmit={updatePassword} sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <TextField
                    id="current_password"
                    label="Current Password"
                    type="password"
                    value={data.current_password}
                    onChange={(e) => setData('current_password', e.target.value)}
                    inputRef={currentPasswordInput}
                    error={!!errors.current_password}
                    helperText={errors.current_password}
                    autoComplete="current-password"
                    fullWidth
                    size="small"
                />

                <TextField
                    id="password"
                    label="New Password"
                    type="password"
                    value={data.password}
                    onChange={(e) => setData('password', e.target.value)}
                    inputRef={passwordInput}
                    error={!!errors.password}
                    helperText={errors.password}
                    autoComplete="new-password"
                    fullWidth
                    size="small"
                />

                <TextField
                    id="password_confirmation"
                    label="Confirm Password"
                    type="password"
                    value={data.password_confirmation}
                    onChange={(e) => setData('password_confirmation', e.target.value)}
                    error={!!errors.password_confirmation}
                    helperText={errors.password_confirmation}
                    autoComplete="new-password"
                    fullWidth
                    size="small"
                />

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
