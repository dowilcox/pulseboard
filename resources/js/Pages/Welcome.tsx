import { Head, Link } from '@inertiajs/react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';

interface WelcomeProps {
    canLogin: boolean;
    canRegister: boolean;
}

export default function Welcome({ canLogin, canRegister }: WelcomeProps) {
    return (
        <>
            <Head title="Welcome" />

            <Box
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: '100vh',
                    bgcolor: 'background.default',
                    px: 2,
                }}
            >
                <Typography
                    variant="h2"
                    component="h1"
                    sx={{
                        color: 'primary.main',
                        fontWeight: 800,
                        letterSpacing: '-0.03em',
                        mb: 2,
                    }}
                >
                    PulseBoard
                </Typography>

                <Typography
                    variant="h6"
                    component="p"
                    sx={{
                        color: 'text.secondary',
                        fontWeight: 400,
                        mb: 4,
                        textAlign: 'center',
                        maxWidth: 480,
                    }}
                >
                    A modern project management tool for teams that move fast.
                </Typography>

                <Box sx={{ display: 'flex', gap: 2 }}>
                    {canLogin && (
                        <Button
                            component={Link}
                            href={route('login')}
                            variant="contained"
                            size="large"
                        >
                            Log in
                        </Button>
                    )}

                    {canRegister && (
                        <Button
                            component={Link}
                            href={route('register')}
                            variant="outlined"
                            size="large"
                        >
                            Register
                        </Button>
                    )}
                </Box>
            </Box>
        </>
    );
}
