import { Link } from '@inertiajs/react';
import { type PropsWithChildren } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';

export default function GuestLayout({ children }: PropsWithChildren) {
    return (
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
            <Box sx={{ mb: 4 }}>
                <Link href="/" style={{ textDecoration: 'none' }}>
                    <Typography
                        variant="h4"
                        component="span"
                        sx={{
                            color: 'primary.main',
                            fontWeight: 700,
                            letterSpacing: '-0.02em',
                        }}
                    >
                        PulseBoard
                    </Typography>
                </Link>
            </Box>

            <Paper
                elevation={3}
                sx={{
                    width: '100%',
                    maxWidth: 448,
                    px: 4,
                    py: 3,
                    borderRadius: 2,
                }}
            >
                {children}
            </Paper>
        </Box>
    );
}
