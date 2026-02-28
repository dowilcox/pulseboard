import { useForm } from '@inertiajs/react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { FormEventHandler, useRef, useState } from 'react';

export default function DeleteUserForm({
    className,
}: {
    className?: string;
}) {
    const [confirmingUserDeletion, setConfirmingUserDeletion] = useState(false);
    const passwordInput = useRef<HTMLInputElement>(null);

    const {
        data,
        setData,
        delete: destroy,
        processing,
        reset,
        errors,
        clearErrors,
    } = useForm({
        password: '',
    });

    const confirmUserDeletion = () => {
        setConfirmingUserDeletion(true);
    };

    const deleteUser: FormEventHandler = (e) => {
        e.preventDefault();

        destroy(route('profile.destroy'), {
            preserveScroll: true,
            onSuccess: () => closeModal(),
            onError: () => passwordInput.current?.focus(),
            onFinish: () => reset(),
        });
    };

    const closeModal = () => {
        setConfirmingUserDeletion(false);
        clearErrors();
        reset();
    };

    return (
        <Box component="section">
            <Typography variant="h6" component="h2" gutterBottom>
                Delete Account
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Once your account is deleted, all of its resources and data will be
                permanently deleted. Before deleting your account, please download any
                data or information that you wish to retain.
            </Typography>

            <Button
                variant="contained"
                color="error"
                onClick={confirmUserDeletion}
            >
                Delete Account
            </Button>

            <Dialog
                open={confirmingUserDeletion}
                onClose={closeModal}
                maxWidth="sm"
                fullWidth
            >
                <Box component="form" onSubmit={deleteUser}>
                    <DialogTitle>
                        Are you sure you want to delete your account?
                    </DialogTitle>

                    <DialogContent>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                            Once your account is deleted, all of its resources and data
                            will be permanently deleted. Please enter your password to
                            confirm you would like to permanently delete your account.
                        </Typography>

                        <TextField
                            id="delete-password"
                            label="Password"
                            type="password"
                            name="password"
                            value={data.password}
                            onChange={(e) => setData('password', e.target.value)}
                            inputRef={passwordInput}
                            error={!!errors.password}
                            helperText={errors.password}
                            placeholder="Password"
                            autoFocus
                            fullWidth
                            size="small"
                        />
                    </DialogContent>

                    <DialogActions sx={{ px: 3, py: 2 }}>
                        <Button onClick={closeModal}>
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            variant="contained"
                            color="error"
                            disabled={processing}
                        >
                            Delete Account
                        </Button>
                    </DialogActions>
                </Box>
            </Dialog>
        </Box>
    );
}
