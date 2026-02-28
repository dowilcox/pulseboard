import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

interface EmptyStateProps {
    icon?: ReactNode;
    title: string;
    description?: string;
    action?: ReactNode;
}

export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                py: 8,
                px: 4,
                textAlign: 'center',
            }}
        >
            {icon && (
                <Box sx={{ color: 'text.disabled', mb: 2, '& .MuiSvgIcon-root': { fontSize: 48 } }}>
                    {icon}
                </Box>
            )}
            <Typography variant="h6" color="text.secondary" gutterBottom>
                {title}
            </Typography>
            {description && (
                <Typography variant="body2" color="text.disabled" sx={{ maxWidth: 400, mb: action ? 3 : 0 }}>
                    {description}
                </Typography>
            )}
            {action}
        </Box>
    );
}
